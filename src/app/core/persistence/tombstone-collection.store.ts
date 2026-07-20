/**
 * @file tombstone方式（deleted論理削除）でlocalStorageに永続化するコレクションのsignalベース実装。
 * media-store.service.ts / achievements-store.service.ts が、この上に薄いラッパーとして構築される。
 * 別タブによるlocalStorage変更はstorageイベントで検知し、signalを再読込して追随する。
 */
import { computed, signal, Signal } from '@angular/core';
import { readJson, writeJson } from '@shared/utils/local-storage.util';

export interface TombstoneEntity {
  id: string;
  deleted?: boolean;
}

export interface TombstoneCollectionStore<T extends TombstoneEntity> {
  // tombstoneを含む全件（Firestore同期がローカル/クラウドの突き合わせに使う）。
  readonly all: Signal<T[]>;
  // 削除済みを除外したビュー（表示・集計はこちらを基準にする）。
  readonly visible: Signal<T[]>;
  persist(items: T[]): void;
  save(item: T): void;
  softDelete(id: string): void;
}

export function createTombstoneCollectionStore<T extends TombstoneEntity>(
  storageKey: string,
  onStorageFull: () => void,
): TombstoneCollectionStore<T> {
  const all = signal<T[]>(readJson<T[]>(storageKey, []));
  const visible = computed(() => all().filter((v) => !v.deleted));

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) all.set(readJson<T[]>(storageKey, []));
  });

  function persist(items: T[]): void {
    if (!writeJson(storageKey, items)) onStorageFull();
    all.set(items);
  }

  function save(item: T): void {
    const existing = all();
    const idx = existing.findIndex((v) => v.id === item.id);
    persist(idx >= 0 ? existing.map((v) => (v.id === item.id ? item : v)) : [item, ...existing]);
  }

  function softDelete(id: string): void {
    persist(all().map((v) => (v.id === id ? { ...v, deleted: true } : v)));
  }

  return { all, visible, persist, save, softDelete };
}
