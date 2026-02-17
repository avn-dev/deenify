import { create } from 'zustand';
import type { UserPayload } from './api';
import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from './api';

type AuthState = {
    user: UserPayload | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error: string | null;
    hydrate: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    register: (payload: { username: string; password: string; password_confirmation: string; email?: string }) => Promise<void>;
    logout: () => Promise<void>;
    updateVault: (vault: UserPayload['vault']) => void;
    updateProfileCiphertext: (profile: { profile_ciphertext: string; profile_iv: string }) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    status: 'idle',
    error: null,
    hydrate: async () => {
        set({ status: 'loading', error: null });
        try {
            const user = await apiMe();
            set({ user, status: 'ready' });
        } catch (error) {
            set({ user: null, status: 'ready' });
        }
    },
    login: async (username, password) => {
        set({ status: 'loading', error: null });
        try {
            const result = await apiLogin(username, password);
            set({ user: result.user, status: 'ready' });
        } catch (error) {
            const message = (error as { message?: string }).message ?? 'Login fehlgeschlagen.';
            set({ status: 'error', error: message });
            throw error;
        }
    },
    register: async (payload) => {
        set({ status: 'loading', error: null });
        try {
            const result = await apiRegister(payload);
            set({ user: result.user, status: 'ready' });
        } catch (error) {
            const message = (error as { message?: string }).message ?? 'Registrierung fehlgeschlagen.';
            set({ status: 'error', error: message });
            throw error;
        }
    },
    logout: async () => {
        set({ status: 'loading', error: null });
        try {
            await apiLogout();
        } finally {
            set({ user: null, status: 'ready' });
        }
    },
    updateVault: (vault) => {
        set((state) => (state.user ? { user: { ...state.user, vault } } : state));
    },
    updateProfileCiphertext: (profile) => {
        set((state) =>
            state.user
                ? {
                      user: {
                          ...state.user,
                          profile_ciphertext: profile.profile_ciphertext,
                          profile_iv: profile.profile_iv,
                      },
                  }
                : state,
        );
    },
}));
