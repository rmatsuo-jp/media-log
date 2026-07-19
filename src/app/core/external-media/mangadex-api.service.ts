/**
 * @file MangaDex API（https://api.mangadex.org）のクライアント。APIキー不要。
 * マンガのタイトル検索と、巻(volume)ごとの表紙画像取得を提供する。
 * AniListとMangaDexにID相互紐付けはないため、作品タイトル文字列で別途検索する。
 * MangaDexは1巻に複数のcover_art（重版・デジタル版など）を持つため、getVolumesは巻番号で
 * 重複排除し、代表URLをcoverImageUrlに、全候補をvariantCoverImageUrlsに格納する。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
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
    return this.http.get<MangaDexSearchResponse>(`${MANGADEX_API}/manga?${params}`).pipe(
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
          };
        }),
      ),
    );
  }

  getVolumes(mangaId: string): Observable<ExternalUnitCandidate[]> {
    const params = new URLSearchParams();
    params.append('manga[]', mangaId);
    params.set('limit', '100');
    params.set('order[volume]', 'asc');
    return this.http.get<MangaDexCoverResponse>(`${MANGADEX_API}/cover?${params}`).pipe(
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
    );
  }
}
