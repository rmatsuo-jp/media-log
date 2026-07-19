/**
 * @file 翻訳辞書 - settings（設定）セクション。
 * ja/en を同一キーごとにペアで定義し、`./index.ts` でマージされ TRANSLATIONS を構成する。
 */

// ── settings ──
export const settings = {
  ja: {
    'settings.title': '設定',
    'settings.account': 'アカウント（データ同期）',
    'settings.accountHint': 'Google でログインすると、記録データを他の端末と共有できます。',
    'settings.loggedIn': 'ログイン中',
    'settings.logout': 'ログアウト',
    'settings.login': 'Google でログイン',
    'settings.processing': '処理中…',
    'settings.authNote':
      'クラウド同期は許可されたユーザー（ホワイトリスト制）のみ利用できます。ログインなしでもローカル保存で全機能を利用できます。',
    'settings.theme': '外観テーマ',
    'settings.themeLight': 'ライト',
    'settings.themeDark': 'ダーク',
    'settings.language': '表示言語',
    'settings.languageJa': '日本語',
    'settings.languageEn': 'English',
    'settings.legal': '法的情報',
    'settings.github': 'GitHub',
  },
  en: {
    'settings.title': 'Settings',
    'settings.account': 'Account (Data Sync)',
    'settings.accountHint': 'Sign in with Google to share your log data across devices.',
    'settings.loggedIn': 'Logged in',
    'settings.logout': 'Log Out',
    'settings.login': 'Sign in with Google',
    'settings.processing': 'Processing…',
    'settings.authNote':
      'Cloud sync is available only to whitelisted users. All features work locally without logging in.',
    'settings.theme': 'Appearance',
    'settings.themeLight': 'Light',
    'settings.themeDark': 'Dark',
    'settings.language': 'Display Language',
    'settings.languageJa': '日本語',
    'settings.languageEn': 'English',
    'settings.legal': 'Legal',
    'settings.github': 'GitHub',
  },
} as const;
