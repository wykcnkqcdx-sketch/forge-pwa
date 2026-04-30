import { describe, expect, it } from 'vitest';
import type { TrackPoint } from '../data/domain';
import {
  decimateRouteForMap,
  evaluateRoutePoint,
  MAX_MAP_RENDER_POINTS,
  sanitizeRoutePoints,
} from './routeQuality';

function point(overrides: Partial<TrackPoint> = {}): TrackPoint {
  return {
    latitude: 53.3498,
    longitude: -6.2603,
    altitude: null,
    accuracy: 8,
    timestamp: 1_000_000,
    ...overrides,
  };
}

describe('route quality filters', () => {
  it('accepts the first usable point', () => {
    expect(evaluateRoutePoint(undefined, point())).toEqual({ accepted: true, distanceKm: 0 });
  });

  it('rejects poor accuracy fixes', () => {
    expect(evaluateRoutePoint(undefined, point({ accuracy: 50 }))).toEqual({
      accepted: false,
      reason: 'poor accuracy',
    });
  });

  it('rejects duplicate timestamps', () => {
    const previous = point();
    const next = point({ latitude: 53.3502, timestamp: previous.timestamp });

    expect(evaluateRoutePoint(previous, next)).toEqual({
      accepted: false,
      reason: 'duplicate timestamp',
    });
  });

  it('rejects tiny movement as gps jitter', () => {
    const previous = point();
    const next = point({ latitude: 53.34981, timestamp: previous.timestamp + 10_000 });

    expect(evaluateRoutePoint(previous, next)).toEqual({
      accepted: false,
      reason: 'gps jitter',
    });
  });

  it('rejects impossible ruck speed spikes', () => {
    const previous = point();
    const next = point({ latitude: 53.3518, timestamp: previous.timestamp + 10_000 });

    expect(evaluateRoutePoint(previous, next)).toEqual({
      accepted: false,
      reason: 'speed spike',
    });
  });

  it('accepts plausible ruck movement and reports distance', () => {
    const previous = point();
    const next = point({ latitude: 53.35025, timestamp: previous.timestamp + 30_000 });
    const result = evaluateRoutePoint(previous, next);

    expect(result.accepted).toBe(true);
    if (result.accepted) expect(result.distanceKm).toBeGreaterThan(0.04);
  });

  it('sanitizes restored routes and reports rejected points', () => {
    const restored = sanitizeRoutePoints([
      point(),
      point({ latitude: 53.34981, timestamp: 1_010_000 }),
      point({ latitude: 53.35025, timestamp: 1_040_000 }),
      point({ latitude: 53.3525, timestamp: 1_045_000 }),
      point({ latitude: 53.3507, timestamp: 1_080_000 }),
    ]);

    expect(restored.routePoints).toHaveLength(3);
    expect(restored.rejectedPointCount).toBe(2);
    expect(restored.lastRejectedReason).toBe('speed spike');
    expect(restored.currentDistance).toBeGreaterThan(0.09);
  });

  it('keeps map display points at or below the render cap', () => {
    const longRoute = Array.from({ length: 1000 }, (_, index) =>
      point({
        latitude: 53.3498 + index * 0.00005,
        longitude: -6.2603 + Math.sin(index / 8) * 0.0005,
        timestamp: 1_000_000 + index * 30_000,
      })
    );

    expect(decimateRouteForMap(longRoute).length).toBeLessThanOrEqual(MAX_MAP_RENDER_POINTS);
  });
});
