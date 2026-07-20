/**
 * @file 作品詳細ページ。Group→Unitの階層を表示し、既読トグル・周回カウント・
 * Group単位の「読みたい」フラグ・グループ/Unitの追加を行う。
 * Unitに外部API由来のcoverImageUrlがあれば表紙サムネイルを表示する。
 * 表紙を左クリックすると既読化＋周回数+1、右クリックするとコンテキストメニュー
 * （表紙候補が2件以上あれば「表紙を変更」、周回数>0なら「周回数を-1」、常に「削除」）を表示する。
 * 既読は表紙画像内の「既読」バッジ（app-badge）で表す（チェックボックスは使わない）。
 * 最新既読日時（Unit.lastViewedAt）はunit-actions内にyyyy/MM/dd形式で表示する。
 * 表紙変更はModal+CoverTileの表紙ピッカーで行う。
 */
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Group, Unit } from '@core/models/media.model';
import { Modal } from '@shared/ui/modal/modal';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Badge } from '@shared/ui/badge/badge';
import { WorksStateService } from '../works-state.service';

@Component({
  selector: 'app-work-detail',
  imports: [Modal, CoverTile, Badge, DatePipe],
  templateUrl: './work-detail.html',
  styleUrl: './work-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkDetail {
  protected state = inject(WorksStateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private paramMap = toSignal(this.route.paramMap);
  private workId = computed(() => this.paramMap()?.get('id') ?? '');

  protected work = computed(() => this.state.workById(this.workId()));
  protected groups = computed(() => this.state.groupsForWork(this.workId()));

  protected newGroupTitle = signal('');
  protected newUnitNumberByGroup = signal<Record<string, string>>({});

  unitsForGroup(groupId: string): Unit[] {
    return this.state.unitsForGroup(groupId);
  }

  toggleWorkWant() {
    const w = this.work();
    if (w) this.state.toggleWorkWant(w);
  }

  deleteWork() {
    const w = this.work();
    if (!w) return;
    if (!confirm(`「${w.title}」を削除しますか？（配下のグループ・記録も削除されます）`)) return;
    this.state.deleteWork(w.id);
    this.router.navigate(['/works']);
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
    if (!confirm(`「${group.title}」を削除しますか？（配下の記録も削除されます）`)) return;
    this.state.deleteGroup(group.id);
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
    this.state.deleteUnit(unit.id);
  }

  protected coverPickerUnit = signal<Unit | null>(null);
  protected contextMenu = signal<{ unit: Unit; x: number; y: number } | null>(null);

  onUnitCoverClick(unit: Unit) {
    this.state.incrementUnitViewCount(unit);
  }

  onUnitCoverContextMenu(event: MouseEvent, unit: Unit) {
    event.preventDefault();
    this.contextMenu.set({ unit, x: event.clientX, y: event.clientY });
  }

  closeContextMenu() {
    this.contextMenu.set(null);
  }

  changeCoverFromMenu() {
    const menu = this.contextMenu();
    if (!menu) return;
    this.coverPickerUnit.set(menu.unit);
    this.contextMenu.set(null);
  }

  decrementViewCountFromMenu() {
    const menu = this.contextMenu();
    if (!menu) return;
    this.state.decrementUnitViewCount(menu.unit);
    this.contextMenu.set(null);
  }

  deleteUnitFromMenu() {
    const menu = this.contextMenu();
    if (!menu) return;
    this.deleteUnit(menu.unit);
    this.contextMenu.set(null);
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
