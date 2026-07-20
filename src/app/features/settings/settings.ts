/**
 * @file 設定ページ。テーマ・Google Books APIキー・法的情報導線・GitHubリポジトリ導線・バージョン情報・
 * アカウント（Google SSO）を持つ。テーマは操作した時点で即時保存する（settings signal は常に
 * 「保存済みの真値」）。Google Books APIキーは入力欄の一時値（apiKeyInput）を保存ボタン押下で
 * 初めて永続化する（テーマとは異なり誤操作防止のため即時保存にしない）。
 */
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppSettings, SettingsStoreService } from '@core/settings/settings-store.service';
import { APP_VERSION, RELEASE_DATE } from '../../../version';
import { AccountPanel } from './account-panel/account-panel';

interface ReleaseNote {
  version: string;
  date: string;
  items: string[];
}

const MAX_RELEASE_NOTES = 5;

@Component({
  selector: 'app-settings',
  imports: [RouterLink, AccountPanel],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private settingsStore = inject(SettingsStoreService);
  private http = inject(HttpClient);

  // ── GitHubリポジトリ導線 ───────────────────────────────────────
  readonly githubUrl = 'https://github.com/rmatsuo-jp/media-log';

  // ── バージョン情報 ────────────────────────────────────────────
  readonly appVersion = APP_VERSION;
  readonly releaseDate = RELEASE_DATE;
  releaseNotes = signal<ReleaseNote[]>([]);

  // ── 状態管理（signal） ────────────────────────────────────────────
  settings = signal<AppSettings>(this.settingsStore.getSettings());

  // ── Google Books APIキー（保存ボタン押下まで反映しない一時値） ──────
  apiKeyInput = signal(this.settingsStore.getSettings().googleBooksApiKey);
  showApiKey = signal(false);
  hasSavedApiKey = computed(() => !!this.settings().googleBooksApiKey);

  constructor() {
    this.http.get('CHANGELOG.md', { responseType: 'text' }).subscribe({
      next: (text) => this.releaseNotes.set(this.parseChangelog(text)),
      error: () => this.releaseNotes.set([]),
    });
  }

  // CHANGELOG.md（semantic-release生成）の見出し・箇条書きのみを軽量抽出する。
  private parseChangelog(text: string): ReleaseNote[] {
    const notes: ReleaseNote[] = [];
    const headingRe = /^#{1,2} \[?(\d+\.\d+\.\d+)\]?.*\((\d{4}-\d{2}-\d{2})\)/gm;
    const headings = [...text.matchAll(headingRe)];

    for (let i = 0; i < headings.length && notes.length < MAX_RELEASE_NOTES; i++) {
      const heading = headings[i];
      const start = heading.index! + heading[0].length;
      const end = headings[i + 1]?.index ?? text.length;
      const body = text.slice(start, end);
      const items = [...body.matchAll(/^\* (.+?)(?: \(\[.+\]\(.+\)\))?$/gm)].map((m) =>
        m[1].trim(),
      );

      notes.push({ version: heading[1], date: heading[2], items });
    }

    return notes;
  }

  // ── テーマ（即時保存。DOM への反映と永続化を同時に行う） ──────────
  updateTheme(theme: AppSettings['theme']) {
    document.documentElement.dataset['theme'] = theme;
    this.persist({ ...this.settingsStore.getSettings(), theme });
  }

  private persist(next: AppSettings) {
    this.settings.set(next);
    this.settingsStore.saveSettings(next);
  }

  // ── Google Books APIキー ──────────────────────────────────────────
  toggleShowApiKey(): void {
    this.showApiKey.update((v) => !v);
  }

  saveApiKey(): void {
    const googleBooksApiKey = this.apiKeyInput().trim();
    this.apiKeyInput.set(googleBooksApiKey);
    this.persist({ ...this.settingsStore.getSettings(), googleBooksApiKey });
  }

  clearApiKey(): void {
    this.apiKeyInput.set('');
    this.persist({ ...this.settingsStore.getSettings(), googleBooksApiKey: '' });
  }
}
