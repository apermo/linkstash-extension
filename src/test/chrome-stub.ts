import { vi } from 'vitest';

type StorageArea = chrome.storage.StorageArea;
type StorageChange = chrome.storage.StorageChange;
type ChangedListener = (
  changes: { [key: string]: StorageChange },
  areaName: chrome.storage.AreaName,
) => void;

interface FakeStorageArea extends StorageArea {
  __reset(initial?: Record<string, unknown>): void;
  __snapshot(): Record<string, unknown>;
}

interface FakeStorage {
  sync: FakeStorageArea;
  session: FakeStorageArea;
  onChanged: chrome.storage.StorageChangedEvent;
  __listeners: Set<ChangedListener>;
}

const makeArea = (
  name: chrome.storage.AreaName,
  emit: (changes: { [key: string]: StorageChange }, areaName: chrome.storage.AreaName) => void,
): FakeStorageArea => {
  let store: Record<string, unknown> = {};

  const get: StorageArea['get'] = ((keys?: unknown) => {
    if (keys == null) return Promise.resolve({ ...store });
    if (typeof keys === 'string') {
      return Promise.resolve(keys in store ? { [keys]: store[keys] } : {});
    }
    if (Array.isArray(keys)) {
      const out: Record<string, unknown> = {};
      for (const k of keys) if (k in store) out[k] = store[k];
      return Promise.resolve(out);
    }
    const out: Record<string, unknown> = { ...(keys as Record<string, unknown>) };
    for (const k of Object.keys(keys)) if (k in store) out[k] = store[k];
    return Promise.resolve(out);
  });

  const set: StorageArea['set'] = (items) => {
    const changes: { [k: string]: StorageChange } = {};
    for (const [k, v] of Object.entries(items)) {
      const oldValue = store[k];
      if (oldValue !== v) changes[k] = { oldValue, newValue: v };
      store[k] = v;
    }
    if (Object.keys(changes).length) emit(changes, name);
    return Promise.resolve();
  };

  const remove: StorageArea['remove'] = (keys) => {
    const list: string[] = Array.isArray(keys) ? (keys as string[]) : [keys as string];
    const changes: { [k: string]: StorageChange } = {};
    for (const k of list) {
      if (k in store) {
        changes[k] = { oldValue: store[k], newValue: undefined };
        delete store[k];
      }
    }
    if (Object.keys(changes).length) emit(changes, name);
    return Promise.resolve();
  };

  const clear: StorageArea['clear'] = () => {
    const changes: { [k: string]: StorageChange } = {};
    for (const k of Object.keys(store)) {
      changes[k] = { oldValue: store[k], newValue: undefined };
    }
    store = {};
    if (Object.keys(changes).length) emit(changes, name);
    return Promise.resolve();
  };

  return {
    get,
    set,
    remove,
    clear,
    getBytesInUse: () => Promise.resolve(0),
    setAccessLevel: () => Promise.resolve(),
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
      hasListeners: vi.fn(() => false),
      getRules: vi.fn(),
      addRules: vi.fn(),
      removeRules: vi.fn(),
    } as unknown as chrome.storage.StorageAreaChangedEvent,
    QUOTA_BYTES: 102_400,
    __reset(initial = {}) {
      store = { ...initial };
    },
    __snapshot() {
      return { ...store };
    },
  } as unknown as FakeStorageArea;
};

export const installChromeStub = (): FakeStorage => {
  const listeners = new Set<ChangedListener>();
  const emit = (changes: { [k: string]: StorageChange }, areaName: chrome.storage.AreaName) => {
    for (const l of listeners) l(changes, areaName);
  };
  const onChanged = {
    addListener: (fn: ChangedListener) => listeners.add(fn),
    removeListener: (fn: ChangedListener) => listeners.delete(fn),
    hasListener: (fn: ChangedListener) => listeners.has(fn),
    hasListeners: () => listeners.size > 0,
  } as unknown as chrome.storage.StorageChangedEvent;

  const fake: FakeStorage = {
    sync: makeArea('sync', emit),
    session: makeArea('session', emit),
    onChanged,
    __listeners: listeners,
  };

  vi.stubGlobal('chrome', {
    storage: fake,
    permissions: {
      contains: vi.fn(),
      request: vi.fn(),
    },
  });

  return fake;
};
