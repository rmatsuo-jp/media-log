# ARCHITECTURE.md — Media Log アーキテクチャ

## 1. レイヤ構成（共通パターン）

コードベースは3層の一方向依存で構成される。**すべての機能追加はこのパターンの繰り返し**であり、
新しい拡張機能（feature）は `features/` にフォルダを1つ追加し、core のサービスを inject するだけでよい。

```
features/ ──▶ core/ ──▶ shared/
（拡張機能）  （基盤）   （汎用util）
```

- **features/** … 遅延ロードされるページ単位の拡張機能。ページ専用の service / util / guard は同じフォルダに同居する。feature 間の依存は禁止。
- **core/** … 全 feature が共有する基盤（設定・Firebase・作品/記録データモデルと永続化）。feature を import してはならない。
- **shared/** … アプリのドメインに依存しない汎用ユーティリティ（日付・クリップボード・localStorage等）とUIコンポーネント（badge/card/icon/modal/progress-bar/spinner）。

```mermaid
graph TD
    subgraph Features["features/（遅延ロード。1フォルダ = 1拡張機能）"]
        Works["works\n作品一覧・詳細（Group/Unit管理）\n(+ works-state.service)"]
        Settings["settings\nテーマ・法的情報導線・アカウント\n(+ account-panel)"]
        Legal["legal\n利用規約・プライバシーポリシー等の表示"]
        Dev["dev（本番非搭載）\nlocalStorage生データダンプ"]
    end

    subgraph Core["core/（基盤。providedIn: root）"]
        Models["models\nWork/Group/Unit型定義"]
        Media["media\nMediaRepositoryService\n（ローカル+クラウド永続化）"]
        SettingsStore["settings\nSettingsStoreService（theme）"]
        Firebase["firebase\nAuthService / firebase.init"]
    end

    Shared["shared/utils\ndate / clipboard / local-storage\nshared/ui\nbadge / card / icon / modal / progress-bar / spinner"]

    Features --> Core --> Shared

    Media --- LocalStorage[("LocalStorage")]
    Media --- Firestore[("Cloud Firestore")]
    Firebase --- FirebaseAuth["Firebase Authentication"]
```

### レイヤ境界の機械強制

`features → core → shared` の一方向依存および feature 間 import 禁止は、`eslint-plugin-boundaries`
（`eslint.config.js`）により `npm run lint` 時に機械的に検証される。パスエイリアス（`@core/*` /
`@shared/*` / `@features/*`）の解決には `eslint-import-resolver-typescript` を使う。

### 変更検知

全コンポーネントは `ChangeDetectionStrategy.OnPush` を採用する（リポジトリ全体の規約）。
状態は signal ベースで保持され、`OnPush` と組み合わせて変更検知範囲を最小化する。

---

## 2. データモデル（Work → Group → Unit）

`core/models/media.model.ts` に、作品(Work)→グループ(Group)→単位(Unit)の3階層を定義する。
mediaType を問わず共通の形で、将来 movie（Group1件・Unit1件）や book（mangaと同形）にも
そのまま拡張できる。

```mermaid
erDiagram
    WORK {
        string id
        string mediaType "'manga' | 'anime'"
        string title
        boolean wantToConsume "作品レベルの読みたい/観たい"
        string externalSource "任意。将来の外部API連携用"
        string externalId "任意"
        boolean deleted "任意。論理削除フラグ（tombstone）"
    }
    GROUP {
        string id
        string workId
        number order
        string title "例: 第1期, 1-10巻"
        boolean wantToConsume "グループレベルの読みたい/観たい（Workとは独立）"
        boolean deleted "任意"
    }
    UNIT {
        string id
        string groupId
        string workId "非正規化。同期・集計を単純化"
        number number "話数/巻数"
        boolean viewed
        number viewCount "再視聴/再読の回数"
        string lastViewedAt "任意"
        boolean deleted "任意"
    }

    WORK ||--o{ GROUP : "1..N"
    GROUP ||--o{ UNIT : "1..N"
```

`wantToConsume` はWork/Group両方に独立して持てる（片方を立てても他方に影響しない）。UI側の
「読みたいリスト」は、Workの`wantToConsume`が立っている作品と、配下いずれかのGroupの
`wantToConsume`が立っている作品（該当Groupのみ表示）の両方を`WorksStateService`が`computed`で
集約して表示する（`features/works/works-state.service.ts`）。

---

## 3. 永続化（ローカル + クラウド同期）

`core/media/`に3つのサービスを持つ。姉妹アプリeibun-labの`SessionRepositoryService`/
`FirestoreSyncService`と同じ「ローカル保存 → Firestoreへfire-and-forget push」パターンと、
tombstone方式の論理削除（`deleted`フラグ + OR結合マージ）を踏襲する。

- **`media-store.service.ts`**: works/groups/unitsを3つの独立したlocalStorageキー
  （`media_works` / `media_groups` / `media_units`）でCRUD管理。Work削除時は配下のGroup/Unitも
  連動してtombstone化する（カスケード）。
- **`media-firestore-sync.service.ts`**: `AuthService.user()`を`effect()`で監視し、ログイン時に
  `apps/media_log/users/{uid}/works|groups|units/{id}`と双方向マージ。以後の保存操作で
  fire-and-forget push。
- **`media-repository.service.ts`**: 上記2つを束ねるファサード。`features/works`はこのサービスのみを
  inject する。

```mermaid
graph TD
    Works["features/works\n(WorksStateService)"]
    Repo["MediaRepositoryService (core/media)"]
    Store["MediaStoreService\nLocalStorage CRUD"]
    Sync["MediaFirestoreSyncService\n双方向同期"]
    Auth["AuthService (user signal)"]

    Works --> Repo
    Repo --> Store
    Repo --> Sync
    Sync -->|user signalをeffect()で監視| Auth
    Sync <--> Firestore[("apps/media_log/users/{uid}/works|groups|units")]
    Store <--> LocalStorage[("LocalStorage")]
```

---

## 4. 認証（プラットフォーム共通パターン）

`AuthService`（core/firebase）が Google SSO ログイン状態を `user` signal で保持する。
クラウド同期はホワイトリスト制（`auth.constants.ts` の `ALLOWED_SYNC_EMAILS`、Firestore側は
`firestore.rules` の `isAllowedUser()`）で、許可されたユーザーの本人 UID サブツリーのみ
読み書きできる。

---

## 5. ルーティング

```mermaid
graph LR
    Root["/"] -->|redirect| WorkList["/works"]
    Root --> WorkDetail["/works/:id"]
    Root --> Settings["/settings"]
    Root --> Legal["/legal/:doc"]
    Root -.->|開発ビルドのみ| Dev["/dev"]
```

`environment.production` が true のとき、[app.routes.ts](src/app/app.routes.ts) は `/dev` ルートを
登録しない。Service Worker は本番ビルドのみ有効。

---

## 6. UI言語

UI言語は日本語のみ（i18n基盤は撤去済み）。文言は各コンポーネントのテンプレートに直接記述する。

---

## 7. 法的情報ページ（legal）

[legal.ts](src/app/features/legal/legal.ts) は `docs/legal/{doc}.md` を実行時に `fetch()` して
Markdownを表示する。`angular.json` のビルドアセット設定で `docs/legal` を `dist/.../legal/` へ
ディレクトリ単位でコピーしている。`docs/legal/` を移動・改名する場合は、この2箇所を必ず
同時に更新すること（詳細は [docs/index.md](docs/index.md) の「ドキュメントリファクタリング方針」）。
