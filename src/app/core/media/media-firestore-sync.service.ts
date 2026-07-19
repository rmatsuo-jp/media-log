/**
 * @file Work/Group/Unitの Firestore 双方向同期を担うサービス。
 * 「クラウド同期」専任部分。MediaStoreService の signal を読み書きし、ログイン状態（AuthService）を
 * 監視して、ログインした瞬間にクラウドと双方向同期する。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、削除も多端末へ伝播させる。
 * 同期失敗は syncError signal（読み取り専用）にメッセージを流す。push に失敗した分は
 * pendingPush に保持し、オンライン復帰（window の online イベント）時に自動で再送する。
 */
import { effect, Injectable, inject, signal } from '@angular/core';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { Group, Unit, Work } from '@core/models/media.model';
import { AuthService } from '../firebase/auth.service';
import { firestore } from '../firebase/firebase.init';
import { MediaStoreService } from './media-store.service';

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
export class MediaFirestoreSyncService {
  private auth = inject(AuthService);
  private store = inject(MediaStoreService);

  private _syncError = signal<string | null>(null);
  readonly syncError = this._syncError.asReadonly();

  private pendingPushIds = { works: new Set<string>(), groups: new Set<string>(), units: new Set<string>() };

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.syncFromCloud(user.uid)
          .then(() => this._syncError.set(null))
          .catch((err) => {
            console.error('[MediaFirestoreSyncService] クラウド同期に失敗:', err);
            this._syncError.set('閲覧記録のクラウド同期に失敗しました。ローカルには保存されています。');
          });
      }
    });

    window.addEventListener('online', () => this.retryPendingPush());
  }

  private retryPendingPush(): void {
    if (this.pendingPushIds.works.size > 0) {
      this.pushWorks(this.store.allWorks().filter((w) => this.pendingPushIds.works.has(w.id)));
    }
    if (this.pendingPushIds.groups.size > 0) {
      this.pushGroups(this.store.allGroups().filter((g) => this.pendingPushIds.groups.has(g.id)));
    }
    if (this.pendingPushIds.units.size > 0) {
      this.pushUnits(this.store.allUnits().filter((u) => this.pendingPushIds.units.has(u.id)));
    }
  }

  // apps/media_log/users/{uid}/{collection}/{id} のドキュメント参照を返す。
  private docRef(uid: string, col: 'works' | 'groups' | 'units', id: string) {
    return doc(firestore, 'apps', 'media_log', 'users', uid, col, id);
  }

  private colRef(uid: string, col: 'works' | 'groups' | 'units') {
    return collection(firestore, 'apps', 'media_log', 'users', uid, col);
  }

  pushWorks(works: Work[]): void {
    const uid = this.auth.user()?.uid;
    if (!uid || works.length === 0) return;
    Promise.all(
      works.map((w) =>
        setDoc(this.docRef(uid, 'works', w.id), stripUndefinedShallow({ ...w })),
      ),
    )
      .then(() => {
        for (const w of works) this.pendingPushIds.works.delete(w.id);
        this._syncError.set(null);
      })
      .catch((err) => {
        console.error('[MediaFirestoreSyncService] works同期に失敗:', err);
        for (const w of works) this.pendingPushIds.works.add(w.id);
        this._syncError.set('閲覧記録のクラウド同期に失敗しました。ローカルには保存されています。');
      });
  }

  pushGroups(groups: Group[]): void {
    const uid = this.auth.user()?.uid;
    if (!uid || groups.length === 0) return;
    Promise.all(
      groups.map((g) =>
        setDoc(this.docRef(uid, 'groups', g.id), stripUndefinedShallow({ ...g })),
      ),
    )
      .then(() => {
        for (const g of groups) this.pendingPushIds.groups.delete(g.id);
        this._syncError.set(null);
      })
      .catch((err) => {
        console.error('[MediaFirestoreSyncService] groups同期に失敗:', err);
        for (const g of groups) this.pendingPushIds.groups.add(g.id);
        this._syncError.set('閲覧記録のクラウド同期に失敗しました。ローカルには保存されています。');
      });
  }

  pushUnits(units: Unit[]): void {
    const uid = this.auth.user()?.uid;
    if (!uid || units.length === 0) return;
    Promise.all(
      units.map((u) =>
        setDoc(this.docRef(uid, 'units', u.id), stripUndefinedShallow({ ...u })),
      ),
    )
      .then(() => {
        for (const u of units) this.pendingPushIds.units.delete(u.id);
        this._syncError.set(null);
      })
      .catch((err) => {
        console.error('[MediaFirestoreSyncService] units同期に失敗:', err);
        for (const u of units) this.pendingPushIds.units.add(u.id);
        this._syncError.set('閲覧記録のクラウド同期に失敗しました。ローカルには保存されています。');
      });
  }

  // ログイン直後に呼ぶ双方向同期（tombstone対応）。works/groups/unitsそれぞれについて、
  // ローカル・クラウドをidで突き合わせてマージし、食い違う分をクラウドへpushする。
  async syncFromCloud(uid: string): Promise<void> {
    await this.syncCollection(uid, 'works', this.store.allWorks(), (merged) =>
      this.store.persistWorks(merged as Work[]),
    );
    await this.syncCollection(uid, 'groups', this.store.allGroups(), (merged) =>
      this.store.persistGroups(merged as Group[]),
    );
    await this.syncCollection(uid, 'units', this.store.allUnits(), (merged) =>
      this.store.persistUnits(merged as Unit[]),
    );
  }

  private async syncCollection<T extends { id: string; deleted?: boolean }>(
    uid: string,
    col: 'works' | 'groups' | 'units',
    local: T[],
    persist: (merged: T[]) => void,
  ): Promise<void> {
    const snap = await getDocs(this.colRef(uid, col));
    const cloud = snap.docs.map((d) => d.data() as T);
    const merged = mergeByIdWithTombstone(local, cloud);
    persist(merged);

    const cloudById = new Map(cloud.map((v) => [v.id, v]));
    const toPush = merged.filter((v) => {
      const c = cloudById.get(v.id);
      return !c || Boolean(c.deleted) !== Boolean(v.deleted);
    });
    await Promise.all(
      toPush.map((v) => setDoc(this.docRef(uid, col, v.id), stripUndefinedShallow(v as Record<string, unknown>))),
    );
  }
}
