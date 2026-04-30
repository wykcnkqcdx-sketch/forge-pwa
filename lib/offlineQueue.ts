import * as SQLite from 'expo-sqlite';
import type { CloudMutation } from './cloud';

const DATABASE_NAME = 'forge-offline-queue.db';
const QUEUE_LIMIT = 50;

type OfflineQueueRow = {
  id: string;
  type: CloudMutation['type'];
  payload: string;
  created_at: string;
  attempt_count: number;
  last_error: string | null;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function createMutationId() {
  return `mutation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS offline_queue (
          id text primary key not null,
          type text not null,
          payload text not null,
          created_at text not null,
          attempt_count integer not null default 0,
          last_error text
        );
        CREATE INDEX IF NOT EXISTS offline_queue_created_at_idx
        ON offline_queue (created_at);
      `);
      return db;
    })();
  }

  return dbPromise;
}

export async function enqueueOfflineMutation(mutation: CloudMutation) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO offline_queue (id, type, payload, created_at, attempt_count, last_error) VALUES (?, ?, ?, ?, 0, null)',
    createMutationId(),
    mutation.type,
    JSON.stringify(mutation.payload),
    new Date().toISOString()
  );
}

export async function getPendingOfflineMutationCount() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM offline_queue');
  return row?.count ?? 0;
}

export async function replayOfflineQueue(applyMutation: (mutation: CloudMutation) => Promise<void>) {
  const db = await getDb();
  let replayed = 0;

  while (true) {
    const rows = await db.getAllAsync<OfflineQueueRow>(
      'SELECT * FROM offline_queue ORDER BY created_at ASC LIMIT ?',
      QUEUE_LIMIT
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        await applyMutation({
          type: row.type,
          payload: JSON.parse(row.payload),
        } as CloudMutation);
        await db.runAsync('DELETE FROM offline_queue WHERE id = ?', row.id);
        replayed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await db.runAsync(
          'UPDATE offline_queue SET attempt_count = attempt_count + 1, last_error = ? WHERE id = ?',
          message,
          row.id
        );
        throw error;
      }
    }
  }

  return replayed;
}

export async function clearOfflineQueue() {
  const db = await getDb();
  await db.runAsync('DELETE FROM offline_queue');
}
