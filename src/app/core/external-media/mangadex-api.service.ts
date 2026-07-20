/**
 * @file MangaDex API（https://api.mangadex.org）のクライアント。APIキー不要。
 * マンガのタイトル検索と、巻(volume)ごとの表紙画像取得を提供する。
 * 作品検索はAniListで行うため、作品タイトル文字列で別途MangaDexを検索する。ただしMangaDexの
 * attributes.linksにはAniListメディアIDが`al`キーで入っていることがあり、searchManga結果の
 * anilistIdとして返す。呼び出し側（work-import.ts）はこれを選択中のAniList作品のexternalIdと
 * 突き合わせて同一作品を確実に特定する（タイトル文字列の曖昧一致による誤爆を防ぐ）。
 * MangaDexは1巻に複数のcover_art（重版・デジタル版など）を持つため、getVolumesは巻番号で
 * 重複排除し、代表URLをcoverImageUrlに、全候補をvariantCoverImageUrlsに格納する。
 * GitHub Pages本番環境ではAngular Service Worker(ngsw-worker.js)がクロスオリジンの
 * fetchも傍受してしまい、その結果CORSエラーになる事象を確認したため、`ngsw-bypass`を
 * リクエストヘッダーとして付与しSWをバイパスする（クエリパラメータで付与すると
 * MangaDex側のクエリパラメータスキーマ検証(400 validation_exception)に失敗するため
 * ヘッダー形式を使う）。
 * MangaDex側の一時的な504等はretry()で吸収し、それでも失敗した場合はエラーとして
 * 呼び出し側（work-import-search.service.ts）に伝播させ、「該当作品なし」と区別する。
 * searchMangaには`order[relevance]=desc`を付与している。これは検索順の意図に加え、
 * MangaDexのCDN（Cloudflare）がAccess-Control-Allow-Originヘッダーを欠いたレスポンスを
 * 最大30日（s-maxage）キャッシュしてしまう既知の汚染バグを踏んだ際に、クエリ文字列を
 * 変えることでキャッシュキーをずらし別エントリを引かせる回避策も兼ねる。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, retry } from 'rxjs';
import { ExternalUnitCandidate, ExternalWorkSearchResult } from './external-media.model';

const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_UPLOADS = 'https://uploads.mangadex.org/covers';

interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: { fileName?: string };
}

interface MangaDexMangaAttributes {
  title: Record<string, string>;
  altTitles?: Record<string, string>[];
  links?: Record<string, string>;
}

interface MangaDexMangaEntry {
  id: string;
  attributes: MangaDexMangaAttributes;
  relationships: MangaDexRelationship[];
}

interface MangaDexSearchResponse {
  data: MangaDexMangaEntry[];
}

interface MangaDexCoverAttributes {
  volume: string | null;
  fileName: string;
}

interface MangaDexCoverEntry {
  attributes: MangaDexCoverAttributes;
}

interface MangaDexCoverResponse {
  data: MangaDexCoverEntry[];
}

function pickTitle(attributes: MangaDexMangaAttributes): string {
  const title = attributes.title;
  return title['ja'] ?? title['en'] ?? Object.values(title)[0] ?? '(タイトル不明)';
}

function coverUrl(mangaId: string, fileName: string): string {
  return `${MANGADEX_UPLOADS}/${mangaId}/${fileName}.512.jpg`;
}

@Injectable({ providedIn: 'root' })
export class MangadexApiService {
  private http = inject(HttpClient);

  searchManga(title: string): Observable<ExternalWorkSearchResult[]> {
    const params = new URLSearchParams();
    params.set('title', title);
    params.set('limit', '20');
    params.append('includes[]', 'cover_art');
    params.set('order[relevance]', 'desc');
    return this.http
      .get<MangaDexSearchResponse>(`${MANGADEX_API}/manga?${params}`, {
        headers: { 'ngsw-bypass': 'true' },
      })
      .pipe(
        map((res) =>
          res.data.map((entry) => {
            const coverRel = entry.relationships.find((r) => r.type === 'cover_art');
            const fileName = coverRel?.attributes?.fileName;
            return {
              mediaType: 'manga' as const,
              externalSource: 'mangadex' as const,
              externalId: entry.id,
              title: pickTitle(entry.attributes),
              coverImageUrl: fileName ? coverUrl(entry.id, fileName) : undefined,
              anilistId: entry.attributes.links?.['al'],
            };
          }),
        ),
        retry({ count: 2, delay: 1000 }),
      );
  }

  getVolumes(mangaId: string): Observable<ExternalUnitCandidate[]> {
    const params = new URLSearchParams();
    params.append('manga[]', mangaId);
    params.set('limit', '100');
    params.set('order[volume]', 'asc');
    return this.http
      .get<MangaDexCoverResponse>(`${MANGADEX_API}/cover?${params}`, {
        headers: { 'ngsw-bypass': 'true' },
      })
      .pipe(
        map((res) => {
          const urlsByVolume = new Map<number, string[]>();
          for (const entry of res.data) {
            const { volume, fileName } = entry.attributes;
            if (volume == null || volume === '') continue;
            const number = Number(volume);
            if (!Number.isFinite(number)) continue;
            const urls = urlsByVolume.get(number) ?? [];
            urls.push(coverUrl(mangaId, fileName));
            urlsByVolume.set(number, urls);
          }
          return Array.from(urlsByVolume.entries())
            .map(([number, urls]) => ({
              number,
              coverImageUrl: urls[0],
              variantCoverImageUrls: urls,
            }))
            .sort((a, b) => a.number - b.number);
        }),
        retry({ count: 2, delay: 1000 }),
      );
  }
}
