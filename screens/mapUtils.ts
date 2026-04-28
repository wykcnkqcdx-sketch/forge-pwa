import { TrackPoint } from '../data/mockData';

export function getMapPoints<T extends TrackPoint>(points: T[] | undefined): (T & { x: number; y: number })[] {
  if (!points || points.length === 0) return [];

  const lats = points.map((p) => p.latitude);
  const lons = points.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latRange = Math.max(maxLat - minLat, 0.0005);
  const lonRange = Math.max(maxLon - minLon, 0.0005);

  return points.map((p) => ({
    ...p,
    x: 8 + ((p.longitude - minLon) / lonRange) * 84,
    y: 92 - ((p.latitude - minLat) / latRange) * 84,
  }));
}