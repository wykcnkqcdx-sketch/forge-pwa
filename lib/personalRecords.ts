import type { TrainingSession } from '../data/domain';

export type PRType =
  | 'bestRuckDistance'
  | 'bestRuckLoad'
  | 'bestRuckScore'
  | 'bestSessionScore'
  | 'longestSession'
  | 'bestRuckPace';

export const PR_META: Record<PRType, { label: string; icon: string }> = {
  bestRuckDistance: { label: 'Furthest Ruck',   icon: 'footsteps-outline' },
  bestRuckLoad:     { label: 'Heaviest Load',   icon: 'barbell-outline' },
  bestRuckScore:    { label: 'Best Ruck Score', icon: 'trophy-outline' },
  bestSessionScore: { label: 'Best Score',      icon: 'trophy-outline' },
  longestSession:   { label: 'Longest Session', icon: 'time-outline' },
  bestRuckPace:     { label: 'Fastest Pace',    icon: 'speedometer-outline' },
};

function ruckDistanceKm(s: TrainingSession): number {
  return s.ruckMission?.targetDistanceKm ?? (s.durationMinutes / 60) * 5.2;
}

function ruckPaceMinPerKm(s: TrainingSession): number {
  const dist = ruckDistanceKm(s);
  if (dist <= 0) return Infinity;
  const minutes = s.ruckMission
    ? s.ruckMission.targetMinutes
    : s.durationMinutes;
  return minutes / dist;
}

export function getSessionPRTypes(
  session: TrainingSession,
  allSessions: TrainingSession[],
): PRType[] {
  const others = allSessions.filter(s => s.id !== session.id);
  const prs: PRType[] = [];

  if (session.type === 'Ruck') {
    const dist = ruckDistanceKm(session);
    const maxOtherDist = Math.max(0, ...others.filter(s => s.type === 'Ruck').map(ruckDistanceKm));
    if (dist > maxOtherDist) prs.push('bestRuckDistance');

    if (session.loadKg != null) {
      const maxOtherLoad = Math.max(0, ...others.filter(s => s.type === 'Ruck' && s.loadKg != null).map(s => s.loadKg!));
      if (session.loadKg > maxOtherLoad) prs.push('bestRuckLoad');
    }

    const maxOtherRuckScore = Math.max(0, ...others.filter(s => s.type === 'Ruck').map(s => s.score));
    if (session.score > maxOtherRuckScore) {
      prs.push('bestRuckScore');
    }

    const pace = ruckPaceMinPerKm(session);
    const minOtherPace = Math.min(Infinity, ...others.filter(s => s.type === 'Ruck').map(ruckPaceMinPerKm));
    if (pace < minOtherPace) prs.push('bestRuckPace');
  } else {
    const maxOtherScore = Math.max(0, ...others.map(s => s.score));
    if (session.score > maxOtherScore) prs.push('bestSessionScore');
  }

  const maxOtherDuration = Math.max(0, ...others.map(s => s.durationMinutes));
  if (session.durationMinutes > maxOtherDuration) prs.push('longestSession');

  return prs;
}

export function getPRSessionIds(sessions: TrainingSession[]): Set<string> {
  const ids = new Set<string>();
  for (const s of sessions) {
    if (getSessionPRTypes(s, sessions).length > 0) ids.add(s.id);
  }
  return ids;
}
