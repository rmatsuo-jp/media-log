# [0.6.0](https://github.com/rmatsuo-jp/media-log/compare/v0.5.0...v0.6.0) (2026-07-20)


### Bug Fixes

* AniListから取得できない話数英語タイトルの取得処理を削除 ([d5ddf98](https://github.com/rmatsuo-jp/media-log/commit/d5ddf98fe9b303523a95cd64405b89a60d96a981))
* streamingEpisodesのtitle取得廃止に合わせテストを更新 ([1ca97c3](https://github.com/rmatsuo-jp/media-log/commit/1ca97c3d7a810ce8aa11d141f6a2af6a59aa1285))
* 本番環境でService WorkerがMangaDex/AniList APIを横取りし504になる問題を修正 ([051e247](https://github.com/rmatsuo-jp/media-log/commit/051e2473cf45df547656a576b034bd71b909fdac))


### Features

* マンガ/アニメ絞り込みトグルを共通コンポーネント化 ([e4e905c](https://github.com/rmatsuo-jp/media-log/commit/e4e905c9f1f8a1dc18893de7b1cefdb4397656f7))
* 作品一覧に件数表示とページングを追加 ([efc9965](https://github.com/rmatsuo-jp/media-log/commit/efc996548d9e8a4b32f9ca9cebdba1d801091016))
* 作品詳細のUnit操作をクリック＋コンテキストメニューに刷新 ([23f69af](https://github.com/rmatsuo-jp/media-log/commit/23f69afb89f785821820985daa8a1771aa92d329))
* 作品追加・表示の絞り込みトグルを統合し領域を分離 ([164b5d1](https://github.com/rmatsuo-jp/media-log/commit/164b5d1360dfecd7b461f8201a9fed9c52330b89))
* 全巻既読の作品カードに既読バッジを表示 ([ecf1357](https://github.com/rmatsuo-jp/media-log/commit/ecf13573dfe319fd277dbedf974ad4b122b56b71))
* 手動追加フォームをwork-importの詳細設定に統合 ([c74f4d8](https://github.com/rmatsuo-jp/media-log/commit/c74f4d8d18450748cbce08e636e4a6b55447f035))
* 次に見るべき未読巻/話をバッジ表示 ([c8543d6](https://github.com/rmatsuo-jp/media-log/commit/c8543d65c17b6ab2b3e7ab1d984f47b773750a14))

# [0.5.0](https://github.com/rmatsuo-jp/media-log/compare/v0.4.0...v0.5.0) (2026-07-19)


### Bug Fixes

* クラウド同期中の直後編集がロールバックされる競合を解消 ([209faeb](https://github.com/rmatsuo-jp/media-log/commit/209faeb5dbc75945ac75925a0b92eb812ba077ea))
* 作品取り込みの「両方」検索でAniList結果が0件になる不具合を修正 ([782e97b](https://github.com/rmatsuo-jp/media-log/commit/782e97bf3da85abce7e525caaf53baffd411a8e4))
* 巻取り込み候補の同一巻数重複表示を解消 ([42b14b2](https://github.com/rmatsuo-jp/media-log/commit/42b14b20d796d22a9112dbeeac64e84db9cb1f62))


### Features

* AniList/MangaDex連携で作品検索・表紙イラスト取り込みに対応 ([e187f90](https://github.com/rmatsuo-jp/media-log/commit/e187f9064b36d68d5776f084753f5287d8b4225c))
* 作品カバーを右クリックで表紙候補選択・削除できるように ([70e06c5](https://github.com/rmatsuo-jp/media-log/commit/70e06c5203b4cf390acb81f36c9cd642bae1eccd))
* 作品一覧・読みたい一覧にマンガ/アニメ絞り込みフィルタを追加 ([fbd4c56](https://github.com/rmatsuo-jp/media-log/commit/fbd4c56880fe92732ca9735c0e05de4b7e93429e))
* 作品一覧グリッドをPCで大きめの画像サイズに変更 ([cd77253](https://github.com/rmatsuo-jp/media-log/commit/cd772535f5073caa8cdc5db5dd0e4ccfd1fb45cf))
* 作品一覧を画像優先のグリッド表示に変更 ([852641b](https://github.com/rmatsuo-jp/media-log/commit/852641b9bf8d4256e74b330767b63495074ce84b))
* 作品取り込みでマンガ/アニメ両方検索・日本語タイトル・人気度順並び替えに対応 ([d092918](https://github.com/rmatsuo-jp/media-log/commit/d092918f73f7199f78df03ba73c347487ef2dfdc))
* 作品取り込みに成人向け作品フィルタと巻データのAniList ID照合を追加 ([71590f4](https://github.com/rmatsuo-jp/media-log/commit/71590f496ba2c4e9ceef3499219f1d90acfe1745))
* 作品検索結果を日本語・人気度順デフォルトに、PC表示拡大とページングに対応 ([df2b395](https://github.com/rmatsuo-jp/media-log/commit/df2b3955067c7d31ccd29081907aa7107cfa292c))
* 作品詳細のUnit一覧を画像中心のグリッド表示に変更 ([fc33547](https://github.com/rmatsuo-jp/media-log/commit/fc33547361cc625fdcacc11c9285228a0039bb3f))
* 作品追加フォームを作品一覧・読みたいタブ共通のコンポーネントに切り出し ([74d62b0](https://github.com/rmatsuo-jp/media-log/commit/74d62b0b1202e8b206acc3b8b48c2d4ba02ac514))
* 作品追加を外部検索インライン表示に変更 ([a42d650](https://github.com/rmatsuo-jp/media-log/commit/a42d6508b4029fb0760545c41c4dac0b42e87457))
* 巻取り込み候補に非整数巻フィルタを追加 ([7f2d991](https://github.com/rmatsuo-jp/media-log/commit/7f2d9911d96318de33b803ed536b072e798d0595))
* 巻表紙を右クリックで代替候補に切り替え可能に ([5385fff](https://github.com/rmatsuo-jp/media-log/commit/5385fff586cec24cf5afd6550be31d6ac12a8711))
* 設定タブにバージョン情報セクションを追加、法的情報リンクを日本語化 ([99562a2](https://github.com/rmatsuo-jp/media-log/commit/99562a2ca7ff226f7df12fc4767b082598769fd7))
* 読みたいリストを作品一覧から独立したサイドバー項目に分離 ([f62880d](https://github.com/rmatsuo-jp/media-log/commit/f62880d0e1047938e4b23066a7cea7c9cb90da49))

# [0.4.0](https://github.com/rmatsuo-jp/media-log/compare/v0.3.2...v0.4.0) (2026-07-19)


### Features

* **pwa:** アプリアイコン・faviconをテーマに沿ったデザインに刷新 ([006bac8](https://github.com/rmatsuo-jp/media-log/commit/006bac871fa83da5b9bca1c2d57ee5dfac4c51cb))

## [0.3.2](https://github.com/rmatsuo-jp/media-log/compare/v0.3.1...v0.3.2) (2026-07-19)


### Bug Fixes

* apply prettier formatting to remaining unformatted files ([80e146f](https://github.com/rmatsuo-jp/media-log/commit/80e146f61e8327ce8bc28211d536cb02e4c8e407))

## [0.3.1](https://github.com/rmatsuo-jp/media-log/compare/v0.3.0...v0.3.1) (2026-07-19)


### Bug Fixes

* apply prettier formatting to unformatted files ([8db5840](https://github.com/rmatsuo-jp/media-log/commit/8db5840c837d05befb54bd80090df4406b7f719d))

# [0.3.0](https://github.com/rmatsuo-jp/media-log/compare/v0.2.0...v0.3.0) (2026-07-19)


### Features

* **works:** add manga/anime viewing-history tracking (Work/Group/Unit) ([6800990](https://github.com/rmatsuo-jp/media-log/commit/68009907914bf8dda95924b3f3e41b5b317aa325))

# [0.2.0](https://github.com/rmatsuo-jp/media-log/compare/v0.1.0...v0.2.0) (2026-07-19)


### Features

* **firebase:** wire up real media-log-7a097 project config ([5155c5c](https://github.com/rmatsuo-jp/media-log/commit/5155c5c25407187e7670c3b36de3fa03382bb98f))
