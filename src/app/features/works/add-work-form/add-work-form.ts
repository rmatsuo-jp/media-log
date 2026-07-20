/**
 * @file 作品追加フォーム。外部API検索パネル（WorkImport）を常時インライン表示し、
 * 手動タイトル入力フォームはng-content（[manualAdd]）でWorkImport側の詳細設定に投影統合する。
 * 作品一覧（/works）と読みたい（/wishlist）の両ページから共通で埋め込む。
 * mediaType inputは呼び出し元ページのマンガ/アニメ/すべてトグルの値を受け取り、WorkImportの検索絞り込みに渡す。
 * wantToConsume inputがtrueの場合、追加/取り込み直後の作品を「読みたい」に自動でトグルする
 * （読みたいタブからの追加を成立させるため）。
 */
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MediaType, Work } from '@core/models/media.model';
import { WorksStateService } from '../works-state.service';
import { WorkImport } from '../work-import/work-import';
import { MediaTypeFilter } from '../work-import/work-import-search.service';

@Component({
  selector: 'app-add-work-form',
  imports: [WorkImport],
  templateUrl: './add-work-form.html',
  styleUrl: './add-work-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddWorkForm {
  private state = inject(WorksStateService);

  wantToConsume = input(false);
  mediaType = input.required<MediaTypeFilter>();

  protected newTitle = signal('');
  protected newMediaType = signal<MediaType>('manga');

  addWork() {
    const title = this.newTitle().trim();
    if (!title) return;
    const work = this.state.addWork(title, this.newMediaType());
    if (this.wantToConsume()) this.state.toggleWorkWant(work);
    this.newTitle.set('');
  }

  onImported(work: Work) {
    if (this.wantToConsume()) this.state.toggleWorkWant(work);
  }
}
