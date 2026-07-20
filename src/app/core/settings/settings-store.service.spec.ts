import { SettingsStoreService } from './settings-store.service';

describe('SettingsStoreService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('デフォルト設定を返す', () => {
    const service = new SettingsStoreService();
    expect(service.getSettings()).toEqual({ theme: 'dark', googleBooksApiKey: '' });
  });

  it('saveSettings()で保存した内容がgetSettings()で復元される', () => {
    const service = new SettingsStoreService();
    service.saveSettings({ theme: 'light', googleBooksApiKey: 'AIzaTest' });

    const reader = new SettingsStoreService();
    expect(reader.getSettings()).toEqual({ theme: 'light', googleBooksApiKey: 'AIzaTest' });
  });
});
