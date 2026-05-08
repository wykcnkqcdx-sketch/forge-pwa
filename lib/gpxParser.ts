export type GpxPoint = {
  lat: number;
  lon: number;
  ele?: number;
  name?: string;
  time?: number;
};

export type GpxResult = {
  name?: string;
  trackPoints: GpxPoint[];
  waypoints: GpxPoint[];
};

export function parseGpx(xml: string): GpxResult {
  const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(xml);
  const name = nameMatch
    ? nameMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    : undefined;

  const trackPoints: GpxPoint[] = [];
  const trkptRe = /<trkpt\s+([^>]*)>([\s\S]*?)<\/trkpt>/gi;
  let m: RegExpExecArray | null;
  while ((m = trkptRe.exec(xml)) !== null) {
    const latM = /lat="([^"]+)"/.exec(m[1]);
    const lonM = /lon="([^"]+)"/.exec(m[1]);
    if (!latM || !lonM) continue;
    const lat = parseFloat(latM[1]);
    const lon = parseFloat(lonM[1]);
    if (isNaN(lat) || isNaN(lon)) continue;
    const eleM = /<ele>([\s\S]*?)<\/ele>/i.exec(m[2]);
    const timeM = /<time>([\s\S]*?)<\/time>/i.exec(m[2]);
    trackPoints.push({
      lat,
      lon,
      ele: eleM ? parseFloat(eleM[1]) : undefined,
      time: timeM ? new Date(timeM[1].trim()).getTime() : undefined,
    });
  }

  const waypoints: GpxPoint[] = [];
  const wptRe = /<wpt\s+([^>]*)>([\s\S]*?)<\/wpt>/gi;
  while ((m = wptRe.exec(xml)) !== null) {
    const latM = /lat="([^"]+)"/.exec(m[1]);
    const lonM = /lon="([^"]+)"/.exec(m[1]);
    if (!latM || !lonM) continue;
    const lat = parseFloat(latM[1]);
    const lon = parseFloat(lonM[1]);
    if (isNaN(lat) || isNaN(lon)) continue;
    const wNameM = /<name>([\s\S]*?)<\/name>/i.exec(m[2]);
    waypoints.push({
      lat,
      lon,
      name: wNameM ? wNameM[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : undefined,
    });
  }

  return { name, trackPoints, waypoints };
}
