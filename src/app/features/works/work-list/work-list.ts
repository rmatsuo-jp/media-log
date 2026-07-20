/**
 * @file 作品一覧ページ。作品追加フォーム（features/works/add-work-form）と作品グリッドを表示する。
 * 読みたいリストは独立ページ（features/works/wishlist）に分離済み。
 * タイトル右の共通トグル（MediaTypeToggle）で一覧のmediaType絞り込みと、追加フォームの検索絞り込みを
 * 同一signalで兼用する（非永続のローカルsignal）。
 * 作品カバーを右クリックすると、表紙候補（coverImageCandidates）の切り替えと作品削除を
 * 行えるメニュー（Modal+CoverTile）を開く。削除は共通ConfirmDialogで確認する。
 * 各カードには次に見るべき未読巻/話（WorksStateService.nextUnreadUnit）をバッジで表示し、
 * 全巻既読（WorksStateService.isFullyRead）の場合は代わりに「既読」バッジを表示する。
 * 絞り込み後の作品数・巻/話数合計を表示し、ページサイズ選択＋前/次ページ切り替えでグリッド表示件数を制御する。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaTypeFilter, Work } from '@core/models/media.model';
import { MEDIA_TYPE_META, MEDIA_TYPE_FILTER_OPTIONS } from '@core/models/media-type-meta';
import { Badge } from '@shared/ui/badge/badge';
import { Modal } from '@shared/ui/modal/modal';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Card } from '@shared/ui/card/card';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { MediaTypeToggle } from '@shared/ui/media-type-toggle/media-type-toggle';
import { WorksStateService } from '../works-state.service';
import { AddWorkForm } from '../add-work-form/add-work-form';

@Component({
  selector: 'app-work-list',
  imports: [RouterLink, Badge, AddWorkForm, Modal, CoverTile, Card, ConfirmDialog, MediaTypeToggle],
  templateUrl: './work-list.html',
  styleUrl: './work-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkList {
  protected state = inject(WorksStateService);
  protected readonly meta = MEDIA_TYPE_META;

  nextUnreadLabel(work: Work): string | null {
    const unit = this.state.nextUnreadUnit(work.id);
    if (!unit) return null;
    return `次: ${MEDIA_TYPE_META[work.mediaType].formatUnit(unit.number)}`;
  }

  isFullyRead(work: Work): boolean {
    return this.state.isFullyRead(work.id);
  }

  // ── メディア種別絞り込み（非永続、追加フォームの検索絞り込みとも共有） ──
  protected readonly mediaTypeFilterOptions = MEDIA_TYPE_FILTER_OPTIONS;
  protected mediaTypeFilter = signal<MediaTypeFilter>('manga');

  protected filteredWorks = computed(() => {
    const filter = this.mediaTypeFilter();
    const works = this.state.allWorksSorted();
    return filter === 'both' ? works : works.filter((work) => work.mediaType === filter);
  });

  onMediaTypeFilterChange(filter: MediaTypeFilter) {
    this.mediaTypeFilter.set(filter);
    this.currentPage.set(1);
  }

  // ── ページング（表示件数選択・前/次ページ切り替え） ──
  protected readonly pageSizeOptions = [12, 24, 48, 96];
  protected pageSize = signal<number>(24);
  protected currentPage = signal<number>(1);

  protected totalUnitCount = computed(() =>
    this.filteredWorks().reduce((sum, work) => sum + this.state.unitCountForWork(work.id), 0),
  );

  protected totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredWorks().length / this.pageSize())),
  );

  protected pagedWorks = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredWorks().slice(start, start + this.pageSize());
  });

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  goToPrevPage() {
    if (this.currentPage() > 1) this.currentPage.update((p) => p - 1);
  }

  goToNextPage() {
    if (this.currentPage() < this.totalPages()) this.currentPage.update((p) => p + 1);
  }

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

  protected pendingDelete = signal<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  deleteWorkFromMenu() {
    const work = this.coverPickerWork();
    if (!work) return;
    this.coverPickerWork.set(null);
    this.pendingDelete.set({
      title: '作品を削除',
      message: `「${work.title}」を削除しますか？（配下のグループ・記録も削除されます）`,
      onConfirm: () => this.state.deleteWork(work.id),
    });
  }

  confirmPendingDelete() {
    this.pendingDelete()?.onConfirm();
    this.pendingDelete.set(null);
  }
}
