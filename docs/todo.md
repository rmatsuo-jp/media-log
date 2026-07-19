# TODO

今後の機能追加・修正およびリファクタリングのTODOリスト。Claude Codeはタスク着手・完了時にこのファイルを更新する。

## 機能追加

- **書籍・映画への対応**: `MediaType`（`core/models/media.model.ts`）を`'book' | 'movie'`に拡張する。movieはGroup1件・Unit1件、bookはmangaと同形の想定（Work→Group→Unitの3階層はそのまま使える設計）。作品取り込みの検索・候補取得ロジックは`work-import-search.service.ts`に分離済みのため、拡張時はこのサービスの差し替え/拡張で対応しやすい。
- **特殊巻・小数話数対応**（外伝・総集編・13.5話等）: 現状`Unit.number`は整数のみ。特殊ケースへの対応は保留。
- **単位のまとめて追加**: 例えば「1〜10巻を一括登録」のような操作は未実装で、現状は1件ずつ追加する。

## リファクタリング

- **作品/グループ/単位の追加フォームのモーダル化**: 現状は各画面に埋め込んだシンプルなフォーム。`shared/ui/modal`（現状未使用）を使う設計に変更する余地がある。
- **アイコン・ファビコンの差し替え**: `public/favicon.svg`・`public/favicon.ico`・`public/icons/*`が現状eibun-lab（プラットフォーム基盤の複製元）のものが流用されたまま。

## 確認待ち

- **ブラウザでの実動作確認**: Phase 2実装時はブラウザ自動操作ツールが利用できず、実際のクリック操作によるE2E確認は未実施。ユーザーによる手動確認待ち。
- **外部API連携（AniList/MangaDex）の実動作確認**: `core/external-media/`に AniList GraphQL API（作品検索・シリーズ表紙・アニメの話数サムネイル）と MangaDex API（マンガの巻ごとの表紙）を実装し、`features/works/work-import/`のモーダルから検索→タイル選択→巻/話数選択→取り込みができるようにした（`work-list`画面の「外部検索から追加」ボタンから起動）。単体テストは通過済みだが、ブラウザ自動操作ツールが利用できず実際のAPI疎通・E2E確認は未実施。ユーザーによる手動確認待ち。

## 既知の問題

（2026-07-19: CIのカバレッジ閾値未達は`media-firestore-sync.service.spec.ts`・`media-repository.service.spec.ts`追加、および`works-state.service.spec.ts`拡充により解消。全体でlines 88.23%/functions 82.44%/statements 85.61%/branches 70.13%まで改善。）

- **`anilist-api.service.spec.ts`のテスト失敗（既知・未着手）**: `検索結果をExternalWorkSearchResultへ変換する`と`includeAdultがtrueの場合はisAdultフィルタなしで検索する`の2件が、`work-import`リファクタリングとは無関係に失敗する（リファクタリング前のベースラインでも再現確認済み）。`npm test`実行順序に依存したテスト間の状態漏れ（モックレスポンスの使い回し等）が疑われる。要調査・修正。
