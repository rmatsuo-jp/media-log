/**
 * @file works機能の状態・派生ロジックを集約するstate service。
 * MediaRepositoryServiceをinjectし、コンポーネントはこのサービス経由でのみ読み書きする
 * （CLAUDE.mdの「状態はfeature内の{feature}-state.serviceに集約する」パターン）。
 * 外部API検索結果からの作品・巻/話数取り込みのドメインマッピングは
 * features/works/work-import/work-import-mapper.service.ts に分離している。
 * nextUnreadUnit()はGroup.order→Unit.numberの順で最初の未読Unitを返す（次に見るべき巻/話の算出）。
 * unitCountForWork()は作品配下の全Unit数（巻/話数の合計）を返す。
 * findPossibleDuplicates()は外部検索結果の取り込み前に既存Workとの重複を検知する
 * （externalId+externalSource一致を最優先、無ければタイトル正規化文字列の完全一致にフォールバック。
 * あいまい類似度計算は行わない）。
 */
import { computed, Injectable, inject } from '@angular/core';
import { Group, MediaType, Unit, Work } from '@core/models/media.model';
import { MediaRepositoryService } from '@core/media/media-repository.service';
import { ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { normalizeTitle } from '@core/external-media/title-normalize.util';

export interface DuplicateWorkMatch {
  work: Work;
  matchType: 'externalId' | 'title';
}

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

  // Group.order→Unit.numberの順で最初に見つかった未読Unit（「次に見るべき」巻/話）。
  nextUnreadUnit(workId: string): Unit | undefined {
    for (const group of this.groupsForWork(workId)) {
      const unread = this.unitsForGroup(group.id).find((u) => !u.viewed);
      if (unread) return unread;
    }
    return undefined;
  }

  // 作品配下に1件以上Unitがあり、かつ全て既読か。
  isFullyRead(workId: string): boolean {
    const units = this.groupsForWork(workId).flatMap((g) => this.unitsForGroup(g.id));
    return units.length > 0 && units.every((u) => u.viewed);
  }

  workById(id: string): Work | undefined {
    return this.works().find((w) => w.id === id);
  }

  unitCountForWork(workId: string): number {
    return this.units().filter((u) => u.workId === workId).length;
  }

  // externalId一致を最優先、無ければタイトル正規化完全一致で既存Workとの重複候補を探す。
  findPossibleDuplicates(result: ExternalWorkSearchResult): DuplicateWorkMatch[] {
    const byExternalId = this.works().find(
      (w) =>
        !w.deleted && w.externalSource === result.externalSource && w.externalId === result.externalId,
    );
    if (byExternalId) return [{ work: byExternalId, matchType: 'externalId' }];

    const targetTitle = normalizeTitle(result.titleNative ?? result.title);
    return this.works()
      .filter((w) => !w.deleted && w.mediaType === result.mediaType)
      .filter((w) => normalizeTitle(w.title) === targetTitle)
      .map((work) => ({ work, matchType: 'title' as const }));
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

  decrementUnitViewCount(unit: Unit): void {
    this.repo.decrementUnitViewCount(unit);
  }

  deleteUnit(id: string): void {
    this.repo.deleteUnit(id);
  }

  updateUnitCover(unit: Unit, coverImageUrl: string): void {
    this.repo.updateUnitCover(unit, coverImageUrl);
  }

  updateWorkCover(work: Work, coverImageUrl: string): void {
    this.repo.updateWorkCover(work, coverImageUrl);
  }
}
