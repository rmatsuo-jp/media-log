/**
 * @file 実績（ゲーミフィケーション）機能の状態・判定ロジックを集約するstate service。
 * MediaRepositoryService（works/groups/units）と AchievementsRepositoryService（解除記録）を
 * injectし、コンポーネントはこのサービス経由でのみ読み書きする。
 * feature間import禁止のため、works機能のWorksStateServiceは使わずここで完読判定を再実装する。
 * 現在値（累計読了数・完読作品数・周回数）を computed() で算出し、実績定義（静的マスタ）と
 * 突き合わせて進捗・解除状態を返す。値が変化して新規に条件を満たした実績があれば
 * effect内で自動的に AchievementsRepositoryService.unlockAchievement を呼ぶ。
 */
import { computed, effect, Injectable, inject } from '@angular/core';
import { MediaType } from '@core/models/media.model';
import { MediaRepositoryService } from '@core/media/media-repository.service';
import { AchievementsRepositoryService } from '@core/achievements/achievements-repository.service';
import {
  ACHIEVEMENT_DEFINITIONS,
  AchievementDefinition,
} from '@core/achievements/achievement-definitions';

export interface AchievementProgress {
  definition: AchievementDefinition;
  current: number;
  unlocked: boolean;
  unlockedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AchievementsStateService {
  private media = inject(MediaRepositoryService);
  private repo = inject(AchievementsRepositoryService);

  readonly achievements = this.repo.achievements;

  // ── 現在値（メトリクス）算出 ────────────────────────────────────
  totalUnitsRead(mediaType: MediaType): number {
    return this.media
      .units()
      .filter((u) => u.viewed && u.workId && this.workMediaType(u.workId) === mediaType).length;
  }

  // 作品配下に1件以上Unitがあり、かつ全て既読の作品数（manga/anime合算）。
  readonly completedWorksCount = computed(() => {
    const groupsByWork = new Map<string, string[]>();
    for (const g of this.media.groups()) {
      const list = groupsByWork.get(g.workId) ?? [];
      list.push(g.id);
      groupsByWork.set(g.workId, list);
    }
    const unitsByGroup = new Map<string, boolean[]>();
    for (const u of this.media.units()) {
      const list = unitsByGroup.get(u.groupId) ?? [];
      list.push(u.viewed);
      unitsByGroup.set(u.groupId, list);
    }
    let count = 0;
    for (const work of this.media.works()) {
      const groupIds = groupsByWork.get(work.id) ?? [];
      const viewedFlags = groupIds.flatMap((gid) => unitsByGroup.get(gid) ?? []);
      if (viewedFlags.length > 0 && viewedFlags.every((v) => v)) count++;
    }
    return count;
  });

  // 全Unitのviewed済み分について viewCount-1 を合算した「2周目以降」の累計回数。
  readonly totalRereads = computed(() =>
    this.media
      .units()
      .filter((u) => u.viewed)
      .reduce((sum, u) => sum + Math.max(0, u.viewCount - 1), 0),
  );

  private workMediaType(workId: string): MediaType | undefined {
    return this.media.works().find((w) => w.id === workId)?.mediaType;
  }

  private metricValue(definition: AchievementDefinition): number {
    switch (definition.metric) {
      case 'unitsRead':
        return this.totalUnitsRead(definition.mediaType!);
      case 'worksCompleted':
        return this.completedWorksCount();
      case 'rereads':
        return this.totalRereads();
    }
  }

  // ── 実績定義 × 現在値 → 進捗・解除状態 ──────────────────────────
  readonly achievementProgress = computed<AchievementProgress[]>(() => {
    const unlockedById = new Map(this.achievements().map((a) => [a.id, a.unlockedAt]));
    return ACHIEVEMENT_DEFINITIONS.map((definition) => {
      const current = this.metricValue(definition);
      const unlockedAt = unlockedById.get(definition.id);
      return {
        definition,
        current,
        unlocked: unlockedAt !== undefined || current >= definition.threshold,
        unlockedAt,
      };
    });
  });

  constructor() {
    // 条件を満たしたが未解除の実績があれば解除記録を残す（解除トリガーはこのサービスが一元管理）。
    effect(() => {
      for (const progress of this.achievementProgress()) {
        if (progress.unlockedAt === undefined && progress.current >= progress.definition.threshold) {
          this.repo.unlockAchievement(progress.definition.id);
        }
      }
    });
  }
}
