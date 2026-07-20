/**
 * @file マンガの巻候補取得のオーケストレーション。Google Booksでシリーズタイトルから巻（ISBN・巻数・表紙）
 * を検索し、得られたISBN群をopenBDに渡して日本語の正確な書誌情報（表紙・発売日）で補完する。
 * MangaDex時代のsearchManga→getVolumesの2段構成に相当する。openBD側に情報があればcoverImageUrl/titleを
 * 優先差し替えし、なければGoogle Books側の情報をそのまま使う。同一巻番号に複数マッチがある場合は
 * variantCoverImageUrlsに集約する（MangaDexのMap<number, string[]>集約パターンを踏襲）。
 * 表紙画像が取得できない巻（Google Books・openBDのどちらにも表紙がない）も候補自体は除外しない
 * （coverImageUrl未指定のまま返し、UI側のプレースホルダー表示に委ねる。以前は無条件に除外しており、
 * 取得できる巻数が実際より少なく見える不具合の原因になっていた）。
 * Google Books側が0件の場合は例外を投げず空配列を返す。
 */
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { ExternalUnitCandidate } from './external-media.model';
import { GoogleBooksApiService, GoogleBooksVolumeMatch } from './google-books-api.service';
import { OpenBdApiService, OpenBdBookInfo } from './openbd-api.service';

function mergeAndGroupByVolume(
  matches: GoogleBooksVolumeMatch[],
  openBdByIsbn: Map<string, OpenBdBookInfo>,
): ExternalUnitCandidate[] {
  const byVolume = new Map<number, { title?: string; urls: string[] }>();
  for (const match of matches) {
    const openBd = match.isbn13 ? openBdByIsbn.get(match.isbn13) : undefined;
    const coverImageUrl = openBd?.coverImageUrl ?? match.coverImageUrl;
    const entry = byVolume.get(match.volumeNumber) ?? { urls: [] };
    entry.title = entry.title ?? openBd?.title ?? match.title;
    if (coverImageUrl) entry.urls.push(coverImageUrl);
    byVolume.set(match.volumeNumber, entry);
  }
  return Array.from(byVolume.entries())
    .map(([number, { title, urls }]) => ({
      number,
      title,
      coverImageUrl: urls[0],
      variantCoverImageUrls: urls.length > 0 ? urls : undefined,
    }))
    .sort((a, b) => a.number - b.number);
}

@Injectable({ providedIn: 'root' })
export class MangaVolumeLookupService {
  private googleBooks = inject(GoogleBooksApiService);
  private openBd = inject(OpenBdApiService);

  getVolumes(seriesTitle: string): Observable<ExternalUnitCandidate[]> {
    return this.googleBooks.searchVolumes(seriesTitle).pipe(
      switchMap((matches) => {
        if (matches.length === 0) return of([]);
        const isbns = matches.map((m) => m.isbn13).filter((isbn): isbn is string => !!isbn);
        return this.openBd
          .getByIsbns(isbns)
          .pipe(map((openBdByIsbn) => mergeAndGroupByVolume(matches, openBdByIsbn)));
      }),
    );
  }
}
