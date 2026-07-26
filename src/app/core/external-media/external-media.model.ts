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
  /** この巻に紐づく既知のISBN群（版違いを含む）。重複除去・異常検知の補助情報でUI表示はしない。 */
  isbns?: string[];
  /** 巻数抽出やISBN集約の結果が疑わしい場合の警告文言。抽出に問題が無ければ未設定。 */
  volumeNumberWarning?: string;
}
