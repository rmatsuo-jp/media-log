import { MediaType } from './media.model';
import {
  MEDIA_TYPE_META,
  MEDIA_TYPE_OPTIONS,
  MEDIA_TYPE_FILTER_OPTIONS,
} from './media-type-meta';

describe('MEDIA_TYPE_META', () => {
  const allTypes = Object.keys(MEDIA_TYPE_META) as MediaType[];

  it('全種別に全フィールドが定義されている（新種別追加時の回帰アンカー）', () => {
    for (const type of allTypes) {
      const meta = MEDIA_TYPE_META[type];
      expect(meta.label).toBeTruthy();
      expect(meta.badgeVariant).toBeTruthy();
      expect(meta.importGroupTitle).toBeTruthy();
      expect(meta.importPanelLabel).toBeTruthy();
      expect(meta.importUnitNoun).toBeTruthy();
      expect(meta.formatUnit(1)).toContain('1');
    }
  });

  it('mangaは「n巻」、animeは「第n話」で表記する', () => {
    expect(MEDIA_TYPE_META.manga.formatUnit(3)).toBe('3巻');
    expect(MEDIA_TYPE_META.anime.formatUnit(3)).toBe('第3話');
  });

  it('MEDIA_TYPE_OPTIONSは全種別を網羅する', () => {
    expect(MEDIA_TYPE_OPTIONS.map((o) => o.value)).toEqual(allTypes);
  });

  it('MEDIA_TYPE_FILTER_OPTIONSは全種別+bothで構成される', () => {
    expect(MEDIA_TYPE_FILTER_OPTIONS.map((o) => o.value)).toEqual([...allTypes, 'both']);
    expect(MEDIA_TYPE_FILTER_OPTIONS.at(-1)?.label).toBe('すべて');
  });
});
