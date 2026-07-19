/**
 * @file 開発者用ページ。localStorage 生データのダンプを行う開発専用タブ（本番ビルドでは非搭載）。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { copyToClipboard } from '@shared/utils/clipboard.util';

@Component({
  selector: 'app-dev',
  imports: [],
  templateUrl: './dev.html',
  styleUrl: './dev.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dev {
  private settingsStore = inject(SettingsStoreService);

  // ── localStorage 生データダンプ ─────────────────────────────
  settingsDump = computed(() => JSON.stringify(this.settingsStore.getSettings(), null, 2));
  localStorageKeys = computed(() => Object.keys(localStorage));

  dumpKey(key: string): string {
    return localStorage.getItem(key) ?? '';
  }

  // ── クリップボードコピー（ボタンごとに一時的に「コピーしました」を表示） ─
  copiedKey = signal<string | null>(null);

  async copy(key: string, text: string) {
    await copyToClipboard(text);
    this.copiedKey.set(key);
    setTimeout(() => {
      if (this.copiedKey() === key) this.copiedKey.set(null);
    }, 1500);
  }
}
