/**
 * @file マンガの巻候補取得のオーケストレーション。Google Booksでシリーズタイトルから巻（ISBN・巻数・表紙）
 * を検索し、得られたISBN群をopenBDに渡して日本語の正確な書誌情報（表紙・発売日）で補完する。
 * MangaDex時代のsearchManga→getVolumesの2段構成に相当する。openBD側に表紙があれば優先差し替えし、
 * なければGoogle Books側の表紙を使う。同一巻番号に複数マッチがある場合はvariantCoverImageUrlsに集約する
 * （MangaDexのMap<number, string[]>集約パターンを踏襲）。UIでは巻数のみを表示しタイトル文字列は使わない
 * ため、ExternalUnitCandidateにtitleは持たせない。
 * それでも表紙が見つからない巻（Google Books側にISBNが無い、またはopenBDに該当レコードが無い）については、
 * NdlApiService（国立国会図書館サーチ）にシリーズタイトル＋欠けている巻番号一覧を渡して1リクエストで
 * まとめて検索させ、得られたISBNを再度openBDへ渡して表紙を補完する（第2段のISBN取得）。巻ごとに別々の
 * リクエストを投げるとNDL側の同時アクセス数上限に達し429になることが判明したため、1リクエストで
 * 複数巻ぶんをまとめて処理する設計にしている。NDL検索の対象はNDL_LOOKUP_MAX件までに制限し、それでも
 * 見つからない巻は表紙画像なし・巻数のみの候補として残す（表紙は「取得できれば添える補助情報」であって
 * 主目的ではなく、巻数（1〜最新刊）を穴あきなく提示することを優先する方針のため）。
 * さらに、検索結果に含まれる整数巻の最大値（最新刊数の目安）までの巻数を1巻から欠番なく生成する
 * （fillMissingVolumes）。小数巻（特別編等）は生成対象に含めず、見つかった分のみ追加する。
 * Google Books側が0件の場合は例外を投げず空配列を返す。
 */
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, switchMap } from 'rxjs';
import { ExternalUnitCandidate } from './external-media.model';
import { GoogleBooksApiService, GoogleBooksVolumeMatch } from './google-books-api.service';
import { NdlApiService } from './ndl-api.service';
import { OpenBdApiService, OpenBdBookInfo } from './openbd-api.service';

const NDL_LOOKUP_MAX = 30;

function mergeAndGroupByVolume(
  matches: GoogleBooksVolumeMatch[],
  openBdByIsbn: Map<string, OpenBdBookInfo>,
): Map<number, string[]> {
  const byVolume = new Map<number, string[]>();
  for (const match of matches) {
    const openBd = match.isbn13 ? openBdByIsbn.get(match.isbn13) : undefined;
    const coverImageUrl = openBd?.coverImageUrl ?? match.coverImageUrl;
    if (!coverImageUrl) continue;
    const urls = byVolume.get(match.volumeNumber) ?? [];
    urls.push(coverImageUrl);
    byVolume.set(match.volumeNumber, urls);
  }
  return byVolume;
}

function latestIntegerVolume(matches: GoogleBooksVolumeMatch[]): number {
  const integerVolumes = matches.map((m) => m.volumeNumber).filter((n) => Number.isInteger(n));
  return integerVolumes.length > 0 ? Math.max(...integerVolumes) : 0;
}

function missingVolumeNumbers(
  matches: GoogleBooksVolumeMatch[],
  byVolume: Map<number, string[]>,
): number[] {
  const latestVolume = latestIntegerVolume(matches);
  const missing: number[] = [];
  for (let number = 1; number <= latestVolume; number++) {
    if (!byVolume.has(number)) missing.push(number);
  }
  return missing.slice(0, NDL_LOOKUP_MAX);
}

function fillMissingVolumes(
  matches: GoogleBooksVolumeMatch[],
  byVolume: Map<number, string[]>,
): ExternalUnitCandidate[] {
  const latestVolume = latestIntegerVolume(matches);
  const fractionalVolumes = [...new Set(matches.map((m) => m.volumeNumber))]
    .filter((n) => !Number.isInteger(n))
    .sort((a, b) => a - b);

  const candidates: ExternalUnitCandidate[] = [];
  for (let number = 1; number <= latestVolume; number++) {
    const urls = byVolume.get(number) ?? [];
    candidates.push({
      number,
      coverImageUrl: urls[0],
      variantCoverImageUrls: urls.length > 0 ? urls : undefined,
    });
  }
  for (const number of fractionalVolumes) {
    const urls = byVolume.get(number) ?? [];
    candidates.push({
      number,
      coverImageUrl: urls[0],
      variantCoverImageUrls: urls.length > 0 ? urls : undefined,
    });
  }
  return candidates.sort((a, b) => a.number - b.number);
}

@Injectable({ providedIn: 'root' })
export class MangaVolumeLookupService {
  private googleBooks = inject(GoogleBooksApiService);
  private openBd = inject(OpenBdApiService);
  private ndlApi = inject(NdlApiService);

  getVolumes(seriesTitle: string): Observable<ExternalUnitCandidate[]> {
    return this.googleBooks.searchVolumes(seriesTitle).pipe(
      switchMap((matches) => {
        if (matches.length === 0) return of([]);
        const isbns = matches.map((m) => m.isbn13).filter((isbn): isbn is string => !!isbn);
        return this.openBd.getByIsbns(isbns).pipe(
          switchMap((openBdByIsbn) => {
            const byVolume = mergeAndGroupByVolume(matches, openBdByIsbn);
            const missing = missingVolumeNumbers(matches, byVolume);
            if (missing.length === 0) return of(fillMissingVolumes(matches, byVolume));
            return this.fillFromNdl(seriesTitle, missing, byVolume).pipe(
              map((filledByVolume) => fillMissingVolumes(matches, filledByVolume)),
            );
          }),
        );
      }),
    );
  }

  private fillFromNdl(
    seriesTitle: string,
    missing: number[],
    byVolume: Map<number, string[]>,
  ): Observable<Map<number, string[]>> {
    return this.ndlApi.searchIsbnsForVolumes(seriesTitle, missing).pipe(
      switchMap((isbnByVolume) => {
        const ndlIsbns = [...new Set(isbnByVolume.values())];
        if (ndlIsbns.length === 0) return of(byVolume);
        return this.openBd.getByIsbns(ndlIsbns).pipe(
          map((ndlOpenBdByIsbn) => {
            for (const [number, isbn] of isbnByVolume) {
              const coverImageUrl = ndlOpenBdByIsbn.get(isbn)?.coverImageUrl;
              if (coverImageUrl) byVolume.set(number, [coverImageUrl]);
            }
            return byVolume;
          }),
        );
      }),
    );
  }
}
