/**
 * @file AniList GraphQL API（https://graphql.anilist.co）のクライアント。APIキー不要。
 * マンガ・アニメ横断の作品検索とシリーズ表紙、アニメの話数サムネイル（取得できる作品のみ）を提供する。
 * 話数タイトルはAniList側に日本語版が存在しないため取得せず、呼び出し側の「第N話」表記に委ねる。
 * searchWorksはmediaTypeに'both'を渡すと種別フィルタなしで検索し、結果ごとの実際の種別(m.type)を
 * 反映する。日本語タイトル(titleNative)・人気度(popularity)・スコア(averageScore)も併せて返す。
 * includeAdultがfalseの場合は成人向け作品(isAdult)を除外する。
 * Angular Service Workerは既定でGETリクエストのみ傍受しPOSTには関与しないため
 * （AniListはGraphQL POST）、MangaDex（GET）と異なりngsw-bypassヘッダーは不要。
 * 一度付与してみたところプリフライトが増えCORSエラーを誘発したため付与しない。
 * AniList側の一時的な504等はretry()で吸収し、それでも失敗した場合はエラーとして
 * 呼び出し側（work-import-search.service.ts）に伝播させる。
 */
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, retry } from 'rxjs';
import { MediaTypeFilter } from '@core/models/media.model';
import { ExternalUnitCandidate, ExternalWorkSearchResult } from './external-media.model';

const ANILIST_ENDPOINT = 'https://graphql.anilist.co';

// AniList GraphQLのMediaType表現との相互変換（AniListが扱うのはMANGA/ANIMEのみ）
const ANILIST_TYPE_BY_MEDIA_TYPE: Record<'manga' | 'anime', 'MANGA' | 'ANIME'> = {
  manga: 'MANGA',
  anime: 'ANIME',
};

interface AniListTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

interface AniListStreamingEpisode {
  thumbnail: string | null;
}

interface AniListMedia {
  id: number;
  type: 'ANIME' | 'MANGA';
  title: AniListTitle;
  coverImage: { large: string | null } | null;
  format: string | null;
  averageScore: number | null;
  popularity: number | null;
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

  searchWorks(
    query: string,
    mediaType: MediaTypeFilter,
    includeAdult = false,
  ): Observable<ExternalWorkSearchResult[]> {
    const anilistType = mediaType === 'both' ? undefined : ANILIST_TYPE_BY_MEDIA_TYPE[mediaType];
    const graphqlQuery = `
      query ($search: String, $type: MediaType, $isAdult: Boolean) {
        Page(page: 1, perPage: 20) {
          media(search: $search, type: $type, isAdult: $isAdult) {
            id
            type
            title { romaji english native }
            coverImage { large }
            format
            averageScore
            popularity
          }
        }
      }
    `;
    return this.http
      .post<AniListSearchResponse>(ANILIST_ENDPOINT, {
        query: graphqlQuery,
        variables: { search: query, type: anilistType, isAdult: includeAdult ? undefined : false },
      })
      .pipe(
        map((res) =>
          res.data.Page.media.map((m) => ({
            mediaType: m.type === 'MANGA' ? ('manga' as const) : ('anime' as const),
            externalSource: 'anilist' as const,
            externalId: String(m.id),
            title: pickTitle(m.title),
            titleNative: m.title.native ?? undefined,
            coverImageUrl: m.coverImage?.large ?? undefined,
            format: m.format ?? undefined,
            averageScore: m.averageScore ?? undefined,
            popularity: m.popularity ?? undefined,
          })),
        ),
        retry({ count: 2, delay: 1000 }),
      );
  }

  // アニメの話数サムネイル。streamingEpisodesを持たない作品では空配列を返す（呼び出し側でシリーズ表紙にフォールバック）。
  // AniListのstreamingEpisodes.titleは配信サイト表示用の英語名しか持たず日本語版が存在しないため取得しない。
  // タイトルは呼び出し側で「第N話」表記にフォールバックする。
  getAnimeEpisodes(externalId: string): Observable<ExternalUnitCandidate[]> {
    const graphqlQuery = `
      query ($id: Int) {
        Media(id: $id) {
          streamingEpisodes { thumbnail }
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
            coverImageUrl: ep.thumbnail ?? undefined,
          }));
        }),
        retry({ count: 2, delay: 1000 }),
      );
  }
}
