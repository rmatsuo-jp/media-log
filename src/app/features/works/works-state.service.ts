/**
 * @file works機能の状態・派生ロジックを集約するstate service。
 * MediaRepositoryServiceをinjectし、コンポーネントはこのサービス経由でのみ読み書きする
 * （CLAUDE.mdの「状態はfeature内の{feature}-state.serviceに集約する」パターン）。
 * 外部API（AniList/MangaDex）検索結果からの作品・巻/話数取り込みもここに集約する。
 */
import { computed, Injectable, inject } from '@angular/core';
import { Group, MediaType, Unit, Work } from '@core/models/media.model';
import { MediaRepositoryService } from '@core/media/media-repository.service';
import {
  ExternalUnitCandidate,
  ExternalWorkSearchResult,
} from '@core/external-media/external-media.model';

// 「読みたい」ビューに出す1行。work.wantToConsumeがtrueなら全グループを、falseなら
// wantToConsumeなグループのみを visibleGroups として持つ。
export interface WantToConsumeEntry {
  work: Work;
  visibleGroups: Group[];
}

@Injectable({ providedIn: 'root' })
export class WorksStateService {
  private repo = inject(MediaRepositoryService);

  readonly works = this.repo.works;
  readonly groups = this.repo.groups;
  readonly units = this.repo.units;

  readonly allWorksSorted = computed(() =>
    [...this.works()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  // work自体がwantToConsumeか、配下の少なくとも1グループがwantToConsumeの作品を集める。
  readonly wantToConsumeEntries = computed<WantToConsumeEntry[]>(() => {
    const groupsByWork = new Map<string, Group[]>();
    for (const g of this.groups()) {
      const list = groupsByWork.get(g.workId) ?? [];
      list.push(g);
      groupsByWork.set(g.workId, list);
    }
    const entries: WantToConsumeEntry[] = [];
    for (const work of this.allWorksSorted()) {
      const workGroups = groupsByWork.get(work.id) ?? [];
      if (work.wantToConsume) {
        entries.push({ work, visibleGroups: workGroups.sort((a, b) => a.order - b.order) });
      } else {
        const wanted = workGroups.filter((g) => g.wantToConsume).sort((a, b) => a.order - b.order);
        if (wanted.length > 0) entries.push({ work, visibleGroups: wanted });
      }
    }
    return entries;
  });

  groupsForWork(workId: string): Group[] {
    return this.groups()
      .filter((g) => g.workId === workId)
      .sort((a, b) => a.order - b.order);
  }

  unitsForGroup(groupId: string): Unit[] {
    return this.units()
      .filter((u) => u.groupId === groupId)
      .sort((a, b) => a.number - b.number);
  }

  workById(id: string): Work | undefined {
    return this.works().find((w) => w.id === id);
  }

  // ── 書き込み系（すべてrepositoryへ委譲、コンポーネントは薄く保つ） ──
  addWork(title: string, mediaType: MediaType): Work {
    return this.repo.createWork({ title, mediaType, wantToConsume: false });
  }

  toggleWorkWant(work: Work): void {
    this.repo.updateWork({ ...work, wantToConsume: !work.wantToConsume });
  }

  deleteWork(id: string): void {
    this.repo.deleteWork(id);
  }

  addGroup(workId: string, title: string): Group {
    const order = this.groupsForWork(workId).length;
    return this.repo.createGroup({ workId, title, order, wantToConsume: false });
  }

  toggleGroupWant(group: Group): void {
    this.repo.updateGroup({ ...group, wantToConsume: !group.wantToConsume });
  }

  deleteGroup(id: string): void {
    this.repo.deleteGroup(id);
  }

  addUnit(workId: string, groupId: string, number: number): Unit {
    return this.repo.createUnit({ workId, groupId, number });
  }

  toggleUnitViewed(unit: Unit): void {
    this.repo.toggleUnitViewed(unit);
  }

  incrementUnitViewCount(unit: Unit): void {
    this.repo.incrementUnitViewCount(unit);
  }

  deleteUnit(id: string): void {
    this.repo.deleteUnit(id);
  }

  // ── 外部API連携（AniList/MangaDex）からの取り込み ──────────────────
  importWorkFromExternal(result: ExternalWorkSearchResult): Work {
    return this.repo.createWork({
      title: result.title,
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
    const order = this.groupsForWork(workId).length;
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

  updateUnitCover(unit: Unit, coverImageUrl: string): void {
    this.repo.updateUnitCover(unit, coverImageUrl);
  }
}
