import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Unit, Work } from '@core/models/media.model';
import { WorksStateService } from '../works-state.service';
import { WorkList } from './work-list';

function work(partial: Partial<Work>): Work {
  return {
    id: 'w-default',
    mediaType: 'manga',
    title: '作品',
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

describe('WorkList', () => {
  function setup(works: Work[], nextUnreadByWorkId: Record<string, Unit | undefined> = {}) {
    const fakeState: Partial<WorksStateService> = {
      allWorksSorted: signal(works),
      nextUnreadUnit: (workId: string) => nextUnreadByWorkId[workId],
      unitCountForWork: () => 0,
      isFullyRead: () => false,
    };
    TestBed.configureTestingModule({
      providers: [{ provide: WorksStateService, useValue: fakeState }],
    });
    return TestBed.runInInjectionContext(() => new WorkList());
  }

  it('初期状態はマンガのみに絞り込まれる', () => {
    const list = setup([
      work({ id: 'w1', mediaType: 'manga' }),
      work({ id: 'w2', mediaType: 'anime' }),
    ]);
    expect(list['filteredWorks']().map((w) => w.id)).toEqual(['w1']);
  });

  it('bothを選ぶと全種別が表示され、ページが1に戻る', () => {
    const list = setup([
      work({ id: 'w1', mediaType: 'manga' }),
      work({ id: 'w2', mediaType: 'anime' }),
    ]);
    list['currentPage'].set(2);
    list.onMediaTypeFilterChange('both');
    expect(list['filteredWorks']().map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(list['currentPage']()).toBe(1);
  });

  it('nextUnreadLabelは種別に応じた巻/話表記を返す', () => {
    const nextUnits = {
      w1: unit({ number: 5 }),
      w2: unit({ number: 12 }),
    };
    const list = setup([], nextUnits);
    expect(list.nextUnreadLabel(work({ id: 'w1', mediaType: 'manga' }))).toBe('次: 5巻');
    expect(list.nextUnreadLabel(work({ id: 'w2', mediaType: 'anime' }))).toBe('次: 第12話');
    expect(list.nextUnreadLabel(work({ id: 'w3' }))).toBeNull();
  });

  it('ページングは端数を切り上げ、範囲外への移動を無視する', () => {
    const works = Array.from({ length: 25 }, (_, i) =>
      work({ id: `w${i}`, mediaType: 'manga' }),
    );
    const list = setup(works);
    list.onPageSizeChange(12);
    expect(list['totalPages']()).toBe(3);
    expect(list['pagedWorks']()).toHaveLength(12);

    list.goToNextPage();
    list.goToNextPage();
    expect(list['currentPage']()).toBe(3);
    expect(list['pagedWorks']()).toHaveLength(1);
    list.goToNextPage(); // 最終ページ超過は無視
    expect(list['currentPage']()).toBe(3);

    list.goToPrevPage();
    list.goToPrevPage();
    list.goToPrevPage(); // 先頭ページ未満は無視
    expect(list['currentPage']()).toBe(1);
  });
});
