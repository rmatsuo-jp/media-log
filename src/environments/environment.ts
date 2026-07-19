/**
 * @file 開発環境用の設定値。Firebase の構成（公開情報）を保持する。
 * 本番ビルド時は angular.json の fileReplacements により environment.prod.ts に差し替えられる。
 * 値はプレースホルダ。Firebase コンソールでプロジェクトを作成後、実際の構成値に差し替えること。
 */

// ── Firebase 構成（クライアント公開情報。保護は Firestore セキュリティルールで担保） ─
export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyAsSqLzZDpGD-QOo3XN_R4aKPGfshd__as',
    authDomain: 'media-log-7a097.firebaseapp.com',
    projectId: 'media-log-7a097',
    storageBucket: 'media-log-7a097.firebasestorage.app',
    messagingSenderId: '735315871795',
    appId: '1:735315871795:web:31e789cbd326ab0414bb46',
  },
};
