/**
 * @file Work/Group/Unitの Firestore 双方向同期を担うサービス。
 * 「クラウド同期」専任部分。MediaStoreService の signal を読み書きし、ログイン状態（AuthService）を
 * 監視して、ログインした瞬間にクラウドと双方向同期する。実体は
 * core/persistence/tombstone-firestore-sync.ts の汎用同期を3つ（Work/Group/Unit）束ねたもの。
 * 削除は物理削除せず deleted フラグ（tombstone）で表現し、削除も多端末へ伝播させる。
 * 同期失敗は syncError signal（読み取り専用）にメッセージを流す。push に失敗した分は
 * pendingPush に保持し、オンライン復帰（window の online イベント）時に自動で再送する。
 */
import { computed, Injectable, inject } from '@angular/core';
import { Group, Unit, Work } from '@core/models/media.model';
import { AuthService } from '../firebase/auth.service';
import { createTombstoneFirestoreSync } from '../persistence/tombstone-firestore-sync';
import { MediaStoreService } from './media-store.service';

const SYNC_ERROR_MESSAGE = '閲覧記録のクラウド同期に失敗しました。ローカルには保存されています。';
const LOG_LABEL = 'MediaFirestoreSyncService';

@Injectable({ providedIn: 'root' })
export class MediaFirestoreSyncService {
  private auth = inject(AuthService);
  private store = inject(MediaStoreService);

  private worksSync = createTombstoneFirestoreSync<Work>({
    auth: this.auth,
    collectionName: 'works',
    getAllLocal: () => this.store.allWorks(),
    persistLocal: (merged) => this.store.persistWorks(merged),
    errorMessage: SYNC_ERROR_MESSAGE,
    logLabel: LOG_LABEL,
  });

  private groupsSync = createTombstoneFirestoreSync<Group>({
    auth: this.auth,
    collectionName: 'groups',
    getAllLocal: () => this.store.allGroups(),
    persistLocal: (merged) => this.store.persistGroups(merged),
    errorMessage: SYNC_ERROR_MESSAGE,
    logLabel: LOG_LABEL,
  });

  private unitsSync = createTombstoneFirestoreSync<Unit>({
    auth: this.auth,
    collectionName: 'units',
    getAllLocal: () => this.store.allUnits(),
    persistLocal: (merged) => this.store.persistUnits(merged),
    errorMessage: SYNC_ERROR_MESSAGE,
    logLabel: LOG_LABEL,
  });

  readonly syncError = computed(
    () => this.worksSync.syncError() ?? this.groupsSync.syncError() ?? this.unitsSync.syncError(),
  );

  pushWorks(works: Work[]): void {
    this.worksSync.push(works);
  }

  pushGroups(groups: Group[]): void {
    this.groupsSync.push(groups);
  }

  pushUnits(units: Unit[]): void {
    this.unitsSync.push(units);
  }

  async syncFromCloud(uid: string): Promise<void> {
    await this.worksSync.syncFromCloud(uid);
    await this.groupsSync.syncFromCloud(uid);
    await this.unitsSync.syncFromCloud(uid);
  }
}
