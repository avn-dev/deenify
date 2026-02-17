import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import '../css/app.css';
import { AuthScreen } from './spa/screens/auth-screen';
import { VaultSetupScreen } from './spa/screens/vault-setup-screen';
import { UnlockScreen } from './spa/screens/unlock-screen';
import { TodayScreen } from './spa/screens/today-screen';
import { CalendarScreen } from './spa/screens/calendar-screen';
import { SettingsScreen } from './spa/screens/settings-screen';
import { AuthCallbackScreen } from './spa/screens/auth-callback-screen';
import { InsightsScreen } from './spa/screens/insights-screen';
import { useEffect } from 'react';
import { useAuthStore } from './spa/lib/auth-store';
import { usePreferencesStore } from './spa/lib/preferences-store';
import { useProfileStore } from './spa/lib/profile-store';
import { useVaultStore } from './spa/lib/vault-store';

function Protected({ children }: { children: JSX.Element }) {
    const status = useAuthStore((state) => state.status);
    const user = useAuthStore((state) => state.user);

    if (status !== 'ready') {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5,_#ffffff)] px-5 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] dark:text-slate-100">
                <div className="mx-auto max-w-md rounded-3xl border border-emerald-100 bg-white/90 p-6 text-sm text-slate-600 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    Lade Konto…
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    return children;
}

function App() {
    const hydrate = useAuthStore((state) => state.hydrate);
    const vaultStatus = useVaultStore((state) => state.status);
    const preferencesStatus = usePreferencesStore((state) => state.status);
    const loadPreferences = usePreferencesStore((state) => state.load);
    const profileStatus = useProfileStore((state) => state.status);
    const loadProfile = useProfileStore((state) => state.loadFromUser);
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        hydrate().catch(() => null);
    }, [hydrate]);

    useEffect(() => {
        if (vaultStatus === 'unlocked' && preferencesStatus === 'idle') {
            loadPreferences().catch(() => null);
        }
    }, [loadPreferences, preferencesStatus, vaultStatus]);

    useEffect(() => {
        if (vaultStatus === 'unlocked' && user && profileStatus === 'idle') {
            loadProfile(user).catch(() => null);
        }
    }, [loadProfile, profileStatus, user, vaultStatus]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => null);
        }
    }, []);

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/auth" element={<AuthScreen />} />
                <Route path="/auth/callback" element={<AuthCallbackScreen />} />
                <Route
                    path="/vault/setup"
                    element={
                        <Protected>
                            <VaultSetupScreen />
                        </Protected>
                    }
                />
                <Route
                    path="/vault/unlock"
                    element={
                        <Protected>
                            <UnlockScreen />
                        </Protected>
                    }
                />
                <Route
                    path="/today"
                    element={
                        <Protected>
                            <TodayScreen />
                        </Protected>
                    }
                />
                <Route
                    path="/calendar"
                    element={
                        <Protected>
                            <CalendarScreen />
                        </Protected>
                    }
                />
                <Route
                    path="/insights"
                    element={
                        <Protected>
                            <InsightsScreen />
                        </Protected>
                    }
                />
                <Route
                    path="/settings"
                    element={
                        <Protected>
                            <SettingsScreen />
                        </Protected>
                    }
                />
                <Route path="/" element={<Navigate to="/today" replace />} />
                <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

const root = createRoot(document.getElementById('root')!);

root.render(
    <StrictMode>
        <App />
    </StrictMode>,
);
