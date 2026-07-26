import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MangaVolumeLookupService } from './manga-volume-lookup.service';
import { GoogleBooksApiService } from './google-books-api.service';
import { NdlApiService } from './ndl-api.service';
import { OpenBdApiService } from './openbd-api.service';
import { ExternalUnitCandidate } from './external-media.model';

describe('MangaVolumeLookupService', () => {
  let service: MangaVolumeLookupService;
  let googleBooks: { searchVolumes: ReturnType<typeof vi.fn> };
  let openBd: { getByIsbns: ReturnType<typeof vi.fn> };
  let ndlApi: { searchIsbnsForVolumes: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    googleBooks = { searchVolumes: vi.fn() };
    openBd = { getByIsbns: vi.fn().mockReturnValue(of(new Map())) };
    ndlApi = { searchIsbnsForVolumes: vi.fn().mockReturnValue(of(new Map())) };

    TestBed.configureTestingModule({
      providers: [
        MangaVolumeLookupService,
        { provide: GoogleBooksApiService, useValue: googleBooks },
        { provide: OpenBdApiService, useValue: openBd },
        { provide: NdlApiService, useValue: ndlApi },
      ],
    });
    service = TestBed.inject(MangaVolumeLookupService);
  });

  it('Google Booksが0件の場合はopenBDを呼ばず空配列を返す', () => {
    googleBooks.searchVolumes.mockReturnValue(of([]));

    let result: unknown;
    service.getVolumes('鬼滅の刃').subscribe((r) => (result = r));

    expect(openBd.getByIsbns).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('表紙画像が取得できない巻も除外せず候補に含める', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([{ isbn13: '9784000000001', volumeNumber: 1, title: '鬼滅の刃 1' }]),
    );
    openBd.getByIsbns.mockReturnValue(of(new Map()));

    let result: unknown;
    service.getVolumes('鬼滅の刃').subscribe((r) => (result = r));

    expect(result).toEqual([
      {
        number: 1,
        coverImageUrl: undefined,
        variantCoverImageUrls: undefined,
        isbns: ['9784000000001'],
        volumeNumberWarning: undefined,
      },
    ]);
  });

  it('Google Booksの表紙を優先しつつopenBD側の表紙も候補として残し、同一巻の複数候補はvariantCoverImageUrlsに集約する', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        {
          isbn13: '9784000000001',
          volumeNumber: 1,
          title: '鬼滅の刃 1',
          coverImageUrl: 'https://example.com/gb-1.jpg',
        },
        {
          isbn13: '9784000000002',
          volumeNumber: 1,
          title: '鬼滅の刃 1(愛蔵版)',
          coverImageUrl: 'https://example.com/gb-1b.jpg',
        },
      ]),
    );
    openBd.getByIsbns.mockReturnValue(
      of(
        new Map([
          [
            '9784000000001',
            { isbn: '9784000000001', title: '鬼滅の刃 1', coverImageUrl: 'https://example.com/ob-1.jpg' },
          ],
        ]),
      ),
    );

    let result: unknown;
    service.getVolumes('鬼滅の刃').subscribe((r) => (result = r));

    expect(result).toEqual([
      {
        number: 1,
        coverImageUrl: 'https://example.com/gb-1.jpg',
        variantCoverImageUrls: [
          'https://example.com/gb-1.jpg',
          'https://example.com/ob-1.jpg',
          'https://example.com/gb-1b.jpg',
        ],
        isbns: ['9784000000001', '9784000000002'],
        volumeNumberWarning: undefined,
      },
    ]);
  });

  it('openBDとGoogle Booksの表紙が同一URLの場合は重複させない', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        {
          isbn13: '9784000000001',
          volumeNumber: 1,
          title: '鬼滅の刃 1',
          coverImageUrl: 'https://example.com/same.jpg',
        },
      ]),
    );
    openBd.getByIsbns.mockReturnValue(
      of(
        new Map([
          [
            '9784000000001',
            { isbn: '9784000000001', title: '鬼滅の刃 1', coverImageUrl: 'https://example.com/same.jpg' },
          ],
        ]),
      ),
    );

    let result: unknown;
    service.getVolumes('鬼滅の刃').subscribe((r) => (result = r));

    expect(result).toEqual([
      {
        number: 1,
        coverImageUrl: 'https://example.com/same.jpg',
        variantCoverImageUrls: ['https://example.com/same.jpg'],
        isbns: ['9784000000001'],
        volumeNumberWarning: undefined,
      },
    ]);
  });

  it('検索で見つかった最大巻数までの巻を欠番なく生成する（見つからなかった巻は表紙なしで補う）', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        {
          isbn13: '9784000000001',
          volumeNumber: 1,
          title: 'ブルーロック 1',
          coverImageUrl: 'https://example.com/1.jpg',
        },
        {
          isbn13: '9784000000039',
          volumeNumber: 39,
          title: 'ブルーロック 39',
          coverImageUrl: 'https://example.com/39.jpg',
        },
      ]),
    );
    openBd.getByIsbns.mockReturnValue(of(new Map()));

    let result: unknown;
    service.getVolumes('ブルーロック').subscribe((r) => (result = r as ExternalUnitCandidate[]));
    const candidates = result as ExternalUnitCandidate[];

    expect(candidates).toHaveLength(39);
    expect(candidates[0]).toEqual({
      number: 1,
      coverImageUrl: 'https://example.com/1.jpg',
      variantCoverImageUrls: ['https://example.com/1.jpg'],
      isbns: ['9784000000001'],
      volumeNumberWarning: undefined,
    });
    expect(candidates[12]).toEqual({
      number: 13,
      coverImageUrl: undefined,
      variantCoverImageUrls: undefined,
      isbns: undefined,
      volumeNumberWarning: undefined,
    });
    expect(candidates[38]).toEqual({
      number: 39,
      coverImageUrl: 'https://example.com/39.jpg',
      variantCoverImageUrls: ['https://example.com/39.jpg'],
      isbns: ['9784000000039'],
      volumeNumberWarning: undefined,
    });
  });

  it('Google Books/openBDで見つからなかった巻はNDLで検索したISBNをopenBDに渡して表紙を補完する', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        {
          isbn13: '9784000000001',
          volumeNumber: 1,
          title: 'ブルーロック 1',
          coverImageUrl: 'https://example.com/1.jpg',
        },
        { isbn13: '9784000000002', volumeNumber: 2, title: 'ブルーロック 2' },
      ]),
    );
    openBd.getByIsbns.mockImplementation((isbns: string[]) => {
      if (isbns.includes('9999999999999')) {
        return of(
          new Map([
            [
              '9999999999999',
              { isbn: '9999999999999', coverImageUrl: 'https://example.com/ndl-2.jpg' },
            ],
          ]),
        );
      }
      return of(new Map());
    });
    ndlApi.searchIsbnsForVolumes.mockReturnValue(of(new Map([[2, '9999999999999']])));

    let result: unknown;
    service.getVolumes('ブルーロック').subscribe((r) => (result = r));

    expect(ndlApi.searchIsbnsForVolumes).toHaveBeenCalledWith('ブルーロック', [2]);
    expect(result).toEqual([
      {
        number: 1,
        coverImageUrl: 'https://example.com/1.jpg',
        variantCoverImageUrls: ['https://example.com/1.jpg'],
        isbns: ['9784000000001'],
        volumeNumberWarning: undefined,
      },
      {
        number: 2,
        coverImageUrl: 'https://example.com/ndl-2.jpg',
        variantCoverImageUrls: ['https://example.com/ndl-2.jpg'],
        isbns: ['9784000000002', '9999999999999'],
        volumeNumberWarning: undefined,
      },
    ]);
  });

  it('NDLでも見つからなければ表紙なし・巻数のみの候補のままにする', () => {
    googleBooks.searchVolumes.mockReturnValue(of([{ isbn13: '9784000000002', volumeNumber: 2 }]));
    openBd.getByIsbns.mockReturnValue(of(new Map()));
    ndlApi.searchIsbnsForVolumes.mockReturnValue(of(new Map()));

    let result: unknown;
    service.getVolumes('作品').subscribe((r) => (result = r));

    expect(result).toEqual([
      {
        number: 1,
        coverImageUrl: undefined,
        variantCoverImageUrls: undefined,
        isbns: undefined,
        volumeNumberWarning: undefined,
      },
      {
        number: 2,
        coverImageUrl: undefined,
        variantCoverImageUrls: undefined,
        isbns: ['9784000000002'],
        volumeNumberWarning: undefined,
      },
    ]);
  });

  it('小数巻（特別編等）は欠番補完の対象にせず、見つかった分のみ末尾に追加する', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        { isbn13: '9784000000001', volumeNumber: 1, title: '作品 1' },
        { isbn13: '9784000000002', volumeNumber: 1.5, title: '作品 1.5' },
      ]),
    );
    openBd.getByIsbns.mockReturnValue(of(new Map()));

    let result: unknown;
    service.getVolumes('作品').subscribe((r) => (result = r as ExternalUnitCandidate[]));
    const candidates = result as ExternalUnitCandidate[];

    expect(candidates.map((c) => c.number)).toEqual([1, 1.5]);
  });

  it('同一ISBNの重複候補（ページング重複等）は1件に統合し、表紙URLを二重集計しない', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        {
          isbn13: '9784000000001',
          volumeNumber: 1,
          title: '鬼滅の刃 1',
          coverImageUrl: 'https://example.com/gb-1.jpg',
        },
        {
          isbn13: '9784000000001',
          volumeNumber: 1,
          title: '鬼滅の刃 1',
          coverImageUrl: 'https://example.com/gb-1.jpg',
        },
      ]),
    );
    openBd.getByIsbns.mockReturnValue(of(new Map()));

    let result: unknown;
    service.getVolumes('鬼滅の刃').subscribe((r) => (result = r as ExternalUnitCandidate[]));
    const candidates = result as ExternalUnitCandidate[];

    expect(candidates).toEqual([
      {
        number: 1,
        coverImageUrl: 'https://example.com/gb-1.jpg',
        variantCoverImageUrls: ['https://example.com/gb-1.jpg'],
        isbns: ['9784000000001'],
        volumeNumberWarning: undefined,
      },
    ]);
  });

  it('同一巻番号に異なるISBNが3件以上集まった場合はvolumeNumberWarningを付与する', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        { isbn13: '9784000000001', volumeNumber: 1, title: '作品 1' },
        { isbn13: '9784000000002', volumeNumber: 1, title: '作品 1(愛蔵版)' },
        { isbn13: '9784000000003', volumeNumber: 1, title: '作品 1(新装版)' },
      ]),
    );
    openBd.getByIsbns.mockReturnValue(of(new Map()));

    let result: unknown;
    service.getVolumes('作品').subscribe((r) => (result = r as ExternalUnitCandidate[]));
    const candidates = result as ExternalUnitCandidate[];

    expect(candidates[0].volumeNumberWarning).toBe(
      '表紙候補が複数見つかりました。誤った巻の可能性があります',
    );
  });

  it('同一巻番号の異なるISBNが2件以下の場合はvolumeNumberWarningを付与しない（通常の版違い統合）', () => {
    googleBooks.searchVolumes.mockReturnValue(
      of([
        { isbn13: '9784000000001', volumeNumber: 1, title: '作品 1' },
        { isbn13: '9784000000002', volumeNumber: 1, title: '作品 1(愛蔵版)' },
      ]),
    );
    openBd.getByIsbns.mockReturnValue(of(new Map()));

    let result: unknown;
    service.getVolumes('作品').subscribe((r) => (result = r as ExternalUnitCandidate[]));
    const candidates = result as ExternalUnitCandidate[];

    expect(candidates[0].volumeNumberWarning).toBeUndefined();
  });
});
