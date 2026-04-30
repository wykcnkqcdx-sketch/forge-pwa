import Dexie from 'dexie';
import type { CloudMutation } from './cloud';

const DATABASE_NAME = 'forge-offline-queue';
const QUEUE_LIMIT = 50;

type OfflineQueueRow = {
  id: string;
  type: CloudMutation['type'];
  payload: string;
  created_at: string;
  attempt_count: number;
  last_error: string | null;
};

type OfflineQueueDb = Dexie & {
  queue: Dexie.Table<OfflineQueueRow, string>;
};

let dbPromise: Promise<OfflineQueueDb> | null = null;

function createMutationId() {
  return `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new Dexie(DATABASE_NAME) as OfflineQueueDb;
      db.version(1).stores({
        queue: 'id, created_at',
      });
      await db.open();
      return db;
    })();
  }

  return dbPromise;
}

export async function enqueueOfflineMutation(mutation: CloudMutation) {
  const db = await getDb();
  await db.queue.add({
    id: createMutationId(),
    type: mutation.type,
    payload: JSON.stringify(mutation.payload),
    created_at: new Date().toISOString(),
    attempt_count: 0,
    last_error: null,
  });
}

export async function getPendingOfflineMutationCount() {
  const db = await getDb();
  return db.queue.count();
}

export async function replayOfflineQueue(applyMutation: (mutation: CloudMutation) => Promise<void>) {
  const db = await getDb();
  let replayed = 0;

  while (true) {
    const rows = await db.queue.orderBy('created_at').limit(QUEUE_LIMIT).toArray();
    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        await applyMutation({
          type: row.type,
          payload: JSON.parse(row.payload),
        } as CloudMutation);
        await db.queue.delete(row.id);
        replayed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.queue.update(row.id, {
          attempt_count: row.attempt_count + 1,
          last_error: message,
        });
        throw error;
      }
    }
  }

  return replayed;
}

export async function clearOfflineQueue() {
  const db = await getDb();
  await db.queue.clear();
}
