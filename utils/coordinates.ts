export type CoordinateFormat = 'latlon' | 'dms' | 'utm' | 'mgrs';

export const coordinateFormatOptions: { key: CoordinateFormat; label: string }[] = [
  { key: 'latlon', label: 'LAT/LON' },
  { key: 'dms', label: 'DMS' },
  { key: 'utm', label: 'UTM' },
  { key: 'mgrs', label: 'MGRS' },
];

type UtmCoordinate = {
  zoneNumber: number;
  zoneLetter: string;
  easting: number;
  northing: number;
};

const latitudeBands = 'CDEFGHJKLMNPQRSTUVWX';
const mgrsColumnSets = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
const mgrsRowSets = ['ABCDEFGHJKLMNPQRSTUV', 'FGHJKLMNPQRSTUVABCDE'];

function clampLatitude(latitude: number) {
  return Math.max(-80, Math.min(84, latitude));
}

function latitudeBand(latitude: number) {
  if (latitude >= 84) return 'X';
  if (latitude < -80) return 'C';
  return latitudeBands[Math.floor((latitude + 80) / 8)];
}

function utmZoneNumber(latitude: number, longitude: number) {
  let zone = Math.floor((longitude + 180) / 6) + 1;

  if (latitude >= 56 && latitude < 64 && longitude >= 3 && longitude < 12) {
    zone = 32;
  }

  if (latitude >= 72 && latitude < 84) {
    if (longitude >= 0 && longitude < 9) zone = 31;
    else if (longitude >= 9 && longitude < 21) zone = 33;
    else if (longitude >= 21 && longitude < 33) zone = 35;
    else if (longitude >= 33 && longitude < 42) zone = 37;
  }

  return Math.max(1, Math.min(60, zone));
}

function toDmsPart(value: number, positiveSuffix: string, negativeSuffix: string) {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix;
  return `${degrees}deg ${String(minutes).padStart(2, '0')}' ${seconds.toFixed(1).padStart(4, '0')}" ${suffix}`;
}

export function toUtm(latitude: number, longitude: number): UtmCoordinate {
  const lat = clampLatitude(latitude);
  const zoneNumber = utmZoneNumber(lat, longitude);
  const zoneLetter = latitudeBand(lat);
  const lonOrigin = (zoneNumber - 1) * 6 - 180 + 3;
  const latRad = lat * Math.PI / 180;
  const lonRad = longitude * Math.PI / 180;
  const lonOriginRad = lonOrigin * Math.PI / 180;

  const semiMajorAxis = 6378137;
  const eccentricitySquared = 0.00669438;
  const scaleFactor = 0.9996;
  const eccentricityPrimeSquared = eccentricitySquared / (1 - eccentricitySquared);

  const n = semiMajorAxis / Math.sqrt(1 - eccentricitySquared * Math.sin(latRad) ** 2);
  const t = Math.tan(latRad) ** 2;
  const c = eccentricityPrimeSquared * Math.cos(latRad) ** 2;
  const a = Math.cos(latRad) * (lonRad - lonOriginRad);

  const m = semiMajorAxis * (
    (1 - eccentricitySquared / 4 - 3 * eccentricitySquared ** 2 / 64 - 5 * eccentricitySquared ** 3 / 256) * latRad
    - (3 * eccentricitySquared / 8 + 3 * eccentricitySquared ** 2 / 32 + 45 * eccentricitySquared ** 3 / 1024) * Math.sin(2 * latRad)
    + (15 * eccentricitySquared ** 2 / 256 + 45 * eccentricitySquared ** 3 / 1024) * Math.sin(4 * latRad)
    - (35 * eccentricitySquared ** 3 / 3072) * Math.sin(6 * latRad)
  );

  const easting = scaleFactor * n * (
    a
    + (1 - t + c) * a ** 3 / 6
    + (5 - 18 * t + t ** 2 + 72 * c - 58 * eccentricityPrimeSquared) * a ** 5 / 120
  ) + 500000;

  let northing = scaleFactor * (
    m + n * Math.tan(latRad) * (
      a ** 2 / 2
      + (5 - t + 9 * c + 4 * c ** 2) * a ** 4 / 24
      + (61 - 58 * t + t ** 2 + 600 * c - 330 * eccentricityPrimeSquared) * a ** 6 / 720
    )
  );

  if (lat < 0) northing += 10000000;

  return {
    zoneNumber,
    zoneLetter,
    easting: Math.round(easting),
    northing: Math.round(northing),
  };
}

export function formatCoordinate(latitude: number, longitude: number, format: CoordinateFormat) {
  if (format === 'dms') {
    return `${toDmsPart(latitude, 'N', 'S')} ${toDmsPart(longitude, 'E', 'W')}`;
  }

  const utm = toUtm(latitude, longitude);

  if (format === 'utm') {
    return `${utm.zoneNumber}${utm.zoneLetter} ${utm.easting}E ${utm.northing}N`;
  }

  if (format === 'mgrs') {
    const columnSet = mgrsColumnSets[(utm.zoneNumber - 1) % mgrsColumnSets.length];
    const rowSet = mgrsRowSets[(utm.zoneNumber - 1) % mgrsRowSets.length];
    const columnLetter = columnSet[Math.floor(utm.easting / 100000) - 1] ?? columnSet[0];
    const rowLetter = rowSet[Math.floor(utm.northing / 100000) % rowSet.length];
    const easting = String(utm.easting % 100000).padStart(5, '0');
    const northing = String(utm.northing % 100000).padStart(5, '0');
    return `${utm.zoneNumber}${utm.zoneLetter} ${columnLetter}${rowLetter} ${easting} ${northing}`;
  }

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
