import Dexie from 'dexie';
import type { RuckMissionPlan, TrackPoint } from '../data/domain';

const DATABASE_NAME = 'forge-ruck-route';

type RoutePointRow = TrackPoint & {
  id?: number;
};

type ActivePlanRow = {
  id: 1;
  plan: RuckMissionPlan;
};

type RuckRouteDb = Dexie & {
  routePoints: Dexie.Table<RoutePointRow, number>;
  plan: Dexie.Table<ActivePlanRow, number>;
};

let dbPromise: Promise<RuckRouteDb> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new Dexie(DATABASE_NAME) as RuckRouteDb;
      db.version(1).stores({
        routePoints: '++id, timestamp',
      });
      db.version(2).stores({
        routePoints: '++id, timestamp',
        plan: 'id',
      });
      await db.open();
      return db;
    })();
  }

  return dbPromise;
}

export async function resetActiveRoute(firstPoint: TrackPoint) {
  const db = await getDb();
  await db.transaction('rw', db.routePoints, async () => {
    await db.routePoints.clear();
    await db.routePoints.add(firstPoint);
  });
}

export async function appendActiveRoutePoints(points: TrackPoint[]) {
  if (points.length === 0) return;

  const db = await getDb();
  await db.routePoints.bulkAdd(points);
}

export async function replaceActiveRoute(points: TrackPoint[]) {
  const db = await getDb();
  await db.transaction('rw', db.routePoints, async () => {
    await db.routePoints.clear();
    if (points.length > 0) await db.routePoints.bulkAdd(points);
  });
}

export async function loadActiveRoute(): Promise<TrackPoint[]> {
  const db = await getDb();
  const rows = await db.routePoints.orderBy('id').toArray();
  return rows.map(({ id: _id, ...point }) => point);
}

export async function clearActiveRoute() {
  const db = await getDb();
  await db.routePoints.clear();
}

export async function saveActiveRuckPlan(plan: RuckMissionPlan) {
  const db = await getDb();
  await db.plan.put({ id: 1, plan });
}

export async function loadActiveRuckPlan(): Promise<RuckMissionPlan | null> {
  const db = await getDb();
  const row = await db.plan.get(1);
  return row?.plan ?? null;
}

export async function clearActiveRuckPlan() {
  const db = await getDb();
  await db.plan.clear();
}
