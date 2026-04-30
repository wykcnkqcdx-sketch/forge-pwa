import { TrainingSession, ReadinessLog } from '../data/domain';
import { buildPerformanceProfile } from './performance';

export type H2FDomain = {
  id: 'physical' | 'sleep' | 'nutrition' | 'mental';
  label: string;
  icon: string;
  value: string;
  score: number;
  status: 'GREEN' | 'AMBER' | 'RED';
  detail: string;
  hasData: boolean;
  actionLabel?: string;
};

export type RuckInputs = {
  bodyMassKg: number;
  loadKg: number;
  speedKph: number;
  gradePercent: number;
  terrainFactor: number;
};

export type RuckEstimate = {
  watts: number;
  wattsCorrected: number;
  metabolicCostKcalHour: number;
  loadedKm: number;
  loadRatio: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function buildH2FDomains(sessions: TrainingSession[], latestReadiness?: ReadinessLog): H2FDomain[] {
  const profile = buildPerformanceProfile(sessions);

  // Physical — derived from real training data
  const physicalScore = clamp(
    Math.round((profile.readiness + Math.min(100, profile.weeklyLoad / 12)) / 2),
    35, 96,
  );

  // Sleep — real data from daily check-in; falls back to honest empty state
  const hasSleepData = latestReadiness?.sleepHours !== undefined;
  const sleepHours = latestReadiness?.sleepHours ?? 0;
  const sleepQuality = latestReadiness?.sleepQuality ?? 3;
  const sleepScore = hasSleepData
    ? clamp(Math.round(sleepHours * 8.5 + (sleepQuality - 1) * 4), 35, 96)
    : 0;
  const sleepStatus: 'GREEN' | 'AMBER' | 'RED' = !hasSleepData ? 'AMBER'
    : sleepHours >= 7 && sleepQuality >= 4 ? 'GREEN'
    : sleepHours >= 6 || sleepQuality >= 3 ? 'AMBER'
    : 'RED';
  const sleepDetail = hasSleepData
    ? latestReadiness?.hydration === 'Poor' ? 'Hydration flagged — address before training'
      : (latestReadiness?.soreness ?? 0) >= 4 ? 'High soreness — monitor recovery'
      : 'Sleep on target'
    : 'Submit daily check-in to track';

  // Mental — real mood/stress from check-in
  const hasMoodData = latestReadiness?.mood !== undefined;
  const mood = latestReadiness?.mood ?? 3;
  const stress = latestReadiness?.stress ?? 3;
  const mentalStatus: 'GREEN' | 'AMBER' | 'RED' = !hasMoodData ? 'AMBER'
    : mood >= 4 && stress <= 2 ? 'GREEN'
    : mood >= 3 ? 'AMBER'
    : 'RED';
  const mentalDetail = hasMoodData
    ? stress >= 4 ? 'High stress — use downshift block before hard work'
      : mood >= 4 ? 'Positive state — execute as planned'
      : 'Monitor mood — cap intensity if flagging'
    : 'Submit daily check-in to track';

  return [
    {
      id: 'physical',
      label: 'Physical',
      icon: 'barbell-outline',
      value: `Readiness ${physicalScore}`,
      score: physicalScore,
      status: physicalScore >= 80 ? 'GREEN' : physicalScore >= 62 ? 'AMBER' : 'RED',
      detail: `ACWR ${profile.acuteChronicRatio} · ${profile.weeklyLoad} AU`,
      hasData: true,
    },
    {
      id: 'sleep',
      label: 'Sleep',
      icon: 'moon-outline',
      value: hasSleepData ? `${sleepHours}h · Q${sleepQuality}/5` : 'Not logged',
      score: sleepScore,
      status: sleepStatus,
      detail: sleepDetail,
      hasData: hasSleepData,
      actionLabel: hasSleepData ? undefined : 'Log check-in →',
    },
    {
      id: 'nutrition',
      label: 'Fuel',
      icon: 'restaurant-outline',
      value: 'Not tracked',
      score: 0,
      status: 'AMBER',
      detail: profile.weeklyLoad > 1200
        ? 'High load — prioritise carbs + electrolytes'
        : 'Open Fuel tab to set targets',
      hasData: false,
      actionLabel: 'Open Fuel →',
    },
    {
      id: 'mental',
      label: 'Mental',
      icon: 'happy-outline',
      value: hasMoodData ? `Mood ${mood}/5` : 'Not logged',
      score: hasMoodData ? clamp(Math.round(mood * 14 + (5 - stress) * 10), 35, 96) : 0,
      status: mentalStatus,
      detail: mentalDetail,
      hasData: hasMoodData,
      actionLabel: hasMoodData ? undefined : 'Log check-in →',
    },
  ];
}

export function calculateWHtR(waistCm: number, heightCm: number) {
  const ratio = heightCm > 0 ? waistCm / heightCm : 0;
  return {
    ratio: Math.round(ratio * 1000) / 1000,
    compliant: ratio > 0 && ratio < 0.55,
    marginCm: Math.round((0.55 * heightCm - waistCm) * 10) / 10,
  };
}

export function calculateEnhancedPandolf(input: RuckInputs): RuckEstimate {
  const speedMs = input.speedKph / 3.6;
  const bodyWithLoad = input.bodyMassKg + input.loadKg;
  const grade = input.gradePercent / 100;
  const terrain = Math.max(1, input.terrainFactor);
  const base = 1.5 * input.bodyMassKg + 2 * bodyWithLoad * Math.pow(input.loadKg / input.bodyMassKg, 2);
  const movement = terrain * bodyWithLoad * (1.5 * Math.pow(speedMs, 2) + 0.35 * speedMs * grade);
  const watts = Math.max(0, base + movement);
  const loadRatio = input.loadKg / input.bodyMassKg;
  const correction = loadRatio >= 0.27 ? 1.27 : 1 + loadRatio;
  const wattsCorrected = watts * correction;

  return {
    watts: Math.round(watts),
    wattsCorrected: Math.round(wattsCorrected),
    metabolicCostKcalHour: Math.round(wattsCorrected * 0.86),
    loadedKm: Math.round(input.speedKph * input.loadKg * 10) / 10,
    loadRatio: Math.round(loadRatio * 100) / 100,
  };
}

export function buildPrescriptiveGuidance(sessions: TrainingSession[], sleepHours = 6.5, hrvTrend: 'up' | 'flat' | 'down' = 'flat') {
  const profile = buildPerformanceProfile(sessions);
  if (sleepHours < 5 || hrvTrend === 'down' || profile.readinessBand === 'RED') {
    return 'Prescribe mobility, Zone 2, tissue care, and hydration. Avoid max-effort lifts or heavy ruck intervals today.';
  }
  if (profile.loadRisk === 'Moderate' || sleepHours < 7) {
    return 'Cap work at RPE 7, shorten loaded volume by 15%, and bias technique over intensity.';
  }
  return 'Green window: execute assigned AFT/CFT or loaded movement work, then log recovery markers before lights out.';
}
