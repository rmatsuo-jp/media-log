/**
 * @file Work/Group/Unit永続化の窓口となるリポジトリサービス。
 * 「ローカル保存（MediaStoreService）→ クラウド反映（MediaFirestoreSyncService.push*）」の
 * 組み合わせを1箇所に集約し、書き込み系操作の呼び忘れによるクラウド乖離を防ぐ。
 * features/works はこのサービスのみをinjectする。
 */
import { Injectable, inject } from '@angular/core';
import { Group, Unit, Work } from '@core/models/media.model';
import { MediaFirestoreSyncService } from './media-firestore-sync.service';
import { MediaStoreService } from './media-store.service';

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

@Injectable({ providedIn: 'root' })
export class MediaRepositoryService {
  private store = inject(MediaStoreService);
  private sync = inject(MediaFirestoreSyncService);

  readonly works = this.store.works;
  readonly groups = this.store.groups;
  readonly units = this.store.units;

  // ── Work ─────────────────────────────────────────────────────────
  createWork(
    input: Pick<Work, 'mediaType' | 'title' | 'wantToConsume'> &
      Partial<Pick<Work, 'externalSource' | 'externalId' | 'coverImageUrl'>>,
  ): Work {
    const now = nowIso();
    const work: Work = { id: newId(), createdAt: now, updatedAt: now, ...input };
    this.store.saveWork(work);
    this.sync.pushWorks([work]);
    return work;
  }

  updateWork(work: Work): void {
    const updated: Work = { ...work, updatedAt: nowIso() };
    this.store.saveWork(updated);
    this.sync.pushWorks([updated]);
  }

  deleteWork(id: string): void {
    this.store.deleteWork(id);
    const work = this.store.allWorks().find((w) => w.id === id);
    if (work) this.sync.pushWorks([work]);
    this.sync.pushGroups(this.store.allGroups().filter((g) => g.workId === id));
    this.sync.pushUnits(this.store.allUnits().filter((u) => u.workId === id));
  }

  // ── Group ────────────────────────────────────────────────────────
  createGroup(
    input: Pick<Group, 'workId' | 'order' | 'title' | 'wantToConsume'> &
      Partial<Pick<Group, 'coverImageUrl'>>,
  ): Group {
    const now = nowIso();
    const group: Group = { id: newId(), createdAt: now, updatedAt: now, ...input };
    this.store.saveGroup(group);
    this.sync.pushGroups([group]);
    return group;
  }

  updateGroup(group: Group): void {
    const updated: Group = { ...group, updatedAt: nowIso() };
    this.store.saveGroup(updated);
    this.sync.pushGroups([updated]);
  }

  deleteGroup(id: string): void {
    this.store.deleteGroup(id);
    const group = this.store.allGroups().find((g) => g.id === id);
    if (group) this.sync.pushGroups([group]);
    this.sync.pushUnits(this.store.allUnits().filter((u) => u.groupId === id));
  }

  // ── Unit ─────────────────────────────────────────────────────────
  createUnit(
    input: Pick<Unit, 'groupId' | 'workId' | 'number'> & Partial<Pick<Unit, 'coverImageUrl'>>,
  ): Unit {
    const now = nowIso();
    const unit: Unit = {
      id: newId(),
      viewed: false,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
    this.store.saveUnit(unit);
    this.sync.pushUnits([unit]);
    return unit;
  }

  deleteUnit(id: string): void {
    this.store.deleteUnit(id);
    const unit = this.store.allUnits().find((u) => u.id === id);
    if (unit) this.sync.pushUnits([unit]);
  }

  // 既読/未読を切り替える。未読→既読への遷移時のみ周回数を1にする（0のままにしないため）。
  toggleUnitViewed(unit: Unit): void {
    const viewed = !unit.viewed;
    const updated: Unit = {
      ...unit,
      viewed,
      viewCount: viewed ? Math.max(1, unit.viewCount) : unit.viewCount,
      lastViewedAt: viewed ? nowIso() : unit.lastViewedAt,
      updatedAt: nowIso(),
    };
    this.store.saveUnit(updated);
    this.sync.pushUnits([updated]);
  }

  // 再視聴・再読の回数を1増やす（既読状態も合わせて立てる）。
  incrementUnitViewCount(unit: Unit): void {
    const updated: Unit = {
      ...unit,
      viewed: true,
      viewCount: unit.viewCount + 1,
      lastViewedAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.store.saveUnit(updated);
    this.sync.pushUnits([updated]);
  }
}
