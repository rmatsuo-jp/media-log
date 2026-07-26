/**
 * @file 外部API（AniList/Google Books/openBD）から作品を検索し、巻/話数の表紙イラストを見ながら取り込むインラインパネル。
 * ①検索→タイル選択 ②巻/話数候補選択 ③取り込み、の3ステップ。作品一覧タブ内に常時表示する（モーダルは使わない）。
 * 検索条件・検索結果・候補取得ロジックはWorkImportSearchServiceに分離しており、このコンポーネントは
 * step/selectedNumbers/groupTitle等のUI選択状態と、取り込み確定（confirmImport）の橋渡しに専念する。
 * 同一巻に複数の表紙候補（variantCoverImageUrls）がある場合の切り替えや、1.5巻等の非整数巻の絞り込み
 * （numberFilter）はサービス側のsignalを参照する。
 * 詳細設定（<details>）内は`[manualAdd]`属性でng-content投影可能にし、呼び出し元（AddWorkForm）の
 * 手動タイトル追加フォームを同じ詳細設定に統合表示する。
 * 巻タイルを右クリックすると、代替表紙候補（variantCoverImageUrls）をグリッド表示するモーダルを開き、
 * クリックした候補を直接選択できる（work-listの作品カバー右クリックメニューと同様のパターン）。
 * mediaType inputは呼び出し元（work-list）のトグル値を受け取り、effectでsearch.mediaTypeへ同期する
 * （自前のトグルUIは持たない）。
 * selectWork()時にWorksStateService.findPossibleDuplicates()で既存Workとの重複候補を検知し、
 * duplicateMatchesにセットする。候補読み込み自体はブロックしない。重複候補がある場合はUI上で警告バナーと
 * 「既存作品に追加」ボタンを表示し、選ぶとconfirmImport()は新規Work作成をスキップして
 * duplicateMatches()[0].workへ直接巻/話数グループを追加する（importIntoExistingWork()）。
 * 重複候補があっても従来通り新規登録したい場合のために「新規作品として取り込む」導線も残す。
 */
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MediaTypeFilter, Work } from '@core/models/media.model';
import { MEDIA_TYPE_META } from '@core/models/media-type-meta';
import {
  ExternalUnitCandidate,
  ExternalWorkSearchResult,
} from '@core/external-media/external-media.model';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Badge } from '@shared/ui/badge/badge';
import { Modal } from '@shared/ui/modal/modal';
import { WorkImportSearchService } from './work-import-search.service';
import { WorkImportMapperService } from './work-import-mapper.service';
import { DuplicateWorkMatch, WorksStateService } from '../works-state.service';

type Step = 'search' | 'candidates';

@Component({
  selector: 'app-work-import',
  imports: [CoverTile, Spinner, Badge, Modal],
  providers: [WorkImportSearchService],
  templateUrl: './work-import.html',
  styleUrl: './work-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkImport {
  private mapper = inject(WorkImportMapperService);
  private worksState = inject(WorksStateService);
  protected search = inject(WorkImportSearchService);
  protected readonly meta = MEDIA_TYPE_META;

  mediaType = input.required<MediaTypeFilter>();

  constructor() {
    effect(() => this.search.mediaType.set(this.mediaType()));
  }

  imported = output<Work>();

  protected step = signal<Step>('search');
  protected selectedWork = signal<ExternalWorkSearchResult | null>(null);
  protected selectedNumbers = signal<Set<number>>(new Set());
  protected groupTitle = signal('');
  protected duplicateMatches = signal<DuplicateWorkMatch[]>([]);

  selectWork(result: ExternalWorkSearchResult): void {
    this.selectedWork.set(result);
    this.step.set('candidates');
    this.groupTitle.set(MEDIA_TYPE_META[result.mediaType].importGroupTitle);
    this.selectedNumbers.set(new Set());
    this.duplicateMatches.set(this.worksState.findPossibleDuplicates(result));

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
    this.duplicateMatches.set([]);
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

  protected coverPickerCandidate = signal<ExternalUnitCandidate | null>(null);

  onCandidateCoverContextMenu(event: MouseEvent, candidate: ExternalUnitCandidate): void {
    event.preventDefault();
    if ((candidate.variantCoverImageUrls?.length ?? 0) < 2) return;
    this.coverPickerCandidate.set(candidate);
  }

  closeCoverPicker(): void {
    this.coverPickerCandidate.set(null);
  }

  selectCandidateVariant(index: number): void {
    const candidate = this.coverPickerCandidate();
    if (!candidate) return;
    this.search.setVariant(candidate, index);
    this.coverPickerCandidate.set(null);
  }

  confirmImport(): void {
    const result = this.selectedWork();
    if (!result) return;
    const work = this.mapper.importWorkFromExternal(result);
    this.importSelectedUnits(work.id);
    this.imported.emit(work);
    this.finishImport();
  }

  // 重複候補（既存Work）に対して新規Workを作らず巻/話数グループのみを追加する。
  importIntoExistingWork(): void {
    const work = this.duplicateMatches()[0]?.work;
    if (!work) return;
    this.importSelectedUnits(work.id);
    this.imported.emit(work);
    this.finishImport();
  }

  private importSelectedUnits(workId: string): void {
    const chosen = this.search
      .visibleCandidates()
      .filter((c) => this.selectedNumbers().has(c.number))
      .map((c) => ({ ...c, coverImageUrl: this.search.coverUrlFor(c) }));
    if (chosen.length > 0) {
      this.mapper.importUnitsAsGroup(workId, this.groupTitle().trim() || '取り込み', chosen);
    }
  }

  private finishImport(): void {
    this.step.set('search');
    this.selectedWork.set(null);
    this.duplicateMatches.set([]);
    this.search.resetAfterImport();
  }
}
