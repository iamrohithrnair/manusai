/**
 * Browser-only: encrypt Manus API key for localStorage using Web Crypto (AES-GCM + PBKDF2).
 * Import only from client components or client-only modules.
 *
 * Security notes:
 * - ciphertext is bound to this origin + device id + build-time pepper (NEXT_PUBLIC_MANUS_STORAGE_PEPPER).
 * - Does not stop XSS with script access; mitigates casual inspection of raw localStorage.
 * - For stronger protection, use an OS keychain or a backend proxy — not available in a static SPA.
 */

const STORAGE_KEY = 'graphluence_manus_key_v1';
const DEVICE_ID_KEY = 'graphluence_device_id_v1';

const DEFAULT_PEPPER =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MANUS_STORAGE_PEPPER
    ? process.env.NEXT_PUBLIC_MANUS_STORAGE_PEPPER
    : 'graphluence-manus-local-storage-v1';

function getPepper(): string {
  return DEFAULT_PEPPER;
}

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(pbkdf2Salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const password = enc.encode(`${getPepper()}:${getOrCreateDeviceId()}`);
  const keyMaterial = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, [
    'deriveBits',
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: pbkdf2Salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export type EncryptedManusKeyBlob = {
  v: 1;
  pbkdf2Salt: string;
  iv: string;
  ciphertext: string;
};

export async function encryptManusApiKey(plain: string): Promise<string> {
  const pbkdf2Salt = crypto.getRandomValues(new Uint8Array(16));
  const aesKey = await deriveAesKey(pbkdf2Salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    enc.encode(plain)
  );
  const blob: EncryptedManusKeyBlob = {
    v: 1,
    pbkdf2Salt: b64encode(pbkdf2Salt),
    iv: b64encode(iv),
    ciphertext: b64encode(ct),
  };
  return JSON.stringify(blob);
}

export async function decryptManusApiKey(stored: string): Promise<string> {
  const blob = JSON.parse(stored) as EncryptedManusKeyBlob;
  if (blob.v !== 1 || !blob.pbkdf2Salt || !blob.iv || !blob.ciphertext) {
    throw new Error('Invalid encrypted key format');
  }
  const pbkdf2Salt = b64decode(blob.pbkdf2Salt);
  const iv = b64decode(blob.iv);
  const ciphertext = b64decode(blob.ciphertext);
  const aesKey = await deriveAesKey(pbkdf2Salt);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    ciphertext as BufferSource
  );
  return new TextDecoder().decode(pt);
}

export function hasStoredManusApiKey(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(STORAGE_KEY)?.trim();
}

export async function loadManusApiKeyFromStorage(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY)?.trim();
  if (!raw) return null;
  try {
    return await decryptManusApiKey(raw);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export async function saveManusApiKeyToStorage(plain: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const trimmed = plain.trim();
  if (!trimmed) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const enc = await encryptManusApiKey(trimmed);
  localStorage.setItem(STORAGE_KEY, enc);
}

export function clearManusApiKeyFromStorage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

/** For fetch / transport: only attach header when a key is present. */
export function manusKeyHeaders(apiKey: string | null | undefined): Record<string, string> {
  const k = apiKey?.trim();
  if (!k) return {};
  return { 'x-manus-api-key': k };
}
