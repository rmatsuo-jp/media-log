/**
 * @file Work/Group/Unit のローカル永続化を担うサービス。
 * 「localStorageへのCRUD」専任部分。MediaRepositoryService から利用される。Firestore同期は
 * media-firestore-sync.service.ts がこのサービスの signal を読み書きすることで担当し、
 * ここではクラウドの存在を意識しない。実体は core/persistence/tombstone-collection.store.ts の
 * 汎用storeを3つ（Work/Group/Unit）束ねたもの。
 * allWorks/allGroups/allUnits は tombstone（deleted=true）も含む全件の源泉。localStorage / Firestore と
 * 一致する。公開の works/groups/units は削除済みを除外したビューで、表示・集計はすべてこちらを基準にする。
 * Workを削除すると配下のGroup・Unitも連動してtombstone化する（カスケード削除）。
 */
import { Injectable } from '@angular/core';
import { Group, Unit, Work } from '@core/models/media.model';
import { createTombstoneCollectionStore } from '../persistence/tombstone-collection.store';

const WORKS_KEY = 'media_works';
const GROUPS_KEY = 'media_groups';
const UNITS_KEY = 'media_units';

function notifyStorageFull(): void {
  alert(
    'ブラウザの保存容量が上限に達したため、データを保存できませんでした。\n' +
      '不要な作品・記録を削除してください。',
  );
}

@Injectable({ providedIn: 'root' })
export class MediaStoreService {
  private worksStore = createTombstoneCollectionStore<Work>(WORKS_KEY, notifyStorageFull);
  private groupsStore = createTombstoneCollectionStore<Group>(GROUPS_KEY, notifyStorageFull);
  private unitsStore = createTombstoneCollectionStore<Unit>(UNITS_KEY, notifyStorageFull);

  readonly works = this.worksStore.visible;
  readonly groups = this.groupsStore.visible;
  readonly units = this.unitsStore.visible;

  readonly allWorks = this.worksStore.all;
  readonly allGroups = this.groupsStore.all;
  readonly allUnits = this.unitsStore.all;

  // ── 書き込み系（保存・論理削除） ───────────────────────────────
  persistWorks(works: Work[]): void {
    this.worksStore.persist(works);
  }

  persistGroups(groups: Group[]): void {
    this.groupsStore.persist(groups);
  }

  persistUnits(units: Unit[]): void {
    this.unitsStore.persist(units);
  }

  saveWork(work: Work): void {
    this.worksStore.save(work);
  }

  saveGroup(group: Group): void {
    this.groupsStore.save(group);
  }

  saveUnit(unit: Unit): void {
    this.unitsStore.save(unit);
  }

  // Workの削除は配下のGroup・Unitも連動してtombstone化する（カスケード）。
  // 呼び出し側（MediaRepositoryService）がFirestoreへpushできるよう、実際にtombstone化した対象を返す。
  deleteWork(id: string): { groups: Group[]; units: Unit[] } {
    this.worksStore.softDelete(id);
    const groups = this.allGroups().filter((g) => g.workId === id && !g.deleted);
    const units = this.allUnits().filter((u) => u.workId === id && !u.deleted);
    this.persistGroups(this.allGroups().map((g) => (g.workId === id ? { ...g, deleted: true } : g)));
    this.persistUnits(this.allUnits().map((u) => (u.workId === id ? { ...u, deleted: true } : u)));
    return { groups, units };
  }

  // Groupの削除は配下のUnitも連動してtombstone化する。
  deleteGroup(id: string): { units: Unit[] } {
    this.groupsStore.softDelete(id);
    const units = this.allUnits().filter((u) => u.groupId === id && !u.deleted);
    this.persistUnits(this.allUnits().map((u) => (u.groupId === id ? { ...u, deleted: true } : u)));
    return { units };
  }

  deleteUnit(id: string): void {
    this.unitsStore.softDelete(id);
  }
}
