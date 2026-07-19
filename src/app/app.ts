/**
 * @file ルートコンポーネント。起動時に theme を初期化し、
 * ボトムナビ実高さの --bottom-nav-height への反映を担う。
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { environment } from '../environments/environment';
import { SettingsStoreService } from '@core/settings/settings-store.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private settingsStore = inject(SettingsStoreService);
  private destroyRef = inject(DestroyRef);

  private bottomNav = viewChild<ElementRef<HTMLElement>>('bottomNav');
  private readonly desktopMedia = window.matchMedia('(min-width: 768px)');

  // ── サイドバー（PCレイアウト時のみ）の格納状態。既定値 false = 表示中 ──
  protected sidebarCollapsed = signal(false);

  // ── 開発用ナビ項目の表示可否（本番ビルドでは /dev ルート自体が存在しないため非表示にする） ─
  protected isDev = !environment.production;

  constructor() {
    const settings = this.settingsStore.getSettings();
    document.documentElement.dataset['theme'] = settings.theme;

    afterNextRender(() => this.observeBottomNavHeight());
  }

  // ── bottom-nav の実高さを監視し、--bottom-nav-height に反映（PCサイドバー時は対象外） ──
  private observeBottomNavHeight() {
    const el = this.bottomNav()?.nativeElement;
    const shell = el?.closest<HTMLElement>('.app-shell');
    if (!el || !shell) return;

    let lastHeight = -1;
    let rafId = -1;
    const applyHeight = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        if (this.desktopMedia.matches) return;
        const height = el.offsetHeight;
        if (height === lastHeight) return;
        lastHeight = height;
        shell.style.setProperty('--bottom-nav-height', `${height}px`);
      });
    };

    const observer = new ResizeObserver(applyHeight);
    observer.observe(el);
    this.desktopMedia.addEventListener('change', applyHeight);
    window.visualViewport?.addEventListener('resize', applyHeight);
    const deferredCheck = window.setTimeout(applyHeight, 300);
    applyHeight();

    this.destroyRef.onDestroy(() => {
      observer.disconnect();
      this.desktopMedia.removeEventListener('change', applyHeight);
      window.visualViewport?.removeEventListener('resize', applyHeight);
      window.clearTimeout(deferredCheck);
      window.cancelAnimationFrame(rafId);
    });
  }

  // ── サイドバー格納ボタン: 表示⇔格納をトグル ─────────────────
  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
}
