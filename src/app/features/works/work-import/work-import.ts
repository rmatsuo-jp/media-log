/**
 * @file 外部API（AniList/MangaDex）から作品を検索し、巻/話数の表紙イラストを見ながら取り込むインラインパネル。
 * ①検索→タイル選択 ②巻/話数候補選択 ③取り込み、の3ステップ。作品一覧タブ内に常時表示する（モーダルは使わない）。
 * 同一巻に複数の表紙候補（variantCoverImageUrls）がある場合、自動で先頭を表示しつつ
 * variantIndexByNumber signalでユーザーが手動で切り替えられるようにする。
 * 1.5巻等の非整数巻は特別版/非売品であることが多いため、numberFilter signalで
 * 「整数のみ／非整数のみ／すべて」の3択表示に絞り込める。
 * マンガの巻取得はMangaDexのタイトル検索結果をそのまま先頭採用せず、attributes.links.alで
 * 返るAniListメディアIDと選択中作品のexternalIdを突き合わせ、一致した候補のみ採用する
 * （同名・類似タイトル作品の巻データ誤取り込みを防ぐ）。一致がなければ巻候補は0件になる。
 * mediaType signalは'both'を許容し、AniListに種別フィルタなしで検索させる（種別は結果ごとに判定）。
 * titleLang signalでタイトル表示をローマ字/英語⇔日本語(titleNative)に切り替え（デフォルト日本語）、
 * sortBy signalで検索結果を人気度/スコア順に並び替えられる（デフォルト人気度順）。
 * 検索結果は10件ずつpage signalでクライアント側ページングし、前へ/次へボタンで切り替える
 * （検索・並び替え変更時はpageを0に戻す）。
 * includeAdult signalは詳細設定で成人向け作品を検索結果に含めるかどうかを切り替え、
 * WorkImportSettingsServiceでlocalStorageに永続化する（デフォルトfalse=除外）。
 * query/mediaType/includeAdultの変更はtoObservable()経由でdebounceTime(400ms)し、
 * トリム後2文字未満でなければ自動検索する（入力補助）。実処理はperformSearch()に集約し、
 * 「検索」ボタン/Enterキーによる即時検索（search()）と共通化している。
 */
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { MediaType, Work } from '@core/models/media.model';
import { ExternalUnitCandidate, ExternalWorkSearchResult } from '@core/external-media/external-media.model';
import { AnilistApiService } from '@core/external-media/anilist-api.service';
import { MangadexApiService } from '@core/external-media/mangadex-api.service';
import { CoverTile } from '@shared/ui/cover-tile/cover-tile';
import { Spinner } from '@shared/ui/spinner/spinner';
import { Badge } from '@shared/ui/badge/badge';
import { WorksStateService } from '../works-state.service';
import { WorkImportSettingsService } from './work-import-settings.service';

type Step = 'search' | 'candidates';
type NumberFilter = 'all' | 'integer' | 'fractional';
type MediaTypeFilter = MediaType | 'both';
type TitleLang = 'original' | 'ja';
type SortBy = 'relevance' | 'popularity' | 'score';

const PAGE_SIZE = 10;

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
  private importSettings = inject(WorkImportSettingsService);

  imported = output<Work>();

  protected step = signal<Step>('search');
  protected mediaType = signal<MediaTypeFilter>('manga');
  protected query = signal('');
  protected searching = signal(false);
  protected searchError = signal<string | null>(null);
  protected searchResults = signal<ExternalWorkSearchResult[]>([]);
  protected titleLang = signal<TitleLang>('ja');
  protected sortBy = signal<SortBy>('popularity');
  protected page = signal(0);
  protected includeAdult = signal(this.importSettings.getSettings().includeAdult);

  constructor() {
    combineLatest([toObservable(this.query), toObservable(this.mediaType), toObservable(this.includeAdult)])
      .pipe(
        debounceTime(400),
        distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]),
      )
      .subscribe(([query, mediaType, includeAdult]) => {
        if (this.step() !== 'search') return;
        const trimmed = query.trim();
        if (trimmed.length < 2) {
          this.searchResults.set([]);
          return;
        }
        this.performSearch(trimmed, mediaType, includeAdult);
      });
  }

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

  protected pagedResults = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.sortedResults().slice(start, start + PAGE_SIZE);
  });

  protected hasNextPage = computed(() => (this.page() + 1) * PAGE_SIZE < this.sortedResults().length);

  setMediaType(type: MediaTypeFilter): void {
    this.mediaType.set(type);
  }

  setTitleLang(lang: TitleLang): void {
    this.titleLang.set(lang);
  }

  setSortBy(sortBy: SortBy): void {
    this.sortBy.set(sortBy);
    this.page.set(0);
  }

  nextPage(): void {
    if (this.hasNextPage()) this.page.update((p) => p + 1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  setIncludeAdult(includeAdult: boolean): void {
    this.includeAdult.set(includeAdult);
    this.importSettings.saveSettings({ includeAdult });
  }

  displayTitle(result: ExternalWorkSearchResult): string {
    return this.titleLang() === 'ja' ? (result.titleNative ?? result.title) : result.title;
  }

  search(): void {
    const query = this.query().trim();
    if (!query) return;
    this.performSearch(query, this.mediaType(), this.includeAdult());
  }

  private performSearch(query: string, mediaType: MediaTypeFilter, includeAdult: boolean): void {
    this.searching.set(true);
    this.searchError.set(null);
    this.anilist.searchWorks(query, mediaType, includeAdult).subscribe({
      next: (results) => {
        this.searchResults.set(results);
        this.page.set(0);
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
        : this.mangadex.searchManga(result.title).pipe(
            switchMap((matches) => {
              const match = matches.find((m) => m.anilistId === result.externalId);
              return match ? this.mangadex.getVolumes(match.externalId) : of([]);
            }),
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
    this.page.set(0);
  }
}
