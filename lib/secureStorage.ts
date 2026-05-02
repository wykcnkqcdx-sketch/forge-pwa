/**
 * Secure storage for web (IndexedDB) and native (AsyncStorage).
 *
 * On web, each value is encrypted with AES-256-GCM. The encryption key is a
 * non-extractable CryptoKey stored in a dedicated IndexedDB keystore — the raw
 * key bytes are never accessible to JavaScript, even via DevTools.
 *
 * On native (iOS/Android), falls back to AsyncStorage (platform keychain
 * integration is a native-build concern handled at the Expo layer).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Dexie from 'dexie';
import { Platform } from 'react-native';

// ── Constants ────────────────────────────────────────────────────────────────

const KEY_DB_NAME = 'forge-keystore';
const DATA_DB_NAME = 'forge-secure-local-v2';
const CRYPTO_KEY_SLOT = 'primary';
const IV_BYTES = 12;

// ── Types ─────────────────────────────────────────────────────────────────────

type EncryptedRecord = {
  id: string;
  data: ArrayBuffer; // IV (12 bytes) || AES-GCM ciphertext
};

type DataDb = {
  records: Dexie.Table<EncryptedRecord, string>;
};

// ── Platform guard ────────────────────────────────────────────────────────────

function isWebWithIndexedDb() {
  return Platform.OS === 'web' && typeof indexedDB !== 'undefined' && typeof crypto?.subtle !== 'undefined';
}

// ── Raw IndexedDB key store (stores CryptoKey objects natively) ───────────────

let keyDbPromise: Promise<IDBDatabase> | null = null;

function openKeyDb(): Promise<IDBDatabase> {
  if (!keyDbPromise) {
    keyDbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(KEY_DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('keys');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        keyDbPromise = null;
        reject(req.error);
      };
    });
  }
  return keyDbPromise;
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readwrite').objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Non-extractable CryptoKey management ─────────────────────────────────────

let cryptoKeyPromise: Promise<CryptoKey> | null = null;

async function getOrCreateCryptoKey(): Promise<CryptoKey> {
  if (!cryptoKeyPromise) {
    cryptoKeyPromise = (async () => {
      const db = await openKeyDb();
      const stored = await idbGet<CryptoKey>(db, 'keys', CRYPTO_KEY_SLOT);
      if (stored) return stored;

      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable: raw bytes are NEVER accessible to JS
        ['encrypt', 'decrypt'],
      );
      await idbPut(db, 'keys', CRYPTO_KEY_SLOT, key);
      return key;
    })().catch((err) => {
      cryptoKeyPromise = null;
      throw err;
    });
  }
  return cryptoKeyPromise;
}

// ── AES-GCM helpers ───────────────────────────────────────────────────────────

async function encrypt(key: CryptoKey, plaintext: string): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_BYTES);
  return result.buffer;
}

async function decrypt(key: CryptoKey, data: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(data);
  const iv = bytes.slice(0, IV_BYTES);
  const ciphertext = bytes.slice(IV_BYTES);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

// ── Dexie data store (stores encrypted blobs) ────────────────────────────────

let dataDbPromise: Promise<DataDb & Dexie> | null = null;

function getDataDb(): Promise<DataDb & Dexie> {
  if (!dataDbPromise) {
    dataDbPromise = (async () => {
      const db = new Dexie(DATA_DB_NAME) as DataDb & Dexie;
      db.version(1).stores({ records: 'id' });
      await db.open();
      return db;
    })().catch((err) => {
      dataDbPromise = null;
      throw err;
    });
  }
  return dataDbPromise;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function secureSetItem(key: string, value: string): Promise<void> {
  if (!isWebWithIndexedDb()) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  const [cryptoKey, db] = await Promise.all([getOrCreateCryptoKey(), getDataDb()]);
  const data = await encrypt(cryptoKey, value);
  await db.records.put({ id: key, data });
}

export async function secureGetItem(key: string): Promise<string | null> {
  if (!isWebWithIndexedDb()) return AsyncStorage.getItem(key);

  const [cryptoKey, db] = await Promise.all([getOrCreateCryptoKey(), getDataDb()]);
  const record = await db.records.get(key);
  if (!record) {
    // Migration path: plain AsyncStorage value from a previous install
    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      // Re-encrypt into the new store and clear the legacy copy
      await secureSetItem(key, legacy);
      await AsyncStorage.removeItem(key);
      return legacy;
    }
    return null;
  }

  try {
    return await decrypt(cryptoKey, record.data);
  } catch {
    console.error(`Failed to decrypt stored value for "${key}" — data may be corrupt`);
    return null;
  }
}

export async function secureRemoveItem(key: string): Promise<void> {
  if (!isWebWithIndexedDb()) {
    await AsyncStorage.removeItem(key);
    return;
  }
  const db = await getDataDb();
  await db.records.delete(key);
}

export async function secureMultiRemove(keys: string[]): Promise<void> {
  await Promise.all(keys.map(secureRemoveItem));
}

export async function secureDestroyLocalData(keys: string[]): Promise<void> {
  await secureMultiRemove(keys);

  if (isWebWithIndexedDb()) {
    // Close and delete the data store
    if (dataDbPromise) {
      const db = await dataDbPromise;
      db.close();
      dataDbPromise = null;
    }
    await Dexie.delete(DATA_DB_NAME);

    // Delete the keystore — next launch generates a fresh key
    if (keyDbPromise) {
      const keyDb = await keyDbPromise;
      keyDb.close();
      keyDbPromise = null;
    }
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(KEY_DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve(); // best-effort
    });

    cryptoKeyPromise = null;
  }

  // Always clear AsyncStorage (legacy values + native path)
  await AsyncStorage.multiRemove(keys);
}
