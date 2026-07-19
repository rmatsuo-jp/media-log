/**
 * @file 作品取り込み検索の詳細設定（成人向け表示可否）のローカル永続化ストア。
 */
import { Injectable } from '@angular/core';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const WORK_IMPORT_SETTINGS_KEY = 'work_import_settings';

export interface WorkImportSettings {
  includeAdult: boolean;
}

const DEFAULT_SETTINGS: WorkImportSettings = {
  includeAdult: false,
};

@Injectable({ providedIn: 'root' })
export class WorkImportSettingsService {
  getSettings(): WorkImportSettings {
    return {
      ...DEFAULT_SETTINGS,
      ...readJson<Partial<WorkImportSettings>>(WORK_IMPORT_SETTINGS_KEY, {}),
    };
  }

  saveSettings(settings: WorkImportSettings): void {
    writeJson(WORK_IMPORT_SETTINGS_KEY, settings);
  }
}
