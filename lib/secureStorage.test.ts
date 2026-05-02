import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

// fake-indexeddb/auto must be imported before secureStorage so that
// `typeof indexedDB !== 'undefined'` is true when the module is loaded.

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    multiRemove: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('dexie', async () => {
  const actual = await vi.importActual<typeof import('dexie')>('dexie');
  return actual;
});

import {
  secureSetItem,
  secureGetItem,
  secureRemoveItem,
  secureMultiRemove,
  secureDestroyLocalData,
} from './secureStorage';

const mockAsyncStorage = AsyncStorage as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  multiRemove: ReturnType<typeof vi.fn>;
};

afterEach(async () => {
  // Tear down all IDB databases and reset module singletons for isolation
  await secureDestroyLocalData([]);
  vi.clearAllMocks();
  mockAsyncStorage.getItem.mockResolvedValue(null);
  mockAsyncStorage.setItem.mockResolvedValue(undefined);
  mockAsyncStorage.removeItem.mockResolvedValue(undefined);
  mockAsyncStorage.multiRemove.mockResolvedValue(undefined);
});

// ── Round-trip encryption ─────────────────────────────────────────────────────

describe('secureSetItem / secureGetItem', () => {
  it('stores and retrieves a string value', async () => {
    await secureSetItem('key1', 'hello world');
    expect(await secureGetItem('key1')).toBe('hello world');
  });

  it('stores and retrieves a JSON string', async () => {
    const payload = JSON.stringify({ id: 'x', score: 99 });
    await secureSetItem('key2', payload);
    expect(await secureGetItem('key2')).toBe(payload);
  });

  it('returns null for a key that was never set', async () => {
    expect(await secureGetItem('no-such-key')).toBeNull();
  });

  it('overwrites an existing entry with the new value', async () => {
    await secureSetItem('k', 'v1');
    await secureSetItem('k', 'v2');
    expect(await secureGetItem('k')).toBe('v2');
  });

  it('each key is stored independently', async () => {
    await secureSetItem('a', 'alpha');
    await secureSetItem('b', 'beta');
    expect(await secureGetItem('a')).toBe('alpha');
    expect(await secureGetItem('b')).toBe('beta');
  });
});

// ── Removal ───────────────────────────────────────────────────────────────────

describe('secureRemoveItem', () => {
  it('removes an existing key', async () => {
    await secureSetItem('del-me', 'value');
    await secureRemoveItem('del-me');
    expect(await secureGetItem('del-me')).toBeNull();
  });

  it('is a no-op when the key does not exist', async () => {
    await expect(secureRemoveItem('ghost')).resolves.toBeUndefined();
  });
});

describe('secureMultiRemove', () => {
  it('removes all listed keys', async () => {
    await secureSetItem('x', '1');
    await secureSetItem('y', '2');
    await secureSetItem('z', '3');
    await secureMultiRemove(['x', 'z']);
    expect(await secureGetItem('x')).toBeNull();
    expect(await secureGetItem('y')).toBe('3'); // untouched
    expect(await secureGetItem('z')).toBeNull();
  });

  it('handles an empty array without throwing', async () => {
    await expect(secureMultiRemove([])).resolves.toBeUndefined();
  });
});

// ── Legacy AsyncStorage migration ─────────────────────────────────────────────

describe('legacy migration', () => {
  it('reads a legacy AsyncStorage value on first get and re-encrypts it', async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce('legacy-data');

    const value = await secureGetItem('legacy-key');
    expect(value).toBe('legacy-data');
    // Plain copy must be deleted
    expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('legacy-key');
    // Re-read should now come from the encrypted store (no AsyncStorage call)
    mockAsyncStorage.getItem.mockResolvedValue(null);
    const second = await secureGetItem('legacy-key');
    expect(second).toBe('legacy-data');
  });
});

// ── Destroy ───────────────────────────────────────────────────────────────────

describe('secureDestroyLocalData', () => {
  it('makes previously-stored data unreadable after destroy', async () => {
    await secureSetItem('important', 'secret');
    await secureDestroyLocalData(['important']);
    // After destroy, databases are gone → fresh DB → key not found
    expect(await secureGetItem('important')).toBeNull();
  });

  it('clears AsyncStorage for the provided keys', async () => {
    await secureDestroyLocalData(['forge:sessions', 'forge:members']);
    expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith(['forge:sessions', 'forge:members']);
  });
});
