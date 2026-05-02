import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useLocalStore } from './useLocalStore';
import * as secureStorage from '../lib/secureStorage';

vi.mock('../lib/secureStorage', () => ({
  secureGetItem: vi.fn().mockResolvedValue(null),
  secureSetItem: vi.fn().mockResolvedValue(undefined),
  secureRemoveItem: vi.fn().mockResolvedValue(undefined),
  secureMultiRemove: vi.fn().mockResolvedValue(undefined),
  secureDestroyLocalData: vi.fn().mockResolvedValue(undefined),
}));

const mockGet = secureStorage.secureGetItem as ReturnType<typeof vi.fn>;
const mockSet = secureStorage.secureSetItem as ReturnType<typeof vi.fn>;
const mockRemove = secureStorage.secureRemoveItem as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue(null);
  mockSet.mockResolvedValue(undefined);
  mockRemove.mockResolvedValue(undefined);
});

// ── Initial load ──────────────────────────────────────────────────────────────

describe('initial data load', () => {
  it('sets isReady after loading', async () => {
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
  });

  it('loads sessions from storage on mount', async () => {
    const stored = [{ id: 's1', type: 'Strength', title: 'Leg Day', score: 80, durationMinutes: 45, rpe: 7 }];
    mockGet.mockImplementation((key: string) =>
      key === 'forge:sessions' ? Promise.resolve(JSON.stringify(stored)) : Promise.resolve(null)
    );
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.sessions).toEqual(stored);
  });

  it('loads pin from storage on mount', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'forge:pin' ? Promise.resolve('5678') : Promise.resolve(null)
    );
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.savedPin).toBe('5678');
  });

  it('keeps default data when storage has nothing', async () => {
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    // initialSessions and squadMembers are non-empty from mockData
    expect(result.current.sessions.length).toBeGreaterThan(0);
    expect(result.current.members.length).toBeGreaterThan(0);
  });
});

// ── Corrupted data handling ───────────────────────────────────────────────────

describe('corrupted storage values', () => {
  it('falls back to defaults when sessions JSON is malformed', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'forge:sessions' ? Promise.resolve('{ not valid json }}') : Promise.resolve(null)
    );
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    // Falls back to initialSessions, does not throw
    expect(result.current.sessions.length).toBeGreaterThan(0);
  });

  it('loads remaining keys even when one key is corrupted', async () => {
    const storedPin = '9999';
    mockGet.mockImplementation((key: string) => {
      if (key === 'forge:sessions') return Promise.resolve('{{bad}}');
      if (key === 'forge:pin') return Promise.resolve(storedPin);
      return Promise.resolve(null);
    });
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    // Pin still loaded despite sessions being corrupted
    expect(result.current.savedPin).toBe(storedPin);
  });
});

// ── Persistence ───────────────────────────────────────────────────────────────

describe('persistence on change', () => {
  it('persists sessions when they change after ready', async () => {
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    const newSession = { id: 'new-1', type: 'Ruck' as const, title: 'Morning Ruck', score: 90, durationMinutes: 60, rpe: 6 };
    act(() => { result.current.setSessions([newSession]); });
    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith('forge:sessions', JSON.stringify([newSession]));
    });
  });

  it('persists members when they change', async () => {
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => { result.current.setMembers([]); });
    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith('forge:members', JSON.stringify([]));
    });
  });

  it('removes forge:pin when savedPin is set to null', async () => {
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => { result.current.setSavedPin(null); });
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalledWith('forge:pin');
    });
  });

  it('persists pin string when savedPin changes', async () => {
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => { result.current.setSavedPin('4321'); });
    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith('forge:pin', '4321');
    });
  });

  it('does NOT persist before isReady', async () => {
    // mockGet never resolves so isReady stays false
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLocalStore());
    // isReady is false — no persist calls expected
    expect(result.current.isReady).toBe(false);
    expect(mockSet).not.toHaveBeenCalled();
  });
});

// ── Google Sheets endpoint ────────────────────────────────────────────────────

describe('googleSheetsEndpoint', () => {
  it('loads endpoint from storage', async () => {
    mockGet.mockImplementation((key: string) =>
      key === 'forge:google_sheets_endpoint' ? Promise.resolve('https://script.google.com/test') : Promise.resolve(null)
    );
    const { result } = renderHook(() => useLocalStore());
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.googleSheetsEndpoint).toBe('https://script.google.com/test');
  });
});
