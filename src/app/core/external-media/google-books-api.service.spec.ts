import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GoogleBooksApiService } from './google-books-api.service';

describe('GoogleBooksApiService', () => {
  let service: GoogleBooksApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GoogleBooksApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('設定画面で保存したAPIキーがあればkeyパラメータに付与する', () => {
    localStorage.setItem(
      'app_settings',
      JSON.stringify({ theme: 'dark', googleBooksApiKey: 'AIzaUserKey' }),
    );

    service.searchVolumes('鬼滅の刃').subscribe();

    const req = httpMock.expectOne((r) =>
      r.urlWithParams.startsWith('https://www.googleapis.com/books/v1/volumes?'),
    );
    expect(req.request.urlWithParams).toContain('key=AIzaUserKey');
    req.flush({ items: [] });
  });

  it('タイトルから巻数・ISBN・表紙を抽出する', () => {
    let result: unknown;
    service.searchVolumes('鬼滅の刃').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) =>
      r.urlWithParams.startsWith('https://www.googleapis.com/books/v1/volumes?'),
    );
    req.flush({
      items: [
        {
          volumeInfo: {
            title: '鬼滅の刃 1',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784000000001' }],
            imageLinks: { thumbnail: 'http://example.com/1.jpg' },
          },
        },
        {
          volumeInfo: {
            title: '鬼滅の刃 第2巻',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784000000002' }],
            imageLinks: { thumbnail: 'http://example.com/2.jpg' },
          },
        },
      ],
    });

    expect(result).toEqual([
      {
        isbn13: '9784000000001',
        isbn10: undefined,
        volumeNumber: 1,
        title: '鬼滅の刃 1',
        coverImageUrl: 'https://example.com/1.jpg',
      },
      {
        isbn13: '9784000000002',
        isbn10: undefined,
        volumeNumber: 2,
        title: '鬼滅の刃 第2巻',
        coverImageUrl: 'https://example.com/2.jpg',
      },
    ]);
  });

  it('巻数の後に出版社レーベル名等が続く表記でも巻数を抽出する', () => {
    let result: unknown;
    service.searchVolumes('ブルーロック').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) =>
      r.urlWithParams.startsWith('https://www.googleapis.com/books/v1/volumes?'),
    );
    req.flush({
      items: [
        {
          volumeInfo: {
            title: 'ブルーロック(39) (講談社コミックス)',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784000000039' }],
          },
        },
      ],
    });

    expect(result).toEqual([
      {
        isbn13: '9784000000039',
        isbn10: undefined,
        volumeNumber: 39,
        title: 'ブルーロック(39) (講談社コミックス)',
        coverImageUrl: undefined,
      },
    ]);
  });

  it('シリーズタイトルに一致しない候補は除外する', () => {
    let result: unknown;
    service.searchVolumes('鬼滅の刃').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) =>
      r.urlWithParams.startsWith('https://www.googleapis.com/books/v1/volumes?'),
    );
    req.flush({
      items: [{ volumeInfo: { title: '無関係な作品 1' } }],
    });

    expect(result).toEqual([]);
  });

  it('巻数を抽出できない候補は除外する', () => {
    let result: unknown;
    service.searchVolumes('鬼滅の刃').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) =>
      r.urlWithParams.startsWith('https://www.googleapis.com/books/v1/volumes?'),
    );
    req.flush({
      items: [{ volumeInfo: { title: '鬼滅の刃' } }],
    });

    expect(result).toEqual([]);
  });

  it('totalItemsが40件を超える場合はstartIndexをずらして追加取得する', () => {
    let result: unknown;
    service.searchVolumes('鬼滅の刃').subscribe((r) => (result = r));

    const firstReq = httpMock.expectOne((r) => r.urlWithParams.includes('startIndex=0'));
    firstReq.flush({
      totalItems: 45,
      items: [
        {
          volumeInfo: {
            title: '鬼滅の刃 1',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784000000001' }],
          },
        },
      ],
    });

    const secondReq = httpMock.expectOne((r) => r.urlWithParams.includes('startIndex=40'));
    secondReq.flush({
      totalItems: 45,
      items: [
        {
          volumeInfo: {
            title: '鬼滅の刃 第41巻',
            industryIdentifiers: [{ type: 'ISBN_13', identifier: '9784000000041' }],
          },
        },
      ],
    });

    expect(result).toEqual([
      {
        isbn13: '9784000000001',
        isbn10: undefined,
        volumeNumber: 1,
        title: '鬼滅の刃 1',
        coverImageUrl: undefined,
      },
      {
        isbn13: '9784000000041',
        isbn10: undefined,
        volumeNumber: 41,
        title: '鬼滅の刃 第41巻',
        coverImageUrl: undefined,
      },
    ]);
  });
});
