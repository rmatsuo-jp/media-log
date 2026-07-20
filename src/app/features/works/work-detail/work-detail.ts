/**
 * @file 作品詳細ページ。Group→Unitの階層を表示し、既読トグル・周回カウント・
 * Group単位の「読みたい」フラグ・グループ/Unitの追加を行う。
 * Unitに外部API由来のcoverImageUrlがあれば表紙サムネイルを表示する。
 * 表紙を左クリックすると既読化＋周回数+1、右クリックすると表紙ピッカーモーダル
 * （表紙候補が2件以上あれば候補グリッド、周回数>0なら「周回数を-1」、常に「削除」）を表示する。
 * work-listの表紙右クリックメニューと同じモーダル方式に統一している。
 * 既読は表紙画像内の「既読」バッジ（app-badge）で表す（チェックボックスは使わない）。
 * 最新既読日時（Unit.lastViewedAt）はunit-actions内にyyyy/MM/dd形式で表示する。
 * 表紙変更はModal+CoverTileの表紙ピッカーで行う。作品/グループ/Unitの削除は共通ConfirmDialogで確認する。
 * 次に見るべき未読Unit（nextUnreadUnitId）は unit-row に next-unread クラスと
 * 「次はこれ」バッジ（既読バッジと排他）で強調表示する。
 */
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Group, Unit } from '@core/models/media.model';
import { MEDIA_TYPE_META } from '@core/models/media-type-meta';
import { Modal } from '@shared/ui/modal/modal';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Badge } from '@shared/ui/badge/badge';
import { ConfirmDialog } from '@shared/ui/confirm-dialog/confirm-dialog';
import { WorksStateService } from '../works-state.service';

@Component({
  selector: 'app-work-detail',
  imports: [Modal, CoverTile, Badge, ConfirmDialog, DatePipe],
  templateUrl: './work-detail.html',
  styleUrl: './work-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkDetail {
  protected state = inject(WorksStateService);
  protected readonly meta = MEDIA_TYPE_META;
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private paramMap = toSignal(this.route.paramMap);
  private workId = computed(() => this.paramMap()?.get('id') ?? '');

  protected work = computed(() => this.state.workById(this.workId()));
  protected groups = computed(() => this.state.groupsForWork(this.workId()));
  protected nextUnreadUnitId = computed(() => this.state.nextUnreadUnit(this.workId())?.id);

  // 表紙ピッカーモーダル等、テンプレートで作品未確定の可能性がある場面用の単位表記ヘルパ
  formatUnitNumber(n: number): string {
    const work = this.work();
    return work ? MEDIA_TYPE_META[work.mediaType].formatUnit(n) : String(n);
  }

  protected newGroupTitle = signal('');
  protected newUnitNumberByGroup = signal<Record<string, string>>({});

  unitsForGroup(groupId: string): Unit[] {
    return this.state.unitsForGroup(groupId);
  }

  toggleWorkWant() {
    const w = this.work();
    if (w) this.state.toggleWorkWant(w);
  }

  protected pendingDelete = signal<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  confirmPendingDelete() {
    this.pendingDelete()?.onConfirm();
    this.pendingDelete.set(null);
  }

  deleteWork() {
    const w = this.work();
    if (!w) return;
    this.pendingDelete.set({
      title: '作品を削除',
      message: `「${w.title}」を削除しますか？（配下のグループ・記録も削除されます）`,
      onConfirm: () => {
        this.state.deleteWork(w.id);
        this.router.navigate(['/works']);
      },
    });
  }

  addGroup() {
    const title = this.newGroupTitle().trim();
    if (!title) return;
    this.state.addGroup(this.workId(), title);
    this.newGroupTitle.set('');
  }

  toggleGroupWant(group: Group) {
    this.state.toggleGroupWant(group);
  }

  deleteGroup(group: Group) {
    this.pendingDelete.set({
      title: 'グループを削除',
      message: `「${group.title}」を削除しますか？（配下の記録も削除されます）`,
      onConfirm: () => this.state.deleteGroup(group.id),
    });
  }

  newUnitNumber(groupId: string): string {
    return this.newUnitNumberByGroup()[groupId] ?? '';
  }

  setNewUnitNumber(groupId: string, value: string) {
    this.newUnitNumberByGroup.update((m) => ({ ...m, [groupId]: value }));
  }

  addUnit(group: Group) {
    const raw = this.newUnitNumber(group.id).trim();
    const number = Number(raw);
    if (!raw || !Number.isFinite(number)) return;
    this.state.addUnit(this.workId(), group.id, number);
    this.setNewUnitNumber(group.id, '');
  }

  deleteUnit(unit: Unit) {
    this.pendingDelete.set({
      title: '削除',
      message: `${unit.number}を削除しますか？`,
      onConfirm: () => this.state.deleteUnit(unit.id),
    });
  }

  protected coverPickerUnit = signal<Unit | null>(null);

  onUnitCoverClick(unit: Unit) {
    this.state.incrementUnitViewCount(unit);
  }

  onUnitCoverContextMenu(event: MouseEvent, unit: Unit) {
    event.preventDefault();
    this.coverPickerUnit.set(unit);
  }

  decrementViewCountFromMenu() {
    const unit = this.coverPickerUnit();
    if (!unit) return;
    this.state.decrementUnitViewCount(unit);
    this.coverPickerUnit.set(null);
  }

  deleteUnitFromMenu() {
    const unit = this.coverPickerUnit();
    if (!unit) return;
    this.coverPickerUnit.set(null);
    this.deleteUnit(unit);
  }

  closeCoverPicker() {
    this.coverPickerUnit.set(null);
  }

  selectUnitCover(coverImageUrl: string) {
    const unit = this.coverPickerUnit();
    if (!unit) return;
    this.state.updateUnitCover(unit, coverImageUrl);
    this.coverPickerUnit.set(null);
  }
}
