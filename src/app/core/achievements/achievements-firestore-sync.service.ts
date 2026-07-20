/**
 * @file 実績（Achievement）解除記録の Firestore 双方向同期を担うサービス。
 * media-firestore-sync.service.ts と同型のパターン。AchievementsStoreService の signal を
 * 読み書きし、ログイン状態（AuthService）を監視して、ログインした瞬間にクラウドと双方向同期する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、削除も多端末へ伝播させる。
 * 同期失敗は syncError signal（読み取り専用）にメッセージを流す。push に失敗した分は
 * pendingPush に保持し、オンライン復帰（window の online イベント）時に自動で再送する。
 */
import { effect, Injectable, inject, signal } from '@angular/core';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { Achievement } from '@core/models/media.model';
import { AuthService } from '../firebase/auth.service';
import { firestore } from '../firebase/firebase.init';
import { AchievementsStoreService } from './achievements-store.service';

// Firestoreはundefinedを受け付けないため、値がundefinedのキーを浅く1階層だけ除去する。
function stripUndefinedShallow<T extends Record<string, unknown>>(obj: T): T {
  const copy: Record<string, unknown> = { ...obj };
  for (const key of Object.keys(copy)) {
    if (copy[key] === undefined) delete copy[key];
  }
  return copy as T;
}

// idで突き合わせ、同一idはdeletedのORを採用してマージする（tombstone対応）。
function mergeByIdWithTombstone<T extends { id: string; deleted?: boolean }>(
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

@Injectable({ providedIn: 'root' })
export class AchievementsFirestoreSyncService {
  private auth = inject(AuthService);
  private store = inject(AchievementsStoreService);

  private _syncError = signal<string | null>(null);
  readonly syncError = this._syncError.asReadonly();

  private pendingPushIds = new Set<string>();

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.syncFromCloud(user.uid)
          .then(() => this._syncError.set(null))
          .catch((err) => {
            console.error('[AchievementsFirestoreSyncService] クラウド同期に失敗:', err);
            this._syncError.set('実績のクラウド同期に失敗しました。ローカルには保存されています。');
          });
      }
    });

    window.addEventListener('online', () => this.retryPendingPush());
  }

  private retryPendingPush(): void {
    if (this.pendingPushIds.size > 0) {
      this.pushAchievements(
        this.store.allAchievements().filter((a) => this.pendingPushIds.has(a.id)),
      );
    }
  }

  // apps/media_log/users/{uid}/achievements/{id} のドキュメント参照を返す。
  private docRef(uid: string, id: string) {
    return doc(firestore, 'apps', 'media_log', 'users', uid, 'achievements', id);
  }

  private colRef(uid: string) {
    return collection(firestore, 'apps', 'media_log', 'users', uid, 'achievements');
  }

  pushAchievements(achievements: Achievement[]): void {
    const uid = this.auth.user()?.uid;
    if (!uid || achievements.length === 0) return;
    Promise.all(
      achievements.map((a) => setDoc(this.docRef(uid, a.id), stripUndefinedShallow({ ...a }))),
    )
      .then(() => {
        for (const a of achievements) this.pendingPushIds.delete(a.id);
        this._syncError.set(null);
      })
      .catch((err) => {
        console.error('[AchievementsFirestoreSyncService] achievements同期に失敗:', err);
        for (const a of achievements) this.pendingPushIds.add(a.id);
        this._syncError.set('実績のクラウド同期に失敗しました。ローカルには保存されています。');
      });
  }

  // ログイン直後に呼ぶ双方向同期（tombstone対応）。ローカル・クラウドをidで突き合わせてマージし、
  // 食い違う分をクラウドへpushする。
  async syncFromCloud(uid: string): Promise<void> {
    const snap = await getDocs(this.colRef(uid));
    const cloud = snap.docs.map((d) => d.data() as Achievement);
    // getDocsの待機中にユーザー操作でローカルが更新されている可能性があるため、ここで読み直す。
    const merged = mergeByIdWithTombstone(this.store.allAchievements(), cloud);
    this.store.persistAchievements(merged);

    const cloudById = new Map(cloud.map((v) => [v.id, v]));
    const toPush = merged.filter((v) => {
      const c = cloudById.get(v.id);
      return !c || Boolean(c.deleted) !== Boolean(v.deleted);
    });
    await Promise.all(
      toPush.map((v) => setDoc(this.docRef(uid, v.id), stripUndefinedShallow({ ...v }))),
    );
  }
}
