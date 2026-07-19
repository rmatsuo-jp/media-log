/**
 * @file 作品(Work)/グループ(Group)/単位(Unit) の3階層データモデル。
 * Work→Group→Unit は media type を問わず共通の形（movie は Group1件・Unit1件、
 * book は manga と同形として扱う想定）。Phase 2 では manga/anime のみ実装する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、Firestore同期でOR-mergeする。
 */

export type MediaType = 'manga' | 'anime'; // 将来 'movie' | 'book' を追加

export interface Work {
  id: string;
  mediaType: MediaType;
  title: string;
  wantToConsume: boolean; // 作品レベルの「読みたい/観たい」
  externalSource?: string; // 将来の外部API連携用（例: 'anilist'）。Phase 2では未使用
  externalId?: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deleted?: boolean; // tombstone
}

export interface Group {
  id: string;
  workId: string;
  order: number; // シーズン/巻セット順（整数）
  title: string; // 例: "第1期", "1-10巻"
  wantToConsume: boolean; // グループレベルの「読みたい/観たい」（Workとは独立に持てる）
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Unit {
  id: string;
  groupId: string;
  workId: string; // 非正規化: groupId経由の逆引きを避け、集計・同期を単純化する
  number: number; // 話数/巻数の整数
  viewed: boolean;
  viewCount: number; // 再視聴/再読の回数
  lastViewedAt?: string; // ISO
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}
