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

  it('讀懃ｴ｢邨先棡繧脱xternalWorkSearchResult縺ｸ螟画鋤縺吶ｋ', () => {
    let result: unknown;
    service.searchWorks('繝ｯ繝ｳ繝斐・繧ｹ', 'manga').subscribe((r) => (result = r));

    const req = httpMock.expectOne('https://graphql.anilist.co');
    expect(req.request.body.variables).toEqual({
      search: '繝ｯ繝ｳ繝斐・繧ｹ',
      type: 'MANGA',
      isAdult: false,
    });
    req.flush({
      data: {
        Page: {
          media: [
            {
              id: 30013,
              type: 'MANGA',
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

  it('includeAdult縺荊rue縺ｮ蝣ｴ蜷医・isAdult繝輔ぅ繝ｫ繧ｿ縺ｪ縺励〒讀懃ｴ｢縺吶ｋ', () => {
    service.searchWorks('繝ｯ繝ｳ繝斐・繧ｹ', 'manga', true).subscribe();

    const req = httpMock.expectOne('https://graphql.anilist.co');
    expect(req.request.body.variables).toEqual({
      search: '繝ｯ繝ｳ繝斐・繧ｹ',
      type: 'MANGA',
      isAdult: undefined,
    });
    req.flush({ data: { Page: { media: [] } } });
  });

  it('streamingEpisodes縺後↑縺・ｴ蜷医・遨ｺ驟榊・繧定ｿ斐☆', () => {
    let result: unknown;
    service.getAnimeEpisodes('21').subscribe((r) => (result = r));

    const req = httpMock.expectOne('https://graphql.anilist.co');
    req.flush({ data: { Media: { streamingEpisodes: null } } });

    expect(result).toEqual([]);
  });

  it('streamingEpisodes縺後≠繧句ｴ蜷医・繧ｵ繝繝阪う繝ｫ莉倥″蛟呵｣懊ｒ霑斐☆', () => {
    let result: unknown;
    service.getAnimeEpisodes('21').subscribe((r) => (result = r));

    const req = httpMock.expectOne('https://graphql.anilist.co');
    req.flush({
      data: {
        Media: {
          streamingEpisodes: [{ thumbnail: 'https://example.com/ep1.jpg' }],
        },
      },
    });

    expect(result).toEqual([{ number: 1, coverImageUrl: 'https://example.com/ep1.jpg' }]);
  });
});
