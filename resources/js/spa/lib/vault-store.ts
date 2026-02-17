import { create } from 'zustand';
import type { UserPayload } from './api';
import { initVault } from './api';
import type { KdfParams } from './crypto';
import {
    buildPbkdf2Params,
    decryptJson,
    deriveKey,
    encryptJson,
    exportRawKey,
    formatError,
    generateDek,
    isCryptoSupported,
    unwrapKey,
    wrapKey,
} from './crypto';

export type VaultStatus = 'locked' | 'unlocked' | 'initializing' | 'error';

type VaultState = {
    status: VaultStatus;
    error: string | null;
    dek: CryptoKey | null;
    kdfParams: KdfParams | null;
    autoLockMinutes: number;
    initVault: (masterPassword: string) => Promise<void>;
    unlock: (masterPassword: string, user: UserPayload) => Promise<void>;
    unlockWithDek: (dek: CryptoKey, params: KdfParams) => void;
    lock: () => void;
    setAutoLockMinutes: (minutes: number) => void;
    encryptEntry: (data: unknown) => Promise<{ ciphertext: string; iv: string }>;
    decryptEntry: <T>(payload: { ciphertext: string; iv: string }) => Promise<T>;
};

let autoLockTimer: number | null = null;
const devStorageKey = 'deenify_dev_dek';
const devUnlockedAtKey = 'deenify_dev_unlocked_at';
const devAutoLockKey = 'deenify_dev_autolock';

function scheduleAutoLock(minutes: number, lock: () => void) {
    if (autoLockTimer) {
        window.clearTimeout(autoLockTimer);
        autoLockTimer = null;
    }
    if (!minutes || minutes <= 0) {
        return;
    }
    autoLockTimer = window.setTimeout(() => {
        lock();
    }, minutes * 60 * 1000);
}

function encodeBase64(data: Uint8Array) {
    return btoa(String.fromCharCode(...data));
}

function decodeBase64(data: string) {
    return Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
}

async function persistDevDek(dek: CryptoKey, minutes: number) {
    if (!import.meta.env.DEV) return;
    const raw = await exportRawKey(dek);
    sessionStorage.setItem(devStorageKey, encodeBase64(raw));
    sessionStorage.setItem(devUnlockedAtKey, String(Date.now()));
    sessionStorage.setItem(devAutoLockKey, String(minutes));
}

function clearDevDek() {
    if (!import.meta.env.DEV) return;
    sessionStorage.removeItem(devStorageKey);
    sessionStorage.removeItem(devUnlockedAtKey);
    sessionStorage.removeItem(devAutoLockKey);
}

async function pickKdfParams(): Promise<KdfParams> {
    return buildPbkdf2Params();
}

type HmrVaultState = Pick<VaultState, 'status' | 'dek' | 'kdfParams' | 'autoLockMinutes'>;

const hmrState = (import.meta.hot?.data as { vaultState?: HmrVaultState } | undefined)?.vaultState;
const initialState: HmrVaultState = hmrState ?? {
    status: 'locked',
    dek: null,
    kdfParams: null,
    autoLockMinutes: 15,
};

export const useVaultStore = create<VaultState>((set, get) => ({
    status: initialState.status,
    error: null,
    dek: initialState.dek,
    kdfParams: initialState.kdfParams,
    autoLockMinutes: initialState.autoLockMinutes,
    initVault: async (masterPassword) => {
        set({ status: 'initializing', error: null });
        try {
            if (!isCryptoSupported()) {
                throw new Error('WebCrypto nicht verfügbar');
            }
            const params = await pickKdfParams();
            const mk = await deriveKey(masterPassword, params);
            const dek = await generateDek();
            const wrapped = await wrapKey(dek, mk);

            await initVault({
                kdf_salt: params.salt,
                kdf_params: {
                    algorithm: params.algorithm,
                    iterations: params.iterations,
                    memory: params.memory,
                    parallelism: params.parallelism,
                    hashLength: params.hashLength,
                },
                encrypted_dek: wrapped.ciphertext,
                dek_iv: wrapped.iv,
            });

            set({ status: 'unlocked', dek, kdfParams: params });
            scheduleAutoLock(get().autoLockMinutes, get().lock);
            await persistDevDek(dek, get().autoLockMinutes);
        } catch (error) {
            const message = formatError(error);
            if (
                /crypto|webcrypto|subtle|secure context|not supported|failed to execute/i.test(message) ||
                (typeof window !== 'undefined' && !window.isSecureContext)
            ) {
                set({
                    status: 'error',
                    error:
                        'Krypto ist auf diesem Gerät nicht verfügbar. Bitte öffne die App unter https oder als PWA (Home‑Screen).',
                });
            } else {
                set({ status: 'error', error: message });
            }
        }
    },
    unlock: async (masterPassword, user) => {
        if (!user.vault.encrypted_dek || !user.vault.dek_iv || !user.vault.kdf_salt || !user.vault.kdf_params) {
            set({ status: 'error', error: 'Vault ist noch nicht eingerichtet.' });
            return;
        }
        set({ status: 'initializing', error: null });
        try {
            if (!isCryptoSupported()) {
                throw new Error('WebCrypto nicht verfügbar');
            }
            const params: KdfParams = {
                algorithm: (user.vault.kdf_params.algorithm as KdfParams['algorithm']) ?? 'pbkdf2',
                iterations: user.vault.kdf_params.iterations as number | undefined,
                memory: user.vault.kdf_params.memory as number | undefined,
                parallelism: user.vault.kdf_params.parallelism as number | undefined,
                hashLength: user.vault.kdf_params.hashLength as number | undefined,
                salt: user.vault.kdf_salt,
            };
            const mk = await deriveKey(masterPassword, params);
            const dek = await unwrapKey(
                { ciphertext: user.vault.encrypted_dek, iv: user.vault.dek_iv },
                mk,
            );

            set({ status: 'unlocked', dek, kdfParams: params });
            scheduleAutoLock(get().autoLockMinutes, get().lock);
            await persistDevDek(dek, get().autoLockMinutes);
        } catch (error) {
            const message = formatError(error);
            if (
                /crypto|webcrypto|subtle|secure context|not supported|failed to execute/i.test(message) ||
                (typeof window !== 'undefined' && !window.isSecureContext)
            ) {
                set({
                    status: 'error',
                    error:
                        'Krypto ist auf diesem Gerät nicht verfügbar. Bitte öffne die App unter https oder als PWA (Home‑Screen).',
                });
                return;
            }
            if (
                (user.vault.kdf_params?.algorithm as string) === 'argon2id' &&
                /webassembly|wasm|memory|unsupported|not supported|failed to execute/i.test(message)
            ) {
                set({
                    status: 'error',
                    error:
                        'Dieses Gerät unterstützt Argon2 nicht. Bitte entsperre den Vault auf einem kompatiblen Gerät und stelle in den Einstellungen auf PBKDF2 um.',
                });
            } else {
                set({ status: 'error', error: 'Master‑Passwort ist ungültig.' });
            }
        }
    },
    unlockWithDek: (dek, params) => {
        set({ status: 'unlocked', dek, kdfParams: params, error: null });
        scheduleAutoLock(get().autoLockMinutes, get().lock);
        void persistDevDek(dek, get().autoLockMinutes);
    },
    lock: () => {
        scheduleAutoLock(0, () => null);
        set({ status: 'locked', dek: null });
        clearDevDek();
    },
    setAutoLockMinutes: (minutes) => {
        set({ autoLockMinutes: minutes });
        if (get().status === 'unlocked') {
            scheduleAutoLock(minutes, get().lock);
        }
    },
    encryptEntry: async (data) => {
        const dek = get().dek;
        if (!dek) {
            throw new Error('Vault ist gesperrt.');
        }
        return encryptJson(data, dek);
    },
    decryptEntry: async (payload) => {
        const dek = get().dek;
        if (!dek) {
            throw new Error('Vault ist gesperrt.');
        }
        return decryptJson(payload, dek);
    },
}));

if (initialState.status === 'unlocked') {
    scheduleAutoLock(initialState.autoLockMinutes, () => useVaultStore.getState().lock());
}

if (import.meta.hot) {
    import.meta.hot.dispose((data) => {
        const state = useVaultStore.getState();
        if (state.status === 'unlocked') {
            data.vaultState = {
                status: state.status,
                dek: state.dek,
                kdfParams: state.kdfParams,
                autoLockMinutes: state.autoLockMinutes,
            };
        } else {
            data.vaultState = {
                status: 'locked',
                dek: null,
                kdfParams: null,
                autoLockMinutes: state.autoLockMinutes,
            };
        }
    });
}

async function restoreDevVault() {
    if (!import.meta.env.DEV) return;
    const raw = sessionStorage.getItem(devStorageKey);
    if (!raw) return;
    const unlockedAt = Number(sessionStorage.getItem(devUnlockedAtKey));
    const minutes = Number(sessionStorage.getItem(devAutoLockKey) ?? '15');
    if (Number.isFinite(unlockedAt) && minutes > 0) {
        const age = Date.now() - unlockedAt;
        if (age > minutes * 60 * 1000) {
            clearDevDek();
            return;
        }
    }
    try {
        const key = await crypto.subtle.importKey('raw', decodeBase64(raw), 'AES-GCM', true, [
            'encrypt',
            'decrypt',
        ]);
        useVaultStore.setState({ status: 'unlocked', dek: key, error: null, autoLockMinutes: minutes });
        scheduleAutoLock(minutes, () => useVaultStore.getState().lock());
    } catch {
        clearDevDek();
    }
}

restoreDevVault().catch(() => null);
