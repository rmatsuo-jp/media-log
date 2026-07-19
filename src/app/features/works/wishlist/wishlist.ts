/**
 * @file 読みたいリストページ。work.wantToConsume または配下グループのwantToConsumeを
 * 持つ作品を一覧表示する（作品一覧ページから独立したサイドバー項目）。
 * 上部には作品一覧ページと共通の追加フォーム（add-work-form）を
 * wantToConsume=trueで埋め込み、このページから追加した作品はそのまま読みたいに入る。
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '@shared/ui/badge/badge';
import { MediaType } from '@core/models/media.model';
import { WorksStateService } from '../works-state.service';
import { AddWorkForm } from '../add-work-form/add-work-form';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, Badge, AddWorkForm],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Wishlist {
  protected state = inject(WorksStateService);

  mediaTypeLabel(type: MediaType): string {
    return type === 'manga' ? 'マンガ' : 'アニメ';
  }
}
