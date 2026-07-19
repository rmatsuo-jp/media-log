/**
 * @file 作品詳細ページ。Group→Unitの階層を表示し、既読トグル・周回カウント・
 * Group単位の「読みたい」フラグ・グループ/Unitの追加を行う。
 * Unitに外部API由来のcoverImageUrlがあれば表紙サムネイルを表示する。
 */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Group, Unit } from '@core/models/media.model';
import { WorksStateService } from '../works-state.service';

@Component({
  selector: 'app-work-detail',
  imports: [],
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

  toggleUnitViewed(unit: Unit) {
    this.state.toggleUnitViewed(unit);
  }

  incrementViewCount(unit: Unit) {
    this.state.incrementUnitViewCount(unit);
  }

  deleteUnit(unit: Unit) {
    this.state.deleteUnit(unit.id);
  }
}
