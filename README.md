# Media Log

マンガ・書籍・アニメ・映画の閲覧記録を一元管理する PWA アプリです。マンガ・アニメについて、作品→グループ（シリーズ/シーズン）→単位（巻/話）の階層で記録し、既読・周回数・「読みたい」を管理します。

**現在は Phase 2（マンガ・アニメの基本機能）段階です。** 書籍・映画への対応は今後追加予定です。UI言語は日本語のみです。

## 技術スタック

Angular 22（Standalone, PWA）+ LocalStorage/Firestore 同期（Google ログインによるオプトインのクラウド同期）。

## セットアップ

### 必要なもの

- Node.js 24.x

### インストール

```bash
npm install
```

### 開発サーバーの起動

```bash
npm start
```

ブラウザで `http://localhost:4203/` を開きます。

詳細なセットアップ手順（Node.js バージョン、Firebase設定、テスト・lintの実行方法など）は [docs/setup.md](docs/setup.md) を参照してください。

## ビルド

```bash
npm run build
```

ビルド成果物は `dist/` に出力されます。

## テスト

```bash
npm test
```

## Lint

```bash
npm run lint       # ESLint
npm run lint:text  # 表記ゆれチェック（docs, README.md, ARCHITECTURE.md）
```

## セキュリティ

このリポジトリは public 公開されています。運用上の注意点：

- **Firebase の構成値（`apiKey` 等）は秘密情報ではなく**、クライアントに必ず露出するプロジェクト識別子です。コードに含めて公開して問題ありません。実際のアクセス保護は **Firestore セキュリティルール**（`firestore.rules`）で行います。
- **Firestore ルールは本人 UID 限定**（`apps/media_log/users/{uid}/...`）です。これが無いと全ユーザーのデータが誰でも読み書き可能になります。ルール変更時は必ず反映してください：

  ```bash
  firebase deploy --only firestore:rules
  ```

- **Firebase apiキーには制限をかける**ことを推奨します（公開済みのため悪用防止）：
  - Google Cloud Console → 認証情報 → 該当キーに **HTTP リファラ制限**（本番ドメインのみ）を設定。
  - Firebase Console → Authentication → Settings → **承認済みドメイン** を本番ドメインに限定。

## プロジェクト構成

依存方向は `features → core → shared` の一方向。詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

```
src/app/
├── core/         # Firebase連携・設定・models・media（Work/Group/Unit永続化）などプラットフォーム共通
├── shared/       # 共通UIコンポーネント・ユーティリティ
└── features/     # works（作品・記録管理）/ settings / legal / dev
```

## ドキュメント

対象読者ごとのドキュメント一覧は [docs/index.md](docs/index.md) を参照してください。

## ライセンス・免責

本アプリは **MIT License** のもとで無償提供されます。利用にあたっては、以下の規約類をご確認ください。

- [免責事項（DISCLAIMER）](docs/legal/disclaimer.md)
- [利用規約（TERMS）](docs/legal/terms.md)
- [プライバシーポリシー（PRIVACY）](docs/legal/privacy.md)
- [ライセンス（LICENSE）](docs/legal/LICENSE.md)

本アプリは現状有姿で提供され、利用に起因する損害について、法令上許容される範囲で開発者は責任を負いません。許可された利用者のログイン時は閲覧記録が Firebase（Google）に同期される点を含め、詳細は[プライバシーポリシー](docs/legal/privacy.md)をご確認ください。
