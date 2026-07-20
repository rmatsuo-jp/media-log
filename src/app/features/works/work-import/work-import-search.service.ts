/**
 * @file 外部API（AniList/Google Books+openBD）による作品検索・巻/話数候補取得のロジックを保持するサービス。
 * work-import.tsのUI状態（step, selectedNumbers, groupTitle等）とは分離し、検索条件（query/mediaType/
 * includeAdult/titleLang/sortBy/page）と検索結果、候補取得結果（candidates/numberFilter/variantIndexByNumber）
 * をsignalで保持する。query/mediaType/includeAdultの変更はtoObservable()経由でdebounceTime(400ms)し、
 * トリム後2文字未満でなければ自動検索する。実処理はperformSearch()に集約し、「検索」ボタン/Enterキーによる
 * 即時検索（search()）と共通化している。マンガの巻取得はAniListの検索結果の日本語タイトル（titleNative。
 * 未取得時のみromaji/english表記のtitleにフォールバック）をMangaVolumeLookupService（Google Books検索→
 * openBD補完）に渡す。ローマ字/英語タイトル（titleのみ）で検索すると、Google Books側で英語翻訳版
 * （巻数の刊行が原作より遅れている）がヒットしてしまい、巻タイトルが英語表示になったり高い巻数が
 * 欠落したりする不具合があったため、日本語タイトル優先に変更した。AniListメディアIDのような相互リンクを
 * 持たないため、タイトル文字列の一致のみに依存し、同名・類似タイトル作品の巻データ誤取り込みのリスクは
 * MangaDex時代より高い（詳細はdocs/external-media-integration.md参照）。
 * 書籍・映画等の将来的なメディア種別拡張時も、このサービスを再利用/差し替えできるようにコンポーネントから
 * 独立させている。
 * loadCandidatesFor()はAPI呼び出し失敗時（外部APIの一時的な504等、各クライアントでretry済みでも
 * 解消しなかった場合）にcandidatesError signalへメッセージを設定し、「該当作品なし（0件）」
 * と区別する。UI側はcandidatesErrorを見て再試行ボタンを出せるよう、直近のloadCandidatesFor呼び出しを
 * retryLastLoadCandidates()で再実行できるようにしている。
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { combineLatest, debounceTime, distinctUntilChanged } from 'rxjs';
import { MediaTypeFilter } from '@core/models/media.model';
import {
  ExternalUnitCandidate,
  ExternalWorkSearchResult,
} from '@core/external-media/external-media.model';
import { AnilistApiService } from '@core/external-media/anilist-api.service';
import { MangaVolumeLookupService } from '@core/external-media/manga-volume-lookup.service';
import { WorkImportSettingsService } from './work-import-settings.service';

export type NumberFilter = 'all' | 'integer' | 'fractional';
export type TitleLang = 'original' | 'ja';
export type SortBy = 'relevance' | 'popularity' | 'score';

const PAGE_SIZE = 10;

@Injectable()
export class WorkImportSearchService {
  private anilist = inject(AnilistApiService);
  private mangaVolumeLookup = inject(MangaVolumeLookupService);
  private importSettings = inject(WorkImportSettingsService);

  mediaType = signal<MediaTypeFilter>('manga');
  query = signal('');
  searching = signal(false);
  searchError = signal<string | null>(null);
  searchResults = signal<ExternalWorkSearchResult[]>([]);
  titleLang = signal<TitleLang>('ja');
  sortBy = signal<SortBy>('popularity');
  page = signal(0);
  includeAdult = signal(this.importSettings.getSettings().includeAdult);

  loadingCandidates = signal(false);
  candidates = signal<ExternalUnitCandidate[]>([]);
  candidatesError = signal<string | null>(null);
  numberFilter = signal<NumberFilter>('integer');
  variantIndexByNumber = signal<Map<number, number>>(new Map());

  private lastCandidatesRequest: {
    result: ExternalWorkSearchResult;
    onLoaded: (candidates: ExternalUnitCandidate[]) => void;
  } | null = null;

  sortedResults = computed(() => {
    const sortBy = this.sortBy();
    if (sortBy === 'relevance') return this.searchResults();
    const key = sortBy === 'popularity' ? 'popularity' : 'averageScore';
    return [...this.searchResults()].sort((a, b) => (b[key] ?? -1) - (a[key] ?? -1));
  });

  pagedResults = computed(() => {
    const start = this.page() * PAGE_SIZE;
    return this.sortedResults().slice(start, start + PAGE_SIZE);
  });

  hasNextPage = computed(() => (this.page() + 1) * PAGE_SIZE < this.sortedResults().length);

  visibleCandidates = computed(() => {
    const filter = this.numberFilter();
    if (filter === 'all') return this.candidates();
    if (filter === 'integer') return this.candidates().filter((c) => Number.isInteger(c.number));
    return this.candidates().filter((c) => !Number.isInteger(c.number));
  });

  constructor() {
    combineLatest([
      toObservable(this.query),
      toObservable(this.mediaType),
      toObservable(this.includeAdult),
    ])
      .pipe(
        debounceTime(400),
        distinctUntilChanged((a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]),
      )
      .subscribe(([query, mediaType, includeAdult]) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
          this.searchResults.set([]);
          return;
        }
        this.performSearch(trimmed, mediaType, includeAdult);
      });
  }

  displayTitle(result: ExternalWorkSearchResult): string {
    return this.titleLang() === 'ja' ? (result.titleNative ?? result.title) : result.title;
  }

  setIncludeAdult(includeAdult: boolean): void {
    this.includeAdult.set(includeAdult);
    this.importSettings.saveSettings({ includeAdult });
  }

  nextPage(): void {
    if (this.hasNextPage()) this.page.update((p) => p + 1);
  }

  prevPage(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  setSortBy(sortBy: SortBy): void {
    this.sortBy.set(sortBy);
    this.page.set(0);
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

  resetAfterImport(): void {
    this.query.set('');
    this.searchResults.set([]);
    this.page.set(0);
  }

  loadCandidatesFor(
    result: ExternalWorkSearchResult,
    onLoaded: (candidates: ExternalUnitCandidate[]) => void,
  ): void {
    this.lastCandidatesRequest = { result, onLoaded };
    this.candidates.set([]);
    this.candidatesError.set(null);
    this.variantIndexByNumber.set(new Map());
    this.loadingCandidates.set(true);

    const candidates$ =
      result.mediaType === 'anime'
        ? this.anilist.getAnimeEpisodes(result.externalId)
        : this.mangaVolumeLookup.getVolumes(result.titleNative ?? result.title);

    candidates$.subscribe({
      next: (candidates) => {
        this.candidates.set(candidates);
        this.loadingCandidates.set(false);
        onLoaded(candidates);
      },
      error: () => {
        this.candidates.set([]);
        this.candidatesError.set('取得に失敗しました。しばらくしてから再試行してください。');
        this.loadingCandidates.set(false);
        onLoaded([]);
      },
    });
  }

  retryLastLoadCandidates(): void {
    if (!this.lastCandidatesRequest) return;
    const { result, onLoaded } = this.lastCandidatesRequest;
    this.loadCandidatesFor(result, onLoaded);
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
}
