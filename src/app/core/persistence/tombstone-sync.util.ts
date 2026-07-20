/**
 * @file tombstone方式（論理削除フラグ）のFirestore同期で使う共通ヘルパー。
 * media/achievements双方のfirestore-syncサービスから利用される。
 */

// Firestoreはundefinedを受け付けないため、値がundefinedのキーを浅く1階層だけ除去する。
export function stripUndefinedShallow<T extends Record<string, unknown>>(obj: T): T {
  const copy: Record<string, unknown> = { ...obj };
  for (const key of Object.keys(copy)) {
    if (copy[key] === undefined) delete copy[key];
  }
  return copy as T;
}

// idで突き合わせ、同一idはdeletedのORを採用してマージする（tombstone対応）。
export function mergeByIdWithTombstone<T extends { id: string; deleted?: boolean }>(
  local: T[],
  cloud: T[],
): T[] {
  const localById = new Map(local.map((v) => [v.id, v]));
  const cloudById = new Map(cloud.map((v) => [v.id, v]));
  const allIds = new Set([...localById.keys(), ...cloudById.keys()]);
  return [...allIds].map((id) => {
    const l = localById.get(id);
    const c = cloudById.get(id);
    const base = l ?? c!;
    const deleted = Boolean(l?.deleted) || Boolean(c?.deleted);
    return deleted ? { ...base, deleted: true } : { ...base };
  });
}
