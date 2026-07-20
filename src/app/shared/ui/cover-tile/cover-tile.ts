/**
 * @file 表紙イラスト（作品・巻/話数）をタイル状に表示する共通コンポーネント。
 * 外部API連携（AniList/Google Books/openBD）で取得した画像を想定するが、imageUrl未指定時はプレースホルダーを表示する。
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-cover-tile',
  imports: [],
  templateUrl: './cover-tile.html',
  styleUrl: './cover-tile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverTile {
  imageUrl = input<string | undefined>(undefined);
  label = input<string>('');
  selected = input(false);
  viewed = input(false);
  size = input<'sm' | 'md'>('md');

  tileClick = output<void>();
}
