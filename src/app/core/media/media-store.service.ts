/**
 * @file Work/Group/Unit のローカル永続化を担うサービス。
 * 「localStorageへのCRUD」専任部分。MediaRepositoryService から利用される。Firestore同期は
 * media-firestore-sync.service.ts がこのサービスの signal を読み書きすることで担当し、
 * ここではクラウドの存在を意識しない。
 * _works/_groups/_units は tombstone（deleted=true）も含む全件の源泉。localStorage / Firestore と一致する。
 * 公開の works/groups/units は削除済みを除外したビューで、表示・集計はすべてこちらを基準にする。
 * Workを削除すると配下のGroup・Unitも連動してtombstone化する（カスケード削除）。
 * 別タブによるlocalStorage変更はstorageイベントで検知し、signalを再読込して追随する。
 */
import { computed, Injectable, signal } from '@angular/core';
import { Group, Unit, Work } from '@core/models/media.model';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const WORKS_KEY = 'media_works';
const GROUPS_KEY = 'media_groups';
const UNITS_KEY = 'media_units';

@Injectable({ providedIn: 'root' })
export class MediaStoreService {
  // ── 状態管理（signal） ─────────────────────────────────────────
  private _works = signal<Work[]>(readJson<Work[]>(WORKS_KEY, []));
  private _groups = signal<Group[]>(readJson<Group[]>(GROUPS_KEY, []));
  private _units = signal<Unit[]>(readJson<Unit[]>(UNITS_KEY, []));

  readonly works = computed(() => this._works().filter((w) => !w.deleted));
  readonly groups = computed(() => this._groups().filter((g) => !g.deleted));
  readonly units = computed(() => this._units().filter((u) => !u.deleted));

  // tombstoneを含む全件（Firestore同期がローカル/クラウドの突き合わせに使う）。
  readonly allWorks = this._works;
  readonly allGroups = this._groups;
  readonly allUnits = this._units;

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key === WORKS_KEY) this._works.set(readJson<Work[]>(WORKS_KEY, []));
      if (event.key === GROUPS_KEY) this._groups.set(readJson<Group[]>(GROUPS_KEY, []));
      if (event.key === UNITS_KEY) this._units.set(readJson<Unit[]>(UNITS_KEY, []));
    });
  }

  // ── 書き込み系（保存・論理削除） ───────────────────────────────
  persistWorks(works: Work[]): void {
    if (!writeJson(WORKS_KEY, works)) this.notifyStorageFull();
    this._works.set(works);
  }

  persistGroups(groups: Group[]): void {
    if (!writeJson(GROUPS_KEY, groups)) this.notifyStorageFull();
    this._groups.set(groups);
  }

  persistUnits(units: Unit[]): void {
    if (!writeJson(UNITS_KEY, units)) this.notifyStorageFull();
    this._units.set(units);
  }

  saveWork(work: Work): void {
    const existing = this._works();
    const idx = existing.findIndex((w) => w.id === work.id);
    this.persistWorks(
      idx >= 0 ? existing.map((w) => (w.id === work.id ? work : w)) : [work, ...existing],
    );
  }

  saveGroup(group: Group): void {
    const existing = this._groups();
    const idx = existing.findIndex((g) => g.id === group.id);
    this.persistGroups(
      idx >= 0 ? existing.map((g) => (g.id === group.id ? group : g)) : [group, ...existing],
    );
  }

  saveUnit(unit: Unit): void {
    const existing = this._units();
    const idx = existing.findIndex((u) => u.id === unit.id);
    this.persistUnits(
      idx >= 0 ? existing.map((u) => (u.id === unit.id ? unit : u)) : [unit, ...existing],
    );
  }

  // Workの削除は配下のGroup・Unitも連動してtombstone化する（カスケード）。
  deleteWork(id: string): void {
    this.persistWorks(this._works().map((w) => (w.id === id ? { ...w, deleted: true } : w)));
    this.persistGroups(this._groups().map((g) => (g.workId === id ? { ...g, deleted: true } : g)));
    this.persistUnits(this._units().map((u) => (u.workId === id ? { ...u, deleted: true } : u)));
  }

  // Groupの削除は配下のUnitも連動してtombstone化する。
  deleteGroup(id: string): void {
    this.persistGroups(this._groups().map((g) => (g.id === id ? { ...g, deleted: true } : g)));
    this.persistUnits(this._units().map((u) => (u.groupId === id ? { ...u, deleted: true } : u)));
  }

  deleteUnit(id: string): void {
    this.persistUnits(this._units().map((u) => (u.id === id ? { ...u, deleted: true } : u)));
  }

  private notifyStorageFull(): void {
    alert(
      'ブラウザの保存容量が上限に達したため、データを保存できませんでした。\n' +
        '不要な作品・記録を削除してください。',
    );
  }
}
