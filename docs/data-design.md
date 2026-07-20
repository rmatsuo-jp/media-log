# データ設計書

本ドキュメントは Media Log のドメインモデルおよび永続化設計を説明する。
実装の正は [media.model.ts](../src/app/core/models/media.model.ts) であり、本書はその構造と
背景にある設計意図を補足するもの。型の詳細に食い違いがあれば実装を正とする。

## 1. 全体構造

マンガ・アニメの閲覧記録を「作品 → グループ → 単位」の3階層で管理する。

```
Work（作品）
 └─ Group（グループ：巻セット・シーズン等）
     └─ Unit（単位：話・巻）
```

- マンガ: Work=作品、Group=巻セット（例:「1-10巻」）、Unit=巻
- アニメ: Work=作品、Group=シーズン（例:「第1期」）、Unit=話
- 将来の書籍・映画拡張もこの3階層抽象で表現する想定（映画はGroup1件・Unit1件になる見込み）

`Work.mediaType: 'manga' | 'anime'` で種別を判定する（将来 `'movie' | 'book'` を追加予定）。

「読みたい/観たい」(ウィッシュリスト)は専用エンティティを持たず、Work/Groupそれぞれの
`wantToConsume: boolean` フラグで表現する。

## 2. エンティティ定義

型定義は [media.model.ts](../src/app/core/models/media.model.ts) を参照。

### Work（作品）

| フィールド              | 型                | 説明                                   |
| ------------------------ | ----------------- | -------------------------------------- |
| `id`                      | `string`           | 一意識別子                              |
| `mediaType`               | `MediaType`        | `'manga' \| 'anime'`                    |
| `title`                   | `string`           | 作品名                                  |
| `wantToConsume`           | `boolean`          | 作品単位の「読みたい/観たい」フラグ     |
| `externalSource?`         | `string`           | 取り込み元API（AniList/Google Books等） |
| `externalId?`             | `string`           | 外部API側のID                           |
| `coverImageUrl?`          | `string`           | 表紙/カバー画像URL                      |
| `coverImageCandidates?`   | `string[]`         | 画像候補（差し替え用）                  |
| `createdAt` / `updatedAt` | `string`（ISO日時）| 作成・更新日時                          |
| `deleted?`                | `boolean`          | tombstone論理削除フラグ                 |

### Group（グループ：巻セット・シーズン等）

| フィールド              | 型        | 説明                                       |
| ------------------------ | --------- | ------------------------------------------ |
| `id`                      | `string`   | 一意識別子                                  |
| `workId`                  | `string`   | 親Workの参照                                |
| `order`                   | `number`   | 表示順（巻セット・シーズン順）              |
| `title`                   | `string`   | グループ名（例:「第1期」「1-10巻」）        |
| `wantToConsume`           | `boolean`  | グループ単位の「読みたい/観たい」（Workとは独立に持てる） |
| `coverImageUrl?`          | `string`   | 表紙/カバー画像URL                          |
| `createdAt` / `updatedAt` | `string`   | 作成・更新日時                              |
| `deleted?`                | `boolean`  | tombstone論理削除フラグ                     |

### Unit（単位：話・巻）

| フィールド              | 型        | 説明                          |
| ------------------------ | --------- | ----------------------------- |
| `id`                      | `string`   | 一意識別子                     |
| `groupId`                 | `string`   | 親Groupの参照                 |
| `workId`                  | `string`   | 親Workの参照（非正規化・検索用）|
| `number`                  | `number`   | 話数/巻数                     |
| `viewed`                  | `boolean`  | 既読/視聴済みフラグ            |
| `viewCount`                | `number`   | 周回数                        |
| `lastViewedAt?`            | `string`   | 最終視聴日時                  |
| `coverImageUrl?`           | `string`   | 表紙/カバー画像URL             |
| `coverImageCandidates?`    | `string[]` | 画像候補                      |
| `createdAt` / `updatedAt`  | `string`   | 作成・更新日時                |
| `deleted?`                 | `boolean`  | tombstone論理削除フラグ        |

### Achievement（実績）

| フィールド    | 型        | 説明                                   |
| -------------- | --------- | -------------------------------------- |
| `id`            | `string`   | 実績定義ID（下記マスタと対応）          |
| `unlockedAt`    | `string`   | 解除日時                                |
| `deleted?`      | `boolean`  | tombstone論理削除フラグ                 |

実績のマスタ定義（閾値・アイコン等）は静的データとして
[achievement-definitions.ts](../src/app/core/achievements/achievement-definitions.ts) に持つ
（永続化対象外）。判定指標 `AchievementMetric` は `unitsRead`（既読数）/ `worksCompleted`（完読作品数）/
`rereads`（周回数）の3種で、閾値配列から実績定義を動的生成する。

## 3. 永続化アーキテクチャ

### 3.1 共通パターン

ドメインデータ（Work/Group/Unit、Achievement）は共通して以下の3層構成を取る。
新しいドメインを追加する際もこのパターンを踏襲する（[CLAUDE.md](../CLAUDE.md)参照）。

```
Repository（feature層が唯一injectする書き込み窓口）
 ├─ Store（localStorage永続化、tombstone論理削除、signalで公開）
 └─ FirestoreSync（クラウド双方向同期、fire-and-forget push）
```

- **Repository**: CRUD操作時に「ローカル保存 → Firestore push」を1箇所に集約する
  （feature層が個別に呼び忘れることを防ぐ）。カスケード削除（例: Work削除で配下Group/Unitも
  tombstone化してpush）もここで行う。
- **Store**: localStorage CRUD専任。削除済みを除外した公開ビュー（例:`works`）と、
  tombstoneを含む全件ビュー（例:`allWorks`）を提供する。
- **FirestoreSync**: Firestoreとの双方向同期専任。ログイン時に自動同期を行う。

設定データ（`SettingsStoreService`）のみこのパターン外で、クラウド同期を持たない単純な
ローカル永続化（後述4.4）。

### 3.2 tombstone共通層

[src/app/core/persistence/](../src/app/core/persistence/) にドメイン非依存の汎用実装を持ち、
media/achievements双方のStore・FirestoreSyncはこの薄いラッパーとして構成される
（コミット「tombstone永続化/同期の三重複を汎用層に統合」で共通化）。

- **tombstone-collection.store.ts**: `createTombstoneCollectionStore<T>(storageKey, onStorageFull)`
  — signalベースのlocalStorage永続化。`all`（全件）/ `visible`（`deleted`除外）/ `persist` /
  `save` / `softDelete` を提供。他タブでの変更は`storage`イベントで検知し追随する。
- **tombstone-firestore-sync.ts**: `createTombstoneFirestoreSync<T>(config)` — Firestore双方向同期の
  汎用実装。`push`（送信失敗分はpendingPushに保持し、オンライン復帰時に再送）、
  `syncFromCloud`（idベースでマージ）、`syncError` signalを提供。
- **tombstone-sync.util.ts**: `stripUndefinedShallow`（Firestoreは`undefined`値を許容しないための
  浅い除去）、`mergeByIdWithTombstone`（idで突合し、`deleted`はOR条件でマージ＝どちらかで
  削除済みなら削除済みとする）。

削除は物理削除せず`deleted`フラグを立てる論理削除（tombstone）方式を全エンティティ共通で採る。
これによりオフライン編集後の同期や複数端末間の削除伝播で、削除操作が上書きで消えることを防ぐ。

### 3.3 localStorageキー一覧

| キー                  | 内容                     | 管理箇所                                                                                     |
| ---------------------- | ------------------------ | ---------------------------------------------------------------------------------------------- |
| `media_works`           | Work一覧                 | [media-store.service.ts](../src/app/core/media/media-store.service.ts)                          |
| `media_groups`          | Group一覧                | 同上                                                                                             |
| `media_units`           | Unit一覧                 | 同上                                                                                             |
| `achievements_unlocked` | 解除済みAchievement一覧  | [achievements-store.service.ts](../src/app/core/achievements/achievements-store.service.ts)      |
| `app_settings`          | アプリ設定               | [settings-store.service.ts](../src/app/core/settings/settings-store.service.ts)                  |

### 3.4 Firestore構造

パス: `apps/media_log/users/{uid}/{collectionName}/{id}`

| コレクション名 | 対応エンティティ |
| --------------- | ---------------- |
| `works`          | Work              |
| `groups`         | Group             |
| `units`          | Unit              |
| `achievements`   | Achievement       |

同期はユーザーログイン時（`AuthService`の状態監視）に自動実行される。ローカル書き込みは
即座にlocalStorageへ反映され、Firestoreへのpushはfire-and-forgetで行われる
（オフライン時はpending保持、オンライン復帰時に再送）。

## 4. 各ドメインの詳細

### 4.1 Media（Work/Group/Unit）

[src/app/core/media/](../src/app/core/media/)

- **MediaRepositoryService**: feature層が唯一injectする書き込み窓口。
- **MediaStoreService**: `works`/`groups`/`units`（tombstone共通storeを3つ束ねたもの）を公開。
- **MediaFirestoreSyncService**: 上記3コレクションの同期を束ねる。

### 4.2 Achievements（実績）

[src/app/core/achievements/](../src/app/core/achievements/)

- **achievement-definitions.ts**: 実績マスタの静的定義（閾値配列から動的生成、永続化対象外）。
- **AchievementsStoreService** / **AchievementsFirestoreSyncService**: tombstone共通層のラッパー。
- **AchievementsRepositoryService**: `unlockAchievement(id)`のみを提供（冪等、解除済みならno-op）。

### 4.3 Wishlist（読みたい/観たい）

独立したデータ構造は持たない。Work/Groupそれぞれの`wantToConsume`フラグで表現し、
専用のStore/Repositoryは存在しない（MediaRepositoryServiceのCRUDに内包される）。

### 4.4 Settings（設定）

[settings-store.service.ts](../src/app/core/settings/settings-store.service.ts)

tombstone方式を使わない単純なオブジェクト永続化（クラウド同期なし、ローカル限定）。

```typescript
interface AppSettings {
  theme: 'light' | 'dark';
  googleBooksApiKey: string; // 未設定時はenvironment.googleBooksApiKeyにフォールバック
}
```

### 4.5 External Media（外部API連携）

[src/app/core/external-media/](../src/app/core/external-media/)

AniList / Google Books / openBD / NDL Search からの検索結果DTO
（`ExternalWorkSearchResult`、`ExternalUnitCandidate`）を定義するが、これらは永続化対象外
（都度取得し、取り込み時にWork/Group/Unitへ変換して保存する）。連携先の役割分担は
[external-media-integration.md](external-media-integration.md)を参照。

## 5. 設計上の注意点

- 新規ドメインデータを追加する際は、`persistence/`の汎用tombstone層（Store + FirestoreSync）を
  再利用し、Repositoryで「ローカル保存 + Firestore push」を1箇所に集約すること。
  設定のようにクラウド同期が不要なデータのみ`SettingsStoreService`パターン（単純ローカル永続化）を
  検討する。
- `deleted`フラグのマージはOR条件（`mergeByIdWithTombstone`）。複数端末間の同期では
  「どちらかで削除されていれば削除済み」として扱われる。
- Firestoreは`undefined`値を許容しないため、push時は`stripUndefinedShallow`で浅く除去される。
  ネストしたオブジェクト内の`undefined`は除去対象外である点に注意。
