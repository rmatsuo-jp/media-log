/**
 * @file 作品一覧ページ。作品追加（外部API検索パネル WorkImport を常時インライン表示する
 * デフォルト導線、手動タイトル入力はオプションでトグル展開）と作品グリッドを表示する。
 * 読みたいリストは独立ページ（features/works/wishlist）に分離済み。
 * 作品カバーを右クリックすると、表紙候補（coverImageCandidates）の切り替えと作品削除を
 * 行えるメニュー（Modal+CoverTile）を開く。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaType, Work } from '@core/models/media.model';
import { Badge } from '@shared/ui/badge/badge';
import { Modal } from '@shared/ui/modal/modal';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { WorksStateService } from '../works-state.service';
import { WorkImport } from '../work-import/work-import';

@Component({
  selector: 'app-work-list',
  imports: [RouterLink, Badge, WorkImport, Modal, CoverTile],
  templateUrl: './work-list.html',
  styleUrl: './work-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkList {
  protected state = inject(WorksStateService);

  protected newTitle = signal('');
  protected newMediaType = signal<MediaType>('manga');
  protected manualOpen = signal(false);

  toggleManual() {
    this.manualOpen.update((open) => !open);
  }

  addWork() {
    const title = this.newTitle().trim();
    if (!title) return;
    this.state.addWork(title, this.newMediaType());
    this.newTitle.set('');
  }

  mediaTypeLabel(type: MediaType): string {
    return type === 'manga' ? 'マンガ' : 'アニメ';
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

  deleteWorkFromMenu() {
    const work = this.coverPickerWork();
    if (!work) return;
    if (!confirm(`「${work.title}」を削除しますか？（配下のグループ・記録も削除されます）`)) return;
    this.state.deleteWork(work.id);
    this.coverPickerWork.set(null);
  }
}
