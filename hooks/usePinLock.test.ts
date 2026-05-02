import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Alert } from 'react-native';
import { usePinLock } from './usePinLock';

const makeProps = (overrides: Partial<Parameters<typeof usePinLock>[0]> = {}) => ({
  savedPin: null,
  setSavedPin: vi.fn(),
  isReady: true,
  onWipe: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── PIN setup validation ──────────────────────────────────────────────────────

describe('savePinSetup', () => {
  it('rejects pins shorter than 4 digits', () => {
    const { result } = renderHook(() => usePinLock(makeProps()));
    act(() => { result.current.openPinSetup(); });
    act(() => { result.current.setNewPinInput('123'); result.current.setConfirmPinInput('123'); });
    act(() => { result.current.savePinSetup(); });
    expect(result.current.pinSetupError).toBe('PIN must be 4 to 8 digits.');
  });

  it('rejects pins longer than 8 digits', () => {
    const { result } = renderHook(() => usePinLock(makeProps()));
    act(() => { result.current.openPinSetup(); });
    act(() => { result.current.setNewPinInput('123456789'); result.current.setConfirmPinInput('123456789'); });
    act(() => { result.current.savePinSetup(); });
    expect(result.current.pinSetupError).toBe('PIN must be 4 to 8 digits.');
  });

  it('rejects non-numeric pins', () => {
    const { result } = renderHook(() => usePinLock(makeProps()));
    act(() => { result.current.openPinSetup(); });
    act(() => { result.current.setNewPinInput('abcd'); result.current.setConfirmPinInput('abcd'); });
    act(() => { result.current.savePinSetup(); });
    expect(result.current.pinSetupError).toBe('PIN must be 4 to 8 digits.');
  });

  it('rejects 0000 — reserved for duress wipe', () => {
    const { result } = renderHook(() => usePinLock(makeProps()));
    act(() => { result.current.openPinSetup(); });
    act(() => { result.current.setNewPinInput('0000'); result.current.setConfirmPinInput('0000'); });
    act(() => { result.current.savePinSetup(); });
    expect(result.current.pinSetupError).toBe('0000 is reserved for duress wipe.');
  });

  it('rejects mismatched confirm pin', () => {
    const { result } = renderHook(() => usePinLock(makeProps()));
    act(() => { result.current.openPinSetup(); });
    act(() => { result.current.setNewPinInput('1234'); result.current.setConfirmPinInput('5678'); });
    act(() => { result.current.savePinSetup(); });
    expect(result.current.pinSetupError).toBe('PIN entries do not match.');
  });

  it('saves a valid pin and locks the app', () => {
    const setSavedPin = vi.fn();
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: null, setSavedPin })));
    act(() => { result.current.openPinSetup(); });
    act(() => { result.current.setNewPinInput('5678'); result.current.setConfirmPinInput('5678'); });
    act(() => { result.current.savePinSetup(); });
    expect(setSavedPin).toHaveBeenCalledWith('5678');
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.pinSetupMode).toBeNull();
  });

  it('accepts 8-digit pin', () => {
    const setSavedPin = vi.fn();
    const { result } = renderHook(() => usePinLock(makeProps({ setSavedPin })));
    act(() => { result.current.openPinSetup(); });
    act(() => { result.current.setNewPinInput('12345678'); result.current.setConfirmPinInput('12345678'); });
    act(() => { result.current.savePinSetup(); });
    expect(setSavedPin).toHaveBeenCalledWith('12345678');
  });
});

// ── PIN input (lock screen) ───────────────────────────────────────────────────

describe('handlePinInput', () => {
  it('unlocks on correct PIN entry', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: '1234' })));
    act(() => { result.current.handlePinInput('1234'); });
    expect(result.current.isUnlocked).toBe(true);
    expect(result.current.pinInput).toBe('');
  });

  it('sets pinError on wrong PIN and clears input after delay', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: '1234' })));
    act(() => { result.current.handlePinInput('9999'); });
    expect(result.current.pinError).toBe(true);
    act(() => { vi.advanceTimersByTime(300); });
    expect(result.current.pinInput).toBe('');
  });

  it('does not trigger when input is shorter than pin length', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: '1234' })));
    act(() => { result.current.handlePinInput('12'); });
    expect(result.current.isUnlocked).toBe(false);
    expect(result.current.pinError).toBe(false);
  });
});

// ── Duress wipe ───────────────────────────────────────────────────────────────

describe('duress wipe', () => {
  it('calls onWipe when 0000 entered at lock screen', async () => {
    const onWipe = vi.fn().mockResolvedValue(undefined);
    const setSavedPin = vi.fn();
    const { result } = renderHook(() =>
      usePinLock(makeProps({ savedPin: '1234', setSavedPin, onWipe }))
    );
    await act(async () => { result.current.handlePinInput('0000'); });
    expect(onWipe).toHaveBeenCalledOnce();
    expect(setSavedPin).toHaveBeenCalledWith(null);
    expect(result.current.isUnlocked).toBe(true);
  });

  it('calls onWipe from handleManualWipe when confirmed (web)', async () => {
    const onWipe = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePinLock(makeProps({ onWipe })));
    await act(async () => { result.current.handleManualWipe(); });
    expect(onWipe).toHaveBeenCalledOnce();
  });

  it('does NOT call onWipe when confirm is cancelled (web)', async () => {
    const onWipe = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { result } = renderHook(() => usePinLock(makeProps({ onWipe })));
    await act(async () => { result.current.handleManualWipe(); });
    expect(onWipe).not.toHaveBeenCalled();
  });
});

// ── Auto-unlock ───────────────────────────────────────────────────────────────

describe('auto-unlock', () => {
  it('is unlocked immediately when no pin is set and app is ready', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: null, isReady: true })));
    expect(result.current.isUnlocked).toBe(true);
  });

  it('is NOT auto-unlocked when a pin is set', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: '1234', isReady: true })));
    expect(result.current.isUnlocked).toBe(false);
  });
});

// ── Setup modal state ─────────────────────────────────────────────────────────

describe('pin setup modal', () => {
  it('openPinSetup sets mode to "set" when no pin exists', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: null })));
    act(() => { result.current.openPinSetup(); });
    expect(result.current.pinSetupMode).toBe('set');
  });

  it('openPinSetup sets mode to "change" when pin already exists', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: '1234' })));
    act(() => { result.current.openPinSetup(); });
    expect(result.current.pinSetupMode).toBe('change');
  });

  it('closePinSetup clears all setup state', () => {
    const { result } = renderHook(() => usePinLock(makeProps()));
    act(() => { result.current.openPinSetup(); result.current.setNewPinInput('1234'); });
    act(() => { result.current.closePinSetup(); });
    expect(result.current.pinSetupMode).toBeNull();
    expect(result.current.newPinInput).toBe('');
    expect(result.current.confirmPinInput).toBe('');
    expect(result.current.pinSetupError).toBe('');
  });
});

// ── Inactivity timer ──────────────────────────────────────────────────────────

describe('inactivity timer', () => {
  it('locks the app after 3 minutes of inactivity', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: '1234' })));
    // Simulate unlock
    act(() => { result.current.handlePinInput('1234'); });
    expect(result.current.isUnlocked).toBe(true);
    act(() => { result.current.resetInactivityTimer(); });
    act(() => { vi.advanceTimersByTime(3 * 60 * 1000); });
    expect(result.current.isUnlocked).toBe(false);
  });

  it('resets the inactivity timer when resetInactivityTimer is called', () => {
    const { result } = renderHook(() => usePinLock(makeProps({ savedPin: '1234' })));
    act(() => { result.current.handlePinInput('1234'); });
    act(() => { result.current.resetInactivityTimer(); });
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); }); // 2 min - not yet
    expect(result.current.isUnlocked).toBe(true);
    act(() => { result.current.resetInactivityTimer(); }); // reset the clock
    act(() => { vi.advanceTimersByTime(2 * 60 * 1000); }); // 2 more min - still not
    expect(result.current.isUnlocked).toBe(true);
    act(() => { vi.advanceTimersByTime(60 * 1000 + 100); }); // over 3 min from last reset
    expect(result.current.isUnlocked).toBe(false);
  });
});
