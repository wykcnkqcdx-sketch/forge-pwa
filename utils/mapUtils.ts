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

export function distanceBetween(a: TrackPoint, b: TrackPoint) {
  const p = 0.017453292519943295; // Math.PI / 180
  const c = Math.cos;
  const haversine =
    0.5 -
    c((b.latitude - a.latitude) * p) / 2 +
    (c(a.latitude * p) * c(b.latitude * p) * (1 - c((b.longitude - a.longitude) * p))) / 2;

  return 12742 * Math.asin(Math.sqrt(haversine)); // 2 * R; R = 6371 km
}

export function bearingBetween(a: TrackPoint, b: TrackPoint) {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const lat1 = a.latitude * toRad;
  const lat2 = b.latitude * toRad;
  const deltaLon = (b.longitude - a.longitude) * toRad;
  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  return (Math.atan2(y, x) * toDeg + 360) % 360;
}
