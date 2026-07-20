/**
 * @file work-list/wishlist/work-importで個別実装されていたマンガ/アニメ絞り込みトグルを統一する共通コンポーネント。
 * ボタン構成（値・ラベル・順序）はoptionsで呼び出し側に委ね、選択値はvalueで双方向バインドする。
 */
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

export interface MediaTypeToggleOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-media-type-toggle',
  imports: [],
  templateUrl: './media-type-toggle.html',
  styleUrl: './media-type-toggle.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MediaTypeToggle {
  options = input.required<MediaTypeToggleOption[]>();
  value = model.required<string>();
}
