/**
 * @file 外部API（AniList/MangaDex）から作品を検索し、巻/話数の表紙イラストを見ながら取り込むインラインパネル。
 * ①検索→タイル選択 ②巻/話数候補選択 ③取り込み、の3ステップ。作品一覧タブ内に常時表示する（モーダルは使わない）。
 * 同一巻に複数の表紙候補（variantCoverImageUrls）がある場合、自動で先頭を表示しつつ
 * variantIndexByNumber signalでユーザーが手動で切り替えられるようにする。
 * 1.5巻等の非整数巻は特別版/非売品であることが多いため、numberFilter signalで
 * 「整数のみ／非整数のみ／すべて」の3択表示に絞り込める。
 * mediaType signalは'both'を許容し、AniListに種別フィルタなしで検索させる（種別は結果ごとに判定）。
 * titleLang signalでタイトル表示をローマ字/英語⇔日本語(titleNative)に切り替え、
 * sortBy signalで検索結果を人気度/スコア順に並び替えられる。
 */
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { of, switchMap } from 'rxjs';
import { MediaType, Work } from '@core/models/media.model';
import { ExternalUnitCandidate, ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { AnilistApiService } from '@core/external-media/anilist-api.service';
import { MangadexApiService } from '@core/external-media/mangadex-api.service';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Badge } from '@shared/ui/badge/badge';
import { WorksStateService } from '../works-state.service';

type Step = 'search' | 'candidates';
type NumberFilter = 'all' | 'integer' | 'fractional';
type MediaTypeFilter = MediaType | 'both';
type TitleLang = 'original' | 'ja';
type SortBy = 'relevance' | 'popularity' | 'score';

@Component({
  selector: 'app-work-import',
  imports: [CoverTile, Spinner, Badge],
  templateUrl: './work-import.html',
  styleUrl: './work-import.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkImport {
  private anilist = inject(AnilistApiService);
  private mangadex = inject(MangadexApiService);
  private state = inject(WorksStateService);

  imported = output<Work>();

  protected step = signal<Step>('search');
  protected mediaType = signal<MediaTypeFilter>('manga');
  protected query = signal('');
  protected searching = signal(false);
  protected searchError = signal<string | null>(null);
  protected searchResults = signal<ExternalWorkSearchResult[]>([]);
  protected titleLang = signal<TitleLang>('original');
  protected sortBy = signal<SortBy>('relevance');

  protected selectedWork = signal<ExternalWorkSearchResult | null>(null);
  protected loadingCandidates = signal(false);
  protected candidates = signal<ExternalUnitCandidate[]>([]);
  protected selectedNumbers = signal<Set<number>>(new Set());
  protected groupTitle = signal('');
  protected variantIndexByNumber = signal<Map<number, number>>(new Map());
  protected numberFilter = signal<NumberFilter>('integer');

  protected visibleCandidates = computed(() => {
    const filter = this.numberFilter();
    if (filter === 'all') return this.candidates();
    if (filter === 'integer') return this.candidates().filter((c) => Number.isInteger(c.number));
    return this.candidates().filter((c) => !Number.isInteger(c.number));
  });

  protected sortedResults = computed(() => {
    const sortBy = this.sortBy();
    if (sortBy === 'relevance') return this.searchResults();
    const key = sortBy === 'popularity' ? 'popularity' : 'averageScore';
    return [...this.searchResults()].sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1));
  });

  setMediaType(type: MediaTypeFilter): void {
    this.mediaType.set(type);
  }

  setTitleLang(lang: TitleLang): void {
    this.titleLang.set(lang);
  }

  setSortBy(sortBy: SortBy): void {
    this.sortBy.set(sortBy);
  }

  displayTitle(result: ExternalWorkSearchResult): string {
    return this.titleLang() === 'ja' ? (result.titleNative ?? result.title) : result.title;
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
    this.variantIndexByNumber.set(new Map());
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
        this.selectedNumbers.set(
          new Set(
            candidates
              .filter((c) => {
                if (this.numberFilter() === 'all') return true;
                const isInt = Number.isInteger(c.number);
                return this.numberFilter() === 'integer' ? isInt : !isInt;
              })
              .map((c) => c.number),
          ),
        );
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

  setNumberFilter(filter: NumberFilter): void {
    this.numberFilter.set(filter);
  }

  coverUrlFor(candidate: ExternalUnitCandidate): string | undefined {
    const variants = candidate.variantCoverImageUrls;
    if (!variants || variants.length === 0) return candidate.coverImageUrl;
    const index = this.variantIndexByNumber().get(candidate.number) ?? 0;
    return variants[index] ?? candidate.coverImageUrl;
  }

  cycleVariant(candidate: ExternalUnitCandidate): void {
    const variants = candidate.variantCoverImageUrls;
    if (!variants || variants.length < 2) return;
    this.variantIndexByNumber.update((map) => {
      const next = new Map(map);
      const current = next.get(candidate.number) ?? 0;
      next.set(candidate.number, (current + 1) % variants.length);
      return next;
    });
  }

  confirmImport(): void {
    const result = this.selectedWork();
    if (!result) return;
    const work = this.state.importWorkFromExternal(result);
    const chosen = this.visibleCandidates()
      .filter((c) => this.selectedNumbers().has(c.number))
      .map((c) => ({ ...c, coverImageUrl: this.coverUrlFor(c) }));
    if (chosen.length > 0) {
      this.state.importUnitsAsGroup(work.id, this.groupTitle().trim() || '取り込み', chosen);
    }
    this.imported.emit(work);

    this.step.set('search');
    this.selectedWork.set(null);
    this.query.set('');
    this.searchResults.set([]);
  }
}
