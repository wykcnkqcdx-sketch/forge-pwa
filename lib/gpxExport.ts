import * as Sharing from 'expo-sharing';
import { writeAsStringAsync, Paths } from 'expo-file-system';
import type { TrainingSession } from '../data/mockData';

export function buildGpxXml(session: TrainingSession): string {
  const points = session.routePoints ?? [];
  const name = (session.title ?? 'FORGE Route').replace(/[<>&"']/g, '');
  const date = session.completedAt ?? new Date().toISOString();

  const trkpts = points
    .map((p) => {
      const ele = p.altitude != null ? `\n        <ele>${p.altitude.toFixed(1)}</ele>` : '';
      const time = `\n        <time>${new Date(p.timestamp).toISOString()}</time>`;
      return `      <trkpt lat="${p.latitude.toFixed(7)}" lon="${p.longitude.toFixed(7)}">${ele}${time}\n      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FORGE Tactical Fitness" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${date}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export async function exportSessionGpx(session: TrainingSession): Promise<void> {
  const points = session.routePoints ?? [];
  if (points.length < 2) throw new Error('No route data for this session.');

  const xml = buildGpxXml(session);
  const slug = (session.title ?? 'route').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const fileUri = `${Paths.cache.uri}${slug}_${session.id}.gpx`;

  await writeAsStringAsync(fileUri, xml, { encoding: 'utf8' });
  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/gpx+xml',
    dialogTitle: 'Export GPX Route',
    UTI: 'com.topografix.gpx',
  });
}
