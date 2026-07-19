# CLAUDE.md — Media Log

Angular 22 製 PWA。マンガ・アニメの閲覧記録（作品Work→グループGroup→単位Unitの3階層で、既読・周回数・
「読みたい」を管理）を一元管理する。書籍・映画への拡張はUnit/Group抽象がそのまま使える設計。
UI言語: 日本語のみ（i18n基盤は撤去済み。多言語対応の予定なし）。

## 基本ルール

- 返答は日本語。実装は簡潔に、解説は求められた時のみ。
- ファイルは全文読みせず、`grep`/`@file`コメントで該当箇所を特定してから必要範囲のみ読む。
- 依存方向は `features → core → shared` の一方向のみ。feature間import・core→features importは禁止。
  層跨ぎは `@core/*` / `@shared/*` / `@features/*`（tsconfig.json）、同一フォルダ内は相対import。
- 型定義の正は `src/app/core/models/media.model.ts`（Work/Group/Unit）。
- リアクティブは `signal()`（`BehaviorSubject`不使用）。コンポーネントはStandalone。
- 永続化はコンポーネントから直接localStorageを触らず、専用のストアサービス経由。
  作品/記録データは `core/media/media-repository.service.ts` が唯一の書き込み窓口
  （ローカル保存 + Firestore fire-and-forget push を1箇所に集約）。設定は`SettingsStoreService`。
  新しいドメインデータを追加する際も同じパターン（single-source-of-truthストア + localStorage永続化 +
  tombstone論理削除 + Firestore任意同期）を踏襲すること。

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
