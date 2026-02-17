import argon2 from 'argon2-browser/dist/argon2-bundled.min.js';

export type KdfParams = {
    algorithm: 'argon2id' | 'pbkdf2';
    iterations?: number;
    memory?: number;
    parallelism?: number;
    hashLength?: number;
    salt: string;
};

export type EncryptedPayload = {
    ciphertext: string;
    iv: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(base64: string): Uint8Array {
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function randomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
}

export async function deriveKey(password: string, params: KdfParams): Promise<CryptoKey> {
    const saltBytes = fromBase64(params.salt);

    if (params.algorithm === 'argon2id') {
        const result = await argon2.hash({
            pass: password,
            salt: saltBytes,
            type: 2,
            hashLen: params.hashLength ?? 32,
            time: params.iterations ?? 3,
            mem: params.memory ?? 65536,
            parallelism: params.parallelism ?? 1,
        });

        return crypto.subtle.importKey('raw', result.hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        textEncoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: params.iterations ?? 250000,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

export async function generateDek(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
    const raw = await crypto.subtle.exportKey('raw', key);
    return new Uint8Array(raw);
}

export async function wrapKey(keyToWrap: CryptoKey, wrappingKey: CryptoKey): Promise<EncryptedPayload> {
    const iv = randomBytes(12);
    const raw = await crypto.subtle.exportKey('raw', keyToWrap);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        wrappingKey,
        raw,
    );

    return {
        ciphertext: toBase64(ciphertext),
        iv: toBase64(iv),
    };
}

export async function unwrapKey(payload: EncryptedPayload, wrappingKey: CryptoKey): Promise<CryptoKey> {
    const iv = fromBase64(payload.iv);
    const ciphertext = fromBase64(payload.ciphertext);
    const raw = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        wrappingKey,
        ciphertext,
    );
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
}

export async function encryptJson(data: unknown, key: CryptoKey): Promise<EncryptedPayload> {
    const iv = randomBytes(12);
    const encoded = textEncoder.encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}

export async function decryptJson<T>(payload: EncryptedPayload, key: CryptoKey): Promise<T> {
    const iv = fromBase64(payload.iv);
    const ciphertext = fromBase64(payload.ciphertext);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return JSON.parse(textDecoder.decode(decrypted)) as T;
}

export function buildArgon2Params(): KdfParams {
    return {
        algorithm: 'argon2id',
        iterations: 3,
        memory: 65536,
        parallelism: 1,
        hashLength: 32,
        salt: toBase64(randomBytes(16)),
    };
}

export function buildPbkdf2Params(): KdfParams {
    return {
        algorithm: 'pbkdf2',
        iterations: 250000,
        salt: toBase64(randomBytes(16)),
    };
}

export async function selectKdfParams(): Promise<KdfParams> {
    try {
        const params = buildArgon2Params();
        await deriveKey('probe', params);
        return params;
    } catch (error) {
        return buildPbkdf2Params();
    }
}

export function isCryptoSupported(): boolean {
    return (
        typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof crypto.getRandomValues === 'function'
    );
}

export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Ein Fehler ist aufgetreten.';
}
