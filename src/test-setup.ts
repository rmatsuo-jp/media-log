/**
 * @file ユニットテスト実行前に読み込まれるグローバルセットアップ。
 * jsdomにはwindow.matchMediaが実装されていないため、app.ts等のデスクトップ判定コードが
 * 動くようにダミー実装を補う。jsdomはResizeObserverも未実装のため、app.tsのbottom-nav高さ
 * 監視処理が動くようにダミー実装を補う。
 */
import 'fake-indexeddb/auto';

if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
