import { TrainingSession } from '../data/mockData';
import { colours } from '../theme';

export type ReadinessBand = 'GREEN' | 'AMBER' | 'RED';
export type LoadRisk = 'Low' | 'Moderate' | 'High';

export type PerformanceProfile = {
  readiness: number;
  readinessBand: ReadinessBand;
  readinessTone: string;
  readinessLabel: string;
  weeklyLoad: number;
  acuteLoad: number;
  chronicLoad: number;
  acuteChronicRatio: number;
  monotony: number;
  strain: number;
  averageRpe: number;
  highIntensityCount: number;
  ruckKm: number;
  ruckLoadKg: number;
  loadRisk: LoadRisk;
  riskTone: string;
  recommendation: string;
  recoveryFocus: string;
};

const dayMs = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sessionDate(session: TrainingSession) {
  const parsed = session.completedAt ? new Date(session.completedAt) : new Date(Number(session.id));
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function sessionLoad(session: TrainingSession) {
  const loadMultiplier = session.loadKg ? 1 + Math.min(0.35, session.loadKg / 100) : 1;
  return Math.round(session.durationMinutes * session.rpe * loadMultiplier);
}

function sessionsWithinDays(sessions: TrainingSession[], days: number, now = new Date()) {
  const cutoff = now.getTime() - days * dayMs;
  return sessions.filter((session) => sessionDate(session).getTime() >= cutoff);
}

function standardDeviation(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function estimateRuckKm(session: TrainingSession) {
  if (session.type !== 'Ruck') return 0;
  const titleMatch = session.title.match(/(\d+(?:\.\d+)?)\s*km/i);
  if (titleMatch) return Number(titleMatch[1]);
  return Math.max(0, Math.round((session.durationMinutes / 12) * 10) / 10);
}

export function sortSessionsByDate(sessions: TrainingSession[]) {
  return [...sessions].sort((a, b) => sessionDate(b).getTime() - sessionDate(a).getTime());
}

export function buildPerformanceProfile(sessions: TrainingSession[], now = new Date()): PerformanceProfile {
  const ordered = sortSessionsByDate(sessions);
  const recent = sessionsWithinDays(ordered, 7, now);
  const chronic = sessionsWithinDays(ordered, 28, now);
  const recentLoads = recent.map(sessionLoad);
  const weeklyLoad = recentLoads.reduce((total, load) => total + load, 0);
  const acuteLoad = Math.round(weeklyLoad / 7);
  const chronicLoad = Math.round(chronic.reduce((total, session) => total + sessionLoad(session), 0) / 28);
  const acuteChronicRatio = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : acuteLoad > 0 ? 1.5 : 0;
  const averageRpe = recent.length
    ? recent.reduce((total, session) => total + session.rpe, 0) / recent.length
    : 0;
  const highIntensityCount = recent.filter((session) => session.rpe >= 8).length;
  const dailyLoads = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - index).getTime();
    const dayEnd = dayStart + dayMs;
    return recent
      .filter((session) => {
        const time = sessionDate(session).getTime();
        return time >= dayStart && time < dayEnd;
      })
      .reduce((total, session) => total + sessionLoad(session), 0);
  });
  const dailyMean = dailyLoads.reduce((total, load) => total + load, 0) / 7;
  const dailySd = standardDeviation(dailyLoads);
  const monotony = dailySd > 0 ? Math.round((dailyMean / dailySd) * 10) / 10 : weeklyLoad > 0 ? 2.5 : 0;
  const strain = Math.round(weeklyLoad * monotony);
  const ruckSessions = recent.filter((session) => session.type === 'Ruck');
  const ruckKm = Math.round(ruckSessions.reduce((total, session) => total + estimateRuckKm(session), 0) * 10) / 10;
  const ruckLoadKg = ruckSessions.length
    ? Math.round(ruckSessions.reduce((total, session) => total + (session.loadKg ?? 0), 0) / ruckSessions.length)
    : 0;

  const loadPenalty = clamp((acuteChronicRatio - 1.25) * 28, 0, 18);
  const rpePenalty = clamp((averageRpe - 6.5) * 7, 0, 18);
  const intensityPenalty = highIntensityCount * 4;
  const monotonyPenalty = monotony > 2 ? clamp((monotony - 2) * 7, 0, 12) : 0;
  const readiness = Math.round(clamp(88 - loadPenalty - rpePenalty - intensityPenalty - monotonyPenalty + Math.min(6, recent.length), 35, 96));
  const readinessBand: ReadinessBand = readiness >= 80 ? 'GREEN' : readiness >= 62 ? 'AMBER' : 'RED';
  const readinessTone = readinessBand === 'GREEN' ? colours.green : readinessBand === 'AMBER' ? colours.amber : colours.red;
  const readinessLabel = readinessBand === 'GREEN' ? 'Train as planned' : readinessBand === 'AMBER' ? 'Control intensity' : 'Recovery priority';
  const loadRisk: LoadRisk = acuteChronicRatio >= 1.45 || highIntensityCount >= 3 || strain >= 2200
    ? 'High'
    : acuteChronicRatio >= 1.2 || averageRpe >= 7 || strain >= 1200
      ? 'Moderate'
      : 'Low';
  const riskTone = loadRisk === 'High' ? colours.red : loadRisk === 'Moderate' ? colours.amber : colours.green;
  const recommendation = loadRisk === 'High'
    ? 'Reduce impact and heavy loading for 24-48 hours; use mobility, Zone 2, and tissue care before another hard block.'
    : loadRisk === 'Moderate'
      ? 'Hold the plan but cap RPE at 7, extend warm-up, and monitor sleep, soreness, hydration, and resting heart rate.'
      : 'Progress normally; this is a good window for quality strength, ruck technique, or controlled aerobic volume.';
  const recoveryFocus = readinessBand === 'RED'
    ? 'Sleep, hydration, low-impact movement'
    : readinessBand === 'AMBER'
      ? 'Fuel around training and avoid extra volume'
      : 'Maintain routine and execute the assigned session';

  return {
    readiness,
    readinessBand,
    readinessTone,
    readinessLabel,
    weeklyLoad,
    acuteLoad,
    chronicLoad,
    acuteChronicRatio,
    monotony,
    strain,
    averageRpe,
    highIntensityCount,
    ruckKm,
    ruckLoadKg,
    loadRisk,
    riskTone,
    recommendation,
    recoveryFocus,
  };
}

export function buildWeeklyLoadSeries(sessions: TrainingSession[], now = new Date()) {
  const ordered = sortSessionsByDate(sessions);
  return Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - index)).getTime();
    const dayEnd = dayStart + dayMs;
    return ordered
      .filter((session) => {
        const time = sessionDate(session).getTime();
        return time >= dayStart && time < dayEnd;
      })
      .reduce((total, session) => total + sessionLoad(session), 0);
  });
}
