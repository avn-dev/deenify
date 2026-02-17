import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { useAuthStore } from '../lib/auth-store';
import { useVaultStore } from '../lib/vault-store';

export function UnlockScreen() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const vaultStatus = useVaultStore((state) => state.status);
    const vaultError = useVaultStore((state) => state.error);
    const unlock = useVaultStore((state) => state.unlock);
    const [password, setPassword] = useState('');
    const hasVault = Boolean(user?.vault?.encrypted_dek);
    const isLoading = vaultStatus === 'initializing';

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!user) {
            navigate('/auth');
            return;
        }
        await unlock(password, user);
        if (useVaultStore.getState().status === 'unlocked') {
            navigate('/today', { replace: true });
        }
    }

    return (
        <AppShell title="Tagebuch entsperren">
            <section className="space-y-6">
                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <h2 className="text-lg font-semibold">Master‑Passwort eingeben</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Entsperre dein verschlüsseltes Ramadan‑Tagebuch, um es zu lesen und zu bearbeiten.
                    </p>
                    {!hasVault ? (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-200">
                            Dein Vault ist noch nicht eingerichtet.{' '}
                            <Link className="font-semibold text-amber-900" to="/vault/setup">
                                Jetzt erstellen
                            </Link>
                            .
                        </div>
                    ) : (
                        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
                            <input
                                type="password"
                                placeholder="Master‑Passwort"
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                                Entsperren
                            </button>
                        </form>
                    )}
                    <p className="mt-4 text-xs text-slate-500">
                        Vergessen? Ohne Master‑Passwort können wir dein Tagebuch nicht wiederherstellen.
                    </p>
                    {vaultError ? (
                        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                            {vaultError}
                        </div>
                    ) : null}
                </div>
            </section>
        </AppShell>
    );
}
