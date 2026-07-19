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
  /** 同一巻の代替表紙候補（自身のcoverImageUrlも含む）。2件以上あれば手動切り替えが可能。 */
  variantCoverImageUrls?: string[];
}
