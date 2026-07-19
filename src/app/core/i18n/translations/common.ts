/**
 * @file 翻訳辞書 - 共通セクション（アプリ全体で使う汎用文言: app/sidebar/nav）。
 * ja/en を同一キーごとにペアで定義し、`./index.ts` でマージされ TRANSLATIONS を構成する。
 */

// ── common ──
export const common = {
  ja: {
    'app.title': 'Media Log',
    'sidebar.expand': 'サイドバーを表示',
    'sidebar.collapse': 'サイドバーを格納',
    'sidebar.language': '言語',

    'nav.settings': '設定',
    'nav.dev': '開発',
  },
  en: {
    'app.title': 'Media Log',
    'sidebar.expand': 'Show sidebar',
    'sidebar.collapse': 'Collapse sidebar',
    'sidebar.language': 'Language',

    'nav.settings': 'Settings',
    'nav.dev': 'Dev',
  },
} as const;
