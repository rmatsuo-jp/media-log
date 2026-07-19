import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MangadexApiService } from './mangadex-api.service';

describe('MangadexApiService', () => {
  let service: MangadexApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MangadexApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('検索結果をカバー画像付きで返す', () => {
    let result: unknown;
    service.searchManga('鬼滅の刃').subscribe((r) => (result = r));

    const req = httpMock.expectOne(
      (r) => r.url === 'https://api.mangadex.org/manga' || r.urlWithParams.startsWith(
        'https://api.mangadex.org/manga?',
      ),
    );
    req.flush({
      data: [
        {
          id: 'manga-1',
          attributes: { title: { ja: '鬼滅の刃', en: 'Demon Slayer' } },
          relationships: [{ id: 'cover-1', type: 'cover_art', attributes: { fileName: 'cover.jpg' } }],
        },
      ],
    });

    expect(result).toEqual([
      {
        mediaType: 'manga',
        externalSource: 'mangadex',
        externalId: 'manga-1',
        title: '鬼滅の刃',
        coverImageUrl: 'https://uploads.mangadex.org/covers/manga-1/cover.jpg.512.jpg',
      },
    ]);
  });

  it('巻ごとのカバーを巻数昇順で返す', () => {
    let result: unknown;
    service.getVolumes('manga-1').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.urlWithParams.startsWith('https://api.mangadex.org/cover?'));
    req.flush({
      data: [
        { attributes: { volume: '2', fileName: 'v2.jpg' } },
        { attributes: { volume: '1', fileName: 'v1.jpg' } },
        { attributes: { volume: null, fileName: 'v-none.jpg' } },
      ],
    });

    expect(result).toEqual([
      { number: 1, coverImageUrl: 'https://uploads.mangadex.org/covers/manga-1/v1.jpg.512.jpg' },
      { number: 2, coverImageUrl: 'https://uploads.mangadex.org/covers/manga-1/v2.jpg.512.jpg' },
    ]);
  });
});
