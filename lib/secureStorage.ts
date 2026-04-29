import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const dbName = 'forge-secure-local';
const storeName = 'encrypted-records';
const secretKey = 'forge:local_crypto_secret';

type SecureRecord = {
  id: string;
  iv: number[];
  payload: number[];
};

function isWebCryptoAvailable() {
  return Platform.OS === 'web'
    && typeof indexedDB !== 'undefined'
    && typeof crypto !== 'undefined'
    && Boolean(crypto.subtle);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transact<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = callback(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  }));
}

async function getSecret() {
  const existing = await AsyncStorage.getItem(secretKey);
  if (existing) return existing;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  await AsyncStorage.setItem(secretKey, secret);
  return secret;
}

async function getCryptoKey() {
  const secret = await getSecret();
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: new TextEncoder().encode('forge-local-only-v1'), iterations: 210000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function secureSetItem(key: string, value: string) {
  if (!isWebCryptoAvailable()) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  const cryptoKey = await getCryptoKey();
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(value));
  const record: SecureRecord = { id: key, iv: Array.from(iv), payload: Array.from(new Uint8Array(encrypted)) };
  await transact('readwrite', (store) => store.put(record));
}

export async function secureGetItem(key: string) {
  if (!isWebCryptoAvailable()) return AsyncStorage.getItem(key);

  const record = await transact<SecureRecord | undefined>('readonly', (store) => store.get(key));
  if (!record) return null;

  const cryptoKey = await getCryptoKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(record.iv) },
    cryptoKey,
    new Uint8Array(record.payload)
  );
  return new TextDecoder().decode(decrypted);
}

export async function secureRemoveItem(key: string) {
  if (!isWebCryptoAvailable()) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await transact('readwrite', (store) => store.delete(key));
}

export async function secureMultiRemove(keys: string[]) {
  await Promise.all(keys.map(secureRemoveItem));
}
