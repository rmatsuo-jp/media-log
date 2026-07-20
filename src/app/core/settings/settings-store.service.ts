/**
 * @file アプリ設定（テーマ、外部API連携キー）のローカル永続化を担うプラットフォーム共通ストア。
 * 機能固有の設定（作品データ等）は各featureが独自にストアを持つこと。
 * googleBooksApiKeyは平文でlocalStorageに保存する（他の設定項目と同水準。Web Crypto等による
 * 暗号化はしない）。GoogleBooksApiServiceがこの値を優先し、未設定時はenvironment.googleBooksApiKey
 * （ビルド時埋め込みの共有キー）にフォールバックする。
 */
import { Injectable } from '@angular/core';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const SETTINGS_KEY = 'app_settings';

export interface AppSettings {
  theme: 'light' | 'dark';
  googleBooksApiKey: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  googleBooksApiKey: '',
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
