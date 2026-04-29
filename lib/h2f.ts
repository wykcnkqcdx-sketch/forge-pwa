import { TrainingSession } from '../data/domain';
import { buildPerformanceProfile } from './performance';

export type H2FDomain = {
  id: 'physical' | 'sleep' | 'nutrition' | 'mental';
  label: string;
  value: string;
  score: number;
  status: 'GREEN' | 'AMBER' | 'RED';
  detail: string;
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

export function buildH2FDomains(sessions: TrainingSession[]): H2FDomain[] {
  const profile = buildPerformanceProfile(sessions);
  const physicalScore = clamp(Math.round((profile.readiness + Math.min(100, profile.weeklyLoad / 12)) / 2), 35, 96);
  const sleepScore = profile.highIntensityCount >= 3 ? 58 : profile.averageRpe >= 7 ? 72 : 84;
  const nutritionScore = profile.weeklyLoad > 1800 ? 68 : profile.weeklyLoad > 800 ? 78 : 86;
  const mentalScore = profile.readinessBand === 'RED' ? 61 : profile.readinessBand === 'AMBER' ? 74 : 88;

  return [
    {
      id: 'physical',
      label: 'Physical',
      value: `AFT/CFT ${physicalScore}`,
      score: physicalScore,
      status: physicalScore >= 80 ? 'GREEN' : physicalScore >= 62 ? 'AMBER' : 'RED',
      detail: `ACWR ${profile.acuteChronicRatio} | ${profile.weeklyLoad} AU load`,
    },
    {
      id: 'sleep',
      label: 'Sleep',
      value: `PIRS-20 ${sleepScore}`,
      score: sleepScore,
      status: sleepScore >= 80 ? 'GREEN' : sleepScore >= 62 ? 'AMBER' : 'RED',
      detail: profile.highIntensityCount >= 3 ? 'Reduce intensity after high RPE stack' : 'Sleep pressure stable',
    },
    {
      id: 'nutrition',
      label: 'Nutrition',
      value: `${nutritionScore}% macros`,
      score: nutritionScore,
      status: nutritionScore >= 80 ? 'GREEN' : nutritionScore >= 62 ? 'AMBER' : 'RED',
      detail: profile.weeklyLoad > 1200 ? 'Add carbs/electrolytes around loaded work' : 'Macro target on plan',
    },
    {
      id: 'mental',
      label: 'Mental',
      value: `${mentalScore} mindful min`,
      score: mentalScore,
      status: mentalScore >= 80 ? 'GREEN' : mentalScore >= 62 ? 'AMBER' : 'RED',
      detail: profile.readinessBand === 'GREEN' ? 'Maintain routine' : 'Use downshift block before hard work',
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
