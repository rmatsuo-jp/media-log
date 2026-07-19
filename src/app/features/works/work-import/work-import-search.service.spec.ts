import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { AnilistApiService } from '@core/external-media/anilist-api.service';
import { MangadexApiService } from '@core/external-media/mangadex-api.service';
import { WorkImportSettingsService } from './work-import-settings.service';
import { WorkImportSearchService } from './work-import-search.service';

describe('WorkImportSearchService', () => {
  let service: WorkImportSearchService;
  let anilist: {
    searchWorks: ReturnType<typeof vi.fn>;
    getAnimeEpisodes: ReturnType<typeof vi.fn>;
  };
  let mangadex: { searchManga: ReturnType<typeof vi.fn>; getVolumes: ReturnType<typeof vi.fn> };

  const result: ExternalWorkSearchResult = {
    mediaType: 'manga',
    externalSource: 'anilist',
    externalId: '1',
    title: 'Test Work',
    titleNative: 'テスト作品',
    popularity: 10,
    averageScore: 80,
  };

  beforeEach(() => {
    anilist = { searchWorks: vi.fn().mockReturnValue(of([result])), getAnimeEpisodes: vi.fn() };
    mangadex = { searchManga: vi.fn(), getVolumes: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        WorkImportSearchService,
        { provide: AnilistApiService, useValue: anilist },
        { provide: MangadexApiService, useValue: mangadex },
        WorkImportSettingsService,
      ],
    });
    service = TestBed.inject(WorkImportSearchService);
  });

  it('search()で入力中のqueryを即時検索する', () => {
    service.query.set('test');
    service.search();
    expect(anilist.searchWorks).toHaveBeenCalledWith('test', 'manga', false);
    expect(service.searchResults()).toEqual([result]);
  });

  it('queryの変更を400msデバウンスして自動検索する', async () => {
    service.query.set('te');
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(anilist.searchWorks).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(anilist.searchWorks).toHaveBeenCalledWith('te', 'manga', false);
  });

  it('トリム後2文字未満では自動検索しない', async () => {
    service.query.set('a');
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(anilist.searchWorks).not.toHaveBeenCalled();
    expect(service.searchResults()).toEqual([]);
  });

  it('sortByをpopularityにすると人気度降順に並び替える', () => {
    service.searchResults.set([
      { ...result, externalId: '1', popularity: 5 },
      { ...result, externalId: '2', popularity: 20 },
    ]);
    service.setSortBy('popularity');
    expect(service.sortedResults().map((r) => r.externalId)).toEqual(['2', '1']);
  });

  it('loadCandidatesForはmangaの場合MangaDexをAniList IDで突き合わせて巻を取得する', () => {
    mangadex.searchManga.mockReturnValue(
      of([
        {
          mediaType: 'manga',
          externalSource: 'mangadex',
          externalId: 'md-1',
          title: 'x',
          anilistId: '1',
        },
        {
          mediaType: 'manga',
          externalSource: 'mangadex',
          externalId: 'md-2',
          title: 'y',
          anilistId: '999',
        },
      ]),
    );
    mangadex.getVolumes.mockReturnValue(of([{ number: 1, coverImageUrl: 'a.jpg' }]));

    let loaded: unknown;
    service.loadCandidatesFor(result, (candidates) => (loaded = candidates));

    expect(mangadex.getVolumes).toHaveBeenCalledWith('md-1');
    expect(loaded).toEqual([{ number: 1, coverImageUrl: 'a.jpg' }]);
    expect(service.candidates()).toEqual([{ number: 1, coverImageUrl: 'a.jpg' }]);
  });

  it('AniList IDが一致しない場合は巻候補を0件にする', () => {
    mangadex.searchManga.mockReturnValue(
      of([
        {
          mediaType: 'manga',
          externalSource: 'mangadex',
          externalId: 'md-2',
          title: 'y',
          anilistId: '999',
        },
      ]),
    );

    let loaded: unknown;
    service.loadCandidatesFor(result, (candidates) => (loaded = candidates));

    expect(mangadex.getVolumes).not.toHaveBeenCalled();
    expect(loaded).toEqual([]);
  });

  it('setIncludeAdultは設定を永続化する', () => {
    const settings = TestBed.inject(WorkImportSettingsService);
    vi.spyOn(settings, 'saveSettings');
    service.setIncludeAdult(true);
    expect(service.includeAdult()).toBe(true);
    expect(settings.saveSettings).toHaveBeenCalledWith({ includeAdult: true });
  });
});
