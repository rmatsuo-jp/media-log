import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { OpenBdApiService } from './openbd-api.service';

describe('OpenBdApiService', () => {
  let service: OpenBdApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(OpenBdApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('ISBNごとの書誌情報をMapで返し、該当なし(null)は除外する', () => {
    let result: Map<string, unknown> | undefined;
    service.getByIsbns(['9784000000001', '9784000000002']).subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.startsWith('https://api.openbd.jp/v1/get'));
    req.flush([
      {
        summary: {
          isbn: '9784000000001',
          title: '鬼滅の刃 1',
          cover: 'https://example.com/1.jpg',
          pubdate: '20160203',
        },
      },
      null,
    ]);

    expect(result).toEqual(
      new Map([
        [
          '9784000000001',
          {
            isbn: '9784000000001',
            title: '鬼滅の刃 1',
            coverImageUrl: 'https://example.com/1.jpg',
            pubDate: '20160203',
          },
        ],
      ]),
    );
  });

  it('ISBNが空配列の場合はリクエストせず空のMapを返す', () => {
    let result: Map<string, unknown> | undefined;
    service.getByIsbns([]).subscribe((r) => (result = r));

    httpMock.expectNone(() => true);
    expect(result).toEqual(new Map());
  });
});
