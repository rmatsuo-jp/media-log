/**
 * @file 読みたいリストページ。work.wantToConsume または配下グループのwantToConsumeを
 * 持つ作品を一覧表示する（作品一覧ページから独立したサイドバー項目）。
 */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Badge } from '@shared/ui/badge/badge';
import { MediaType } from '@core/models/media.model';
import { WorksStateService } from '../works-state.service';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, Badge],
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
