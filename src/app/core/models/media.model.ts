/**
 * @file 作品(Work)/グループ(Group)/単位(Unit) の3階層データモデル。
 * Work→Group→Unit は media type を問わず共通の形（movie は Group1件・Unit1件、
 * book は manga と同形として扱う想定）。Phase 2 では manga/anime のみ実装する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、Firestore同期でOR-mergeする。
 * coverImageUrl は外部API連携（AniList/MangaDex等）から取り込んだ表紙イラストのURL（任意）。
 * Unit.coverImageCandidates は取り込み時に見つかった同一巻の代替表紙候補。2件以上あれば
 * work-detail画面での右クリック切り替え（表紙ピッカー）が有効になる。
 * Work.coverImageCandidates は同じ形の受け皿（現時点では取り込みロジック未実装）。作品一覧の
 * カバー右クリックでは候補数に関わらず削除メニューが常に開く。
 * Achievement は実績（ゲーミフィケーション）の解除記録。定義（閾値・文言）は
 * core/achievements/achievement-definitions.ts に静的マスタとして持ち、ここには
 * 「いつ解除したか」のみを保存する。
 */

export type MediaType = 'manga' | 'anime'; // 将来 'movie' | 'book' を追加

export interface Work {
  id: string;
  mediaType: MediaType;
  title: string;
  wantToConsume: boolean; // 作品レベルの「読みたい/観たい」
  externalSource?: string; // 外部API連携元（例: 'anilist' | 'mangadex'）
  externalId?: string;
  coverImageUrl?: string; // 外部APIから取り込んだ表紙イラストURL
  coverImageCandidates?: string[]; // 代替表紙候補（2件以上で右クリック切り替え可能）
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
  coverImageUrl?: string; // 外部APIから取り込んだ表紙イラストURL
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
  coverImageUrl?: string; // 外部APIから取り込んだ表紙イラストURL（巻/話数単位）
  coverImageCandidates?: string[]; // 同一巻の代替表紙候補（2件以上で右クリック切り替え可能）
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
}

export interface Achievement {
  id: string; // 実績定義ID（achievement-definitions.ts の AchievementDefinition.id と対応）
  unlockedAt: string; // ISO、解除日時
  deleted?: boolean; // tombstone
}
