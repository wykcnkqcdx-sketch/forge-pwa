import type { ImageStyle } from 'react-native';
import type { TrackPoint } from '../data/mockData';

export type MapLayerKey = 'street' | 'topo' | 'satellite' | 'dark';

export const mapLayerOptions: { key: MapLayerKey; label: string; attribution: string }[] = [
  { key: 'topo', label: 'TOPO', attribution: 'OpenTopoMap' },
  { key: 'street', label: 'STREET', attribution: 'OpenStreetMap' },
  { key: 'satellite', label: 'SAT', attribution: 'Esri' },
  { key: 'dark', label: 'DARK', attribution: 'Carto' },
];

export type MapViewport = {
  width: number;
  height: number;
};

export type MapTile = {
  id: string;
  url: string;
  style: ImageStyle;
};

const tileSize = 256;
const maxLatitude = 85.05112878;

function clampLatitude(latitude: number) {
  return Math.max(-maxLatitude, Math.min(maxLatitude, latitude));
}

function worldPixelSize(zoom: number) {
  return tileSize * 2 ** zoom;
}

export function latLonToWorldPixel(latitude: number, longitude: number, zoom: number) {
  const lat = clampLatitude(latitude);
  const sinLat = Math.sin(lat * Math.PI / 180);
  const size = worldPixelSize(zoom);

  return {
    x: ((longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * size,
  };
}

function normalizeTileX(x: number, zoom: number) {
  const tileCount = 2 ** zoom;
  return ((x % tileCount) + tileCount) % tileCount;
}

export function getTileUrl(layer: MapLayerKey, zoom: number, x: number, y: number) {
  const normalizedX = normalizeTileX(x, zoom);

  if (layer === 'topo') {
    return `https://a.tile.opentopomap.org/${zoom}/${normalizedX}/${y}.png`;
  }

  if (layer === 'satellite') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${normalizedX}`;
  }

  if (layer === 'dark') {
    return `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${normalizedX}/${y}.png`;
  }

  return `https://a.tile.openstreetmap.org/${zoom}/${normalizedX}/${y}.png`;
}

export function buildVisibleTiles(center: TrackPoint | undefined, viewport: MapViewport, layer: MapLayerKey, zoom = 15): MapTile[] {
  if (!center || viewport.width <= 0 || viewport.height <= 0) return [];

  const centerPixel = latLonToWorldPixel(center.latitude, center.longitude, zoom);
  const minPixelX = centerPixel.x - viewport.width / 2;
  const minPixelY = centerPixel.y - viewport.height / 2;
  const maxPixelX = centerPixel.x + viewport.width / 2;
  const maxPixelY = centerPixel.y + viewport.height / 2;
  const minTileX = Math.floor(minPixelX / tileSize);
  const maxTileX = Math.floor(maxPixelX / tileSize);
  const minTileY = Math.floor(minPixelY / tileSize);
  const maxTileY = Math.floor(maxPixelY / tileSize);
  const maxTileIndex = 2 ** zoom - 1;
  const tiles: MapTile[] = [];

  for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      if (tileY < 0 || tileY > maxTileIndex) continue;

      tiles.push({
        id: `${layer}-${zoom}-${tileX}-${tileY}`,
        url: getTileUrl(layer, zoom, tileX, tileY),
        style: {
          position: 'absolute',
          left: tileX * tileSize - minPixelX,
          top: tileY * tileSize - minPixelY,
          width: tileSize,
          height: tileSize,
        },
      });
    }
  }

  return tiles;
}

export function getMercatorRoutePoints(points: TrackPoint[], center: TrackPoint | undefined, viewport: MapViewport, zoom = 15) {
  if (!center || viewport.width <= 0 || viewport.height <= 0) return [];

  const centerPixel = latLonToWorldPixel(center.latitude, center.longitude, zoom);
  const minPixelX = centerPixel.x - viewport.width / 2;
  const minPixelY = centerPixel.y - viewport.height / 2;

  return points.map((point) => {
    const worldPixel = latLonToWorldPixel(point.latitude, point.longitude, zoom);
    return {
      ...point,
      x: worldPixel.x - minPixelX,
      y: worldPixel.y - minPixelY,
    };
  });
}
