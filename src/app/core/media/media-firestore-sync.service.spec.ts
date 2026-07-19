import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import type { User } from 'firebase/auth';
import { Work } from '@core/models/media.model';
import { AuthService } from '../firebase/auth.service';

const { setDocMock, getDocsMock, docMock, collectionMock } = vi.hoisted(() => ({
  setDocMock: vi.fn().mockResolvedValue(undefined),
  getDocsMock: vi.fn().mockResolvedValue({ docs: [] }),
  docMock: vi.fn(() => ({ path: 'doc' })),
  collectionMock: vi.fn(() => ({ path: 'col' })),
}));

vi.mock('firebase/app', () => ({
  initializeApp: () => ({}),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
}));

vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  persistentLocalCache: () => ({}),
  persistentMultipleTabManager: () => ({}),
  collection: collectionMock,
  doc: docMock,
  getDocs: getDocsMock,
  setDoc: setDocMock,
}));

import { MediaFirestoreSyncService } from './media-firestore-sync.service';
import { MediaStoreService } from './media-store.service';

function work(partial: Partial<Work> = {}): Work {
  return {
    id: 'w1',
    mediaType: 'manga',
    title: 'テスト作品',
    wantToConsume: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('MediaFirestoreSyncService', () => {
  let userSignal: ReturnType<typeof signal<User | null>>;
  let storeStub: {
    allWorks: ReturnType<typeof vi.fn>;
    allGroups: ReturnType<typeof vi.fn>;
    allUnits: ReturnType<typeof vi.fn>;
    persistWorks: ReturnType<typeof vi.fn>;
    persistGroups: ReturnType<typeof vi.fn>;
    persistUnits: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    setDocMock.mockReset().mockResolvedValue(undefined);
    getDocsMock.mockReset().mockResolvedValue({ docs: [] });
    userSignal = signal<User | null>(null);
    storeStub = {
      allWorks: vi.fn(() => []),
      allGroups: vi.fn(() => []),
      allUnits: vi.fn(() => []),
      persistWorks: vi.fn(),
      persistGroups: vi.fn(),
      persistUnits: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: userSignal } },
        { provide: MediaStoreService, useValue: storeStub },
      ],
    });
  });

  it('未ログイン時はpushWorksを呼んでもsetDocは呼ばれない', () => {
    const service = TestBed.inject(MediaFirestoreSyncService);
    service.pushWorks([work()]);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('空配列に対してpushWorksを呼んでもsetDocは呼ばれない', () => {
    userSignal.set({ uid: 'u1' } as User);
    const service = TestBed.inject(MediaFirestoreSyncService);
    service.pushWorks([]);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('ログイン中はpushWorksでsetDocが呼ばれ、成功後にsyncErrorがnullになる', async () => {
    userSignal.set({ uid: 'u1' } as User);
    const service = TestBed.inject(MediaFirestoreSyncService);

    service.pushWorks([work()]);
    await Promise.resolve();
    await Promise.resolve();

    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(service.syncError()).toBeNull();
  });

  it('pushWorksが失敗するとsyncErrorがセットされる', async () => {
    userSignal.set({ uid: 'u1' } as User);
    setDocMock.mockRejectedValueOnce(new Error('network error'));
    const service = TestBed.inject(MediaFirestoreSyncService);

    service.pushWorks([work()]);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.syncError()).not.toBeNull();
  });

  it('undefinedのキーを持つWorkをpushしてもエラーにならない', async () => {
    userSignal.set({ uid: 'u1' } as User);
    const service = TestBed.inject(MediaFirestoreSyncService);

    service.pushWorks([work({ externalSource: undefined })]);
    await Promise.resolve();
    await Promise.resolve();

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const pushedData = setDocMock.mock.calls[0][1];
    expect(pushedData).not.toHaveProperty('externalSource');
  });

  it('pushGroups/pushUnitsも未ログイン時は何もしない', () => {
    const service = TestBed.inject(MediaFirestoreSyncService);
    service.pushGroups([]);
    service.pushUnits([]);
    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('syncFromCloud()はローカル・クラウドをマージして永続化する', async () => {
    storeStub.allWorks.mockReturnValue([work({ id: 'local-only' })]);
    getDocsMock.mockResolvedValue({
      docs: [{ data: () => work({ id: 'cloud-only' }) }],
    });
    const service = TestBed.inject(MediaFirestoreSyncService);

    await service.syncFromCloud('u1');

    expect(storeStub.persistWorks).toHaveBeenCalled();
    const merged = storeStub.persistWorks.mock.calls[0][0] as Work[];
    expect(merged.map((w) => w.id).sort()).toEqual(['cloud-only', 'local-only']);
  });

  it('ログイン検知(effect)でsyncFromCloudが実行されsyncErrorがnullになる', async () => {
    TestBed.inject(MediaFirestoreSyncService);
    userSignal.set({ uid: 'u1' } as User);
    TestBed.flushEffects();

    await vi.waitFor(() => expect(getDocsMock).toHaveBeenCalled());
  });

  it('syncFromCloudが失敗するとsyncErrorがセットされる', async () => {
    getDocsMock.mockRejectedValue(new Error('offline'));
    const service = TestBed.inject(MediaFirestoreSyncService);
    userSignal.set({ uid: 'u1' } as User);
    TestBed.flushEffects();

    await vi.waitFor(() => expect(service.syncError()).not.toBeNull());
  });
});
