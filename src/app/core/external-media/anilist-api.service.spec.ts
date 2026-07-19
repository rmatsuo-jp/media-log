import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AnilistApiService } from './anilist-api.service';

describe('AnilistApiService', () => {
  let service: AnilistApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnilistApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('検索結果をExternalWorkSearchResultへ変換する', () => {
    let result: unknown;
    service.searchWorks('ワンピース', 'manga').subscribe((r) => (result = r));

    const req = httpMock.expectOne('https://graphql.anilist.co');
    expect(req.request.body.variables).toEqual({
      search: 'ワンピース',
      type: 'MANGA',
      isAdult: false,
    });
    req.flush({
      data: {
        Page: {
          media: [
            {
              id: 30013,
              title: { romaji: 'ONE PIECE', english: null, native: null },
              coverImage: { large: 'https://example.com/cover.jpg' },
              format: 'MANGA',
            },
          ],
        },
      },
    });

    expect(result).toEqual([
      {
        mediaType: 'manga',
        externalSource: 'anilist',
        externalId: '30013',
        title: 'ONE PIECE',
        coverImageUrl: 'https://example.com/cover.jpg',
        format: 'MANGA',
      },
    ]);
  });

  it('includeAdultがtrueの場合はisAdultフィルタなしで検索する', () => {
    service.searchWorks('ワンピース', 'manga', true).subscribe();

    const req = httpMock.expectOne('https://graphql.anilist.co');
    expect(req.request.body.variables).toEqual({
      search: 'ワンピース',
      type: 'MANGA',
      isAdult: null,
    });
    req.flush({ data: { Page: { media: [] } } });
  });

  it('streamingEpisodesがない場合は空配列を返す', () => {
    let result: unknown;
    service.getAnimeEpisodes('21').subscribe((r) => (result = r));

    const req = httpMock.expectOne('https://graphql.anilist.co');
    req.flush({ data: { Media: { streamingEpisodes: null } } });

    expect(result).toEqual([]);
  });

  it('streamingEpisodesがある場合はサムネイル付き候補を返す', () => {
    let result: unknown;
    service.getAnimeEpisodes('21').subscribe((r) => (result = r));

    const req = httpMock.expectOne('https://graphql.anilist.co');
    req.flush({
      data: {
        Media: {
          streamingEpisodes: [{ title: '第1話', thumbnail: 'https://example.com/ep1.jpg' }],
        },
      },
    });

    expect(result).toEqual([
      { number: 1, title: '第1話', coverImageUrl: 'https://example.com/ep1.jpg' },
    ]);
  });
});
