import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Group } from '@core/models/media.model';
import { MediaRepositoryService } from '@core/media/media-repository.service';
import { WorksStateService } from '../works-state.service';
import { WorkImportMapperService } from './work-import-mapper.service';

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

describe('WorkImportMapperService', () => {
  function setup() {
    const repoStub = {
      createWork: vi.fn(),
      createGroup: vi.fn(),
      createUnit: vi.fn(),
    };
    const stateStub = {
      groupsForWork: vi.fn().mockReturnValue([]),
    };
    TestBed.configureTestingModule({
      providers: [
        WorkImportMapperService,
        { provide: MediaRepositoryService, useValue: repoStub },
        { provide: WorksStateService, useValue: stateStub },
      ],
    });
    return { mapper: TestBed.inject(WorkImportMapperService), repoStub, stateStub };
  }

  it('importWorkFromExternal()は外部検索結果からrepo.createWorkに委譲する', () => {
    const { mapper, repoStub } = setup();
    mapper.importWorkFromExternal({
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
    const { mapper, repoStub, stateStub } = setup();
    const createdGroup = group({ id: 'g-new', workId: 'w1', order: 0, title: '1-2巻' });
    repoStub.createGroup.mockReturnValue(createdGroup);
    stateStub.groupsForWork.mockReturnValue([]);

    mapper.importUnitsAsGroup('w1', '1-2巻', [
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
