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

export type PRRecord = {
  session: TrainingSession;
  value: number;
  formattedValue: string;
};

export function getBestSessions(
  sessions: TrainingSession[],
): Partial<Record<PRType, PRRecord>> {
  const result: Partial<Record<PRType, PRRecord>> = {};

  const rucks = sessions.filter(s => s.type === 'Ruck');

  // bestRuckDistance
  if (rucks.length > 0) {
    const best = rucks.reduce((a, b) => ruckDistanceKm(a) >= ruckDistanceKm(b) ? a : b);
    const dist = ruckDistanceKm(best);
    result.bestRuckDistance = { session: best, value: dist, formattedValue: `${dist.toFixed(1)} km` };
  }

  // bestRuckLoad
  const rucksWithLoad = rucks.filter(s => s.loadKg != null);
  if (rucksWithLoad.length > 0) {
    const best = rucksWithLoad.reduce((a, b) => a.loadKg! >= b.loadKg! ? a : b);
    result.bestRuckLoad = { session: best, value: best.loadKg!, formattedValue: `${best.loadKg} kg` };
  }

  // bestRuckScore
  if (rucks.length > 0) {
    const best = rucks.reduce((a, b) => a.score >= b.score ? a : b);
    result.bestRuckScore = { session: best, value: best.score, formattedValue: String(best.score) };
  }

  // bestSessionScore (non-ruck only)
  const nonRucks = sessions.filter(s => s.type !== 'Ruck');
  if (nonRucks.length > 0) {
    const best = nonRucks.reduce((a, b) => a.score >= b.score ? a : b);
    result.bestSessionScore = { session: best, value: best.score, formattedValue: String(best.score) };
  }

  // longestSession
  if (sessions.length > 0) {
    const best = sessions.reduce((a, b) => a.durationMinutes >= b.durationMinutes ? a : b);
    const h = Math.floor(best.durationMinutes / 60);
    const m = best.durationMinutes % 60;
    result.longestSession = {
      session: best,
      value: best.durationMinutes,
      formattedValue: h > 0 ? `${h}h ${m}m` : `${m}m`,
    };
  }

  // bestRuckPace (lower is better)
  if (rucks.length > 0) {
    const best = rucks.reduce((a, b) => ruckPaceMinPerKm(a) <= ruckPaceMinPerKm(b) ? a : b);
    const pace = ruckPaceMinPerKm(best);
    if (isFinite(pace)) {
      const pMin = Math.floor(pace);
      const pSec = Math.round((pace - pMin) * 60);
      result.bestRuckPace = {
        session: best,
        value: pace,
        formattedValue: `${pMin}:${String(pSec).padStart(2, '0')} /km`,
      };
    }
  }

  return result;
}
