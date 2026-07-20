/**
 * @file 作品一覧ページ。作品追加フォーム（features/works/add-work-form）と作品グリッドを表示する。
 * 読みたいリストは独立ページ（features/works/wishlist）に分離済み。
 * 上部の共通トグル（MediaTypeToggle）で一覧をmediaType絞り込み（非永続のローカルsignal）。
 * 作品カバーを右クリックすると、表紙候補（coverImageCandidates）の切り替えと作品削除を
 * 行えるメニュー（Modal+CoverTile）を開く。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaType, Work } from '@core/models/media.model';
import { Badge } from '@shared/ui/badge/badge';
import { Modal } from '@shared/ui/modal/modal';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { MediaTypeToggle, MediaTypeToggleOption } from '@shared/ui/media-type-toggle/media-type-toggle';
import { WorksStateService } from '../works-state.service';
import { AddWorkForm } from '../add-work-form/add-work-form';

@Component({
  selector: 'app-work-list',
  imports: [RouterLink, Badge, AddWorkForm, Modal, CoverTile, MediaTypeToggle],
  templateUrl: './work-list.html',
  styleUrl: './work-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkList {
  protected state = inject(WorksStateService);

  mediaTypeLabel(type: MediaType): string {
    return type === 'manga' ? 'マンガ' : 'アニメ';
  }

  // ── マンガ/アニメ絞り込み（非永続） ──
  protected readonly mediaTypeFilterOptions: MediaTypeToggleOption[] = [
    { value: 'all', label: 'すべて' },
    { value: 'manga', label: 'マンガ' },
    { value: 'anime', label: 'アニメ' },
  ];
  protected mediaTypeFilter = signal<MediaType | 'all'>('all');

  protected filteredWorks = computed(() => {
    const filter = this.mediaTypeFilter();
    const works = this.state.allWorksSorted();
    return filter === 'all' ? works : works.filter((work) => work.mediaType === filter);
  });

  protected coverPickerWork = signal<Work | null>(null);

  // 作品カバーの右クリックメニュー（表紙候補切り替え＋削除）。候補数に関わらず常に開く。
  onWorkCoverContextMenu(event: MouseEvent, work: Work) {
    event.preventDefault();
    this.coverPickerWork.set(work);
  }

  closeCoverPickerWork() {
    this.coverPickerWork.set(null);
  }

  selectWorkCover(coverImageUrl: string) {
    const work = this.coverPickerWork();
    if (!work) return;
    this.state.updateWorkCover(work, coverImageUrl);
    this.coverPickerWork.set(null);
  }

  deleteWorkFromMenu() {
    const work = this.coverPickerWork();
    if (!work) return;
    if (!confirm(`「${work.title}」を削除しますか？（配下のグループ・記録も削除されます）`)) return;
    this.state.deleteWork(work.id);
    this.coverPickerWork.set(null);
  }
}
