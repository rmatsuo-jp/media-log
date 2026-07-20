/**
 * @file 実績（Achievement）解除記録の Firestore 双方向同期を担うサービス。
 * core/persistence/tombstone-firestore-sync.ts の汎用同期の薄いラッパー
 * （media-firestore-sync.service.ts と同型のパターン）。AchievementsStoreService の signal を
 * 読み書きし、ログイン状態（AuthService）を監視して、ログインした瞬間にクラウドと双方向同期する。
 */
import { Injectable, inject } from '@angular/core';
import { Achievement } from '@core/models/media.model';
import { AuthService } from '../firebase/auth.service';
import { createTombstoneFirestoreSync } from '../persistence/tombstone-firestore-sync';
import { AchievementsStoreService } from './achievements-store.service';

@Injectable({ providedIn: 'root' })
export class AchievementsFirestoreSyncService {
  private auth = inject(AuthService);
  private store = inject(AchievementsStoreService);

  private sync = createTombstoneFirestoreSync<Achievement>({
    auth: this.auth,
    collectionName: 'achievements',
    getAllLocal: () => this.store.allAchievements(),
    persistLocal: (merged) => this.store.persistAchievements(merged),
    errorMessage: '実績のクラウド同期に失敗しました。ローカルには保存されています。',
    logLabel: 'AchievementsFirestoreSyncService',
  });

  readonly syncError = this.sync.syncError;

  pushAchievements(achievements: Achievement[]): void {
    this.sync.push(achievements);
  }

  async syncFromCloud(uid: string): Promise<void> {
    await this.sync.syncFromCloud(uid);
  }
}
