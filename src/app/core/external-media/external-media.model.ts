/**
 * @file 外部API（AniList/Google Books/openBD）から取得する作品検索結果・巻/話数候補のDTO型。
 */
import { MediaType } from '@core/models/media.model';

export type ExternalSource = 'anilist';

export interface ExternalWorkSearchResult {
  mediaType: MediaType;
  externalSource: ExternalSource;
  externalId: string;
  title: string;
  /** 日本語（現地語）表記のタイトル。取得できない場合は未設定。 */
  titleNative?: string;
  coverImageUrl?: string;
  format?: string;
  averageScore?: number;
  popularity?: number;
}

export interface ExternalUnitCandidate {
  number: number;
  coverImageUrl?: string;
  /** 同一巻の代替表紙候補（自身のcoverImageUrlも含む）。2件以上あれば手動切り替えが可能。 */
  variantCoverImageUrls?: string[];
}
