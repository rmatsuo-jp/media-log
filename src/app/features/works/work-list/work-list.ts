/**
 * @file 作品一覧ページ。「作品一覧」⇔「読みたいリスト」を切り替えて表示する。
 * 作品の追加フォームもこの画面に持つ（別ルート・モーダルにはしない、シンプルな追加操作のため）。
 * 外部API検索から作品を取り込む導線（WorkImportモーダル）もここから開く。
 */
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaType } from '@core/models/media.model';
import { Badge } from '@shared/ui/badge/badge';
import { WorksStateService, WorksViewMode } from '../works-state.service';
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
  protected importOpen = signal(false);

  setViewMode(mode: WorksViewMode) {
    this.state.viewMode.set(mode);
  }

  openImport() {
    this.importOpen.set(true);
  }

  closeImport() {
    this.importOpen.set(false);
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
