/**
 * @file 各featureで個別実装されていたpillバッジ（カテゴリ・実績達成度・スコア等）を統一する共通コンポーネント。
 * variant で色（トークン）を切り替えるのみで、文言は呼び出し側の <ng-content> に委ねる。
 * solid=trueで、表紙画像等の上に重ねる用の不透明背景＋白文字＋ドロップシャドウ表示になる
 * （work-list/work-detailが個別に::ng-deepで上書きしていたオーバーレイ表示を統一）。
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'default' | 'success' | 'error' | 'warning';

@Component({
  selector: 'app-badge',
  imports: [],
  templateUrl: './badge.html',
  styleUrl: './badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  variant = input<BadgeVariant>('default');
  solid = input<boolean>(false);
}
