import { vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Work } from '@core/models/media.model';
import { ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { DuplicateWorkMatch, WorksStateService } from '../works-state.service';
import { WorkImportMapperService } from './work-import-mapper.service';
import { WorkImportSearchService } from './work-import-search.service';
import { WorkImport } from './work-import';

function work(partial: Partial<Work>): Work {
  return {
    id: 'w1',
    mediaType: 'manga',
    title: 'NARUTO',
    wantToConsume: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function externalResult(partial: Partial<ExternalWorkSearchResult> = {}): ExternalWorkSearchResult {
  return {
    mediaType: 'manga',
    externalSource: 'anilist',
    externalId: 'a1',
    title: 'NARUTO',
    ...partial,
  };
}

describe('WorkImport', () => {
  function setup(duplicates: DuplicateWorkMatch[] = []) {
    const worksStateStub = {
      findPossibleDuplicates: vi.fn().mockReturnValue(duplicates),
    };
    const mapperStub = {
      importWorkFromExternal: vi.fn().mockReturnValue(work({})),
      importUnitsAsGroup: vi.fn(),
    };
    const searchStub = {
      mediaType: signal('manga'),
      numberFilter: signal('integer'),
      loadCandidatesFor: vi.fn((_result: ExternalWorkSearchResult, onLoaded: (c: []) => void) =>
        onLoaded([]),
      ),
      visibleCandidates: signal([]),
      coverUrlFor: vi.fn(),
      resetAfterImport: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: WorksStateService, useValue: worksStateStub },
        { provide: WorkImportMapperService, useValue: mapperStub },
        { provide: WorkImportSearchService, useValue: searchStub },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new WorkImport());
    return { component, worksStateStub, mapperStub };
  }

  it('selectWork()はfindPossibleDuplicatesの結果をduplicateMatchesにセットする', () => {
    const dup = { work: work({}), matchType: 'title' as const };
    const { component, worksStateStub } = setup([dup]);

    const result = externalResult();
    component.selectWork(result);

    expect(worksStateStub.findPossibleDuplicates).toHaveBeenCalledWith(result);
    expect(component['duplicateMatches']()).toEqual([dup]);
  });

  it('重複が無い場合はduplicateMatchesが空のままになる', () => {
    const { component } = setup([]);

    component.selectWork(externalResult());

    expect(component['duplicateMatches']()).toEqual([]);
  });

  it('重複ありでもconfirmImport()はブロックされず新規作成を実行する', () => {
    const dup = { work: work({}), matchType: 'title' as const };
    const { component, mapperStub } = setup([dup]);

    component.selectWork(externalResult());
    expect(component['duplicateMatches']()).toEqual([dup]);

    component.confirmImport();

    expect(mapperStub.importWorkFromExternal).toHaveBeenCalled();
  });

  it('backToSearch()はduplicateMatchesをリセットする', () => {
    const dup = { work: work({}), matchType: 'title' as const };
    const { component } = setup([dup]);

    component.selectWork(externalResult());
    component.backToSearch();

    expect(component['duplicateMatches']()).toEqual([]);
  });
});
