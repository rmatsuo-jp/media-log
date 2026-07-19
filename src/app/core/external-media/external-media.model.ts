/**
 * @file 外部API（AniList/MangaDex）から取得する作品検索結果・巻/話数候補のDTO型。
 */
import { MediaType } from '@core/models/media.model';

export type ExternalSource = 'anilist' | 'mangadex';

export interface ExternalWorkSearchResult {
  mediaType: MediaType;
  externalSource: ExternalSource;
  externalId: string;
  title: string;
  coverImageUrl?: string;
  format?: string;
}

export interface ExternalUnitCandidate {
  number: number;
  title?: string;
  coverImageUrl?: string;
}
