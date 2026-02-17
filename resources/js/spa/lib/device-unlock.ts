import type { UserPayload } from './api';
import type { KdfParams } from './crypto';
import { buildPbkdf2Params, randomBytes, unwrapKey, wrapKey } from './crypto';

const storageKey = 'deenify_device_unlock';

type DeviceUnlockRecord = {
    credentialId: string;
    prfSalt: string;
    wrappedDek: { ciphertext: string; iv: string };
    userId: string;
    createdAt: number;
};

function bufferToBase64Url(buffer: ArrayBuffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBuffer(data: string) {
    const padded = data.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(data.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function loadRecord(): DeviceUnlockRecord | null {
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return null;
        return JSON.parse(raw) as DeviceUnlockRecord;
    } catch {
        return null;
    }
}

function saveRecord(record: DeviceUnlockRecord) {
    localStorage.setItem(storageKey, JSON.stringify(record));
}

export function clearDeviceUnlock() {
    localStorage.removeItem(storageKey);
}

export function hasDeviceUnlockConfig(userId?: string) {
    const record = loadRecord();
    if (!record) return false;
    if (userId && record.userId !== userId) return false;
    return true;
}

export async function isDeviceUnlockSupported(): Promise<boolean> {
    if (!window.isSecureContext) return false;
    if (!('PublicKeyCredential' in window)) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

async function derivePrfKey(credentialId: string, prfSalt: string) {
    const publicKey: PublicKeyCredentialRequestOptions = {
        challenge: randomBytes(32),
        allowCredentials: [
            {
                id: new Uint8Array(base64UrlToBuffer(credentialId)),
                type: 'public-key',
            },
        ],
        userVerification: 'required',
        extensions: {
            prf: { eval: { first: new Uint8Array(base64UrlToBuffer(prfSalt)) } },
        },
    };

    const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
    const results = credential.getClientExtensionResults() as {
        prf?: { results?: { first?: ArrayBuffer } };
    };
    const prf = results?.prf?.results?.first;
    if (!prf) {
        throw new Error('Face ID/Passkey PRF wird von diesem Gerät nicht unterstützt.');
    }

    return crypto.subtle.importKey('raw', prf, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function enableDeviceUnlock(dek: CryptoKey, user: UserPayload) {
    if (!user?.id) {
        throw new Error('Kein Benutzer gefunden.');
    }
    const supported = await isDeviceUnlockSupported();
    if (!supported) {
        throw new Error('Face ID/Passkey wird auf diesem Gerät nicht unterstützt.');
    }

    const credential = (await navigator.credentials.create({
        publicKey: {
            challenge: randomBytes(32),
            rp: { name: 'Deenify', id: window.location.hostname },
            user: {
                id: new TextEncoder().encode(user.id),
                name: user.username || user.email || 'Deenify',
                displayName: user.username || user.email || 'Deenify',
            },
            pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                residentKey: 'required',
                userVerification: 'required',
            },
            attestation: 'none',
            extensions: { prf: {} },
        },
    })) as PublicKeyCredential;

    const credentialId = bufferToBase64Url(credential.rawId);
    const prfSalt = bufferToBase64Url(randomBytes(32));
    const prfKey = await derivePrfKey(credentialId, prfSalt);
    const wrappedDek = await wrapKey(dek, prfKey);

    saveRecord({
        credentialId,
        prfSalt,
        wrappedDek,
        userId: user.id,
        createdAt: Date.now(),
    });
}

export async function unlockWithDevice(user: UserPayload): Promise<{ dek: CryptoKey; kdfParams: KdfParams }> {
    const record = loadRecord();
    if (!record || record.userId !== user.id) {
        throw new Error('Face ID ist auf diesem Gerät nicht eingerichtet.');
    }

    const prfKey = await derivePrfKey(record.credentialId, record.prfSalt);
    const dek = await unwrapKey(record.wrappedDek, prfKey);

    const params: KdfParams = {
        algorithm: (user.vault.kdf_params?.algorithm as KdfParams['algorithm']) ?? 'pbkdf2',
        iterations: user.vault.kdf_params?.iterations as number | undefined,
        memory: user.vault.kdf_params?.memory as number | undefined,
        parallelism: user.vault.kdf_params?.parallelism as number | undefined,
        hashLength: user.vault.kdf_params?.hashLength as number | undefined,
        salt: user.vault.kdf_salt,
    };

    if (!params.salt) {
        const fallback = await buildPbkdf2Params();
        params.salt = fallback.salt;
    }

    return { dek, kdfParams: params };
}
