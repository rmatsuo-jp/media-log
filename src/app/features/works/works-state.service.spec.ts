import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Group, Unit, Work } from '@core/models/media.model';
import { MediaRepositoryService } from '@core/media/media-repository.service';
import { WorksStateService } from './works-state.service';

function work(partial: Partial<Work>): Work {
  return {
    id: 'w-default',
    mediaType: 'anime',
    title: '作品',
    wantToConsume: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function group(partial: Partial<Group>): Group {
  return {
    id: 'g-default',
    workId: 'w-default',
    order: 0,
    title: 'グループ',
    wantToConsume: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function unit(partial: Partial<Unit>): Unit {
  return {
    id: 'u-default',
    groupId: 'g-default',
    workId: 'w-default',
    number: 1,
    viewed: false,
    viewCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('WorksStateService', () => {
  function setup(works: Work[], groups: Group[], units: Unit[] = []) {
    const fakeRepo: Partial<MediaRepositoryService> = {
      works: signal(works),
      groups: signal(groups),
      units: signal(units),
    };
    TestBed.configureTestingModule({
      providers: [WorksStateService, { provide: MediaRepositoryService, useValue: fakeRepo }],
    });
    return TestBed.inject(WorksStateService);
  }

  it('Work自体がwantToConsumeなら配下の全グループを表示する', () => {
    const w = work({ id: 'w1', title: 'アニメA', wantToConsume: true });
    const g1 = group({ id: 'g1', workId: 'w1', order: 0, title: '第1期' });
    const g2 = group({ id: 'g2', workId: 'w1', order: 1, title: '第2期' });
    const state = setup([w], [g1, g2]);

    const entries = state.wantToConsumeEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].work.id).toBe('w1');
    expect(entries[0].visibleGroups.map((g) => g.id)).toEqual(['g1', 'g2']);
  });

  it('Work自体はwantToConsumeでなくても、配下のGroupがwantToConsumeなら該当グループのみ表示する', () => {
    const w = work({ id: 'w1', title: 'アニメA', wantToConsume: false });
    const g1 = group({ id: 'g1', workId: 'w1', order: 0, title: '第1期', wantToConsume: false });
    const g2 = group({ id: 'g2', workId: 'w1', order: 1, title: '第2期', wantToConsume: true });
    const state = setup([w], [g1, g2]);

    const entries = state.wantToConsumeEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].visibleGroups.map((g) => g.id)).toEqual(['g2']);
  });

  it('WorkもGroupもwantToConsumeでなければ読みたいリストに現れない', () => {
    const w = work({ id: 'w1', title: 'アニメA', wantToConsume: false });
    const g1 = group({ id: 'g1', workId: 'w1', wantToConsume: false });
    const state = setup([w], [g1]);

    expect(state.wantToConsumeEntries()).toHaveLength(0);
  });

  it('allWorksSorted()はcreatedAt降順で並ぶ', () => {
    const w1 = work({ id: 'w1', createdAt: '2026-01-01T00:00:00.000Z' });
    const w2 = work({ id: 'w2', createdAt: '2026-02-01T00:00:00.000Z' });
    const state = setup([w1, w2], []);

    expect(state.allWorksSorted().map((w) => w.id)).toEqual(['w2', 'w1']);
  });

  it('groupsForWork()はworkIdでフィルタしorder昇順でソートする', () => {
    const g1 = group({ id: 'g1', workId: 'w1', order: 1 });
    const g2 = group({ id: 'g2', workId: 'w1', order: 0 });
    const g3 = group({ id: 'g3', workId: 'other', order: 0 });
    const state = setup([], [g1, g2, g3]);

    expect(state.groupsForWork('w1').map((g) => g.id)).toEqual(['g2', 'g1']);
  });

  it('unitsForGroup()はgroupIdでフィルタしnumber昇順でソートする', () => {
    const u1 = unit({ id: 'u1', groupId: 'g1', number: 2 });
    const u2 = unit({ id: 'u2', groupId: 'g1', number: 1 });
    const u3 = unit({ id: 'u3', groupId: 'other', number: 0 });
    const state = setup([], [], [u1, u2, u3]);

    expect(state.unitsForGroup('g1').map((u) => u.id)).toEqual(['u2', 'u1']);
  });

  it('workById()はidに一致するworkを返す', () => {
    const w = work({ id: 'w1' });
    const state = setup([w], []);

    expect(state.workById('w1')?.id).toBe('w1');
    expect(state.workById('missing')).toBeUndefined();
  });

  describe('書き込み系メソッド', () => {
    function setupWithRepoSpy() {
      const repoStub = {
        works: signal<Work[]>([]),
        groups: signal<Group[]>([]),
        units: signal<Unit[]>([]),
        createWork: vi.fn(),
        updateWork: vi.fn(),
        deleteWork: vi.fn(),
        createGroup: vi.fn(),
        updateGroup: vi.fn(),
        deleteGroup: vi.fn(),
        createUnit: vi.fn(),
        toggleUnitViewed: vi.fn(),
        incrementUnitViewCount: vi.fn(),
        deleteUnit: vi.fn(),
      };
      TestBed.configureTestingModule({
        providers: [WorksStateService, { provide: MediaRepositoryService, useValue: repoStub }],
      });
      return { state: TestBed.inject(WorksStateService), repoStub };
    }

    it('addWork()はwantToConsume:falseでrepo.createWorkに委譲する', () => {
      const { state, repoStub } = setupWithRepoSpy();
      state.addWork('新作品', 'manga');
      expect(repoStub.createWork).toHaveBeenCalledWith({
        title: '新作品',
        mediaType: 'manga',
        wantToConsume: false,
      });
    });

    it('toggleWorkWant()はwantToConsumeを反転してrepo.updateWorkに渡す', () => {
      const { state, repoStub } = setupWithRepoSpy();
      const w = work({ wantToConsume: false });
      state.toggleWorkWant(w);
      expect(repoStub.updateWork).toHaveBeenCalledWith({ ...w, wantToConsume: true });
    });

    it('deleteWork()はrepo.deleteWorkに委譲する', () => {
      const { state, repoStub } = setupWithRepoSpy();
      state.deleteWork('w1');
      expect(repoStub.deleteWork).toHaveBeenCalledWith('w1');
    });

    it('addGroup()はorderに現在のグループ数を渡す', () => {
      const { state, repoStub } = setupWithRepoSpy();
      repoStub.groups.set([group({ id: 'g1', workId: 'w1', order: 0 })]);
      state.addGroup('w1', '新グループ');
      expect(repoStub.createGroup).toHaveBeenCalledWith({
        workId: 'w1',
        title: '新グループ',
        order: 1,
        wantToConsume: false,
      });
    });

    it('toggleGroupWant()はwantToConsumeを反転してrepo.updateGroupに渡す', () => {
      const { state, repoStub } = setupWithRepoSpy();
      const g = group({ wantToConsume: false });
      state.toggleGroupWant(g);
      expect(repoStub.updateGroup).toHaveBeenCalledWith({ ...g, wantToConsume: true });
    });

    it('deleteGroup()はrepo.deleteGroupに委譲する', () => {
      const { state, repoStub } = setupWithRepoSpy();
      state.deleteGroup('g1');
      expect(repoStub.deleteGroup).toHaveBeenCalledWith('g1');
    });

    it('addUnit()はrepo.createUnitに委譲する', () => {
      const { state, repoStub } = setupWithRepoSpy();
      state.addUnit('w1', 'g1', 5);
      expect(repoStub.createUnit).toHaveBeenCalledWith({ workId: 'w1', groupId: 'g1', number: 5 });
    });

    it('toggleUnitViewed()/incrementUnitViewCount()/deleteUnit()はrepoへ委譲する', () => {
      const { state, repoStub } = setupWithRepoSpy();
      const u = unit({});

      state.toggleUnitViewed(u);
      expect(repoStub.toggleUnitViewed).toHaveBeenCalledWith(u);

      state.incrementUnitViewCount(u);
      expect(repoStub.incrementUnitViewCount).toHaveBeenCalledWith(u);

      state.deleteUnit('u1');
      expect(repoStub.deleteUnit).toHaveBeenCalledWith('u1');
    });

    it('importWorkFromExternal()は外部検索結果からrepo.createWorkに委譲する', () => {
      const { state, repoStub } = setupWithRepoSpy();
      state.importWorkFromExternal({
        mediaType: 'manga',
        externalSource: 'anilist',
        externalId: 'manga-1',
        title: '鬼滅の刃',
        coverImageUrl: 'https://example.com/cover.jpg',
      });
      expect(repoStub.createWork).toHaveBeenCalledWith({
        title: '鬼滅の刃',
        mediaType: 'manga',
        wantToConsume: false,
        externalSource: 'anilist',
        externalId: 'manga-1',
        coverImageUrl: 'https://example.com/cover.jpg',
      });
    });

    it('importUnitsAsGroup()はグループを1件作成し、候補ごとにcoverImageUrl付きUnitを作成する', () => {
      const { state, repoStub } = setupWithRepoSpy();
      const createdGroup = group({ id: 'g-new', workId: 'w1', order: 0, title: '1-2巻' });
      repoStub.createGroup.mockReturnValue(createdGroup);

      state.importUnitsAsGroup('w1', '1-2巻', [
        { number: 1, coverImageUrl: 'https://example.com/v1.jpg' },
        { number: 2, coverImageUrl: 'https://example.com/v2.jpg' },
      ]);

      expect(repoStub.createGroup).toHaveBeenCalledWith({
        workId: 'w1',
        title: '1-2巻',
        order: 0,
        wantToConsume: false,
      });
      expect(repoStub.createUnit).toHaveBeenNthCalledWith(1, {
        workId: 'w1',
        groupId: 'g-new',
        number: 1,
        coverImageUrl: 'https://example.com/v1.jpg',
      });
      expect(repoStub.createUnit).toHaveBeenNthCalledWith(2, {
        workId: 'w1',
        groupId: 'g-new',
        number: 2,
        coverImageUrl: 'https://example.com/v2.jpg',
      });
    });
  });
});
