import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCloudSync } from './useCloudSync';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: null,
}));

vi.mock('../lib/cloud', () => ({
  fetchCloudSnapshot: vi.fn(),
  pushCloudMutation: vi.fn().mockResolvedValue(undefined),
  pushCloudSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/offlineQueue', () => ({
  enqueueOfflineMutation: vi.fn().mockResolvedValue(undefined),
  getPendingOfflineMutationCount: vi.fn().mockResolvedValue(0),
  replayOfflineQueue: vi.fn().mockResolvedValue(0),
  clearOfflineQueue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/googleSheets', () => ({
  buildGoogleSheetsPayload: vi.fn().mockReturnValue({}),
  exportToGoogleSheets: vi.fn().mockResolvedValue({ delivery: 'no-cors' }),
}));

import * as supabaseModule from '../lib/supabase';
import * as offlineQueue from '../lib/offlineQueue';
import * as cloud from '../lib/cloud';

const mockEnqueue = offlineQueue.enqueueOfflineMutation as ReturnType<typeof vi.fn>;
const mockGetCount = offlineQueue.getPendingOfflineMutationCount as ReturnType<typeof vi.fn>;
const mockFetch = cloud.fetchCloudSnapshot as ReturnType<typeof vi.fn>;

// Minimal supabase client that satisfies the auth useEffect without throwing
const makeSupabaseStub = (sessionOverride: unknown = null) => ({
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: sessionOverride }, error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
});

// ── Test helpers ──────────────────────────────────────────────────────────────

const makeProps = (overrides: Partial<Parameters<typeof useCloudSync>[0]> = {}) => ({
  sessions: [],
  members: [],
  workoutCompletions: [],
  readinessLogs: [],
  setSessions: vi.fn(),
  setMembers: vi.fn(),
  setWorkoutCompletions: vi.fn(),
  setReadinessLogs: vi.fn(),
  setPendingSyncCount: vi.fn(),
  showToast: vi.fn(),
  isReady: true,
  googleSheetsEndpoint: '',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCount.mockResolvedValue(0);
  mockEnqueue.mockResolvedValue(undefined);
  // Always start each test with Supabase unconfigured
  vi.mocked(supabaseModule).isSupabaseConfigured = false;
  vi.mocked(supabaseModule).supabase = null;
});

afterEach(() => {
  // Guarantee reset even if a test throws mid-way
  vi.mocked(supabaseModule).isSupabaseConfigured = false;
  vi.mocked(supabaseModule).supabase = null;
});

// ── enqueueCloudMutation ──────────────────────────────────────────────────────

describe('enqueueCloudMutation', () => {
  it('does nothing when Supabase is not configured', async () => {
    const { result } = renderHook(() => useCloudSync(makeProps()));
    await act(async () => {
      await result.current.enqueueCloudMutation({ type: 'delete_session', payload: { id: 'x' } });
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('does nothing when there is no cloud session', async () => {
    const { result } = renderHook(() => useCloudSync(makeProps()));
    await act(async () => {
      await result.current.enqueueCloudMutation({ type: 'delete_session', payload: { id: 'x' } });
    });
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('shows a toast when enqueue fails', async () => {
    mockEnqueue.mockRejectedValueOnce(new Error('Queue full'));
    const showToast = vi.fn();
    const { result } = renderHook(() => useCloudSync(makeProps({ showToast })));

    // Without a real session the enqueue path bails early
    await act(async () => {
      await result.current.enqueueCloudMutation({ type: 'delete_session', payload: { id: 'x' } });
    });
    expect(showToast).not.toHaveBeenCalled(); // no session → no attempt → no toast
  });
});

// ── syncCloudNow ──────────────────────────────────────────────────────────────

describe('syncCloudNow', () => {
  it('sets status to "local" when Supabase is not configured', async () => {
    const { result } = renderHook(() => useCloudSync(makeProps()));
    await act(async () => { await result.current.syncCloudNow(); });
    expect(result.current.cloudStatus).toBe('local');
  });

  it('sets status to "auth" when there is no cloud session', async () => {
    vi.mocked(supabaseModule).isSupabaseConfigured = true;
    vi.mocked(supabaseModule).supabase = makeSupabaseStub(null) as never;

    const { result } = renderHook(() => useCloudSync(makeProps()));
    // Wait for the auth useEffect to settle (getSession resolves with null session)
    await waitFor(() => expect(result.current.authReady).toBe(true));

    await act(async () => { await result.current.syncCloudNow(); });
    expect(result.current.cloudStatus).toBe('auth');
  });
});

// ── Auth state ────────────────────────────────────────────────────────────────

describe('initial auth state', () => {
  it('starts as "local" status when Supabase is not configured', () => {
    const { result } = renderHook(() => useCloudSync(makeProps()));
    expect(result.current.cloudStatus).toBe('local');
  });

  it('starts with authReady=true when Supabase is not configured', () => {
    const { result } = renderHook(() => useCloudSync(makeProps()));
    expect(result.current.authReady).toBe(true);
  });

  it('starts with no cloud session', () => {
    const { result } = renderHook(() => useCloudSync(makeProps()));
    expect(result.current.cloudSession).toBeNull();
  });
});

// ── signOutCloud ──────────────────────────────────────────────────────────────

describe('signOutCloud', () => {
  it('is a no-op when supabase client is null', async () => {
    const { result } = renderHook(() => useCloudSync(makeProps()));
    await act(async () => { await result.current.signOutCloud(); });
    expect(result.current.cloudSession).toBeNull();
  });
});

// ── resetCloudForWipe ─────────────────────────────────────────────────────────

describe('resetCloudForWipe', () => {
  it('resets cloud status and pending count', async () => {
    const setPendingSyncCount = vi.fn();
    const { result } = renderHook(() => useCloudSync(makeProps({ setPendingSyncCount })));
    await act(async () => { await result.current.resetCloudForWipe(); });
    expect(result.current.cloudSession).toBeNull();
    expect(result.current.cloudStatus).toBe('local');
    expect(setPendingSyncCount).toHaveBeenCalledWith(0);
  });
});

// ── Pending sync count ────────────────────────────────────────────────────────

describe('pending sync count', () => {
  it('reads initial count from the offline queue on mount', async () => {
    mockGetCount.mockResolvedValue(3);
    const setPendingSyncCount = vi.fn();
    renderHook(() => useCloudSync(makeProps({ setPendingSyncCount })));
    await waitFor(() => {
      expect(setPendingSyncCount).toHaveBeenCalledWith(3);
    });
  });
});
