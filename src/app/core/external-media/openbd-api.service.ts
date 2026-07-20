/**
 * @file openBD API（https://api.openbd.jp）のクライアント。APIキー不要。
 * ISBN群を一括指定して日本語の正確な書誌情報（表紙・発売日）を取得する検索機能を持たないAPIのため、
 * タイトル検索はGoogle Books側（google-books-api.service.ts）が担い、そこで得たISBNをこのサービスに渡す
 * （manga-volume-lookup.service.ts が両者を仲介する）。
 * URL長の上限を考慮しISBNを30件ずつチャンク化してforkJoinで並列取得し、該当なし（null）の要素を除いた
 * ISBN→書誌情報のMapに正規化する。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, retry } from 'rxjs';

const OPENBD_API = 'https://api.openbd.jp/v1/get';
const CHUNK_SIZE = 30;

export interface OpenBdBookInfo {
  isbn: string;
  title?: string;
  coverImageUrl?: string;
  pubDate?: string;
}

interface OpenBdSummary {
  isbn: string;
  title?: string;
  cover?: string;
  pubdate?: string;
}

type OpenBdEntry = { summary: OpenBdSummary } | null;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

@Injectable({ providedIn: 'root' })
export class OpenBdApiService {
  private http = inject(HttpClient);

  getByIsbns(isbns: string[]): Observable<Map<string, OpenBdBookInfo>> {
    if (isbns.length === 0) return of(new Map());
    const requests = chunk(isbns, CHUNK_SIZE).map((group) =>
      this.http
        .get<OpenBdEntry[]>(`${OPENBD_API}?isbn=${group.join(',')}`)
        .pipe(retry({ count: 2, delay: 1000 })),
    );
    return forkJoin(requests).pipe(
      map((results) => {
        const map = new Map<string, OpenBdBookInfo>();
        for (const entries of results) {
          for (const entry of entries) {
            if (!entry) continue;
            const { summary } = entry;
            map.set(summary.isbn, {
              isbn: summary.isbn,
              title: summary.title,
              coverImageUrl: summary.cover,
              pubDate: summary.pubdate,
            });
          }
        }
        return map;
      }),
    );
  }
}
