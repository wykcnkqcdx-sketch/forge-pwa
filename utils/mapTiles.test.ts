import { describe, expect, it } from 'vitest';
import type { TrackPoint } from '../data/domain';
import { buildVisibleTiles, getMercatorRoutePoints, getTileUrl, latLonToWorldPixel } from './mapTiles';

const dublin: TrackPoint = {
  latitude: 53.349805,
  longitude: -6.26031,
  altitude: null,
  accuracy: 8,
  timestamp: 1_000_000,
};

describe('map tile helpers', () => {
  it('projects coordinates into Web Mercator pixels', () => {
    const pixel = latLonToWorldPixel(0, 0, 2);

    expect(pixel.x).toBeCloseTo(512);
    expect(pixel.y).toBeCloseTo(512);
  });

  it('builds visible raster tiles for a viewport', () => {
    const tiles = buildVisibleTiles(dublin, { width: 360, height: 190 }, 'topo', 15);

    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles[0].url).toContain('opentopomap');
  });

  it('projects the current point to the center of the viewport', () => {
    const points = getMercatorRoutePoints([dublin], dublin, { width: 360, height: 190 }, 15);

    expect(points[0].x).toBeCloseTo(180);
    expect(points[0].y).toBeCloseTo(95);
  });

  it('uses provider URL formats for available layers', () => {
    expect(getTileUrl('street', 15, 15815, 10767)).toContain('openstreetmap');
    expect(getTileUrl('satellite', 15, 15815, 10767)).toContain('ArcGIS');
    expect(getTileUrl('dark', 15, 15815, 10767)).toContain('cartocdn');
  });
});
