/**
 * @file 実績（Achievement）解除記録の永続化窓口となるリポジトリサービス。
 * 「ローカル保存（AchievementsStoreService）→ クラウド反映（AchievementsFirestoreSyncService.push）」の
 * 組み合わせを1箇所に集約する。features/achievements はこのサービスのみをinjectする。
 */
import { Injectable, inject } from '@angular/core';
import { Achievement } from '@core/models/media.model';
import { AchievementsFirestoreSyncService } from './achievements-firestore-sync.service';
import { AchievementsStoreService } from './achievements-store.service';

function nowIso(): string {
  return new Date().toISOString();
}

@Injectable({ providedIn: 'root' })
export class AchievementsRepositoryService {
  private store = inject(AchievementsStoreService);
  private sync = inject(AchievementsFirestoreSyncService);

  readonly achievements = this.store.achievements;

  // 既に解除済みの実績IDには何もしない（冪等）。未解除であれば解除日時を記録する。
  unlockAchievement(id: string): void {
    if (this.store.achievements().some((a) => a.id === id)) return;
    const achievement: Achievement = { id, unlockedAt: nowIso() };
    this.store.saveAchievement(achievement);
    this.sync.pushAchievements([achievement]);
  }
}
