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

## 巻数抽出ロジック（Google Books）

[google-books-api.service.ts](../src/app/core/external-media/google-books-api.service.ts) は書籍タイトル文字列から
正規表現で巻数を抽出する。カナ副題付きタイトル（例:「NARUTO -ナルト- 15」のようにシリーズ名と巻数の間に
サブタイトルが挟まるケース）に対応するため、3段階のパターンを順に試す（42〜63行）。

1. **PREFIX_VOLUME_PATTERNS**（42〜46行）: シリーズ名を除去した残り文字列の**先頭**から巻数を抽出する通常ケース
   （`第15巻`・`(15)`・先頭の裸数字など）。先頭優先なので、末尾に付く出版社レーベル表記
   （例:`(講談社コミックス)`）に巻数抽出が阻害されない
2. **MID_VOLUME_PATTERNS**（51〜55行）: シリーズ名は見つかったが、残り文字列の先頭に巻数が無い場合のフォールバック。
   カナ副題等がシリーズ名と巻数の間に挟まるケースで、区切り文字（空白・ハイフン・括弧・句読点や文字列端）で
   区切られた最初の巻数トークンを残り文字列全体から探索する（副題部分の文字を読み飛ばせる）
3. **SUFFIX_VOLUME_PATTERNS**（58〜63行）: シリーズ名自体がタイトル文字列内で見つからなかった場合のみ使う
   最終手段。タイトル末尾側から巻数を抽出する

処理の流れ（`parseVolumeNumber()`, 113〜126行）:
- `title`+`subtitle` を連結し、`toHalfWidthDigits()`（94〜96行）で**全角数字を半角化**してから正規表現を適用する
  （正規表現の`\d`は全角数字にマッチしないため、半角化しないと`１巻`のような表記の巻を取りこぼす）
- 連結後の文字列内で`seriesTitle`の位置を探し（`seriesMatch`）、見つかった場合はその後ろの残り文字列に対して
  PREFIX→MIDの順に試す。見つからなかった場合は元の文字列全体に対してSUFFIXを試す
- `matchFirst()`（102〜111行）は各パターンを順に試し、最初にマッチした数値を返す。どのパターンにもマッチしなければ
  `null`
- 巻数が抽出できなかった候補は`toMatches()`（183行、`if (volumeNumber == null) continue;`）で**除外**される。
  誤った巻数を採用するリスクより、候補から漏れる方を優先する設計
- シリーズ名の一致判定（`toMatches()`, 181行）は`normalizeTitle()`（[title-normalize.util.ts](../src/app/core/external-media/title-normalize.util.ts)）
  で正規化した上での部分一致で、無関係な同名短縮タイトルの誤混入を防ぐ
- ISBN抽出（183〜196行）は`ISBN_13`を優先し、`ISBN_10`しか無ければ`isbn10ToIsbn13()`で変換する

## ISBNベースの巻マージと表紙候補の集約

[manga-volume-lookup.service.ts](../src/app/core/external-media/manga-volume-lookup.service.ts) の
`mergeAndGroupByVolume()`（49〜70行）が、Google Books検索結果を巻番号（`match.volumeNumber`）をキーに集約する。

- 巻ごとに`seenIsbnsByVolume`（Set）でISBNの重複を除去する（Google Booksのページング結果に同一書籍が
  複数回現れることがあるため、58行目`if (isbn && seenIsbns.has(isbn)) continue;`）
- 各（巻番号, ISBN）の組み合わせについて、`openBdByIsbn.get(isbn)`があれば**Google Booksの表紙URLとopenBDの
  表紙URLの両方**を`entry.urls`へ追加する（`addUrl()`, 41〜43行、完全一致URLで重複排除）。これが表紙候補の
  集約（`variantCoverImageUrls`）にあたる
- `entry.isbns`にはその巻番号に紐づいた全ての異なるISBNを蓄積する

`toCandidate()`（89〜102行）で最終的な候補に変換する際:
- `coverImageUrl = urls[0]`。`mergeAndGroupByVolume()`ではGoogle Booksの表紙URLを先に追加しているため、
  **Google Booksの表紙が常に主表紙として優先され、openBDの表紙は`variantCoverImageUrls`側の副候補として保持される**。
  Google Booksはヒット率が高い一方で表紙の正確性はopenBDに劣るため、主表紙は網羅性優先・副候補は精度確認用という
  役割分担になっている
- `entry.isbns.length >= VOLUME_ISBN_WARNING_THRESHOLD`（34行、閾値は3）の場合、`volumeNumberWarning`を立てる。
  同一巻番号に3件以上の異なるISBNが紐づくのは巻数抽出の誤りを示唆するシグナルであり、類似度スコアリングでは
  なく**単純な件数閾値**による判定である点に注意

その他の流れ（既存どおり）:
- `latestIntegerVolume()`（72〜75行）: 見つかった最大の整数巻番号を最新巻とする
- `missingVolumeNumbers()`（77〜87行）: 1〜最新巻のうち表紙URLが無い巻番号一覧
- `fillMissingVolumes()`（104〜121行）: 1〜最新巻を欠番なく生成し、加えて実際に見つかった小数巻（4.5巻等の
  特装版）も含める。小数巻を推測で生成することはない
- `getVolumes()`（129〜146行、エントリーポイント）: `googleBooks.searchVolumes()` → ISBN収集 →
  `openBd.getByIsbns()` → `mergeAndGroupByVolume()` → 欠番があれば`fillFromNdl()` → `fillMissingVolumes()`
- `fillFromNdl()`（148〜171行）: `ndlApi.searchIsbnsForVolumes()`で欠番分をまとめて1リクエストで問い合わせ、
  得られたISBNを再度openBDへ渡し、`byVolume`マップに表紙URL・ISBNを追加（インプレースで更新）してから
  再度`fillMissingVolumes()`を実行する

## 作品重複登録の防止

作品取り込み時に既存の作品と重複しそうな場合、警告バナーで知らせる（ただし取り込み自体はブロックしない）。

[works-state.service.ts](../src/app/features/works/works-state.service.ts) の `findPossibleDuplicates()`（99〜112行）:

1. まず既存の未削除作品から`externalSource`+`externalId`の**完全一致**を検索する。見つかればそれを
   `matchType: 'externalId'`として即座に返す（外部IDでの一致は最も確度が高いため単独で返す）
2. externalIdが一致しなければ、`result.titleNative`（無ければ`result.title`）を`normalizeTitle()`
   （[title-normalize.util.ts](../src/app/core/external-media/title-normalize.util.ts)）で正規化し、
   同じ`mediaType`の既存作品のうちタイトル正規化後の**完全一致**（ファジーマッチではない）を全て
   `matchType: 'title'`として返す

戻り値`DuplicateWorkMatch[]`は`{ work: Work; matchType: 'externalId' | 'title' }`の配列。
呼び出し元は`work-import.ts`の`selectWork()`（65〜70行）で、結果はUI上の警告バナー表示のみに使われ、
`confirmImport()`側にガードは無いため、**ユーザーは警告を見た上でも取り込みを続行できる**（非ブロッキング）。
