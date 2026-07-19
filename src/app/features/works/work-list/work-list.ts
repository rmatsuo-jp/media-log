/**
 * @file 作品一覧ページ。作品追加（外部API検索パネル WorkImport を常時インライン表示する
 * デフォルト導線、手動タイトル入力はオプションでトグル展開）と作品グリッドを表示する。
 * 読みたいリストは独立ページ（features/works/wishlist）に分離済み。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaType } from '@core/models/media.model';
import { Badge } from '@shared/ui/badge/badge';
import { WorksStateService } from '../works-state.service';
import { WorkImport } from '../work-import/work-import';

@Component({
  selector: 'app-work-list',
  imports: [RouterLink, Badge, WorkImport],
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
}
