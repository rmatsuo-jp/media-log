/**
 * @file 実績（Achievement）解除記録のローカル永続化を担うサービス。
 * core/persistence/tombstone-collection.store.ts の汎用storeの薄いラッパー
 * （media-store.service.ts と同型のパターン、Firestore同期は achievements-firestore-sync.service.ts が担当）。
 */
import { Injectable } from '@angular/core';
import { Achievement } from '@core/models/media.model';
import { createTombstoneCollectionStore } from '../persistence/tombstone-collection.store';

const ACHIEVEMENTS_KEY = 'achievements_unlocked';

function notifyStorageFull(): void {
  alert(
    'ブラウザの保存容量が上限に達したため、データを保存できませんでした。\n' +
      '不要な作品・記録を削除してください。',
  );
}

@Injectable({ providedIn: 'root' })
export class AchievementsStoreService {
  private achievementsStore = createTombstoneCollectionStore<Achievement>(
    ACHIEVEMENTS_KEY,
    notifyStorageFull,
  );

  readonly achievements = this.achievementsStore.visible;
  readonly allAchievements = this.achievementsStore.all;

  persistAchievements(achievements: Achievement[]): void {
    this.achievementsStore.persist(achievements);
  }

  saveAchievement(achievement: Achievement): void {
    this.achievementsStore.save(achievement);
  }
}
