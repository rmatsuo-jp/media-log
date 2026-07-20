/**
 * @file 実績（バッジ）の静的マスタ定義。閾値・文言をここに集約し、
 * features/achievements/achievements-state.service.ts が現在値と突き合わせて進捗・解除判定に使う。
 * metric は「累計読了数」「作品完読数」「周回数」の3系統。unitsRead は mediaType 別、
 * worksCompleted/rereads は manga/anime を合算した値で判定する。
 */
import { MediaType } from '@core/models/media.model';

export type AchievementMetric = 'unitsRead' | 'worksCompleted' | 'rereads';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  metric: AchievementMetric;
  mediaType?: MediaType; // unitsRead のみ指定。未指定は合算値で判定する。
  threshold: number;
  icon: string; // 絵文字アイコン（依存追加を避けるため）
}

// ── 累計読了数（巻/話数マイルストーン、マンガ/アニメ別） ──────────────
const UNITS_READ_THRESHOLDS = [10, 50, 100, 300, 500, 1000];

function unitsReadDefinitions(mediaType: MediaType): AchievementDefinition[] {
  const unitLabel = mediaType === 'manga' ? '巻' : '話';
  const mediaLabel = mediaType === 'manga' ? 'マンガ' : 'アニメ';
  return UNITS_READ_THRESHOLDS.map((threshold) => ({
    id: `units-read-${mediaType}-${threshold}`,
    title: `${mediaLabel} ${threshold}${unitLabel}読了`,
    description: `${mediaLabel}を累計${threshold}${unitLabel}読み終える。`,
    metric: 'unitsRead',
    mediaType,
    threshold,
    icon: mediaType === 'manga' ? '📖' : '📺',
  }));
}

// ── 作品完読数（全巻/全話既読の作品数、manga/anime合算） ──────────────
const WORKS_COMPLETED_THRESHOLDS = [1, 5, 10, 30, 50];

const worksCompletedDefinitions: AchievementDefinition[] = WORKS_COMPLETED_THRESHOLDS.map(
  (threshold) => ({
    id: `works-completed-${threshold}`,
    title: `完読${threshold}作品`,
    description: `作品を最後まで読了/視聴し終えた数が${threshold}作品に到達する。`,
    metric: 'worksCompleted',
    threshold,
    icon: '🏆',
  }),
);

// ── 周回数（再読・再視聴の累計、manga/anime合算） ──────────────────
const REREADS_THRESHOLDS = [10, 50, 100, 300];

const rereadsDefinitions: AchievementDefinition[] = REREADS_THRESHOLDS.map((threshold) => ({
  id: `rereads-${threshold}`,
  title: `周回${threshold}回`,
  description: `巻/話の再読・再視聴回数が累計${threshold}回に到達する。`,
  metric: 'rereads',
  threshold,
  icon: '🔁',
}));

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  ...unitsReadDefinitions('manga'),
  ...unitsReadDefinitions('anime'),
  ...worksCompletedDefinitions,
  ...rereadsDefinitions,
];
