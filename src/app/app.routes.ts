/**
 * @file 遅延ロード（loadComponent）を使ったルーティング設定。デフォルトは /settings にリダイレクト
 * （Phase 2 で作品/記録機能を追加したらデフォルトルートを差し替える）。
 * dev ルートは本番ビルドでは登録しない（route table・lazy chunkから除外し出荷されないようにする）。
 */
import { Routes } from '@angular/router';
import { environment } from '../environments/environment';

export const routes: Routes = [
  { path: '', redirectTo: 'settings', pathMatch: 'full' },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings').then((m) => m.Settings),
  },
  {
    path: 'legal/:doc',
    loadComponent: () => import('./features/legal/legal').then((m) => m.Legal),
  },
  // ── 開発用ページ（本番ビルドでは非搭載） ────────────────────────
  ...(environment.production
    ? []
    : [
        {
          path: 'dev',
          loadComponent: () => import('./features/dev/dev').then((m) => m.Dev),
        },
      ]),
];
