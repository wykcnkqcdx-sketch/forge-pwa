import { describe, expect, it } from 'vitest';
import { formatCoordinate, toUtm } from './coordinates';

describe('coordinate formatting', () => {
  it('formats decimal latitude and longitude', () => {
    expect(formatCoordinate(53.349805, -6.26031, 'latlon')).toBe('53.34981, -6.26031');
  });

  it('formats degrees minutes seconds', () => {
    expect(formatCoordinate(53.349805, -6.26031, 'dms')).toContain('53deg 20\' 59.3" N');
    expect(formatCoordinate(53.349805, -6.26031, 'dms')).toContain('6deg 15\' 37.1" W');
  });

  it('converts Dublin coordinates to the expected UTM zone', () => {
    const utm = toUtm(53.349805, -6.26031);

    expect(utm.zoneNumber).toBe(29);
    expect(utm.zoneLetter).toBe('U');
    expect(utm.easting).toBeGreaterThan(680000);
    expect(utm.easting).toBeLessThan(684000);
    expect(utm.northing).toBeGreaterThan(5900000);
    expect(utm.northing).toBeLessThan(5930000);
  });

  it('formats MGRS with zone, square, easting, and northing groups', () => {
    expect(formatCoordinate(53.349805, -6.26031, 'mgrs')).toMatch(/^29U [A-Z]{2} \d{5} \d{5}$/);
  });
});
