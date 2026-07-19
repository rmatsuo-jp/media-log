# Media Log — 開発環境セットアップ手順

このドキュメントでは、Media Log のソースコードを clone してから、ローカルで動作確認・テスト・ビルドまで行えるようにするための手順を説明します。

---

## 前提条件

| ソフトウェア | バージョン                                                |
| ------------ | --------------------------------------------------------- |
| Node.js      | 24.x（CI と同じバージョン）                               |
| npm          | 11.x（`packageManager` フィールドで指定、Node 24 に同梱） |

Node.js のバージョン管理には [nvm](https://github.com/nvm-sh/nvm) や [Volta](https://volta.sh/) の利用を推奨します。

---

## 1. リポジトリの clone と依存関係のインストール

```bash
git clone https://github.com/rmatsuo-jp/media-log.git
cd media-log
npm install
```

---

## 2. Firebase設定（クラウド同期を使う場合）

クラウド同期（Google ログイン + Firestore）を使う場合は、Firebase コンソールでプロジェクトを作成し、`src/environments/environment.ts` / `environment.prod.ts` の `firebase` フィールドをプロジェクトの構成値に差し替えてください。ログインなしでもローカル保存のみで全機能が利用できます。

---

## 3. ローカル開発サーバーの起動

```bash
npm start
```

`http://localhost:4203` でアプリが起動します（ホットリロード対応）。

---

## 4. テストの実行

```bash
npm test
```

Vitest によるユニットテストが実行されます。

---

## 5. Lint の実行

```bash
npm run lint       # ESLint
npm run lint:text  # 表記ゆれチェック（docs/README.md/ARCHITECTURE.md）
```

---

## 6. 本番ビルドの確認

```bash
npm run build
```

`dist/media-log/` 配下に本番ビルド成果物が出力されます。Service Worker（PWA）も有効化されたビルドになります。

---

## よくあるつまずきポイント

- **`npm install` でエンジンエラーが出る**: Node.js のバージョンが 24 系になっているか `node -v` で確認してください。
- **コミット時の運用**: バージョン番号は semantic-release が自動採番するため、`package.json` の `version` は手動編集しないでください（詳細は [CLAUDE.md](../CLAUDE.md) の「バージョン運用」を参照）。
