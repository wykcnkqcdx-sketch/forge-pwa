type PinData = { hash: string; length: number };

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parsePinData(stored: string): PinData | null {
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>).hash === 'string' &&
      typeof (parsed as Record<string, unknown>).length === 'number'
    ) {
      return parsed as PinData;
    }
    return null;
  } catch {
    return null;
  }
}

export async function encodePin(pin: string): Promise<string> {
  const hash = await sha256(pin);
  return JSON.stringify({ hash, length: pin.length } satisfies PinData);
}

export async function verifyPin(input: string, encoded: string): Promise<boolean> {
  const data = parsePinData(encoded);
  if (!data) return false;
  const inputHash = await sha256(input);
  return inputHash === data.hash;
}

export function getPinLength(encoded: string): number {
  return parsePinData(encoded)?.length ?? 4;
}

/** Migrates a legacy plaintext PIN to hashed format; returns null if the stored value is unrecognisable. */
export async function migratePlaintextPin(stored: string): Promise<string | null> {
  if (parsePinData(stored)) return stored;
  if (/^\d{4,8}$/.test(stored)) return encodePin(stored);
  return null;
}
