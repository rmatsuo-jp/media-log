/**
 * @file 本番環境用の設定値。本番ビルド時に environment.ts と差し替えられる。
 * Firebase の構成は同一プロジェクトを参照する（構成値はクライアント公開情報）。
 * 値はプレースホルダ。Firebase コンソールでプロジェクトを作成後、実際の構成値に差し替えること。
 */

// ── Firebase 構成（クライアント公開情報。保護は Firestore セキュリティルールで担保） ─
export const environment = {
  production: true,
  firebase: {
    apiKey: 'TODO_FIREBASE_API_KEY',
    authDomain: 'TODO_PROJECT_ID.firebaseapp.com',
    projectId: 'TODO_PROJECT_ID',
    storageBucket: 'TODO_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'TODO_SENDER_ID',
    appId: 'TODO_APP_ID',
  },
};
