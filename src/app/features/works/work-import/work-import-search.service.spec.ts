import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { AnilistApiService } from '@core/external-media/anilist-api.service';
import { MangaVolumeLookupService } from '@core/external-media/manga-volume-lookup.service';
import { WorkImportSettingsService } from './work-import-settings.service';
import { WorkImportSearchService } from './work-import-search.service';

describe('WorkImportSearchService', () => {
  let service: WorkImportSearchService;
  let anilist: {
    searchWorks: ReturnType<typeof vi.fn>;
    getAnimeEpisodes: ReturnType<typeof vi.fn>;
  };
  let mangaVolumeLookup: { getVolumes: ReturnType<typeof vi.fn> };

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
    mangaVolumeLookup = { getVolumes: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        WorkImportSearchService,
        { provide: AnilistApiService, useValue: anilist },
        { provide: MangaVolumeLookupService, useValue: mangaVolumeLookup },
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

  it('loadCandidatesForはmangaの場合MangaVolumeLookupServiceに日本語タイトル(titleNative)を渡して巻を取得する', () => {
    mangaVolumeLookup.getVolumes.mockReturnValue(of([{ number: 1, coverImageUrl: 'a.jpg' }]));

    let loaded: unknown;
    service.loadCandidatesFor(result, (candidates) => (loaded = candidates));

    expect(mangaVolumeLookup.getVolumes).toHaveBeenCalledWith('テスト作品');
    expect(loaded).toEqual([{ number: 1, coverImageUrl: 'a.jpg' }]);
    expect(service.candidates()).toEqual([{ number: 1, coverImageUrl: 'a.jpg' }]);
  });

  it('loadCandidatesForはtitleNativeが無い場合titleにフォールバックする', () => {
    mangaVolumeLookup.getVolumes.mockReturnValue(of([]));
    const resultWithoutNative = { ...result, titleNative: undefined };

    service.loadCandidatesFor(resultWithoutNative, () => {});

    expect(mangaVolumeLookup.getVolumes).toHaveBeenCalledWith('Test Work');
  });

  it('候補が見つからない場合は巻候補を0件にする', () => {
    mangaVolumeLookup.getVolumes.mockReturnValue(of([]));

    let loaded: unknown;
    service.loadCandidatesFor(result, (candidates) => (loaded = candidates));

    expect(loaded).toEqual([]);
  });

  it('外部APIがエラーの場合はcandidatesErrorを設定し「該当なし」とは区別する', () => {
    mangaVolumeLookup.getVolumes.mockReturnValue(throwError(() => new Error('504')));

    let loaded: unknown;
    service.loadCandidatesFor(result, (candidates) => (loaded = candidates));

    expect(loaded).toEqual([]);
    expect(service.candidates()).toEqual([]);
    expect(service.candidatesError()).not.toBeNull();
  });

  it('retryLastLoadCandidatesは直近のloadCandidatesForを再実行する', () => {
    mangaVolumeLookup.getVolumes.mockReturnValueOnce(throwError(() => new Error('504')));
    let loaded: unknown;
    service.loadCandidatesFor(result, (candidates) => (loaded = candidates));
    expect(service.candidatesError()).not.toBeNull();

    mangaVolumeLookup.getVolumes.mockReturnValue(of([{ number: 1, coverImageUrl: 'a.jpg' }]));

    service.retryLastLoadCandidates();

    expect(mangaVolumeLookup.getVolumes).toHaveBeenCalledTimes(2);
    expect(service.candidatesError()).toBeNull();
    expect(loaded).toEqual([{ number: 1, coverImageUrl: 'a.jpg' }]);
  });

  it('setIncludeAdultは設定を永続化する', () => {
    const settings = TestBed.inject(WorkImportSettingsService);
    vi.spyOn(settings, 'saveSettings');
    service.setIncludeAdult(true);
    expect(service.includeAdult()).toBe(true);
    expect(settings.saveSettings).toHaveBeenCalledWith({ includeAdult: true });
  });
});
