/**
 * @file 遅延ロード（loadComponent）を使ったルーティング設定。デフォルトは /works にリダイレクト。
 * dev ルートは本番ビルドでは登録しない（route table・lazy chunkから除外し出荷されないようにする）。
 */
import { Routes } from '@angular/router';
import { environment } from '../environments/environment';

export const routes: Routes = [
  { path: '', redirectTo: 'works', pathMatch: 'full' },
  {
    path: 'works',
    loadComponent: () => import('./features/works/work-list/work-list').then((m) => m.WorkList),
  },
  {
    path: 'works/:id',
    loadComponent: () =>
      import('./features/works/work-detail/work-detail').then((m) => m.WorkDetail),
  },
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
