import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { useAuthStore } from '../lib/auth-store';
import { useProfileStore } from '../lib/profile-store';
import { useVaultStore } from '../lib/vault-store';

export function VaultSetupScreen() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const initVault = useVaultStore((state) => state.initVault);
    const vaultStatus = useVaultStore((state) => state.status);
    const vaultError = useVaultStore((state) => state.error);
    const pendingProfile = useProfileStore((state) => state.pendingProfile);
    const saveProfile = useProfileStore((state) => state.saveProfile);
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [confirmedRisk, setConfirmedRisk] = useState(false);
    const isLoading = vaultStatus === 'initializing';
    const hasVault = Boolean(user?.vault?.encrypted_dek);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!confirmedRisk || password.length < 8 || password !== confirm) {
            return;
        }
        await initVault(password);
        if (useVaultStore.getState().status === 'unlocked') {
            if (pendingProfile) {
                await saveProfile(pendingProfile);
            }
            navigate('/today', { replace: true });
        }
    }

    return (
        <AppShell title="Vault erstellen">
            <section className="space-y-6">
                {hasVault ? (
                    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                        Dein Vault ist bereits eingerichtet. Du kannst ihn auf der Entsperr‑Seite öffnen.
                    </div>
                ) : null}
                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <h2 className="text-lg font-semibold">Master‑Passwort</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Dieses Passwort entsperrt dein Tagebuch. Wir speichern es nie und können es nicht
                        wiederherstellen.
                    </p>
                    <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                        <input
                            type="password"
                            placeholder="Master‑Passwort erstellen"
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                        <input
                            type="password"
                            placeholder="Master‑Passwort bestätigen"
                            autoComplete="new-password"
                            value={confirm}
                            onChange={(event) => setConfirm(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                        />
                        {password && password.length < 8 ? (
                            <p className="text-xs text-amber-700">Mindestens 8 Zeichen empfohlen.</p>
                        ) : null}
                        {confirm && password !== confirm ? (
                            <p className="text-xs text-red-600">Die Passwörter stimmen nicht überein.</p>
                        ) : null}
                        <button
                            type="submit"
                            disabled={hasVault || isLoading || !confirmedRisk || password !== confirm}
                            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            Vault erstellen
                        </button>
                    </form>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800/60 dark:bg-amber-950/30">
                    <p className="text-sm text-amber-800">
                        Ohne dein Master‑Passwort können wir deine Einträge nicht wiederherstellen. Lege optional
                        einen Recovery‑Key an.
                    </p>
                    <label className="mt-4 flex items-start gap-3 text-sm">
                        <input
                            type="checkbox"
                            className="mt-1"
                            checked={confirmedRisk}
                            onChange={(event) => setConfirmedRisk(event.target.checked)}
                        />
                        Ich verstehe, dass der Verlust des Master‑Passworts den Verlust meines Tagebuchs bedeutet.
                    </label>
                </div>

                {vaultError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                        {vaultError}
                    </div>
                ) : null}
            </section>
        </AppShell>
    );
}
