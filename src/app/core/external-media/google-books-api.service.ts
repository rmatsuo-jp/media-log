/**
 * @file Google Books API（https://www.googleapis.com/books/v1）のクライアント。
 * マンガのシリーズタイトルで巻（書籍）を検索し、ISBNと巻数を抽出する。
 * Google Booksはタイトル文字列が「作品名 15」「作品名(15)」「作品名 第15巻」「作品名15(講談社コミックス)」
 * などの表記揺れを持つため、parseVolumeNumber()がタイトルからシリーズ名部分を取り除いた残り文字列の
 * 先頭付近を正規表現で解析して巻数を抽出する（末尾に出版社レーベル名等の付加情報が続いても拾えるようにする
 * ため、末尾一致ではなく先頭一致を基本にしている）。シリーズ名の除去に失敗した場合は末尾一致パターンに
 * フォールバックする。抽出できない候補は誤った巻番号を混入させるより除外する（欠落を優先）。
 * また、無関係な同名短縮タイトル作品の混入を防ぐため、シリーズタイトルと
 * 正規化した書籍タイトル（記号除去・小文字化）で部分一致する候補のみ採用する。AniListのメディアIDのような
 * 相互リンクを持たないため、この文字列マッチングが唯一の突合手段であり、MangaDex時代のAniList ID突合より
 * 一致精度は下がりうる。
 * imageLinks.thumbnailはhttp://で返るためhttps://に置換する。
 * 未認証リクエストは1日あたりの割り当てが0のため、必ずkeyパラメータでAPIキーを付与する。
 * SettingsStoreServiceに保存されたユーザー入力キー（設定画面から入力、平文でlocalStorage保存）を
 * 優先し、未設定時はenvironment.googleBooksApiKey（ビルド時埋め込みの共有キー）にフォールバックする。
 * retry()後もエラーの場合は呼び出し側（manga-volume-lookup.service.ts）にエラーとして伝播させる。
 * 1リクエストあたりmaxResultsは40件が上限のため、totalItemsを見てstartIndexをずらした追加リクエストを
 * 並列発行し、MAX_ITEMS件までページングして取得する（長期連載シリーズで巻が欠落しないようにするため）。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, retry, switchMap } from 'rxjs';
import { SettingsStoreService } from '@core/settings/settings-store.service';
import { environment } from '../../../environments/environment';

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const PAGE_SIZE = 40;
const MAX_ITEMS = 400;

// シリーズ名を除去した残り文字列の先頭付近から巻数を拾う（末尾に付加情報が続いても拾える）。
const PREFIX_VOLUME_PATTERNS = [
  /^\s*第?\s*(\d+(?:\.\d+)?)\s*巻/,
  /^\s*[([（]\s*(\d+(?:\.\d+)?)\s*[)\])）]/,
  /^[\s:：\-–—.、,]*(\d+(?:\.\d+)?)(?!\d)/,
];

// シリーズ名の除去に失敗した場合のフォールバック（タイトル末尾一致）。
const SUFFIX_VOLUME_PATTERNS = [
  /第\s*(\d+(?:\.\d+)?)\s*巻/,
  /\((\d+(?:\.\d+)?)\)\s*$/,
  /\s(\d+(?:\.\d+)?)\s*巻/,
  /\s(\d+(?:\.\d+)?)\s*$/,
];

export interface GoogleBooksVolumeMatch {
  isbn13?: string;
  isbn10?: string;
  volumeNumber: number;
  title: string;
  coverImageUrl?: string;
}

interface GoogleBooksIdentifier {
  type: string;
  identifier: string;
}

interface GoogleBooksVolumeInfo {
  title: string;
  subtitle?: string;
  industryIdentifiers?: GoogleBooksIdentifier[];
  imageLinks?: { thumbnail?: string };
}

interface GoogleBooksItem {
  volumeInfo: GoogleBooksVolumeInfo;
}

interface GoogleBooksSearchResponse {
  totalItems?: number;
  items?: GoogleBooksItem[];
}

function normalize(title: string): string {
  return title.replace(/[\s　!-/:-@[-`{-~！-／：-＠［-｀｛-～]/g, '').toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchFirst(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const number = Number(match[1]);
      if (Number.isFinite(number)) return number;
    }
  }
  return null;
}

function parseVolumeNumber(volumeInfo: GoogleBooksVolumeInfo, seriesTitle: string): number | null {
  const text = [volumeInfo.title, volumeInfo.subtitle].filter(Boolean).join(' ');
  const seriesMatch = text.match(new RegExp(escapeRegExp(seriesTitle), 'i'));
  if (seriesMatch?.index != null) {
    const remainder = text.slice(seriesMatch.index + seriesMatch[0].length);
    const number = matchFirst(remainder, PREFIX_VOLUME_PATTERNS);
    if (number != null) return number;
  }
  return matchFirst(text, SUFFIX_VOLUME_PATTERNS);
}

function toHttps(url: string | undefined): string | undefined {
  return url?.replace(/^http:\/\//, 'https://');
}

@Injectable({ providedIn: 'root' })
export class GoogleBooksApiService {
  private http = inject(HttpClient);
  private settingsStore = inject(SettingsStoreService);

  searchVolumes(seriesTitle: string): Observable<GoogleBooksVolumeMatch[]> {
    const normalizedSeries = normalize(seriesTitle);
    return this.fetchPage(seriesTitle, 0).pipe(
      switchMap(({ totalItems, items }) => {
        const remainingStarts: number[] = [];
        for (let start = PAGE_SIZE; start < Math.min(totalItems, MAX_ITEMS); start += PAGE_SIZE) {
          remainingStarts.push(start);
        }
        if (remainingStarts.length === 0) return of(items);
        return forkJoin(
          remainingStarts.map((start) =>
            this.fetchPage(seriesTitle, start).pipe(map((page) => page.items)),
          ),
        ).pipe(map((pages) => [items, ...pages].flat()));
      }),
      map((items) => this.toMatches(items, seriesTitle, normalizedSeries)),
    );
  }

  private fetchPage(
    seriesTitle: string,
    startIndex: number,
  ): Observable<{ totalItems: number; items: GoogleBooksItem[] }> {
    const params = new URLSearchParams();
    params.set('q', `intitle:${seriesTitle}`);
    params.set('country', 'JP');
    params.set('maxResults', String(PAGE_SIZE));
    params.set('startIndex', String(startIndex));
    const apiKey = this.settingsStore.getSettings().googleBooksApiKey || environment.googleBooksApiKey;
    if (apiKey) params.set('key', apiKey);
    return this.http.get<GoogleBooksSearchResponse>(`${GOOGLE_BOOKS_API}?${params}`).pipe(
      map((res) => ({ totalItems: res.totalItems ?? 0, items: res.items ?? [] })),
      retry({ count: 2, delay: 1000 }),
    );
  }

  private toMatches(
    items: GoogleBooksItem[],
    seriesTitle: string,
    normalizedSeries: string,
  ): GoogleBooksVolumeMatch[] {
    const matches: GoogleBooksVolumeMatch[] = [];
    for (const item of items) {
      const info = item.volumeInfo;
      if (!normalize(info.title).includes(normalizedSeries)) continue;
      const volumeNumber = parseVolumeNumber(info, seriesTitle);
      if (volumeNumber == null) continue;
      const isbn13 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_13')?.identifier;
      const isbn10 = info.industryIdentifiers?.find((i) => i.type === 'ISBN_10')?.identifier;
      matches.push({
        isbn13,
        isbn10,
        volumeNumber,
        title: info.title,
        coverImageUrl: toHttps(info.imageLinks?.thumbnail),
      });
    }
    return matches;
  }
}
