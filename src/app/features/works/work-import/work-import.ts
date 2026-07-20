/**
 * @file 外部API（AniList/MangaDex）から作品を検索し、巻/話数の表紙イラストを見ながら取り込むインラインパネル。
 * ①検索→タイル選択 ②巻/話数候補選択 ③取り込み、の3ステップ。作品一覧タブ内に常時表示する（モーダルは使わない）。
 * 検索条件・検索結果・候補取得ロジックはWorkImportSearchServiceに分離しており、このコンポーネントは
 * step/selectedNumbers/groupTitle等のUI選択状態と、取り込み確定（confirmImport）の橋渡しに専念する。
 * 同一巻に複数の表紙候補（variantCoverImageUrls）がある場合の切り替えや、1.5巻等の非整数巻の絞り込み
 * （numberFilter）はサービス側のsignalを参照する。
 * 詳細設定（<details>）内は`[manualAdd]`属性でng-content投影可能にし、呼び出し元（AddWorkForm）の
 * 手動タイトル追加フォームを同じ詳細設定に統合表示する。
 */
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { Work } from '@core/models/media.model';
import { ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Badge } from '@shared/ui/badge/badge';
import { MediaTypeToggle, MediaTypeToggleOption } from '@shared/ui/media-type-toggle/media-type-toggle';
import { WorksStateService } from '../works-state.service';
import { WorkImportSearchService } from './work-import-search.service';

type Step = 'search' | 'candidates';

@Component({
  selector: 'app-work-import',
  imports: [CoverTile, Spinner, Badge, MediaTypeToggle],
  providers: [WorkImportSearchService],
  templateUrl: './work-import.html',
  styleUrl: './work-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkImport {
  private state = inject(WorksStateService);
  protected search = inject(WorkImportSearchService);

  // ── マンガ/アニメ/両方絞り込み（共通トグル用） ──
  protected readonly mediaTypeOptions: MediaTypeToggleOption[] = [
    { value: 'both', label: 'すべて' },
    { value: 'manga', label: 'マンガ' },
    { value: 'anime', label: 'アニメ' },
  ];

  imported = output<Work>();

  protected step = signal<Step>('search');
  protected selectedWork = signal<ExternalWorkSearchResult | null>(null);
  protected selectedNumbers = signal<Set<number>>(new Set());
  protected groupTitle = signal('');

  selectWork(result: ExternalWorkSearchResult): void {
    this.selectedWork.set(result);
    this.step.set('candidates');
    this.groupTitle.set(result.mediaType === 'manga' ? '取り込んだ巻' : '取り込んだ話数');
    this.selectedNumbers.set(new Set());

    this.search.loadCandidatesFor(result, (candidates) => {
      const filter = this.search.numberFilter();
      this.selectedNumbers.set(
        new Set(
          candidates
            .filter((c) => {
              if (filter === 'all') return true;
              const isInt = Number.isInteger(c.number);
              return filter === 'integer' ? isInt : !isInt;
            })
            .map((c) => c.number),
        ),
      );
    });
  }

  backToSearch(): void {
    this.step.set('search');
    this.selectedWork.set(null);
  }

  isSelected(number: number): boolean {
    return this.selectedNumbers().has(number);
  }

  toggleCandidate(number: number): void {
    this.selectedNumbers.update((set) => {
      const next = new Set(set);
      if (next.has(number)) next.delete(number);
      else next.add(number);
      return next;
    });
  }

  confirmImport(): void {
    const result = this.selectedWork();
    if (!result) return;
    const work = this.state.importWorkFromExternal(result);
    const chosen = this.search
      .visibleCandidates()
      .filter((c) => this.selectedNumbers().has(c.number))
      .map((c) => ({ ...c, coverImageUrl: this.search.coverUrlFor(c) }));
    if (chosen.length > 0) {
      this.state.importUnitsAsGroup(work.id, this.groupTitle().trim() || '取り込み', chosen);
    }
    this.imported.emit(work);

    this.step.set('search');
    this.selectedWork.set(null);
    this.search.resetAfterImport();
  }
}
