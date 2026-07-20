/**
 * @file 国立国会図書館サーチ（NDL Search）SRU API（https://ndlsearch.ndl.go.jp/api/sru）のクライアント。
 * APIキー不要、CORS許可（Access-Control-Allow-Origin: *）を確認済み。
 * Google Books+openBDの組み合わせでISBN・表紙が見つからなかった巻について、シリーズタイトルで検索し、
 * 欠けている巻番号すべてのISBNを一括で補完する（manga-volume-lookup.service.tsから利用）。
 * 巻ごとに別々のリクエストを投げると（シリーズタイトルだけを条件にしているためレスポンス自体はほぼ
 * 同じになるにもかかわらず）NDL側の同時アクセス数上限に達し429が返ることが判明したため、
 * シリーズタイトルにつき1リクエストで取得したレスポンスから必要な巻番号ぶんをまとめて抽出する設計にしている。
 * レスポンスはdcndl形式のXML。巻数はタイトル文字列からの正規表現推測ではなく、構造化フィールド
 * dcndl:volume/rdf:Description/dcndl:transcriptionから取得する（"1"「2」等のクリーンな数値文字列。
 * rdf:value側は"[2]"のような角括弧付きの場合があるためtranscriptionを使う）。全角数字で入っている
 * 可能性もあるためtoHalfWidthDigits()（google-books-api.service.tsと共有）で半角に変換して比較する。
 * NDLはスピンオフ・小説版・グッズ等もシリーズタイトルの部分一致条件に乗ってしまうため、シリーズタイトルの
 * 正規化部分一致で候補を絞った上で巻数が完全一致するレコードのみ採用する（それでも誤判定の可能性は残る）。
 * ネットワークエラー・パース失敗・該当なしはすべて空Mapとして扱い、呼び出し側の全体フローを止めない。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, retry } from 'rxjs';
import { normalizeIsbn } from './isbn.util';
import { toHalfWidthDigits } from './google-books-api.service';

const NDL_SRU_API = 'https://ndlsearch.ndl.go.jp/api/sru';
const MAX_RECORDS = 40;

function normalizeTitle(title: string): string {
  return title.replace(/[\s　!-/:-@[-`{-~！-／：-＠［-｀｛-～]/g, '').toLowerCase();
}

function textOf(el: Element | null): string | null {
  return el?.textContent?.trim() || null;
}

@Injectable({ providedIn: 'root' })
export class NdlApiService {
  private http = inject(HttpClient);

  searchIsbnsForVolumes(
    seriesTitle: string,
    volumeNumbers: number[],
  ): Observable<Map<number, string>> {
    if (volumeNumbers.length === 0) return of(new Map());

    const params = new URLSearchParams();
    params.set('operation', 'searchRetrieve');
    params.set('version', '1.2');
    params.set('query', `title="${seriesTitle}"`);
    params.set('recordSchema', 'dcndl');
    params.set('maximumRecords', String(MAX_RECORDS));

    return this.http.get(`${NDL_SRU_API}?${params}`, { responseType: 'text' }).pipe(
      retry({ count: 2, delay: 1000 }),
      map((xml) => this.extractIsbns(xml, seriesTitle, new Set(volumeNumbers))),
      catchError(() => of(new Map<number, string>())),
    );
  }

  private extractIsbns(
    xml: string,
    seriesTitle: string,
    volumeNumbers: Set<number>,
  ): Map<number, string> {
    const found = new Map<number, string>();
    const outer = new DOMParser().parseFromString(xml, 'text/xml');
    const normalizedSeries = normalizeTitle(seriesTitle);
    const recordDataNodes = Array.from(outer.getElementsByTagName('recordData'));

    for (const recordData of recordDataNodes) {
      if (found.size === volumeNumbers.size) break;
      const inner = new DOMParser().parseFromString(recordData.textContent ?? '', 'text/xml');
      for (const bibResource of Array.from(inner.getElementsByTagNameNS('*', 'BibResource'))) {
        // dc:title（値がネストされたrdf:Description/rdf:value）とdcterms:title（平文）の両方が
        // 'title'としてヒットするため、rdf:valueを持つ方（dc:title）を優先的に探す。
        const titleEls = Array.from(bibResource.getElementsByTagNameNS('*', 'title'));
        const titleWithValue = titleEls
          .map((el) => textOf(el.getElementsByTagNameNS('*', 'value')[0] ?? null))
          .find((v): v is string => v != null);
        const title = titleWithValue ?? textOf(titleEls[0] ?? null);
        if (!title || !normalizeTitle(title).includes(normalizedSeries)) continue;

        const volumeText = textOf(
          bibResource
            .getElementsByTagNameNS('*', 'volume')[0]
            ?.getElementsByTagNameNS('*', 'transcription')[0] ?? null,
        );
        if (volumeText == null) continue;
        const volumeNumber = Number(toHalfWidthDigits(volumeText));
        if (!volumeNumbers.has(volumeNumber) || found.has(volumeNumber)) continue;

        const identifiers = Array.from(bibResource.getElementsByTagNameNS('*', 'identifier'));
        const isbnEl = identifiers.find((el) =>
          el.getAttributeNS('http://www.w3.org/1999/02/22-rdf-syntax-ns#', 'datatype')?.endsWith('/ISBN'),
        );
        const isbn = textOf(isbnEl ?? null);
        if (isbn) found.set(volumeNumber, normalizeIsbn(isbn));
      }
    }
    return found;
  }
}
