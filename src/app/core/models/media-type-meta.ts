/**
 * @file MediaTypeごとの表示メタデータ（種別ラベル・バッジ色・巻/話数の単位表記）を一元管理する。
 * 種別分岐（manga ? ... : ...）をコンポーネント側に書かず、必ずこのマップを参照すること。
 * 新しいメディア種別（movie/book等）を追加する際は、media.model.tsのMediaTypeに追加した上で
 * このマップに1エントリ足せば、satisfies Record<...>によりキー漏れがコンパイルエラーで検出される。
 * トグル/セレクト用のoptions配列（MEDIA_TYPE_OPTIONS / MEDIA_TYPE_FILTER_OPTIONS）もここから導出する。
 */
import { MediaType, MediaTypeFilter } from './media.model';

// ── メタデータ定義 ──

export interface MediaTypeMeta {
  /** 種別の表示名（例: マンガ） */
  label: string;
  /** 種別バッジの色（shared/ui/badge の variant 値） */
  badgeVariant: 'default' | 'success' | 'error' | 'warning';
  /** 巻/話数の単位表記（例: 3 → 「3巻」「第3話」） */
  formatUnit: (n: number) => string;
  /** 取り込みグループの既定タイトル（例: 取り込んだ巻） */
  importGroupTitle: string;
  /** 取り込みパネルの見出し（例: 巻情報） */
  importPanelLabel: string;
  /** 取り込み対象の呼称（例: 巻）。「取り込む◯◯を選択」等の文中で使う */
  importUnitNoun: string;
}

export const MEDIA_TYPE_META = {
  manga: {
    label: 'マンガ',
    badgeVariant: 'default',
    formatUnit: (n) => `${n}巻`,
    importGroupTitle: '取り込んだ巻',
    importPanelLabel: '巻情報',
    importUnitNoun: '巻',
  },
  anime: {
    label: 'アニメ',
    badgeVariant: 'success',
    formatUnit: (n) => `第${n}話`,
    importGroupTitle: '取り込んだ話数',
    importPanelLabel: '話数サムネイル',
    importUnitNoun: '話数',
  },
} as const satisfies Record<MediaType, MediaTypeMeta>;

// ── 導出options（トグル/セレクト用） ──

export interface MediaTypeOption {
  value: MediaType;
  label: string;
}

/** 全種別のoptions（追加フォームのセレクト等） */
export const MEDIA_TYPE_OPTIONS: MediaTypeOption[] = (
  Object.keys(MEDIA_TYPE_META) as MediaType[]
).map((value) => ({ value, label: MEDIA_TYPE_META[value].label }));

/** 絞り込みトグル用options（全種別 + 「すべて」） */
export const MEDIA_TYPE_FILTER_OPTIONS: { value: MediaTypeFilter; label: string }[] = [
  ...MEDIA_TYPE_OPTIONS,
  { value: 'both', label: 'すべて' },
];
