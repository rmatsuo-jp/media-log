# 外部API連携（AniList / MangaDex）の関係性

作品取り込み機能（[work-import.ts](../src/app/features/works/work-import/work-import.ts)）が利用する
外部API 2種の役割分担と依存関係をまとめる。

## 役割分担

- **AniList**（[anilist-api.service.ts](../src/app/core/external-media/anilist-api.service.ts)）
  - 作品検索全般（マンガ・アニメ両方、`mediaType: 'both'` 可）を担当
  - アニメの場合は話数候補もAniListだけで取得（`getAnimeEpisodes`）
- **MangaDex**（[mangadex-api.service.ts](../src/app/core/external-media/mangadex-api.service.ts)）
  - マンガの**巻単位の候補**（表紙イラスト付き）取得専用
  - AniListは作品検索はできても「巻ごとの表紙画像」を持っていないため、巻候補が必要な場面でのみ登場

## 依存関係（マンガ選択時のみ）

`work-import.ts` の `selectWork()` を見ると、マンガを選んだ場合は次の流れになる。

1. AniListの検索結果から得た `result.title` を使って
2. **MangaDex側でタイトル文字列を再検索**（`mangadex.searchManga(result.title)`）
3. マッチした先頭候補のIDで `mangadex.getVolumes(...)` を呼び、巻候補を取得

つまり「独立した2つのAPI」ではあるものの、マンガの巻取り込みフローでは
**AniListの検索結果（タイトル文字列）をMangaDex検索の入力として使う一方向の連携**がある。
IDでの直接紐付けではなくタイトル文字列でのゆるいマッチングのため、
同名異作品などで取り違えるリスクは残る設計になっている。

アニメの場合はMangaDexを一切呼ばず、AniList単体で完結する。
