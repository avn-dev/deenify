import { create } from 'zustand';
import { getPreferencesRecord, savePreferencesRecord } from './api';
import { useVaultStore } from './vault-store';

export type Preferences = {
    theme: 'system' | 'light' | 'dark';
    autoLockMinutes: number;
    ramadanStart: string;
};

type PreferencesState = {
    preferences: Preferences;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    load: () => Promise<void>;
    update: (next: Partial<Preferences>) => Promise<void>;
    applyTheme: (theme: Preferences['theme']) => void;
};

const defaultPreferences: Preferences = {
    theme: 'system',
    autoLockMinutes: 15,
    ramadanStart: '2026-02-17',
};

function applyTheme(theme: Preferences['theme']) {
    const root = document.documentElement;
    if (theme === 'dark') {
        root.classList.add('dark');
        return;
    }
    if (theme === 'light') {
        root.classList.remove('dark');
        return;
    }
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
    preferences: defaultPreferences,
    status: 'idle',
    error: null,
    applyTheme: (theme) => applyTheme(theme),
    load: async () => {
        set({ status: 'loading', error: null });
        try {
            const record = await getPreferencesRecord();
            if (!record) {
                set({ preferences: defaultPreferences, status: 'ready' });
                applyTheme(defaultPreferences.theme);
                useVaultStore.getState().setAutoLockMinutes(defaultPreferences.autoLockMinutes);
                return;
            }
            const preferences = await useVaultStore.getState().decryptEntry<Partial<Preferences>>(record);
            const merged = { ...defaultPreferences, ...preferences };
            set({ preferences: merged, status: 'ready' });
            applyTheme(merged.theme);
            useVaultStore.getState().setAutoLockMinutes(merged.autoLockMinutes);
        } catch (error) {
            const message = (error as { message?: string }).message ?? 'Einstellungen konnten nicht geladen werden.';
            set({ status: 'error', error: message });
        }
    },
    update: async (next) => {
        const current = get().preferences;
        const updated = { ...current, ...next };
        set({ preferences: updated });
        applyTheme(updated.theme);
        useVaultStore.getState().setAutoLockMinutes(updated.autoLockMinutes);
        try {
            const encrypted = await useVaultStore.getState().encryptEntry(updated);
            await savePreferencesRecord(encrypted);
        } catch (error) {
            const message = (error as { message?: string }).message ?? 'Einstellungen konnten nicht gespeichert werden.';
            set({ error: message });
        }
    },
}));
