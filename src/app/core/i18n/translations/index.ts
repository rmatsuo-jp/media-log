/**
 * @file UI 文言の日英翻訳辞書のエントリポイント。セクションごとに分割された各ファイル
 * （common/settings）の ja/en を統合し、`TRANSLATIONS` と `TranslationKey` を構成する。
 * ja を正典としてキー集合を定義し、en には同じキー集合を TypeScript の型チェックで強制する
 * （en 側のキー欠落はコンパイルエラーになる）。
 * キーはドット区切りの平坦なフラット構造（例: 'nav.settings'）。I18nService.t() から参照する。
 */
import { Lang } from '../lang.model';
import { common } from './common';
import { settings } from './settings';

// ── merge ──
const ja = {
  ...common.ja,
  ...settings.ja,
} as const;

type TranslationKey = keyof typeof ja;

const en: Record<TranslationKey, string> = {
  ...common.en,
  ...settings.en,
};

export const TRANSLATIONS: Record<Lang, Record<TranslationKey, string>> = { ja, en };
export type { TranslationKey };
