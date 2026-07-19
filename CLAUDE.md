# CLAUDE.md — Media Log

Angular 22 製 PWA。マンガ・書籍・アニメ・映画の閲覧記録（作品・記録単位・いつ/何回目まで進んだか）を一元管理する。
UI言語: 日本語（i18nでen対応）。

**現状（Phase 1）はプラットフォーム基盤のみ**（core/firebase, core/i18n, core/settings, features/settings, features/legal, features/dev）。
作品・記録のデータモデルとCRUD機能（features/works, features/logs 等）はPhase 2で追加する。

## 基本ルール

- 返答は日本語。実装は簡潔に、解説は求められた時のみ。
- ファイルは全文読みせず、`grep`/`@file`コメントで該当箇所を特定してから必要範囲のみ読む。
- 依存方向は `features → core → shared` の一方向のみ。feature間import・core→features importは禁止。
  層跨ぎは `@core/*` / `@shared/*` / `@features/*`（tsconfig.json）、同一フォルダ内は相対import。
- リアクティブは `signal()`（`BehaviorSubject`不使用）。コンポーネントはStandalone。
- 永続化はコンポーネントから直接localStorageを触らず、専用のストアサービス（`SettingsStoreService`等）経由。
  Phase 2で作品/記録データのストアを追加する際も同じパターン（single-source-of-truthストア + localStorage永続化 +
  Firestore任意同期）を踏襲すること。

## バージョン運用

semantic-release による自動採番。`package.json`の`version`を手動編集しない。
`fix/perf`=PATCH、`feat`=MINOR、`feat!`/`BREAKING CHANGE`=MAJOR、それ以外は上昇なし。
`src/version.ts`はリリース時のみ生成される（通常のbuildでは再生成されない）。

## コメント管理ルール

ファイル編集時は `@file` コメントと影響するセクションコメントを同時に更新する（全読み回避のため）。
`.spec.ts`と`src/version.ts`は対象外。書式:

```typescript
/**
 * @file ファイルの役割を1〜2行で説明
 */
// ── セクション名 ──
```

## 開発コマンド

`npm start`（http://localhost:4203）/ `npm run build` / `npm test` / `npm run lint` / `npm run lint:text`
