# TODO

今後の機能追加・修正およびリファクタリングのTODOリスト。Claude Codeはタスク着手・完了時にこのファイルを更新する。

## 機能追加

- **書籍・映画への対応**: `MediaType`（`core/models/media.model.ts`）を`'book' | 'movie'`に拡張する。movieはGroup1件・Unit1件、bookはmangaと同形の想定（Work→Group→Unitの3階層はそのまま使える設計）。作品取り込みの検索・候補取得ロジックは`work-import-search.service.ts`に分離済みのため、拡張時はこのサービスの差し替え/拡張で対応しやすい。
- **特殊巻・小数話数対応**（外伝・総集編・13.5話等）: 現状`Unit.number`は整数のみ。特殊ケースへの対応は保留。
- **単位のまとめて追加**: 例えば「1〜10巻を一括登録」のような操作は未実装で、現状は1件ずつ追加する。
- **アニメ話数のAnnict連携によるタイトル精度向上**: 現状アニメの話数タイトル・サムネイルはAniList（英語圏中心）のみに依存。日本のアニメ特化DBであるAnnict APIを`anilist-api.service.ts`と同様のパターンで追加し、話数タイトル・サブタイトルの答え合わせ／優先採用元とすることで、日本語タイトルの正確性を上げる。
- **`coverImageCandidates`の実装（表紙画像の複数候補・手動選択）**: `Work`/`Unit`に候補配列フィールドは定義済みだが取り込みロジックが未実装。Google Books/openBD/NDL/AniListから取得できる複数の表紙候補を`coverImageCandidates`に格納し、取り込みモーダルでユーザーが正しい表紙を選べるUIを追加する。自動選定が誤った表紙（別版・別巻）を採用してしまう問題を軽減できる。
- **NDL典拠ID（著者名典拠・シリーズ名典拠）を用いた名寄せ精度向上**: `ndl-api.service.ts`は現状タイトル文字列一致でのフォールバック検索のみ。NDL Searchが提供する典拠ID（著者/シリーズ）を用いることで、同名異作品・シリーズ違いの誤マッチを減らし、正式タイトル・巻数の取得精度を上げる。
- **巻データのFirestoreキャッシュ**: 同一作品・巻への外部API問い合わせが取り込みのたびに発生している。取得結果（ISBN・表紙URL・巻数）をFirestore側にキャッシュし、再取り込み時はキャッシュを優先参照することでAPIレート制限（NDLの30件/リクエスト制限等）のリスクを下げ、取得速度も上げる。
- **複数API結果の突合スコアリング**: Google Books・openBD・NDL・AniListから得られる候補タイトルを単純な優先順位（現行: Google Books→openBD→NDL）ではなく、レーベンシュタイン距離等による類似度スコアで突合し、最も確からしいタイトル・表紙を自動選定するロジックに改善する。
- **書影画像のプロキシ/キャッシュ配信**: 外部の表紙URLを直接`<img>`参照しているため、リンク切れ・CORS・ホットリンク制限のリスクがある。表紙画像をFirebase Storage等に一度取り込みキャッシュ配信することで表示の安定性を上げる（将来検討・優先度低）。

## 公開準備

eibun-lab（プラットフォーム基盤の複製元）の公開設定一式と本リポジトリを突き合わせた結果、
`firebase.json`／`.firebaserc`／`firestore.rules`（ホワイトリスト方式）／CI一式
（`ci.yml`・`deploy.yml`・`codeql.yml`・`dependabot-auto-merge.yml`）／semantic-release／
`docs/legal/*`・LICENSE／PWA構成（manifest.webmanifest・ngsw-config.json）は既に輸入済み。
残る公開前タスクは以下。

- **`SECURITY.md`が存在しない**: eibun-labにはroot直下に脆弱性報告先を案内する`SECURITY.md`がある。公開リポジトリとして最低限追加する。
- **Google Books APIキー未設定**: `environment.ts`/`environment.prod.ts`の`googleBooksApiKey`が空のまま。巻数取得APIをGoogle Books+openBDに置き換え済みのため（[fa6d0bd]）、公開環境で有効化するには実キーの設定が必要。
- **Firebase APIキーのHTTPリファラー制限の設定確認**: READMEに推奨事項として記載済みだが、Google Cloud Console側で実際に設定済みかは未確認。公開前にチェックする。
- **既知の失敗テストの修正**: →「既知の問題」節の`anilist-api.service.spec.ts`参照。公開前のCI green化のため優先度を上げる。
- **GitHub Actionsシークレットの設定確認**: `FIREBASE_TOKEN`（Firestore rulesデプロイ用）が本リポジトリのSecretsに登録済みか未確認。
- **`deploy.yml`の`--base-href`確認**: eibun-labからの流用時、リポジトリ名（`media-log`）に対応したbase-hrefが正しく設定されているか確認する。
- **robots.txt検討**: 個人ログアプリとして検索エンジンにインデックスさせない方針であれば、全面Disallowの`robots.txt`追加を検討（eibun-lab同様、必須ではない）。
- **アナリティクス/エラー監視は未導入**（eibun-labも同様）: 公開後の障害検知のため、軽量なエラートラッキング導入を将来検討事項とする（必須ではない）。
- **`docs/setup.md`・`docs/index.md`の内容確認**: 公開ドキュメントとして最新かどうか未検証。確認待ち。

## 確認待ち

- **ブラウザでの実動作確認**: Phase 2実装時はブラウザ自動操作ツールが利用できず、実際のクリック操作によるE2E確認は未実施。ユーザーによる手動確認待ち。
- **外部API連携（AniList/Google Books/openBD）の実動作確認**: `core/external-media/`に AniList GraphQL API（作品検索・シリーズ表紙・アニメの話数サムネイル）と Google Books API+openBD（マンガの巻ごとの表紙・書誌情報）を実装し、`features/works/work-import/`のモーダルから検索→タイル選択→巻/話数選択→取り込みができるようにした（`work-list`画面の「外部検索から追加」ボタンから起動）。単体テストは通過済みだが、ブラウザ自動操作ツールが利用できず実際のAPI疎通・E2E確認は未実施。ユーザーによる手動確認待ち。

## 既知の問題

（MangaDex検索でのCORSエラー問題は、マンガの巻データ取得元をGoogle Books+openBDへ置き換えたことで解消・関連コード削除済み。）

（2026-07-19: CIのカバレッジ閾値未達は`media-firestore-sync.service.spec.ts`・`media-repository.service.spec.ts`追加、および`works-state.service.spec.ts`拡充により解消。全体でlines 88.23%/functions 82.44%/statements 85.61%/branches 70.13%まで改善。）

- **`anilist-api.service.spec.ts`のテスト失敗（既知・未着手）**: `検索結果をExternalWorkSearchResultへ変換する`と`includeAdultがtrueの場合はisAdultフィルタなしで検索する`の2件が、`work-import`リファクタリングとは無関係に失敗する（リファクタリング前のベースラインでも再現確認済み）。`npm test`実行順序に依存したテスト間の状態漏れ（モックレスポンスの使い回し等）が疑われる。要調査・修正。
