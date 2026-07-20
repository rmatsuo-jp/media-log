/**
 * @file tombstone方式のコレクションをFirestoreと双方向同期する共通実装。
 * media-firestore-sync.service.ts / achievements-firestore-sync.service.ts が、この上に薄いラッパーとして
 * 構築される。ログイン状態（AuthService）を監視し、ログインした瞬間にクラウドと双方向同期する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、削除も多端末へ伝播させる。
 * 同期失敗は syncError signal（読み取り専用）にメッセージを流す。push に失敗した分は pendingPush に
 * 保持し、オンライン復帰（window の online イベント）時に自動で再送する。
 */
import { effect, signal, Signal } from '@angular/core';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { AuthService } from '../firebase/auth.service';
import { firestore } from '../firebase/firebase.init';
import { TombstoneEntity } from './tombstone-collection.store';
import { mergeByIdWithTombstone, stripUndefinedShallow } from './tombstone-sync.util';

export interface TombstoneFirestoreSync<T extends TombstoneEntity> {
  readonly syncError: Signal<string | null>;
  push(items: T[]): void;
  syncFromCloud(uid: string): Promise<void>;
}

export function createTombstoneFirestoreSync<T extends TombstoneEntity>(config: {
  auth: AuthService;
  collectionName: string;
  getAllLocal: () => T[];
  persistLocal: (merged: T[]) => void;
  errorMessage: string;
  logLabel: string;
}): TombstoneFirestoreSync<T> {
  const { auth, collectionName, getAllLocal, persistLocal, errorMessage, logLabel } = config;

  const _syncError = signal<string | null>(null);
  const pendingPushIds = new Set<string>();

  function docRef(uid: string, id: string) {
    return doc(firestore, 'apps', 'media_log', 'users', uid, collectionName, id);
  }

  function colRef(uid: string) {
    return collection(firestore, 'apps', 'media_log', 'users', uid, collectionName);
  }

  function push(items: T[]): void {
    const uid = auth.user()?.uid;
    if (!uid || items.length === 0) return;
    Promise.all(items.map((v) => setDoc(docRef(uid, v.id), stripUndefinedShallow({ ...v } as Record<string, unknown>))))
      .then(() => {
        for (const v of items) pendingPushIds.delete(v.id);
        _syncError.set(null);
      })
      .catch((err) => {
        console.error(`[${logLabel}] ${collectionName}同期に失敗:`, err);
        for (const v of items) pendingPushIds.add(v.id);
        _syncError.set(errorMessage);
      });
  }

  function retryPendingPush(): void {
    if (pendingPushIds.size === 0) return;
    push(getAllLocal().filter((v) => pendingPushIds.has(v.id)));
  }

  // ログイン直後に呼ぶ双方向同期（tombstone対応）。ローカル・クラウドをidで突き合わせてマージし、
  // 食い違う分をクラウドへpushする。
  async function syncFromCloud(uid: string): Promise<void> {
    const snap = await getDocs(colRef(uid));
    const cloud = snap.docs.map((d) => d.data() as T);
    // getDocsの待機中にユーザー操作でローカルが更新されている可能性があるため、ここで読み直す。
    const merged = mergeByIdWithTombstone(getAllLocal(), cloud);
    persistLocal(merged);

    const cloudById = new Map(cloud.map((v) => [v.id, v]));
    const toPush = merged.filter((v) => {
      const c = cloudById.get(v.id);
      return !c || Boolean(c.deleted) !== Boolean(v.deleted);
    });
    await Promise.all(
      toPush.map((v) => setDoc(docRef(uid, v.id), stripUndefinedShallow({ ...v } as Record<string, unknown>))),
    );
  }

  effect(() => {
    const user = auth.user();
    if (user) {
      syncFromCloud(user.uid)
        .then(() => _syncError.set(null))
        .catch((err) => {
          console.error(`[${logLabel}] クラウド同期に失敗:`, err);
          _syncError.set(errorMessage);
        });
    }
  });

  window.addEventListener('online', retryPendingPush);

  return { syncError: _syncError.asReadonly(), push, syncFromCloud };
}
