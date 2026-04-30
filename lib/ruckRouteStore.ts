import * as SQLite from 'expo-sqlite';
import type { TrackPoint } from '../data/domain';

const DATABASE_NAME = 'forge-ruck-route.db';

type RoutePointRow = {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  timestamp: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS active_ruck_route (
          id integer primary key autoincrement,
          latitude real not null,
          longitude real not null,
          altitude real,
          accuracy real,
          timestamp integer not null
        );
        CREATE INDEX IF NOT EXISTS active_ruck_route_timestamp_idx
        ON active_ruck_route (timestamp);
      `);
      return db;
    })();
  }

  return dbPromise;
}

async function insertRoutePoint(db: SQLite.SQLiteDatabase, point: TrackPoint) {
  await db.runAsync(
    'INSERT INTO active_ruck_route (latitude, longitude, altitude, accuracy, timestamp) VALUES (?, ?, ?, ?, ?)',
    point.latitude,
    point.longitude,
    point.altitude,
    point.accuracy,
    point.timestamp
  );
}

export async function resetActiveRoute(firstPoint: TrackPoint) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM active_ruck_route');
    await insertRoutePoint(db, firstPoint);
  });
}

export async function appendActiveRoutePoints(points: TrackPoint[]) {
  if (points.length === 0) return;

  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const point of points) {
      await insertRoutePoint(db, point);
    }
  });
}

export async function replaceActiveRoute(points: TrackPoint[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM active_ruck_route');
    for (const point of points) {
      await insertRoutePoint(db, point);
    }
  });
}

export async function loadActiveRoute(): Promise<TrackPoint[]> {
  const db = await getDb();
  return db.getAllAsync<RoutePointRow>('SELECT latitude, longitude, altitude, accuracy, timestamp FROM active_ruck_route ORDER BY id ASC');
}

export async function clearActiveRoute() {
  const db = await getDb();
  await db.runAsync('DELETE FROM active_ruck_route');
}
