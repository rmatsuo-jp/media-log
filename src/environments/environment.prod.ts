/**
 * @file 本番環境用の設定値。本番ビルド時に environment.ts と差し替えられる。
 * Firebase の構成は同一プロジェクトを参照する（構成値はクライアント公開情報）。
 * googleBooksApiKey は environment.ts と同様、Books API 専用の読み取りキー（HTTPリファラー制限推奨）。
 */

// ── Firebase 構成（クライアント公開情報。保護は Firestore セキュリティルールで担保） ─
export const environment = {
  production: true,
  firebase: {
    apiKey: 'AIzaSyAsSqLzZDpGD-QOo3XN_R4aKPGfshd__as',
    authDomain: 'media-log-7a097.firebaseapp.com',
    projectId: 'media-log-7a097',
    storageBucket: 'media-log-7a097.firebasestorage.app',
    messagingSenderId: '735315871795',
    appId: '1:735315871795:web:31e789cbd326ab0414bb46',
  },
  googleBooksApiKey: '',
};
