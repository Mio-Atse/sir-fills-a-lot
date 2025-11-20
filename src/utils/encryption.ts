// Lightweight encryption helper for shielding sensitive values at rest inside chrome.storage.
// Uses a per-installation AES-GCM key that is generated on first use and stored alongside data
// (obfuscation against casual inspection; not a substitute for user passphrases).
const STORAGE_KEY = 'sf_encryption_key_v1';
const PREFIX = 'enc.v1:';

let cachedCryptoKey: CryptoKey | null = null;

const toBase64 = (data: ArrayBuffer | ArrayBufferLike): string => {
    const view = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data);
    return btoa(String.fromCharCode(...view));
};

const fromBase64 = (b64: string): Uint8Array => {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
};

async function importKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
    return crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

async function getOrCreateKey(): Promise<CryptoKey> {
    if (cachedCryptoKey) return cachedCryptoKey;

    const existing = await chrome.storage.local.get(STORAGE_KEY);
    let keyBytes: Uint8Array;

    if (existing?.[STORAGE_KEY]) {
        keyBytes = fromBase64(existing[STORAGE_KEY]);
    } else {
        keyBytes = crypto.getRandomValues(new Uint8Array(32));
        await chrome.storage.local.set({ [STORAGE_KEY]: toBase64(keyBytes.buffer as ArrayBuffer) });
    }

    cachedCryptoKey = await importKey(keyBytes.buffer as ArrayBuffer);
    return cachedCryptoKey;
}

export const isEncryptedString = (value?: string | null): boolean => {
    return typeof value === 'string' && value.startsWith(PREFIX);
};

export async function encryptString(plaintext: string): Promise<string> {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return `${PREFIX}${toBase64(iv.buffer)}:${toBase64(cipher)}`;
}

export async function decryptString(value: string): Promise<string> {
    if (!isEncryptedString(value)) return value;

    const key = await getOrCreateKey();
    const [, payload] = value.split(PREFIX);
    const [ivB64, cipherB64] = payload.split(':');
    const iv = fromBase64(ivB64);
    const cipher = fromBase64(cipherB64);

    const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
    const cipherBuffer = cipher.buffer.slice(cipher.byteOffset, cipher.byteOffset + cipher.byteLength) as ArrayBuffer;
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBuffer }, key, cipherBuffer);
    return new TextDecoder().decode(decrypted);
}
