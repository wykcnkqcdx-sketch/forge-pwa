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

export type ParsedCoordinate = {
  latitude: number;
  longitude: number;
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

function latitudeBandMinimum(band: string) {
  const index = latitudeBands.indexOf(band);
  if (band === 'X') return 72;
  if (index < 0) return null;
  return -80 + index * 8;
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

export function fromUtm(utm: UtmCoordinate): ParsedCoordinate {
  const northernHemisphere = utm.zoneLetter >= 'N';
  const x = utm.easting - 500000;
  let y = utm.northing;
  if (!northernHemisphere) y -= 10000000;

  const semiMajorAxis = 6378137;
  const eccentricitySquared = 0.00669438;
  const scaleFactor = 0.9996;
  const eccentricityPrimeSquared = eccentricitySquared / (1 - eccentricitySquared);
  const e1 = (1 - Math.sqrt(1 - eccentricitySquared)) / (1 + Math.sqrt(1 - eccentricitySquared));
  const lonOrigin = (utm.zoneNumber - 1) * 6 - 180 + 3;
  const m = y / scaleFactor;
  const mu = m / (semiMajorAxis * (1 - eccentricitySquared / 4 - 3 * eccentricitySquared ** 2 / 64 - 5 * eccentricitySquared ** 3 / 256));
  const phi1Rad = mu
    + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu);

  const n1 = semiMajorAxis / Math.sqrt(1 - eccentricitySquared * Math.sin(phi1Rad) ** 2);
  const t1 = Math.tan(phi1Rad) ** 2;
  const c1 = eccentricityPrimeSquared * Math.cos(phi1Rad) ** 2;
  const r1 = semiMajorAxis * (1 - eccentricitySquared) / (1 - eccentricitySquared * Math.sin(phi1Rad) ** 2) ** 1.5;
  const d = x / (n1 * scaleFactor);

  const latitudeRad = phi1Rad - (n1 * Math.tan(phi1Rad) / r1) * (
    d ** 2 / 2
    - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccentricityPrimeSquared) * d ** 4 / 24
    + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * eccentricityPrimeSquared - 3 * c1 ** 2) * d ** 6 / 720
  );
  const longitude = lonOrigin + (
    d
    - (1 + 2 * t1 + c1) * d ** 3 / 6
    + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * eccentricityPrimeSquared + 24 * t1 ** 2) * d ** 5 / 120
  ) / Math.cos(phi1Rad) * 180 / Math.PI;

  return {
    latitude: latitudeRad * 180 / Math.PI,
    longitude,
  };
}

function parseLatLon(input: string): ParsedCoordinate | null {
  const normalized = input.trim().replace(/[,\s]+/g, ' ');
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseDms(input: string): ParsedCoordinate | null {
  const pattern = /(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D*([NSEW])/gi;
  const parts = [...input.matchAll(pattern)].map((match) => {
    const degrees = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3]);
    const hemisphere = match[4].toUpperCase();
    const value = degrees + minutes / 60 + seconds / 3600;
    return { hemisphere, value: hemisphere === 'S' || hemisphere === 'W' ? -value : value };
  });

  const latitude = parts.find((part) => part.hemisphere === 'N' || part.hemisphere === 'S')?.value;
  const longitude = parts.find((part) => part.hemisphere === 'E' || part.hemisphere === 'W')?.value;
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseUtm(input: string): ParsedCoordinate | null {
  const normalized = input.trim().toUpperCase();
  const match = normalized.match(/^(\d{1,2})\s*([C-HJ-NP-X])\s+(\d+(?:\.\d+)?)\s*E?\s+(\d+(?:\.\d+)?)\s*N?$/);
  if (!match) return null;

  const zoneNumber = Number(match[1]);
  const zoneLetter = match[2];
  const easting = Number(match[3]);
  const northing = Number(match[4]);
  if (zoneNumber < 1 || zoneNumber > 60 || easting < 100000 || easting > 900000 || northing < 0 || northing > 10000000) return null;
  return fromUtm({ zoneNumber, zoneLetter, easting, northing });
}

function parseMgrs(input: string): ParsedCoordinate | null {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d{1,2})([C-HJ-NP-X])\s*([A-HJ-NP-Z]{2})\s*(\d{1,5})\s*(\d{1,5})$/);
  if (!match) return null;

  const zoneNumber = Number(match[1]);
  const zoneLetter = match[2];
  const square = match[3];
  const eastingDigits = match[4];
  const northingDigits = match[5];
  if (zoneNumber < 1 || zoneNumber > 60 || eastingDigits.length !== northingDigits.length) return null;

  const columnSet = mgrsColumnSets[(zoneNumber - 1) % mgrsColumnSets.length];
  const rowSet = mgrsRowSets[(zoneNumber - 1) % mgrsRowSets.length];
  const columnIndex = columnSet.indexOf(square[0]);
  const rowIndex = rowSet.indexOf(square[1]);
  const bandMinimum = latitudeBandMinimum(zoneLetter);
  if (columnIndex < 0 || rowIndex < 0 || bandMinimum == null) return null;

  const precisionScale = 10 ** (5 - eastingDigits.length);
  const easting = (columnIndex + 1) * 100000 + Number(eastingDigits) * precisionScale;
  let northing = rowIndex * 100000 + Number(northingDigits) * precisionScale;
  const bandOrigin = toUtm(bandMinimum, (zoneNumber - 1) * 6 - 177).northing;
  while (northing < bandOrigin) northing += 2000000;

  return fromUtm({ zoneNumber, zoneLetter, easting, northing });
}

export function parseCoordinate(input: string, preferredFormat?: CoordinateFormat): ParsedCoordinate | null {
  const parsers = {
    latlon: parseLatLon,
    dms: parseDms,
    utm: parseUtm,
    mgrs: parseMgrs,
  };

  if (preferredFormat) {
    const parsed = parsers[preferredFormat](input);
    if (parsed) return parsed;
  }

  return parseLatLon(input) ?? parseDms(input) ?? parseUtm(input) ?? parseMgrs(input);
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
