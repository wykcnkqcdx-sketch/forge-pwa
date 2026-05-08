import { describe, expect, it } from 'vitest';
import { addDaysToDateKey, getDateKey, isSameLocalDate, toLocalDateKey } from './date';

describe('date helpers', () => {
  it('formats a local YYYY-MM-DD key', () => {
    expect(toLocalDateKey(new Date(2026, 4, 8, 23, 30))).toBe('2026-05-08');
  });

  it('adds days without relying on UTC conversion', () => {
    expect(addDaysToDateKey('2026-05-08', 1)).toBe('2026-05-09');
    expect(addDaysToDateKey('2026-05-01', -1)).toBe('2026-04-30');
  });

  it('returns null for malformed dates', () => {
    expect(getDateKey('not-a-date')).toBeNull();
    expect(isSameLocalDate('not-a-date', '2026-05-08')).toBe(false);
  });

  it('matches stored date-only strings before parsing', () => {
    expect(isSameLocalDate('2026-05-08T12:00:00.000Z', '2026-05-08')).toBe(true);
  });
});
