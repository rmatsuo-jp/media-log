/**
 * @file AniList GraphQL API（https://graphql.anilist.co）のクライアント。APIキー不要。
 * マンガ・アニメ横断の作品検索とシリーズ表紙、アニメの話数サムネイル（取得できる作品のみ）を提供する。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { MediaType } from '@core/models/media.model';
import { ExternalUnitCandidate, ExternalWorkSearchResult } from './external-media.model';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

interface AniListStreamingEpisode {
  title: string | null;
  thumbnail: string | null;
}

interface AniListMedia {
  id: number;
  title: AniListTitle;
  coverImage: { large: string | null } | null;
  format: string | null;
  streamingEpisodes: AniListStreamingEpisode[] | null;
}

interface AniListSearchResponse {
  data: { Page: { media: AniListMedia[] } };
}

interface AniListEpisodesResponse {
  data: { Media: { streamingEpisodes: AniListStreamingEpisode[] | null } | null };
}

function pickTitle(title: AniListTitle): string {
  return title.romaji ?? title.english ?? title.native ?? '(タイトル不明)';
}

@Injectable({ providedIn: 'root' })
export class AnilistApiService {
  private http = inject(HttpClient);

  searchWorks(query: string, mediaType: MediaType): Observable<ExternalWorkSearchResult[]> {
    const anilistType = mediaType === 'manga' ? 'MANGA' : 'ANIME';
    const graphqlQuery = `
      query ($search: String, $type: MediaType) {
        Page(page: 1, perPage: 20) {
          media(search: $search, type: $type) {
            id
            title { romaji english native }
            coverImage { large }
            format
          }
        }
      }
    `;
    return this.http
      .post<AniListSearchResponse>(ANILIST_ENDPOINT, {
        query: graphqlQuery,
        variables: { search: query, type: anilistType },
      })
      .pipe(
        map((res) =>
          res.data.Page.media.map((m) => ({
            mediaType,
            externalSource: 'anilist' as const,
            externalId: String(m.id),
            title: pickTitle(m.title),
            coverImageUrl: m.coverImage?.large ?? undefined,
            format: m.format ?? undefined,
          })),
        ),
      );
  }

  // アニメの話数サムネイル。streamingEpisodesを持たない作品では空配列を返す（呼び出し側でシリーズ表紙にフォールバック）。
  getAnimeEpisodes(externalId: string): Observable<ExternalUnitCandidate[]> {
    const graphqlQuery = `
      query ($id: Int) {
        Media(id: $id) {
          streamingEpisodes { title thumbnail }
        }
      }
    `;
    return this.http
      .post<AniListEpisodesResponse>(ANILIST_ENDPOINT, {
        query: graphqlQuery,
        variables: { id: Number(externalId) },
      })
      .pipe(
        map((res) => {
          const episodes = res.data.Media?.streamingEpisodes ?? [];
          return episodes.map((ep, index) => ({
            number: index + 1,
            title: ep.title ?? undefined,
            coverImageUrl: ep.thumbnail ?? undefined,
          }));
        }),
      );
  }
}
