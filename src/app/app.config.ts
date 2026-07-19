/**
 * @file Angular グローバル設定。ルーター・HttpClient・Service Worker（本番のみ）を提供する。
 */
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  APP_INITIALIZER,
  inject,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerImmediately',
    }),
    // ── Service Worker 更新監視: 新バージョン検知時に即座にアクティベートしてリロードする ──
    // 目的: GitHub Pages 上で古いバージョンがキャッシュされ続け、スーパーリロードしないと
    // 反映されない問題を恒久的に解消するため。inject(SwUpdate) は factory 本体（injection
    // context 内）で解決し、戻り値の関数へキャプチャする（この関数は init 実行フェーズ＝
    // context 外で呼ばれるため、中で inject() すると NG0203 で購読登録に失敗する）。
    // registerImmediately 指定で起動直後にチェックし、タブ復帰時（visibilitychange）にも再チェック。
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const swUpdate = inject(SwUpdate);
        return () => {
          if (isDevMode() || !swUpdate.isEnabled) return;
          swUpdate.versionUpdates.subscribe((event) => {
            if (event.type === 'VERSION_READY') {
              swUpdate.activateUpdate().then(() => document.location.reload());
            }
          });
          swUpdate.checkForUpdate();
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              swUpdate.checkForUpdate();
            }
          });
        };
      },
      multi: true,
    },
  ],
};
