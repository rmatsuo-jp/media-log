/**
 * @file 開発環境用の設定値。Firebase の構成（公開情報）を保持する。
 * 本番ビルド時は angular.json の fileReplacements により environment.prod.ts に差し替えられる。
 * 値はプレースホルダ。Firebase コンソールでプロジェクトを作成後、実際の構成値に差し替えること。
 */

// ── Firebase 構成（クライアント公開情報。保護は Firestore セキュリティルールで担保） ─
export const environment = {
  production: false,
  firebase: {
    apiKey: 'TODO_FIREBASE_API_KEY',
    authDomain: 'TODO_PROJECT_ID.firebaseapp.com',
    projectId: 'TODO_PROJECT_ID',
    storageBucket: 'TODO_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'TODO_SENDER_ID',
    appId: 'TODO_APP_ID',
  },
};
