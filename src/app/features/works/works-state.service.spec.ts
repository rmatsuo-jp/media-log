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
});
