# 外部API連携（AniList / Google Books / openBD）の関係性

作品取り込み機能の検索・候補取得ロジック（[work-import-search.service.ts](../src/app/features/works/work-import/work-import-search.service.ts)、[work-import.ts](../src/app/features/works/work-import/work-import.ts)から呼び出される）が利用する
外部API 3種の役割分担と依存関係をまとめる。

かつてマンガの巻候補取得にはMangaDex APIを使用していたが、Cloudflare CDNのキャッシュ汚染やWAFによる
CORS/403エラーが繰り返し発生したため、Google Books + openBDへ置き換えた。

## 役割分担

- **AniList**（[anilist-api.service.ts](../src/app/core/external-media/anilist-api.service.ts)）
  - 作品検索全般（マンガ・アニメ両方、`mediaType: 'both'` 可）を担当
  - アニメの場合は話数候補もAniListだけで取得（`getAnimeEpisodes`）
- **Google Books**（[google-books-api.service.ts](../src/app/core/external-media/google-books-api.service.ts)）
  - マンガの**巻単位の候補**の一次情報源。シリーズタイトルで書籍を検索し、ISBN・巻数（タイトル文字列から
    正規表現でパース）・表紙画像を抽出する
  - 未認証リクエストは1日あたりの割り当てが0のため、`environment.googleBooksApiKey`（Books API専用の
    読み取りキー、Google Cloud Consoleで発行しHTTPリファラー制限を推奨）が必須
- **openBD**（[openbd-api.service.ts](../src/app/core/external-media/openbd-api.service.ts)）
  - 検索機能を持たないISBN一括取得APIのため単体では使えない。Google Booksで得たISBN群を渡し、
    日本語の正確な書誌情報（表紙・発売日）で補完する専用
- 上記2つの仲介は[manga-volume-lookup.service.ts](../src/app/core/external-media/manga-volume-lookup.service.ts)が担う

## 依存関係（マンガ選択時のみ）

`work-import-search.service.ts` の `loadCandidatesFor()` を見ると、マンガを選んだ場合は次の流れになる。

1. AniListの検索結果から得た日本語タイトル `result.titleNative`（無ければ`result.title`）を使って
2. `manga-volume-lookup.service.ts` の `getVolumes()` を呼び、
   **Google Books側でタイトル文字列を検索**（`googleBooks.searchVolumes(seriesTitle)`）してISBN・巻数候補を得る
3. 得られたISBN群を **openBDへ渡し**（`openBd.getByIsbns(isbns)`）、日本語の正確な表紙・発売日で補完する
4. 巻番号ごとにグルーピングし、候補（`ExternalUnitCandidate[]`）として返す

Google BooksはAniListのメディアIDのような相互リンクを持たないため、シリーズタイトルと書籍タイトルの
文字列一致（部分一致）でのみ候補を絞り込んでいる。IDでの直接紐付けではないため、
同名・類似タイトル作品の巻データを誤って取り込むリスクは、旧MangaDex実装（AniList ID突合あり）より高い。

アニメの場合はGoogle Books/openBDを一切呼ばず、AniList単体で完結する。
