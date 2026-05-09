const TOKEN_BYTES = 32;
const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function bytesToToken(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getCrypto() {
  return typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
}

export function generateInviteToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  const crypto = getCrypto();

  if (crypto?.getRandomValues) {
    crypto.getRandomValues(bytes);
    return bytesToToken(bytes);
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytesToToken(bytes);
}

export async function hashInviteToken(token: string) {
  const crypto = getCrypto();
  if (crypto?.subtle) {
    const encoded = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return bytesToHex(new Uint8Array(digest));
  }

  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildSecureInviteUrl(appBaseUrl: string, token: string) {
  const url = new URL(appBaseUrl);
  url.searchParams.set('invite', token);
  return url.toString();
}

export function inviteExpiry(days = 14) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
