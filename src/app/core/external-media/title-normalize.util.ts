/**
 * @file タイトル文字列の正規化ユーティリティ（記号除去・小文字化）。表記揺れを吸収した
 * 部分一致・完全一致比較のため、Google Booksのシリーズ絞り込みや作品重複検知から利用する。
 */

export function normalizeTitle(title: string): string {
  return title.replace(/[\s　!-/:-@[-`{-~！-／：-＠［-｀｛-～]/g, '').toLowerCase();
}
