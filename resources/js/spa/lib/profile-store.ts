import { create } from 'zustand';
import type { UserPayload } from './api';
import { updateProfile } from './api';
import { useAuthStore } from './auth-store';
import { useVaultStore } from './vault-store';

export type ProfileData = {
    gender: 'male' | 'female';
};

type ProfileState = {
    profile: ProfileData | null;
    pendingProfile: ProfileData | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    setPendingProfile: (profile: ProfileData) => void;
    clearPendingProfile: () => void;
    loadFromUser: (user: UserPayload) => Promise<void>;
    saveProfile: (profile: ProfileData) => Promise<void>;
};

export const useProfileStore = create<ProfileState>((set) => ({
    profile: null,
    pendingProfile: null,
    status: 'idle',
    error: null,
    setPendingProfile: (profile) => set({ pendingProfile: profile }),
    clearPendingProfile: () => set({ pendingProfile: null }),
    loadFromUser: async (user) => {
        if (!user.profile_ciphertext || !user.profile_iv) {
            set({ profile: null, status: 'ready' });
            return;
        }
        set({ status: 'loading', error: null });
        try {
            const decrypted = await useVaultStore.getState().decryptEntry<ProfileData>({
                ciphertext: user.profile_ciphertext,
                iv: user.profile_iv,
            });
            set({ profile: decrypted, status: 'ready' });
        } catch (error) {
            set({ status: 'error', error: 'Profil konnte nicht entschlüsselt werden.' });
        }
    },
    saveProfile: async (profile) => {
        set({ status: 'loading', error: null });
        try {
            const encrypted = await useVaultStore.getState().encryptEntry(profile);
            await updateProfile({
                profile_ciphertext: encrypted.ciphertext,
                profile_iv: encrypted.iv,
            });
            useAuthStore.getState().updateProfileCiphertext({
                profile_ciphertext: encrypted.ciphertext,
                profile_iv: encrypted.iv,
            });
            set({ profile, status: 'ready', pendingProfile: null });
        } catch (error) {
            set({ status: 'error', error: 'Profil konnte nicht gespeichert werden.' });
        }
    },
}));
