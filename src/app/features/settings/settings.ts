/**
 * @file 設定ページ。テーマ・法的情報導線・GitHubリポジトリ導線・アカウント（Google SSO）を持つ。
 * テーマは操作した時点で即時保存する（settings signal は常に「保存済みの真値」）。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppSettings, SettingsStoreService } from '@core/settings/settings-store.service';
import { AccountPanel } from './account-panel/account-panel';

@Component({
  selector: 'app-settings',
  imports: [RouterLink, AccountPanel],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private settingsStore = inject(SettingsStoreService);

  // ── GitHubリポジトリ導線 ───────────────────────────────────────
  readonly githubUrl = 'https://github.com/rmatsuo-jp/media-log';

  // ── 状態管理（signal） ────────────────────────────────────────────
  settings = signal<AppSettings>(this.settingsStore.getSettings());

  // ── テーマ（即時保存。DOM への反映と永続化を同時に行う） ──────────
  updateTheme(theme: AppSettings['theme']) {
    document.documentElement.dataset['theme'] = theme;
    this.persist({ ...this.settingsStore.getSettings(), theme });
  }

  private persist(next: AppSettings) {
    this.settings.set(next);
    this.settingsStore.saveSettings(next);
  }
}
