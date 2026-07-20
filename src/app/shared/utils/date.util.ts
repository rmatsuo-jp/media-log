/**
 * @file 日時フォーマット用の純粋関数群。nowIso()は各repositoryのcreatedAt/updatedAt採番で共用する。
 */

// ── エクスポートファイル名用タイムスタンプ ──────────────────────────
/** ローカル時刻を YYMMDDhhmm 形式の文字列にする（ダウンロードファイル名に使用）。 */
export function formatTimestampForFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const yy = pad(date.getFullYear() % 100);
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yy}${mm}${dd}${hh}${mi}`;
}

// ── 現在時刻ISO文字列（各repositoryのcreatedAt/updatedAt採番で共用） ──────
/** 現在時刻をISO文字列で返す。 */
export function nowIso(): string {
  return new Date().toISOString();
}

// ── 日付キー正規化（streak集計・カレンダー表示で共用） ───────────────
/** ISO日時をローカル時刻の YYYY-MM-DD キーに正規化する。 */
export function toDayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
