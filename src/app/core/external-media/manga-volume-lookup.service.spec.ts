import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MangaVolumeLookupService } from './manga-volume-lookup.service';
import { GoogleBooksApiService } from './google-books-api.service';
import { OpenBdApiService } from './openbd-api.service';

describe('MangaVolumeLookupService', () => {
  let service: MangaVolumeLookupService;
  let googleBooks: { searchVolumes: ReturnType<typeof vi.fn> };
  let openBd: { getByIsbns: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    googleBooks = { searchVolumes: vi.fn() };
    openBd = { getByIsbns: vi.fn().mockReturnValue(of(new Map())) };

    TestBed.configureTestingModule({
      providers: [
        MangaVolumeLookupService,
        { provide: GoogleBooksApiService, useValue: googleBooks },
        { provide: OpenBdApiService, useValue: openBd },
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
      { number: 1, title: '鬼滅の刃 1', coverImageUrl: undefined, variantCoverImageUrls: undefined },
    ]);
  });

  it('openBDの表紙・タイトルがあれば優先し、同一巻の複数候補はvariantCoverImageUrlsに集約する', () => {
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
        title: '鬼滅の刃 1',
        coverImageUrl: 'https://example.com/ob-1.jpg',
        variantCoverImageUrls: ['https://example.com/ob-1.jpg', 'https://example.com/gb-1b.jpg'],
      },
    ]);
  });
});
