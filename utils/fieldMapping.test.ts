import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
  calculateMeasurementArea,
  calculateMeasurementDistance,
  extractKmlFromKmz,
  formatMeasureArea,
  formatMeasureDistance,
  parseGeoJsonOverlay,
  parseKmlOverlay,
} from './fieldMapping';

describe('field mapping overlays', () => {
  it('parses GeoJSON points, lines, and polygons', () => {
    const overlay = parseGeoJsonOverlay(JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'RV' }, geometry: { type: 'Point', coordinates: [-6.26031, 53.349805] } },
        { type: 'Feature', properties: { name: 'Track' }, geometry: { type: 'LineString', coordinates: [[-6.26, 53.34], [-6.25, 53.35]] } },
        { type: 'Feature', properties: { name: 'Area' }, geometry: { type: 'Polygon', coordinates: [[[-6.26, 53.34], [-6.25, 53.34], [-6.25, 53.35], [-6.26, 53.34]]] } },
      ],
    }), 'mission.geojson', '#facc15');

    expect(overlay.name).toBe('mission');
    expect(overlay.format).toBe('geojson');
    expect(overlay.points).toHaveLength(1);
    expect(overlay.lines).toHaveLength(1);
    expect(overlay.polygons).toHaveLength(1);
    expect(overlay.points[0]).toMatchObject({ label: 'RV', latitude: 53.349805, longitude: -6.26031 });
  });

  it('parses KML placemarks into overlay features', () => {
    const kml = `
      <kml><Document><name>Mission KML</name>
        <Placemark><name>OP</name><Point><coordinates>-6.26031,53.349805,0</coordinates></Point></Placemark>
        <Placemark><name>Route</name><LineString><coordinates>-6.26,53.34,0 -6.25,53.35,0</coordinates></LineString></Placemark>
        <Placemark><name>Zone</name><Polygon><outerBoundaryIs><LinearRing><coordinates>-6.26,53.34,0 -6.25,53.34,0 -6.25,53.35,0 -6.26,53.34,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
      </Document></kml>
    `;

    const overlay = parseKmlOverlay(kml, 'mission.kml', '#34d399');

    expect(overlay.name).toBe('Mission KML');
    expect(overlay.format).toBe('kml');
    expect(overlay.points[0]).toMatchObject({ label: 'OP', latitude: 53.349805, longitude: -6.26031 });
    expect(overlay.lines[0].points).toHaveLength(2);
    expect(overlay.polygons[0].rings[0]).toHaveLength(4);
  });

  it('extracts doc.kml from KMZ base64 content', () => {
    const zipped = zipSync({
      'doc.kml': strToU8('<kml><Document><name>KMZ Doc</name></Document></kml>'),
      'files/ignored.txt': strToU8('ignored'),
    });
    const base64 = Buffer.from(zipped).toString('base64');

    expect(extractKmlFromKmz(base64)).toContain('KMZ Doc');
  });
});

describe('field mapping measurements', () => {
  const points = [
    { latitude: 53.349805, longitude: -6.26031 },
    { latitude: 53.359805, longitude: -6.26031 },
    { latitude: 53.359805, longitude: -6.24531 },
  ];

  it('calculates route distance and formats distance labels', () => {
    const distance = calculateMeasurementDistance(points.slice(0, 2));

    expect(distance).toBeGreaterThan(1);
    expect(formatMeasureDistance(distance)).toMatch(/km$/);
    expect(formatMeasureDistance(0.42)).toBe('420 m');
  });

  it('calculates area and formats area labels', () => {
    const area = calculateMeasurementArea(points);

    expect(area).toBeGreaterThan(100000);
    expect(formatMeasureArea(area)).toMatch(/ha|sq m|sq km/);
  });
});
