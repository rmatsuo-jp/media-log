/**
 * @file タイトル文字列の正規化ユーティリティ（記号除去・小文字化）。表記揺れを吸収した
 * 部分一致・完全一致比較のため、Google Booksのシリーズ絞り込みや作品重複検知から利用する。
 * titlesMatchは「NARUTO」と「NARUTO -ナルト-」のように片方に副題が付くだけの表記ゆれを
 * 同一作品とみなすため、正規化後の完全一致に加えて双方向の部分一致も許容する。
 */

export function normalizeTitle(title: string): string {
  return title.replace(/[\s　!-/:-@[-`{-~！-／：-＠［-｀｛-～]/g, '').toLowerCase();
}

export function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
