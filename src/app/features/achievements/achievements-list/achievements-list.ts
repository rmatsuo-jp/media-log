/**
 * @file 実績一覧ページ。累計読了数・完読作品数・周回数の3カテゴリに分けてバッジを表示する。
 * 解除済みは強調表示（解除日つき）、未解除は現在値/閾値の進捗つきでグレーアウト表示する。
 * 解除判定・解除記録の書き込みは AchievementsStateService が担い、このコンポーネントは表示のみ。
 */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AchievementMetric } from '@core/achievements/achievement-definitions';
import { AchievementProgress, AchievementsStateService } from '../achievements-state.service';

interface AchievementCategory {
  metric: AchievementMetric;
  title: string;
  items: AchievementProgress[];
}

const CATEGORY_TITLES: Record<AchievementMetric, string> = {
  unitsRead: '累計読了数',
  worksCompleted: '完読作品数',
  rereads: '周回数（再読・再視聴）',
};

@Component({
  selector: 'app-achievements-list',
  imports: [],
  templateUrl: './achievements-list.html',
  styleUrl: './achievements-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AchievementsList {
  protected state = inject(AchievementsStateService);

  protected categories = computed<AchievementCategory[]>(() => {
    const progress = this.state.achievementProgress();
    const byMetric = new Map<AchievementMetric, AchievementProgress[]>();
    for (const item of progress) {
      const list = byMetric.get(item.definition.metric) ?? [];
      list.push(item);
      byMetric.set(item.definition.metric, list);
    }
    return (Object.keys(CATEGORY_TITLES) as AchievementMetric[]).map((metric) => ({
      metric,
      title: CATEGORY_TITLES[metric],
      items: byMetric.get(metric) ?? [],
    }));
  });

  protected unlockedCount = computed(
    () => this.state.achievementProgress().filter((p) => p.unlocked).length,
  );

  protected totalCount = computed(() => this.state.achievementProgress().length);

  formatUnlockedAt(iso: string): string {
    const date = new Date(iso);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} 解除`;
  }
}
