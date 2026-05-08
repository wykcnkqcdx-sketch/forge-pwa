import { strFromU8, unzipSync } from 'fflate';
import type { TrackPoint } from '../data/domain';
import { distanceBetween } from './mapUtils';

export type OverlayPoint = { id: string; label: string; latitude: number; longitude: number };
export type OverlayLine = { id: string; label: string; points: Array<{ lat: number; lon: number }> };
export type OverlayPolygon = { id: string; label: string; rings: Array<Array<{ lat: number; lon: number }>> };
export type MeasurementMode = 'range' | 'route' | 'area';
export type MeasurementPoint = { latitude: number; longitude: number };

export type MapOverlay = {
  id: string;
  name: string;
  format: 'geojson' | 'kml' | 'kmz';
  visible: boolean;
  color: string;
  points: OverlayPoint[];
  lines: OverlayLine[];
  polygons: OverlayPolygon[];
};

function isLonLatPair(value: unknown): value is [number, number, ...number[]] {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'number'
    && typeof value[1] === 'number'
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && Math.abs(value[0]) <= 180
    && Math.abs(value[1]) <= 90;
}

function overlayPointFromCoordinate(id: string, label: string, coordinate: unknown): OverlayPoint | null {
  if (!isLonLatPair(coordinate)) return null;
  return { id, label, latitude: coordinate[1], longitude: coordinate[0] };
}

function overlayLineFromCoordinates(id: string, label: string, coordinates: unknown): OverlayLine | null {
  if (!Array.isArray(coordinates)) return null;
  const points = coordinates
    .map((coordinate) => isLonLatPair(coordinate) ? { lat: coordinate[1], lon: coordinate[0] } : null)
    .filter((point): point is { lat: number; lon: number } => point != null);
  return points.length >= 2 ? { id, label, points } : null;
}

function overlayPolygonFromCoordinates(id: string, label: string, coordinates: unknown): OverlayPolygon | null {
  if (!Array.isArray(coordinates)) return null;
  const rings = coordinates
    .map((ring) => Array.isArray(ring)
      ? ring
        .map((coordinate) => isLonLatPair(coordinate) ? { lat: coordinate[1], lon: coordinate[0] } : null)
        .filter((point): point is { lat: number; lon: number } => point != null)
      : [])
    .filter((ring) => ring.length >= 3);
  return rings.length > 0 ? { id, label, rings } : null;
}

function geoJsonFeatureLabel(feature: any, fallback: string) {
  const props = feature?.properties;
  return String(props?.name ?? props?.title ?? props?.label ?? props?.id ?? feature?.id ?? fallback);
}

function collectGeoJsonGeometry(overlay: MapOverlay, geometry: any, label: string, idPrefix: string) {
  if (!geometry || typeof geometry !== 'object') return;
  const { type, coordinates, geometries } = geometry;

  if (type === 'GeometryCollection' && Array.isArray(geometries)) {
    geometries.forEach((child, index) => collectGeoJsonGeometry(overlay, child, label, `${idPrefix}-g${index}`));
    return;
  }

  if (type === 'Point') {
    const point = overlayPointFromCoordinate(`${idPrefix}-pt`, label, coordinates);
    if (point) overlay.points.push(point);
    return;
  }

  if (type === 'MultiPoint' && Array.isArray(coordinates)) {
    coordinates.forEach((coordinate, index) => {
      const point = overlayPointFromCoordinate(`${idPrefix}-pt${index}`, label, coordinate);
      if (point) overlay.points.push(point);
    });
    return;
  }

  if (type === 'LineString') {
    const line = overlayLineFromCoordinates(`${idPrefix}-ln`, label, coordinates);
    if (line) overlay.lines.push(line);
    return;
  }

  if (type === 'MultiLineString' && Array.isArray(coordinates)) {
    coordinates.forEach((lineCoordinates, index) => {
      const line = overlayLineFromCoordinates(`${idPrefix}-ln${index}`, label, lineCoordinates);
      if (line) overlay.lines.push(line);
    });
    return;
  }

  if (type === 'Polygon') {
    const polygon = overlayPolygonFromCoordinates(`${idPrefix}-pg`, label, coordinates);
    if (polygon) overlay.polygons.push(polygon);
    return;
  }

  if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
    coordinates.forEach((polygonCoordinates, index) => {
      const polygon = overlayPolygonFromCoordinates(`${idPrefix}-pg${index}`, label, polygonCoordinates);
      if (polygon) overlay.polygons.push(polygon);
    });
  }
}

export function parseGeoJsonOverlay(content: string, fileName: string, color: string): MapOverlay {
  const parsed = JSON.parse(content);
  const overlay: MapOverlay = {
    id: `overlay-${Date.now()}`,
    name: fileName.replace(/\.(geo)?json$/i, '') || 'GeoJSON Overlay',
    format: 'geojson',
    visible: true,
    color,
    points: [],
    lines: [],
    polygons: [],
  };
  const features = parsed?.type === 'FeatureCollection'
    ? parsed.features
    : parsed?.type === 'Feature'
      ? [parsed]
      : [{ type: 'Feature', properties: { name: fileName }, geometry: parsed }];

  if (!Array.isArray(features)) throw new Error('GeoJSON has no features.');
  features.forEach((feature, index) => {
    const label = geoJsonFeatureLabel(feature, `Feature ${index + 1}`);
    collectGeoJsonGeometry(overlay, feature.geometry, label, `${overlay.id}-${index}`);
  });

  if (overlay.points.length + overlay.lines.length + overlay.polygons.length === 0) {
    throw new Error('GeoJSON has no supported map features.');
  }

  return overlay;
}

function stripXmlTags(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function firstXmlText(xml: string, tag: string) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(xml);
  return match ? stripXmlTags(match[1]) : null;
}

function xmlBlocks(xml: string, tag: string) {
  const matches: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    matches.push(match[0]);
  }
  return matches;
}

function parseKmlCoordinateList(coordinatesText: string) {
  return coordinatesText
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .trim()
    .split(/\s+/)
    .map((part) => {
      const [lonRaw, latRaw] = part.split(',');
      const lon = Number.parseFloat(lonRaw);
      const lat = Number.parseFloat(latRaw);
      return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
        ? { lat, lon }
        : null;
    })
    .filter((point): point is { lat: number; lon: number } => point != null);
}

export function parseKmlOverlay(content: string, fileName: string, color: string, format: MapOverlay['format'] = 'kml'): MapOverlay {
  const overlay: MapOverlay = {
    id: `overlay-${Date.now()}`,
    name: firstXmlText(content, 'name') ?? fileName.replace(/\.(kml|kmz)$/i, '') ?? (format === 'kmz' ? 'KMZ Overlay' : 'KML Overlay'),
    format,
    visible: true,
    color,
    points: [],
    lines: [],
    polygons: [],
  };
  const placemarks = xmlBlocks(content, 'Placemark');
  const blocks = placemarks.length > 0 ? placemarks : [content];

  blocks.forEach((block, index) => {
    const label = firstXmlText(block, 'name') ?? `Placemark ${index + 1}`;
    const idPrefix = `${overlay.id}-${index}`;

    xmlBlocks(block, 'Point').forEach((pointBlock, pointIndex) => {
      const coordinates = firstXmlText(pointBlock, 'coordinates');
      if (!coordinates) return;
      const [point] = parseKmlCoordinateList(coordinates);
      if (point) {
        overlay.points.push({
          id: `${idPrefix}-pt${pointIndex}`,
          label,
          latitude: point.lat,
          longitude: point.lon,
        });
      }
    });

    xmlBlocks(block, 'LineString').forEach((lineBlock, lineIndex) => {
      const coordinates = firstXmlText(lineBlock, 'coordinates');
      if (!coordinates) return;
      const points = parseKmlCoordinateList(coordinates);
      if (points.length >= 2) {
        overlay.lines.push({ id: `${idPrefix}-ln${lineIndex}`, label, points });
      }
    });

    xmlBlocks(block, 'Polygon').forEach((polygonBlock, polygonIndex) => {
      const rings = xmlBlocks(polygonBlock, 'LinearRing')
        .map((ringBlock) => {
          const coordinates = firstXmlText(ringBlock, 'coordinates');
          return coordinates ? parseKmlCoordinateList(coordinates) : [];
        })
        .filter((ring) => ring.length >= 3);

      if (rings.length > 0) {
        overlay.polygons.push({ id: `${idPrefix}-pg${polygonIndex}`, label, rings });
      }
    });
  });

  if (overlay.points.length + overlay.lines.length + overlay.polygons.length === 0) {
    throw new Error('KML has no supported map features.');
  }

  return overlay;
}

function base64ToUint8Array(base64: string) {
  const clean = base64.replace(/\s/g, '');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    if (char === '=') break;
    const value = chars.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  return new Uint8Array(bytes);
}

export function extractKmlFromKmz(base64Content: string) {
  const files = unzipSync(base64ToUint8Array(base64Content));
  const fileNames = Object.keys(files);
  const kmlName = fileNames.find((name) => /(^|\/)doc\.kml$/i.test(name))
    ?? fileNames.find((name) => /\.kml$/i.test(name) && !name.includes('__MACOSX'));

  if (!kmlName) throw new Error('KMZ has no KML document.');
  return strFromU8(files[kmlName]);
}

export function measurementPointToTrackPoint(point: MeasurementPoint): TrackPoint {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    altitude: null,
    accuracy: null,
    timestamp: 0,
  };
}

export function formatMeasureDistance(km: number) {
  return km >= 1 ? `${km.toFixed(2)} km` : `${Math.round(km * 1000)} m`;
}

export function calculateMeasurementDistance(points: MeasurementPoint[], closeLoop = false) {
  if (points.length < 2) return 0;
  const routePoints = closeLoop ? [...points, points[0]] : points;
  return routePoints.slice(1).reduce((total, point, index) => (
    total + distanceBetween(measurementPointToTrackPoint(routePoints[index]), measurementPointToTrackPoint(point))
  ), 0);
}

export function calculateMeasurementArea(points: MeasurementPoint[]) {
  if (points.length < 3) return 0;
  const earthRadiusMeters = 6371008.8;
  const avgLat = points.reduce((total, point) => total + point.latitude, 0) / points.length;
  const cosLat = Math.cos((avgLat * Math.PI) / 180);
  const projected = points.map((point) => ({
    x: earthRadiusMeters * (point.longitude * Math.PI / 180) * cosLat,
    y: earthRadiusMeters * (point.latitude * Math.PI / 180),
  }));
  const twiceArea = projected.reduce((total, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return total + point.x * next.y - next.x * point.y;
  }, 0);
  return Math.abs(twiceArea) / 2;
}

export function formatMeasureArea(areaSquareMeters: number) {
  if (areaSquareMeters >= 1000000) return `${(areaSquareMeters / 1000000).toFixed(2)} sq km`;
  if (areaSquareMeters >= 10000) return `${(areaSquareMeters / 10000).toFixed(2)} ha`;
  return `${Math.round(areaSquareMeters)} sq m`;
}
