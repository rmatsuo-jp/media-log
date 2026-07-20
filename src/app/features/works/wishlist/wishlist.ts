/**
 * @file 読みたいリストページ。work.wantToConsume または配下グループのwantToConsumeを
 * 持つ作品を一覧表示する（作品一覧ページから独立したサイドバー項目）。
 * 上部には作品一覧ページと共通の追加フォーム（add-work-form）を
 * wantToConsume=trueで埋め込み、このページから追加した作品はそのまま読みたいに入る。
 * さらにその下の共通トグル（MediaTypeToggle）で一覧をmediaType絞り込み（非永続のローカルsignal）。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '@shared/ui/badge/badge';
import { Card } from '@shared/ui/card/card';
import { MediaType } from '@core/models/media.model';
import {
  MediaTypeToggle,
  MediaTypeToggleOption,
} from '@shared/ui/media-type-toggle/media-type-toggle';
import { MediaTypeFilter } from '../work-import/work-import-search.service';
import { WorksStateService } from '../works-state.service';
import { AddWorkForm } from '../add-work-form/add-work-form';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, Badge, Card, AddWorkForm, MediaTypeToggle],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wishlist {
  protected state = inject(WorksStateService);

  mediaTypeLabel(type: MediaType): string {
    return type === 'manga' ? 'マンガ' : 'アニメ';
  }

  // ── マンガ/アニメ絞り込み（非永続、追加フォームの検索絞り込みとも共有） ──
  protected readonly mediaTypeFilterOptions: MediaTypeToggleOption[] = [
    { value: 'manga', label: 'マンガ' },
    { value: 'anime', label: 'アニメ' },
    { value: 'both', label: 'すべて' },
  ];
  protected mediaTypeFilter = signal<MediaTypeFilter>('manga');

  protected filteredEntries = computed(() => {
    const filter = this.mediaTypeFilter();
    const entries = this.state.wantToConsumeEntries();
    return filter === 'both' ? entries : entries.filter((entry) => entry.work.mediaType === filter);
  });
}
