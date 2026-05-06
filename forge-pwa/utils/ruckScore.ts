const BASE = 95;
const LOAD_PENALTY_THRESHOLD = 0.3;
const LOAD_PENALTY_MULTIPLIER = 60;
const WEIGHT_COST = 0.5;
const DISTANCE_COST = 0.4;
const ASCENT_COST = 160;
const TERRAIN_COST = 30;
const MIN_SCORE = 55;

export interface RuckScoreParams {
  weightKg: number;
  distanceKm: number;
  bodyWeightKg: number;
  terrainMultiplier: number;
  calibrationFactor: number;
  ascentM?: number;
}

export function calculateRuckScore({
  weightKg,
  distanceKm,
  bodyWeightKg,
  terrainMultiplier,
  calibrationFactor,
  ascentM = 0,
}: RuckScoreParams): number {
  const loadFraction = weightKg / bodyWeightKg;
  const highLoadPenalty =
    loadFraction > LOAD_PENALTY_THRESHOLD
      ? (loadFraction - LOAD_PENALTY_THRESHOLD) * LOAD_PENALTY_MULTIPLIER
      : 0;
  const base = BASE - weightKg * WEIGHT_COST - distanceKm * DISTANCE_COST - ascentM / ASCENT_COST;
  const terrainAdjusted = base - (terrainMultiplier - 1) * TERRAIN_COST;
  return Math.max(MIN_SCORE, Math.round((terrainAdjusted - highLoadPenalty) * calibrationFactor));
}
