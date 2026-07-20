/**
 * @file 実績（Achievement）解除記録のローカル永続化を担うサービス。
 * media-store.service.ts と同型のパターン（localStorageへのCRUD専任、Firestore同期は
 * achievements-firestore-sync.service.ts が担当）。
 * _achievements は tombstone（deleted=true）も含む全件の源泉。公開の achievements は
 * 削除済みを除外したビューで、表示・判定はすべてこちらを基準にする。
 * 別タブによるlocalStorage変更はstorageイベントで検知し、signalを再読込して追随する。
 */
import { computed, Injectable, signal } from '@angular/core';
import { Achievement } from '@core/models/media.model';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

const ACHIEVEMENTS_KEY = 'achievements_unlocked';

@Injectable({ providedIn: 'root' })
export class AchievementsStoreService {
  // ── 状態管理（signal） ─────────────────────────────────────────
  private _achievements = signal<Achievement[]>(readJson<Achievement[]>(ACHIEVEMENTS_KEY, []));

  readonly achievements = computed(() => this._achievements().filter((a) => !a.deleted));

  // tombstoneを含む全件（Firestore同期がローカル/クラウドの突き合わせに使う）。
  readonly allAchievements = this._achievements;

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key === ACHIEVEMENTS_KEY) {
        this._achievements.set(readJson<Achievement[]>(ACHIEVEMENTS_KEY, []));
      }
    });
  }

  // ── 書き込み系（保存） ───────────────────────────────────────
  persistAchievements(achievements: Achievement[]): void {
    if (!writeJson(ACHIEVEMENTS_KEY, achievements)) this.notifyStorageFull();
    this._achievements.set(achievements);
  }

  saveAchievement(achievement: Achievement): void {
    const existing = this._achievements();
    const idx = existing.findIndex((a) => a.id === achievement.id);
    this.persistAchievements(
      idx >= 0
        ? existing.map((a) => (a.id === achievement.id ? achievement : a))
        : [achievement, ...existing],
    );
  }

  private notifyStorageFull(): void {
    alert(
      'ブラウザの保存容量が上限に達したため、データを保存できませんでした。\n' +
        '不要な作品・記録を削除してください。',
    );
  }
}
