# API仕様書（外部連携API）

Media Logは独自のバックエンドAPIを持たないクライアント完結型PWAで、データ永続化はFirestore
（構造は[data-design.md](data-design.md)を参照）、作品・巻・話の取り込みは外部の公開API 4種を
直接HTTPクライアント（`HttpClient`）から呼び出すことで実現する。本書はその4種の外部APIの
エンドポイント・リクエスト/レスポンス仕様をまとめる。各APIの役割分担や連携フローの全体像は
[external-media-integration.md](external-media-integration.md)を参照。

実装は [src/app/core/external-media/](../src/app/core/external-media/) 配下。

## 共通事項

- 全APIとも呼び出し失敗時は`retry({ count: 2, delay: 1000 })`で最大2回リトライする。
- APIキーはクライアントサイド（ブラウザ）から直接送信される。バックエンドを介したキー秘匿は行っていない。
- 認証（Firebase Authユーザーのログイン等）とは無関係で、いずれも匿名で呼び出し可能なパブリックAPI。

## 1. AniList GraphQL API

| 項目 | 内容 |
| --- | --- |
| エンドポイント | `https://graphql.anilist.co` |
| プロトコル | GraphQL over HTTP POST |
| 認証 | 不要 |
| 実装 | [anilist-api.service.ts](../src/app/core/external-media/anilist-api.service.ts) |

マンガ・アニメ横断の作品検索と、アニメの話数サムネイル取得を担う。

### `searchWorks(query, mediaType, includeAdult = false)`

作品検索。`mediaType`に`'both'`を渡すと種別フィルタなしで検索する。

リクエスト例（GraphQL variables）:

```graphql
query ($search: String, $type: MediaType, $isAdult: Boolean) {
  Page(page: 1, perPage: 20) {
    media(search: $search, type: $type, isAdult: $isAdult) {
      id
      type
      title { romaji english native }
      coverImage { large }
      format
      averageScore
      popularity
    }
  }
}
```

- `type`: `mediaType`が`'manga'`→`MANGA`、`'anime'`→`ANIME`、`'both'`→未指定（フィルタなし）
- `isAdult`: `includeAdult`が`false`の場合のみ`false`を明示指定（成人向け除外）

戻り値は`ExternalWorkSearchResult[]`に変換される（`title`はromaji→english→nativeの優先順で採用、
`titleNative`は別途保持）。

### `getAnimeEpisodes(externalId)`

指定作品の話数サムネイル一覧を取得（`streamingEpisodes`を持たない作品は空配列）。

```graphql
query ($id: Int) {
  Media(id: $id) {
    streamingEpisodes { thumbnail }
  }
}
```

日本語の話タイトルはAniList側に存在しないため取得せず、呼び出し側で「第N話」表記にフォールバックする。

### 実装上の注意

- Angular Service WorkerはデフォルトでGETリクエストのみ傍受するため、POSTであるAniList呼び出しには
  `ngsw-bypass`ヘッダーが不要（付与するとプリフライトが増えCORSエラーを誘発するため付与しない）。

## 2. Google Books API

| 項目 | 内容 |
| --- | --- |
| エンドポイント | `https://www.googleapis.com/books/v1/volumes` |
| プロトコル | REST (GET) |
| 認証 | APIキー必須（`key`クエリパラメータ） |
| 実装 | [google-books-api.service.ts](../src/app/core/external-media/google-books-api.service.ts) |

マンガの巻単位候補（ISBN・巻数・表紙）の一次情報源。

### `searchVolumes(seriesTitle)`

リクエストパラメータ:

| パラメータ | 値 |
| --- | --- |
| `q` | `intitle:{seriesTitle}` |
| `country` | `JP` |
| `maxResults` | `40`（1リクエストの上限） |
| `startIndex` | ページング用オフセット |
| `key` | APIキー（後述） |

`totalItems`に応じて`startIndex`をずらした追加リクエストを並列発行し、最大400件
（`MAX_ITEMS`）までページングする。

レスポンスの`items[].volumeInfo`から以下を抽出する:

- `industryIdentifiers`（ISBN_13優先、ISBN_10しか無い場合は`isbn10ToIsbn13()`で決定的変換）
- 巻数: タイトル/サブタイトル文字列を正規表現で解析（`parseVolumeNumber()`。表記揺れ
  「作品名 15」「作品名(15)」「作品名 第15巻」等に対応。全角数字は`toHalfWidthDigits()`で半角化）
- `imageLinks.thumbnail`（`http://`は`https://`に置換）

シリーズタイトルと正規化した書籍タイトルが部分一致する候補のみ採用する（IDによる相互リンクが
ないための誤マッチ対策）。

### APIキー

未認証リクエストは1日あたりの割り当てが0のため必須。優先順位:

1. `SettingsStoreService`に保存されたユーザー入力キー（設定画面から入力、平文でlocalStorage保存）
2. `environment.googleBooksApiKey`（ビルド時埋め込みの共有キー）

キーはGoogle Cloud ConsoleでBooks API専用の読み取りキーとして発行し、HTTPリファラー制限を
推奨する。

## 3. openBD API

| 項目 | 内容 |
| --- | --- |
| エンドポイント | `https://api.openbd.jp/v1/get` |
| プロトコル | REST (GET) |
| 認証 | 不要 |
| 実装 | [openbd-api.service.ts](../src/app/core/external-media/openbd-api.service.ts) |

検索機能を持たないISBN一括取得API。Google Books/NDLで得たISBN群を渡し、日本語の正確な
書誌情報（表紙・発売日）で補完する専用。

### `getByIsbns(isbns)`

リクエスト: `GET /v1/get?isbn={isbn1},{isbn2},...`

URL長の上限を考慮し、ISBNを30件（`CHUNK_SIZE`）ずつチャンク化して並列リクエストする。

レスポンスは各ISBNに対応する要素の配列（該当なしは`null`）。`summary`オブジェクトから
`isbn`/`title`/`cover`/`pubdate`を抽出し、ISBN→書誌情報の`Map`に正規化して返す
（該当なし要素は除外）。

## 4. NDL Search（国立国会図書館サーチ）SRU API

| 項目 | 内容 |
| --- | --- |
| エンドポイント | `https://ndlsearch.ndl.go.jp/api/sru` |
| プロトコル | SRU (GET, レスポンスはdcndl形式のXML) |
| 認証 | 不要（CORS許可 `Access-Control-Allow-Origin: *` 確認済み） |
| 実装 | [ndl-api.service.ts](../src/app/core/external-media/ndl-api.service.ts) |

Google Books+openBDでISBN・表紙が見つからなかった巻を、構造化フィールドから補完する。

### `searchIsbnsForVolumes(seriesTitle, volumeNumbers)`

リクエストパラメータ:

| パラメータ | 値 |
| --- | --- |
| `operation` | `searchRetrieve` |
| `version` | `1.2` |
| `query` | `title="{seriesTitle}"` |
| `recordSchema` | `dcndl` |
| `maximumRecords` | `40`（`MAX_RECORDS`） |

**シリーズタイトルにつき1リクエスト**で、指定した巻番号（`volumeNumbers`）すべてを
まとめて処理する。巻ごとに別々のリクエストを投げるとNDL側の同時アクセス数上限に達し
429が返ることが判明したための設計。

レスポンスXMLは`recordData`要素ごとに`BibResource`をパースし、以下を抽出する:

- タイトル: `dc:title`（`rdf:value`側）を優先、無ければ`dcterms:title`
- 巻数: `dcndl:volume/rdf:Description/dcndl:transcription`（構造化フィールドのためタイトルからの
  正規表現推測より精度が高い。`rdf:value`は`"[2]"`のような角括弧付きの場合があるため使わない。
  全角数字は`toHalfWidthDigits()`で半角化）
- ISBN: `dc:identifier`のうち`rdf:datatype`が`.../ISBN`で終わるもの

シリーズタイトルの正規化部分一致で絞った上で、巻数が完全一致するレコードのみ採用する
（スピンオフ・小説版・グッズ等の誤マッチ対策。それでも誤判定の可能性は残る）。

ネットワークエラー・パース失敗・該当なしはすべて空`Map`として扱い、呼び出し側の全体フローを
止めない（`catchError`で吸収）。補完対象は呼び出し側（`manga-volume-lookup.service.ts`）で
最大30巻（`NDL_LOOKUP_MAX`）までに制限される。

## エラーハンドリング方針

| API | リトライ | 最終失敗時の扱い |
| --- | --- | --- |
| AniList | 2回（1秒間隔） | エラーとして呼び出し側（`work-import-search.service.ts`）に伝播 |
| Google Books | 2回（1秒間隔） | エラーとして呼び出し側（`manga-volume-lookup.service.ts`）に伝播 |
| openBD | 2回（1秒間隔） | エラーとして呼び出し側に伝播 |
| NDL Search | 2回（1秒間隔） | `catchError`で空`Map`に変換し、呼び出し側の処理を継続 |

いずれも作品取り込みフロー（[work-import.ts](../src/app/features/works/work-import/work-import.ts)）
の一部候補が欠けるだけで、全体は継続できるよう設計されている（NDLは特にその位置づけが強い＝
「見つからなければ表紙なしで表示」のフォールバックが前提）。
