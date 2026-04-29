import AsyncStorage from '@react-native-async-storage/async-storage';
import Dexie from 'dexie';
import { applyEncryptionMiddleware, clearEncryptedTables, ENCRYPT_LIST } from 'dexie-encrypted';
import { Platform } from 'react-native';

const dbName = 'forge-secure-local';
const secretKey = 'forge:local_crypto_secret';

type SecureRecord = {
  id: string;
  value: string;
};

type SecureDb = {
  records: {
    put: (record: SecureRecord) => Promise<string>;
    get: (id: string) => Promise<SecureRecord | undefined>;
    delete: (id: string) => Promise<void>;
  };
  open: () => Promise<unknown>;
};

let dbPromise: Promise<SecureDb> | null = null;

function isIndexedDbAvailable() {
  return Platform.OS === 'web' && typeof indexedDB !== 'undefined';
}

async function getSecretBytes() {
  const existing = await AsyncStorage.getItem(secretKey);
  if (existing) {
    return Uint8Array.from(existing.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
  }

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await AsyncStorage.setItem(secretKey, secret);
  return bytes;
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = new Dexie(dbName) as unknown as SecureDb & { version: (version: number) => { stores: (schema: Record<string, string>) => void } };
      applyEncryptionMiddleware(
        db as never,
        getSecretBytes(),
        {
          records: {
            type: ENCRYPT_LIST,
            fields: ['value'],
          },
        } as never,
        clearEncryptedTables
      );
      db.version(2).stores({ records: 'id' });
      await db.open();
      return db;
    })();
  }

  return dbPromise;
}

export async function secureSetItem(key: string, value: string) {
  if (!isIndexedDbAvailable()) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  const db = await getDb();
  await db.records.put({ id: key, value });
}

export async function secureGetItem(key: string) {
  if (!isIndexedDbAvailable()) return AsyncStorage.getItem(key);

  const db = await getDb();
  const record = await db.records.get(key);
  return record?.value ?? null;
}

export async function secureRemoveItem(key: string) {
  if (!isIndexedDbAvailable()) {
    await AsyncStorage.removeItem(key);
    return;
  }

  const db = await getDb();
  await db.records.delete(key);
}

export async function secureMultiRemove(keys: string[]) {
  await Promise.all(keys.map(secureRemoveItem));
}
