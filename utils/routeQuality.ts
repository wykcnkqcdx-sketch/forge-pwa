import type { TrackPoint } from '../data/domain';
import { distanceBetween } from './mapUtils';

export const MAX_MAP_RENDER_POINTS = 160;
export const MAX_MAP_SIMPLIFICATION_SOURCE_POINTS = 800;
export const MAP_SIMPLIFICATION_TOLERANCE_METERS = 10;
export const MAX_ACCEPTED_ACCURACY_METERS = 35;
export const WEAK_ACCURACY_METERS = 20;
export const MIN_MOVEMENT_METERS = 4;
export const MAX_RUCK_SPEED_KPH = 12;

export type RouteQualityResult =
  | { accepted: true; distanceKm: number }
  | { accepted: false; reason: string };

export function evaluateRoutePoint(previousPoint: TrackPoint | undefined, point: TrackPoint): RouteQualityResult {
  if (point.accuracy != null && point.accuracy > MAX_ACCEPTED_ACCURACY_METERS) {
    return { accepted: false, reason: 'poor accuracy' };
  }

  if (!previousPoint) return { accepted: true, distanceKm: 0 };
  if (previousPoint.timestamp === point.timestamp) return { accepted: false, reason: 'duplicate timestamp' };

  const distanceKm = distanceBetween(previousPoint, point);
  const distanceMeters = distanceKm * 1000;
  const elapsedHours = Math.max((point.timestamp - previousPoint.timestamp) / 3600000, 0);
  const speedKph = elapsedHours > 0 ? distanceKm / elapsedHours : 0;

  if (distanceMeters < MIN_MOVEMENT_METERS) return { accepted: false, reason: 'gps jitter' };
  if (speedKph > MAX_RUCK_SPEED_KPH) return { accepted: false, reason: 'speed spike' };

  return { accepted: true, distanceKm };
}

export function sanitizeRoutePoints(points: TrackPoint[]) {
  let rejectedPointCount = 0;
  let lastRejectedReason: string | null = null;
  let currentDistance = 0;
  const routePoints: TrackPoint[] = [];

  points.forEach((point) => {
    const previousPoint = routePoints[routePoints.length - 1];
    const result = evaluateRoutePoint(previousPoint, point);
    if (!result.accepted) {
      rejectedPointCount += 1;
      lastRejectedReason = result.reason;
      return;
    }

    currentDistance += result.distanceKm;
    routePoints.push(point);
  });

  return { routePoints, currentDistance, rejectedPointCount, lastRejectedReason };
}

export function limitRoutePoints(points: TrackPoint[], maxPoints: number) {
  if (points.length <= maxPoints) return points;

  const stride = (points.length - 1) / (maxPoints - 1);
  return Array.from({ length: maxPoints }, (_, index) => points[Math.round(index * stride)]);
}

function projectPoint(point: Pick<TrackPoint, 'latitude' | 'longitude'>, origin: Pick<TrackPoint, 'latitude' | 'longitude'>) {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = metersPerDegreeLat * Math.cos(origin.latitude * (Math.PI / 180));

  return {
    x: (point.longitude - origin.longitude) * metersPerDegreeLon,
    y: (point.latitude - origin.latitude) * metersPerDegreeLat,
  };
}

function perpendicularDistanceMeters(point: TrackPoint, start: TrackPoint, end: TrackPoint) {
  const projectedPoint = projectPoint(point, start);
  const projectedEnd = projectPoint(end, start);
  const segmentLengthSquared = projectedEnd.x ** 2 + projectedEnd.y ** 2;

  if (segmentLengthSquared === 0) return distanceBetween(point, start) * 1000;

  const t = Math.max(
    0,
    Math.min(1, (projectedPoint.x * projectedEnd.x + projectedPoint.y * projectedEnd.y) / segmentLengthSquared)
  );
  const closest = {
    x: t * projectedEnd.x,
    y: t * projectedEnd.y,
  };

  return Math.hypot(projectedPoint.x - closest.x, projectedPoint.y - closest.y);
}

export function simplifyRoute(points: TrackPoint[], toleranceMeters: number): TrackPoint[] {
  if (points.length <= 2) return points;

  let maxDistance = 0;
  let splitIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistanceMeters(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = i;
    }
  }

  if (maxDistance <= toleranceMeters) return [start, end];

  const beforeSplit = simplifyRoute(points.slice(0, splitIndex + 1), toleranceMeters);
  const afterSplit = simplifyRoute(points.slice(splitIndex), toleranceMeters);
  return [...beforeSplit.slice(0, -1), ...afterSplit];
}

export function decimateRouteForMap(points: TrackPoint[]) {
  const sourcePoints = limitRoutePoints(points, MAX_MAP_SIMPLIFICATION_SOURCE_POINTS);
  const simplifiedPoints = simplifyRoute(sourcePoints, MAP_SIMPLIFICATION_TOLERANCE_METERS);
  return limitRoutePoints(simplifiedPoints, MAX_MAP_RENDER_POINTS);
}
