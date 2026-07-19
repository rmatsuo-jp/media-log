import { Group, Unit, Work } from '@core/models/media.model';
import { MediaStoreService } from './media-store.service';

function work(partial: Partial<Work> = {}): Work {
  return {
    id: 'w1',
    mediaType: 'manga',
    title: 'テスト作品',
    wantToConsume: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function group(partial: Partial<Group> = {}): Group {
  return {
    id: 'g1',
    workId: 'w1',
    order: 0,
    title: 'グループ1',
    wantToConsume: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function unit(partial: Partial<Unit> = {}): Unit {
  return {
    id: 'u1',
    groupId: 'g1',
    workId: 'w1',
    number: 1,
    viewed: false,
    viewCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('MediaStoreService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('保存したWorkがworks()に反映される', () => {
    const store = new MediaStoreService();
    store.saveWork(work());
    expect(store.works().map((w) => w.id)).toEqual(['w1']);
  });

  it('deleteWork()はWork本体だけでなく配下のGroup・Unitも連動してtombstone化する', () => {
    const store = new MediaStoreService();
    store.saveWork(work());
    store.saveGroup(group());
    store.saveUnit(unit());

    store.deleteWork('w1');

    expect(store.works()).toEqual([]);
    expect(store.groups()).toEqual([]);
    expect(store.units()).toEqual([]);
    expect(store.allWorks().find((w) => w.id === 'w1')?.deleted).toBe(true);
    expect(store.allGroups().find((g) => g.id === 'g1')?.deleted).toBe(true);
    expect(store.allUnits().find((u) => u.id === 'u1')?.deleted).toBe(true);
  });

  it('deleteGroup()は配下のUnitも連動してtombstone化する', () => {
    const store = new MediaStoreService();
    store.saveGroup(group());
    store.saveUnit(unit());

    store.deleteGroup('g1');

    expect(store.groups()).toEqual([]);
    expect(store.units()).toEqual([]);
    expect(store.allUnits().find((u) => u.id === 'u1')?.deleted).toBe(true);
  });

  it('別インスタンスでもlocalStorageから復元される', () => {
    const writer = new MediaStoreService();
    writer.saveWork(work());

    const reader = new MediaStoreService();
    expect(reader.works().map((w) => w.id)).toEqual(['w1']);
  });
});
