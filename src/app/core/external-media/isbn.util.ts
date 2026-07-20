/**
 * @file ISBNの正規化・ISBN-10→13変換ユーティリティ。Google Books/NDL双方のクライアントから利用する。
 * ISBN-10→13変換は「978」を先頭に付け、先頭9桁から検査ディジットをモジュラス10算術で再計算するだけの
 * 決定的な変換であり、書誌データベースを引く必要がない（規格上一意に定まる）。
 */

export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isbn10ToIsbn13(isbn10: string): string | null {
  const normalized = normalizeIsbn(isbn10);
  if (normalized.length !== 10) return null;

  const core = '978' + normalized.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(core[i]);
    if (!Number.isFinite(digit)) return null;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return core + checkDigit;
}
