/**
 * @file アプリ設定（テーマ）のローカル永続化を担うプラットフォーム共通ストア。
 * 機能固有の設定（作品データ等）は各featureが独自にストアを持つこと。
 */
import { Injectable } from '@angular/core';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  theme: 'light' | 'dark';
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
};

@Injectable({ providedIn: 'root' })
export class SettingsStoreService {
  getSettings(): AppSettings {
    return { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(SETTINGS_KEY, {}) };
  }

  saveSettings(settings: AppSettings): void {
    writeJson(SETTINGS_KEY, settings);
  }
}
