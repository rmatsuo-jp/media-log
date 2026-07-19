/**
 * @file 外部API（AniList/MangaDex）から作品を検索し、巻/話数の表紙イラストを見ながら取り込むモーダル。
 * ①検索→タイル選択 ②巻/話数候補選択 ③取り込み、の3ステップ。shared/ui/modalを初めて活用する。
 */
import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { of, switchMap } from 'rxjs';
import { MediaType, Work } from '@core/models/media.model';
import { ExternalUnitCandidate, ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { AnilistApiService } from '@core/external-media/anilist-api.service';
import { MangadexApiService } from '@core/external-media/mangadex-api.service';
import { Modal } from '@shared/ui/modal/modal';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Spinner } from '@shared/ui/spinner/spinner';
import { WorksStateService } from '../works-state.service';

type Step = 'search' | 'candidates';

@Component({
  selector: 'app-work-import',
  imports: [Modal, CoverTile, Spinner],
  templateUrl: './work-import.html',
  styleUrl: './work-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkImport {
  private anilist = inject(AnilistApiService);
  private mangadex = inject(MangadexApiService);
  private state = inject(WorksStateService);

  closed = output<void>();
  imported = output<Work>();

  protected step = signal<Step>('search');
  protected mediaType = signal<MediaType>('manga');
  protected query = signal('');
  protected searching = signal(false);
  protected searchError = signal<string | null>(null);
  protected searchResults = signal<ExternalWorkSearchResult[]>([]);

  protected selectedWork = signal<ExternalWorkSearchResult | null>(null);
  protected loadingCandidates = signal(false);
  protected candidates = signal<ExternalUnitCandidate[]>([]);
  protected selectedNumbers = signal<Set<number>>(new Set());
  protected groupTitle = signal('');

  setMediaType(type: MediaType): void {
    this.mediaType.set(type);
  }

  search(): void {
    const query = this.query().trim();
    if (!query) return;
    this.searching.set(true);
    this.searchError.set(null);
    this.anilist.searchWorks(query, this.mediaType()).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.searching.set(false);
      },
      error: () => {
        this.searchError.set('検索に失敗しました。時間をおいて再度お試しください。');
        this.searching.set(false);
      },
    });
  }

  selectWork(result: ExternalWorkSearchResult): void {
    this.selectedWork.set(result);
    this.step.set('candidates');
    this.groupTitle.set(result.mediaType === 'manga' ? '取り込んだ巻' : '取り込んだ話数');
    this.candidates.set([]);
    this.selectedNumbers.set(new Set());
    this.loadingCandidates.set(true);

    const candidates$ =
      result.mediaType === 'anime'
        ? this.anilist.getAnimeEpisodes(result.externalId)
        : this.mangadex
            .searchManga(result.title)
            .pipe(
              switchMap((matches) =>
                matches.length > 0 ? this.mangadex.getVolumes(matches[0].externalId) : of([]),
              ),
            );

    candidates$.subscribe({
      next: (candidates) => {
        this.candidates.set(candidates);
        this.selectedNumbers.set(new Set(candidates.map((c) => c.number)));
        this.loadingCandidates.set(false);
      },
      error: () => {
        this.candidates.set([]);
        this.loadingCandidates.set(false);
      },
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
    const chosen = this.candidates().filter((c) => this.selectedNumbers().has(c.number));
    if (chosen.length > 0) {
      this.state.importUnitsAsGroup(work.id, this.groupTitle().trim() || '取り込み', chosen);
    }
    this.imported.emit(work);
    this.closed.emit();
  }

  close(): void {
    this.closed.emit();
  }
}
