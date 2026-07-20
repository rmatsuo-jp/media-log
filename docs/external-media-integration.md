# 外部API連携（AniList / Google Books / openBD / NDL Search）の関係性

作品取り込み機能の検索・候補取得ロジック（[work-import-search.service.ts](../src/app/features/works/work-import/work-import-search.service.ts)、[work-import.ts](../src/app/features/works/work-import/work-import.ts)から呼び出される）が利用する
外部API 4種の役割分担と依存関係をまとめる。

かつてマンガの巻候補取得にはMangaDex APIを使用していたが、Cloudflare CDNのキャッシュ汚染やWAFによる
CORS/403エラーが繰り返し発生したため、Google Books + openBD（+ NDL Search）へ置き換えた。

## 役割分担

- **AniList**（[anilist-api.service.ts](../src/app/core/external-media/anilist-api.service.ts)）
  - 作品検索全般（マンガ・アニメ両方、`mediaType: 'both'` 可）を担当
  - アニメの場合は話数候補もAniListだけで取得（`getAnimeEpisodes`）
- **Google Books**（[google-books-api.service.ts](../src/app/core/external-media/google-books-api.service.ts)）
  - マンガの**巻単位の候補**の一次情報源。シリーズタイトルで書籍を検索し、ISBN・巻数（タイトル文字列から
    正規表現でパース）・表紙画像を抽出する
  - `industryIdentifiers`にISBN_13が無くISBN_10のみの場合は、[isbn.util.ts](../src/app/core/external-media/isbn.util.ts)の`isbn10ToIsbn13()`（検査ディジットを再計算する決定的な変換）でISBN_13に変換して格納する
  - 未認証リクエストは1日あたりの割り当てが0のため、`environment.googleBooksApiKey`（Books API専用の
    読み取りキー、Google Cloud Consoleで発行しHTTPリファラー制限を推奨）が必須
- **openBD**（[openbd-api.service.ts](../src/app/core/external-media/openbd-api.service.ts)）
  - 検索機能を持たないISBN一括取得APIのため単体では使えない。Google Books（および後述のNDL）で得たISBN群を渡し、
    日本語の正確な書誌情報（表紙・発売日）で補完する専用
- **NDL Search**（[ndl-api.service.ts](../src/app/core/external-media/ndl-api.service.ts)、国立国会図書館サーチSRU API）
  - Google Books+openBDの組み合わせでも表紙・ISBNが見つからなかった巻について、シリーズタイトルで検索し、
    欠けている巻番号ぶんのISBNをまとめて補完する（openBDへ再度渡す）。APIキー不要、CORS許可
    （`Access-Control-Allow-Origin: *`）済み
  - `searchIsbnsForVolumes(seriesTitle, volumeNumbers)`は**シリーズタイトルにつき1リクエスト**で欠けている
    巻すべてを処理する。巻ごとに別々のリクエストを投げるとNDL側の同時アクセス数上限に達し429になることが
    実際に判明したため、この設計にしている
  - 巻数はタイトル文字列からの正規表現推測ではなく、構造化フィールド`dcndl:volume`から取得するため
    Google Books側の巻数抽出より精度が高い。ただしシリーズ判定自体はタイトル文字列の部分一致に依存するため、
    スピンオフ・小説版等の誤マッチのリスクはGoogle Booksと同程度残る
  - 補完対象は最大30巻（`NDL_LOOKUP_MAX`）までに制限し、それでも見つからない巻は表紙なし・巻数のみで表示する
- 上記3つの仲介は[manga-volume-lookup.service.ts](../src/app/core/external-media/manga-volume-lookup.service.ts)が担う

## 依存関係（マンガ選択時のみ）

`work-import-search.service.ts` の `loadCandidatesFor()` を見ると、マンガを選んだ場合は次の流れになる。

1. AniListの検索結果から得た日本語タイトル `result.titleNative`（無ければ`result.title`）を使って
2. `manga-volume-lookup.service.ts` の `getVolumes()` を呼び、
   **Google Books側でタイトル文字列を検索**（`googleBooks.searchVolumes(seriesTitle)`）してISBN・巻数候補を得る
3. 得られたISBN群を **openBDへ渡し**（`openBd.getByIsbns(isbns)`）、日本語の正確な表紙・発売日で補完する
4. 1〜最新巻のうちまだ表紙が見つかっていない巻番号一覧を**NDL Searchへ1リクエストでまとめて渡し**、
   得られたISBNを再度openBDへ渡して表紙を補完する
5. 巻番号ごとにグルーピングし、候補（`ExternalUnitCandidate[]`）として返す。巻数（1〜最新刊）は
   欠番なく生成し、表紙が最後まで見つからない巻は画像なしのまま返す

Google Books・NDLともAniListのメディアIDのような相互リンクを持たないため、シリーズタイトルと書籍タイトルの
文字列一致（部分一致）でのみ候補を絞り込んでいる。IDでの直接紐付けではないため、
同名・類似タイトル作品の巻データを誤って取り込むリスクは、旧MangaDex実装（AniList ID突合あり）より高い。

アニメの場合はGoogle Books/openBD/NDLを一切呼ばず、AniList単体で完結する。
