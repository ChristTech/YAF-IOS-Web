const PBKDF2_ITERATIONS = 10000;
const KEY_LENGTH_BITS = 256;

function getSubtleCrypto(): SubtleCrypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto SubtleCrypto is unavailable in this environment.');
}

function getRandomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function derivePbkdf2Hash(password: string, saltBytes: Uint8Array): Promise<string> {
  const subtle = getSubtleCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const saltBuffer = new Uint8Array(saltBytes).buffer;
  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH_BITS
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

export async function hashPassword(password: string): Promise<{
  saltBase64: string;
  hashBase64: string;
  combined: string;
}> {
  const saltBytes = getRandomBytes(16);
  const saltBase64 = bytesToBase64(saltBytes);
  const hashBase64 = await derivePbkdf2Hash(password, saltBytes);
  return {
    saltBase64,
    hashBase64,
    combined: `${saltBase64}:${hashBase64}`,
  };
}

export async function verifyPassword(
  candidatePassword: string,
  account: {
    passwordSalt?: string;
    passwordHash?: string;
    password?: string;
  }
): Promise<boolean> {
  if (!candidatePassword) return false;

  // 1. Explicit passwordSalt + passwordHash fields (Android/Web standard)
  if (account.passwordSalt && account.passwordHash) {
    try {
      const saltBytes = base64ToBytes(account.passwordSalt.trim());
      const derived = await derivePbkdf2Hash(candidatePassword, saltBytes);
      if (constantTimeEqual(derived, account.passwordHash.trim())) {
        return true;
      }
    } catch {
      // fall through to other formats
    }
  }

  // 2. Combined string formats in `password` field ("salt:hash", "salt$hash", or "pbkdf2:10000:salt:hash")
  if (account.password) {
    const raw = account.password.trim();
    if (raw.includes(':')) {
      const parts = raw.split(':');
      if (parts.length === 2) {
        try {
          const saltBytes = base64ToBytes(parts[0]);
          const derived = await derivePbkdf2Hash(candidatePassword, saltBytes);
          if (constantTimeEqual(derived, parts[1])) return true;
        } catch {
          // ignore invalid base64
        }
      } else if (parts.length >= 4) {
        const saltPart = parts[parts.length - 2];
        const hashPart = parts[parts.length - 1];
        try {
          const saltBytes = base64ToBytes(saltPart);
          const derived = await derivePbkdf2Hash(candidatePassword, saltBytes);
          if (constantTimeEqual(derived, hashPart)) return true;
        } catch {
          // ignore
        }
      }
    }
    if (raw.includes('$')) {
      const parts = raw.split('$');
      if (parts.length === 2) {
        try {
          const saltBytes = base64ToBytes(parts[0]);
          const derived = await derivePbkdf2Hash(candidatePassword, saltBytes);
          if (constantTimeEqual(derived, parts[1])) return true;
        } catch {
          // ignore
        }
      }
    }

    // 3. Direct plaintext fallback (e.g., seeded AdminPass#2026 document)
    if (constantTimeEqual(candidatePassword, raw)) {
      return true;
    }
  }

  return false;
}
