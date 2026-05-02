import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useToast', () => {
  it('starts with empty toastMessage', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toastMessage).toBe('');
  });

  it('sets toastMessage when showToast is called', () => {
    const { result } = renderHook(() => useToast());
    act(() => { result.current.showToast('Saved successfully'); });
    expect(result.current.toastMessage).toBe('Saved successfully');
  });

  it('clears toastMessage after the dismiss animation completes', () => {
    const { result } = renderHook(() => useToast());
    act(() => { result.current.showToast('Test message'); });
    expect(result.current.toastMessage).toBe('Test message');
    // Advance past the 3200ms display window and the 180ms fade-out
    act(() => { vi.advanceTimersByTime(3200 + 200); });
    expect(result.current.toastMessage).toBe('');
  });

  it('replaces an existing toast when showToast is called again', () => {
    const { result } = renderHook(() => useToast());
    act(() => { result.current.showToast('First message'); });
    act(() => { result.current.showToast('Second message'); });
    expect(result.current.toastMessage).toBe('Second message');
  });

  it('resets the dismiss timer when a new toast replaces the current one', () => {
    const { result } = renderHook(() => useToast());
    act(() => { result.current.showToast('First message'); });
    // Advance almost to dismiss
    act(() => { vi.advanceTimersByTime(3000); });
    // Replace with new toast — timer should reset
    act(() => { result.current.showToast('Second message'); });
    // Old timer would have fired by now but new toast should still be visible
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.toastMessage).toBe('Second message');
  });
});
