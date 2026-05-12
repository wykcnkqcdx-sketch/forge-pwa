import type { TrainingSession } from '../data/domain';

const DAY_MS = 86_400_000;

function activeDaySet(sessions: TrainingSession[]): Set<string> {
  return new Set(
    sessions
      .filter(s => s.completedAt)
      .map(s => new Date(s.completedAt!).toDateString()),
  );
}

export function getCurrentStreak(sessions: TrainingSession[]): number {
  const days = activeDaySet(sessions);
  const cursor = new Date();
  // Streak survives until midnight of the following day — check today first,
  // fall back to yesterday so a morning opens don't snap the count to 0.
  if (!days.has(cursor.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let count = 0;
  while (days.has(cursor.toDateString())) {
    count++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export function getLongestStreak(sessions: TrainingSession[]): number {
  const days = activeDaySet(sessions);
  if (days.size === 0) return 0;
  const sorted = [...days]
    .map(d => new Date(d).getTime())
    .sort((a, b) => a - b)
    .filter((t, i, arr) => i === 0 || t !== arr[i - 1]);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((sorted[i] - sorted[i - 1]) / DAY_MS);
    if (diff === 1) {
      run++;
      if (run > best) best = run;
    } else if (diff > 1) {
      run = 1;
    }
  }
  return best;
}

export function getLast7DayFlags(sessions: TrainingSession[]): boolean[] {
  const days = activeDaySet(sessions);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return days.has(d.toDateString());
  });
}

export function streakMilestoneLabel(streak: number): string | null {
  if (streak >= 90) return '90-DAY';
  if (streak >= 60) return '60-DAY';
  if (streak >= 30) return '30-DAY';
  if (streak >= 21) return '21-DAY';
  if (streak >= 14) return '14-DAY';
  if (streak >= 7)  return '7-DAY';
  if (streak >= 3)  return '3-DAY';
  return null;
}
