export type RuckScoreInput = {
  distanceKm: number;
  loadKg: number;
  bodyMassKg: number;
  paceMinPerKm: number;
  ascentM: number;
  terrainFactor: number;
  splitCount?: number;
  reachedCheckpoints?: number;
  totalCheckpoints?: number;
};

export type RuckScoreBreakdown = {
  score: number;
  loadAdjustedPace: string;
  factors: Array<{ label: string; value: string; points: number }>;
  finding: string;
  recommendation: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function calculateRuckScore(input: RuckScoreInput): RuckScoreBreakdown {
  const loadRatio = input.loadKg / Math.max(1, input.bodyMassKg);
  const elevationPerKm = input.distanceKm > 0 ? input.ascentM / input.distanceKm : 0;
  const checkpointRatio = input.totalCheckpoints ? (input.reachedCheckpoints ?? 0) / input.totalCheckpoints : 1;

  const loadPoints = clamp(loadRatio / 0.32, 0, 1) * 22;
  const distancePoints = clamp(input.distanceKm / 16, 0, 1) * 20;
  const elevationPoints = clamp(elevationPerKm / 80, 0, 1) * 16;
  const terrainPoints = clamp((input.terrainFactor - 1) / 1.2, 0, 1) * 12;
  const paceTarget = 10.5 + loadRatio * 8 + (input.terrainFactor - 1) * 2 + elevationPerKm / 45;
  const paceRatio = paceTarget / Math.max(5, input.paceMinPerKm);
  const pacePoints = clamp(paceRatio, 0.55, 1.15) * 20;
  const executionPoints = clamp(checkpointRatio, 0, 1) * 10;

  const score = Math.round(clamp(loadPoints + distancePoints + elevationPoints + terrainPoints + pacePoints + executionPoints, 35, 100));
  const loadAdjustedPace = (input.paceMinPerKm * (1 + loadRatio * 0.75 + (input.terrainFactor - 1) * 0.18)).toFixed(1);

  const weakest = [
    { key: 'load', label: 'Load tolerance', value: loadPoints },
    { key: 'pace', label: 'Pace control', value: pacePoints },
    { key: 'elevation', label: 'Hill work', value: elevationPoints },
    { key: 'execution', label: 'Checkpoint execution', value: executionPoints },
  ].sort((a, b) => a.value - b.value)[0];

  return {
    score,
    loadAdjustedPace,
    factors: [
      { label: 'Distance', value: `${input.distanceKm.toFixed(1)} km`, points: Math.round(distancePoints) },
      { label: 'Load', value: `${input.loadKg} kg (${Math.round(loadRatio * 100)}%)`, points: Math.round(loadPoints) },
      { label: 'Elevation', value: `${Math.round(input.ascentM)} m`, points: Math.round(elevationPoints) },
      { label: 'Terrain', value: `${input.terrainFactor.toFixed(1)}x`, points: Math.round(terrainPoints) },
      { label: 'Pace', value: `${input.paceMinPerKm.toFixed(1)} min/km`, points: Math.round(pacePoints) },
      { label: 'Execution', value: input.totalCheckpoints ? `${input.reachedCheckpoints ?? 0}/${input.totalCheckpoints} CP` : 'Route only', points: Math.round(executionPoints) },
    ],
    finding: weakest.key === 'pace'
      ? 'Pace is the limiting factor under this load.'
      : weakest.key === 'load'
        ? 'Load carriage is the main limiter for this route.'
        : weakest.key === 'elevation'
          ? 'Climbing demand is the weakest part of the profile.'
          : 'Route execution needs cleaner checkpoint discipline.',
    recommendation: score >= 82
      ? 'Repeat once, then progress either load or distance, not both.'
      : score >= 68
        ? 'Hold the same route and aim for steadier pace before progressing.'
        : 'Reduce load or distance and rebuild consistency before increasing stress.',
  };
}
