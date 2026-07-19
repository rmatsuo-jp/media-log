import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Group, Unit, Work } from '@core/models/media.model';
import { MediaFirestoreSyncService } from './media-firestore-sync.service';
import { MediaRepositoryService } from './media-repository.service';
import { MediaStoreService } from './media-store.service';

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

describe('MediaRepositoryService', () => {
  let repo: MediaRepositoryService;
  let syncStub: {
    pushWorks: ReturnType<typeof vi.fn>;
    pushGroups: ReturnType<typeof vi.fn>;
    pushUnits: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    localStorage.clear();
    syncStub = { pushWorks: vi.fn(), pushGroups: vi.fn(), pushUnits: vi.fn() };
    TestBed.configureTestingModule({
      providers: [{ provide: MediaFirestoreSyncService, useValue: syncStub }],
    });
    repo = TestBed.inject(MediaRepositoryService);
  });

  it('createWork()は保存してsync.pushWorksを呼ぶ', () => {
    const work = repo.createWork({ mediaType: 'manga', title: '作品A', wantToConsume: true });

    expect(repo.works().map((w) => w.id)).toEqual([work.id]);
    expect(syncStub.pushWorks).toHaveBeenCalledWith([work]);
  });

  it('updateWork()はupdatedAtを更新して保存する', () => {
    const work = repo.createWork({ mediaType: 'manga', title: '作品A', wantToConsume: false });
    const updated: Work = { ...work, title: '作品A改' };

    repo.updateWork(updated);

    expect(repo.works().find((w) => w.id === work.id)?.title).toBe('作品A改');
    expect(syncStub.pushGroups).not.toHaveBeenCalled();
  });

  it('deleteWork()はWorkとその配下Group/Unitをpushする', () => {
    const work = repo.createWork({ mediaType: 'manga', title: '作品A', wantToConsume: false });
    const store = TestBed.inject(MediaStoreService);
    store.saveGroup(group({ workId: work.id }));
    store.saveUnit(unit({ workId: work.id }));

    repo.deleteWork(work.id);

    expect(repo.works()).toEqual([]);
    expect(syncStub.pushWorks).toHaveBeenCalled();
    expect(syncStub.pushGroups).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'g1' })]),
    );
    expect(syncStub.pushUnits).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'u1' })]),
    );
  });

  it('createGroup()は保存してsync.pushGroupsを呼ぶ', () => {
    const g = repo.createGroup({ workId: 'w1', order: 0, title: 'G', wantToConsume: false });

    expect(repo.groups().map((x) => x.id)).toEqual([g.id]);
    expect(syncStub.pushGroups).toHaveBeenCalledWith([g]);
  });

  it('deleteGroup()はGroupと配下Unitをpushする', () => {
    const store = TestBed.inject(MediaStoreService);
    store.saveGroup(group());
    store.saveUnit(unit());

    repo.deleteGroup('g1');

    expect(repo.groups()).toEqual([]);
    expect(syncStub.pushGroups).toHaveBeenCalled();
    expect(syncStub.pushUnits).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'u1' })]),
    );
  });

  it('createUnit()はviewed=false, viewCount=0で作成される', () => {
    const u = repo.createUnit({ groupId: 'g1', workId: 'w1', number: 1 });

    expect(u.viewed).toBe(false);
    expect(u.viewCount).toBe(0);
    expect(syncStub.pushUnits).toHaveBeenCalledWith([u]);
  });

  it('deleteUnit()はUnitをtombstone化してpushする', () => {
    const u = repo.createUnit({ groupId: 'g1', workId: 'w1', number: 1 });
    syncStub.pushUnits.mockClear();

    repo.deleteUnit(u.id);

    expect(repo.units()).toEqual([]);
    expect(syncStub.pushUnits).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: u.id, deleted: true })]),
    );
  });

  it('toggleUnitViewed()は未読→既読でviewCountを最低1にする', () => {
    const u = repo.createUnit({ groupId: 'g1', workId: 'w1', number: 1 });

    repo.toggleUnitViewed(u);

    const updated = repo.units().find((x) => x.id === u.id)!;
    expect(updated.viewed).toBe(true);
    expect(updated.viewCount).toBe(1);
    expect(updated.lastViewedAt).toBeDefined();
  });

  it('toggleUnitViewed()は既読→未読でviewCountを変えない', () => {
    const u = repo.createUnit({ groupId: 'g1', workId: 'w1', number: 1 });
    repo.toggleUnitViewed(u);
    const viewed = repo.units().find((x) => x.id === u.id)!;

    repo.toggleUnitViewed(viewed);

    const updated = repo.units().find((x) => x.id === u.id)!;
    expect(updated.viewed).toBe(false);
    expect(updated.viewCount).toBe(1);
  });

  it('incrementUnitViewCount()はviewedをtrueにしてviewCountを1増やす', () => {
    const u = repo.createUnit({ groupId: 'g1', workId: 'w1', number: 1 });

    repo.incrementUnitViewCount(u);

    const updated = repo.units().find((x) => x.id === u.id)!;
    expect(updated.viewed).toBe(true);
    expect(updated.viewCount).toBe(1);

    repo.incrementUnitViewCount(updated);
    expect(repo.units().find((x) => x.id === u.id)?.viewCount).toBe(2);
  });
});
