/**
 * @file 外部API（AniList/Google Books/openBD）検索結果からWork/Groupへ取り込む際のドメインマッピング。
 * WorksStateServiceから分離: work-importフィーチャー固有の変換ロジックのみをここに持つ。
 * 作品タイトルは日本語（titleNative）を優先して保存する（アプリ全体で日本語表記を基本とする）。
 */
import { Injectable, inject } from '@angular/core';
import { Group, Work } from '@core/models/media.model';
import { MediaRepositoryService } from '@core/media/media-repository.service';
import {
  ExternalUnitCandidate,
  ExternalWorkSearchResult,
} from '@core/external-media/external-media.model';
import { WorksStateService } from '../works-state.service';

@Injectable({ providedIn: 'root' })
export class WorkImportMapperService {
  private repo = inject(MediaRepositoryService);
  private state = inject(WorksStateService);

  importWorkFromExternal(result: ExternalWorkSearchResult): Work {
    return this.repo.createWork({
      title: result.titleNative ?? result.title,
      mediaType: result.mediaType,
      wantToConsume: false,
      externalSource: result.externalSource,
      externalId: result.externalId,
      coverImageUrl: result.coverImageUrl,
    });
  }

  importUnitsAsGroup(
    workId: string,
    groupTitle: string,
    candidates: ExternalUnitCandidate[],
  ): Group {
    const order = this.state.groupsForWork(workId).length;
    const group = this.repo.createGroup({
      workId,
      title: groupTitle,
      order,
      wantToConsume: false,
    });
    for (const candidate of candidates) {
      this.repo.createUnit({
        workId,
        groupId: group.id,
        number: candidate.number,
        coverImageUrl: candidate.coverImageUrl,
        coverImageCandidates: candidate.variantCoverImageUrls,
      });
    }
    return group;
  }
}
