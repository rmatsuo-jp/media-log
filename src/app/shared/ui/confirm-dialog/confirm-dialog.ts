/**
 * @file 削除確認ダイアログ。work-list/work-detailが個別にwindow.confirm()していたのを統一する。
 * shared/ui/modalをラップし、見出し・本文・ボタン文言は呼び出し側から差し込む。
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from '../modal/modal';

@Component({
  selector: 'app-confirm-dialog',
  imports: [Modal],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  title = input.required<string>();
  message = input.required<string>();
  confirmLabel = input<string>('削除');
  cancelLabel = input<string>('キャンセル');
  confirmed = output<void>();
  cancelled = output<void>();
}
