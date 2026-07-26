/**
 * @file 閲覧記録データモデル。Series(シリーズ)/Work(作品)/Group(グループ)/Unit(単位) の4階層。
 * MediaTypeごとの表示メタデータ（ラベル・巻/話表記等）は media-type-meta.ts に分離している。
 * Seriesはmedia typeを問わない汎用の最上位層（例: タイトルをまたぐ関連作品群をまとめる。
 * バキシリーズ＝バキ/範馬刃牙/刃牙道のように別Workだが関連する作品群、将来はアニメ続編シリーズや
 * 映画シリーズにも流用する想定）。Work.seriesIdは任意で、シリーズに属さないWorkも成立する。
 * Work→Group→Unit は元々media typeを問わず共通の形だったが、Unit.groupIdを任意化し、
 * Group層を使わずWork直下にUnitを置く運用（例: マンガの「巻」は話数管理が不要なためGroup省略）も
 * 型として許容する（movie は Group1件・Unit1件、book は manga と同形として扱う想定）。
 * Phase 2 では manga/anime のみ実装する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、Firestore同期でOR-mergeする。
 * Work.titleAlt は外部API取り込み時に得られたローマ字/英語表記（titleと異なる場合のみ）。
 * スクリプトをまたぐ重複検知（例:「ナルト」で登録済みの作品を"NARUTO"で再取り込みしようとした場合）に使う。
 * coverImageUrl は外部API連携（AniList/Google Books/openBD等）から取り込んだ表紙イラストのURL（任意）。
 * Unit.coverImageCandidates は取り込み時に見つかった同一巻の代替表紙候補。2件以上あれば
 * work-detail画面での右クリック切り替え（表紙ピッカー）が有効になる。
 * Work.coverImageCandidates は同じ形の受け皿（現時点では取り込みロジック未実装）。作品一覧の
 * カバー右クリックでは候補数に関わらず削除メニューが常に開く。
 * Achievement は実績（ゲーミフィケーション）の解除記録。定義（閾値・文言）は
 * core/achievements/achievement-definitions.ts に静的マスタとして持ち、ここには
 * 「いつ解除したか」のみを保存する。
 */

export type MediaType = 'manga' | 'anime'; // 将来 'movie' | 'book' を追加（表示メタはmedia-type-meta.tsに追記）

export type MediaTypeFilter = MediaType | 'both'; // 一覧・検索の種別絞り込み用（'both'=すべて）

export interface Series {
  id: string;
  mediaType: MediaType;
  title: string;
  wantToConsume: boolean; // シリーズレベルの「読みたい/観たい」
  coverImageUrl?: string; // 外部APIから取り込んだ表紙イラストURL
  createdAt: string; // ISO
  updatedAt: string; // ISO
  deleted?: boolean; // tombstone
}

export interface Work {
  id: string;
  mediaType: MediaType;
  seriesId?: string; // 所属シリーズ（任意）。シリーズに属さないWorkも成立する
  title: string;
  titleAlt?: string; // ローマ字/英語表記（titleと異なる場合のみ、外部取り込み時に設定）
  wantToConsume: boolean; // 作品レベルの「読みたい/観たい」
  externalSource?: string; // 外部API連携元（例: 'anilist'）
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
  groupId?: string; // 任意: Group層を使わずWork直下にぶら下げる運用（例: マンガの巻）も許容する
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
