import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { useAuthStore } from '../lib/auth-store';
import { createEntry, getPreferencesRecord, listEntries, rotateVault, updateEntry } from '../lib/api';
import { buildPbkdf2Params, formatError, deriveKey, unwrapKey, wrapKey, type KdfParams } from '../lib/crypto';
import { usePreferencesStore } from '../lib/preferences-store';
import { useProfileStore } from '../lib/profile-store';
import { useVaultStore } from '../lib/vault-store';

export function SettingsScreen() {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const logout = useAuthStore((state) => state.logout);
    const updateVault = useAuthStore((state) => state.updateVault);
    const vaultStatus = useVaultStore((state) => state.status);
    const dek = useVaultStore((state) => state.dek);
    const lock = useVaultStore((state) => state.lock);
    const encryptEntry = useVaultStore((state) => state.encryptEntry);
    const decryptEntry = useVaultStore((state) => state.decryptEntry);

    const profile = useProfileStore((state) => state.profile);
    const saveProfile = useProfileStore((state) => state.saveProfile);
    const preferences = usePreferencesStore((state) => state.preferences);
    const preferencesStatus = usePreferencesStore((state) => state.status);
    const preferencesError = usePreferencesStore((state) => state.error);
    const loadPreferences = usePreferencesStore((state) => state.load);
    const updatePreferences = usePreferencesStore((state) => state.update);

    const [currentPassword, setCurrentPassword] = useState('');
    const [nextPassword, setNextPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rotateStatus, setRotateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [rotateError, setRotateError] = useState<string | null>(null);
    const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
    const [exportError, setExportError] = useState<string | null>(null);
    // Nacht-Zeiten wurden entfernt.
    const ramadanStart = '2026-02-17';
    const ramadanEnd = addDays(ramadanStart, 29);
    const [ramadanDays, setRamadanDays] = useState<{ date: string; fajr: string; maghrib: string }[]>([]);
    const [ramadanSaving, setRamadanSaving] = useState(false);
    const [ramadanError, setRamadanError] = useState<string | null>(null);
    const [ramadanSuccess, setRamadanSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (vaultStatus === 'unlocked' && preferencesStatus === 'idle') {
            loadPreferences().catch(() => null);
        }
    }, [loadPreferences, preferencesStatus, vaultStatus]);

    // Nacht-Zeiten Load entfernt.

    async function handleLogout() {
        await logout();
        lock();
        navigate('/auth', { replace: true });
    }

    async function handleRotate(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setRotateStatus('loading');
        setRotateError(null);

        if (!user) {
            setRotateStatus('error');
            setRotateError('Bitte erneut anmelden.');
            return;
        }

        if (vaultStatus !== 'unlocked' || !dek) {
            setRotateStatus('error');
            setRotateError('Bitte entsperre zuerst deinen Vault.');
            return;
        }

        if (nextPassword.length < 8) {
            setRotateStatus('error');
            setRotateError('Das neue Passwort sollte mindestens 8 Zeichen haben.');
            return;
        }

        if (nextPassword !== confirmPassword) {
            setRotateStatus('error');
            setRotateError('Die neuen Passwörter stimmen nicht überein.');
            return;
        }

        if (!user.vault.encrypted_dek || !user.vault.dek_iv || !user.vault.kdf_salt || !user.vault.kdf_params) {
            setRotateStatus('error');
            setRotateError('Vault-Daten fehlen.');
            return;
        }

        try {
            const params: KdfParams = {
                algorithm: (user.vault.kdf_params.algorithm as KdfParams['algorithm']) ?? 'pbkdf2',
                iterations: user.vault.kdf_params.iterations as number | undefined,
                memory: user.vault.kdf_params.memory as number | undefined,
                parallelism: user.vault.kdf_params.parallelism as number | undefined,
                hashLength: user.vault.kdf_params.hashLength as number | undefined,
                salt: user.vault.kdf_salt,
            };

            const oldMk = await deriveKey(currentPassword, params);
            const verifiedDek = await unwrapKey(
                { ciphertext: user.vault.encrypted_dek, iv: user.vault.dek_iv },
                oldMk,
            );

            const newParams = buildPbkdf2Params();
            const newMk = await deriveKey(nextPassword, newParams);
            const wrapped = await wrapKey(verifiedDek, newMk);

            await rotateVault({
                kdf_salt: newParams.salt,
                kdf_params: {
                    algorithm: newParams.algorithm,
                    iterations: newParams.iterations,
                    memory: newParams.memory,
                    parallelism: newParams.parallelism,
                    hashLength: newParams.hashLength,
                },
                encrypted_dek: wrapped.ciphertext,
                dek_iv: wrapped.iv,
            });

            updateVault({
                kdf_salt: newParams.salt,
                kdf_params: {
                    algorithm: newParams.algorithm,
                    iterations: newParams.iterations,
                    memory: newParams.memory,
                    parallelism: newParams.parallelism,
                    hashLength: newParams.hashLength,
                },
                encrypted_dek: wrapped.ciphertext,
                dek_iv: wrapped.iv,
            });

            setRotateStatus('success');
            setCurrentPassword('');
            setNextPassword('');
            setConfirmPassword('');
        } catch (error) {
            setRotateStatus('error');
            setRotateError(formatError(error) || 'Passwort konnte nicht geändert werden.');
        }
    }

    async function handleExport() {
        setExportStatus('loading');
        setExportError(null);
        try {
            const entries = await listEntries();
            const preferences = await getPreferencesRecord();
            const payload = {
                exported_at: new Date().toISOString(),
                user: {
                    id: user?.id ?? null,
                    username: user?.username ?? null,
                    email: user?.email ?? null,
                    profile_ciphertext: user?.profile_ciphertext ?? null,
                    profile_iv: user?.profile_iv ?? null,
                    vault: user?.vault ?? null,
                },
                entries,
                preferences,
            };

            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `deenify-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            setExportStatus('success');
        } catch (error) {
            setExportStatus('error');
            setExportError('Export konnte nicht erstellt werden.');
        }
    }

    // Nacht-Zeiten Save entfernt.

    useEffect(() => {
        if (vaultStatus !== 'unlocked') {
            return;
        }
        setRamadanError(null);
        setRamadanSuccess(null);
        (async () => {
            try {
                const dates = buildDateRange(ramadanStart, ramadanEnd);
                const existing = await listEntries({ start: ramadanStart, end: ramadanEnd });
                const byDay = new Map(existing.map((entry) => [entry.day, entry]));
                const rows: { date: string; fajr: string; maghrib: string }[] = [];

                for (const date of dates) {
                    const entry = byDay.get(date);
                    if (entry) {
                        const data = await decryptEntry<EntryData>({ ciphertext: entry.ciphertext, iv: entry.iv });
                        rows.push({
                            date,
                            fajr: data.night?.fajr ?? '',
                            maghrib: data.night?.maghrib ?? '',
                        });
                    } else {
                        rows.push({ date, fajr: '', maghrib: '' });
                    }
                }
                setRamadanDays(rows);
            } catch {
                setRamadanError('Ramadan‑Zeiten konnten nicht geladen werden.');
            }
        })();
    }, [decryptEntry, ramadanEnd, ramadanStart, vaultStatus]);

    async function handleRamadanApply() {
        if (vaultStatus !== 'unlocked') {
            setRamadanError('Bitte entsperre zuerst deinen Vault.');
            return;
        }
        if (!ramadanDays.length) {
            setRamadanError('Bitte Zeiten eintragen.');
            return;
        }
        setRamadanSaving(true);
        setRamadanError(null);
        setRamadanSuccess(null);
        try {
            const existing = await listEntries({ start: ramadanStart, end: ramadanEnd });
            const byDay = new Map(existing.map((entry) => [entry.day, entry]));

            for (const row of ramadanDays) {
                const date = row.date;
                const existingEntry = byDay.get(date);
                let base = defaultEntry();
                let entryId: string | null = null;

                if (existingEntry) {
                    base = await decryptEntry<EntryData>({
                        ciphertext: existingEntry.ciphertext,
                        iv: existingEntry.iv,
                    });
                    entryId = existingEntry.id;
                }

                const nextData: EntryData = {
                    ...base,
                    night: {
                        maghrib: row.maghrib,
                        fajr: row.fajr,
                    },
                };
                const encrypted = await encryptEntry(nextData);

                if (entryId) {
                    await updateEntry(entryId, {
                        ciphertext: encrypted.ciphertext,
                        iv: encrypted.iv,
                    });
                } else {
                    await createEntry({
                        day: date,
                        ciphertext: encrypted.ciphertext,
                        iv: encrypted.iv,
                    });
                }
            }

            setRamadanSuccess(`Gespeichert für ${ramadanDays.length} Tage.`);
        } catch (error) {
            setRamadanError('Ramadan‑Zeiten konnten nicht gespeichert werden.');
        } finally {
            setRamadanSaving(false);
        }
    }

    const autoLockOptions = [5, 15, 30];

    return (
        <AppShell title="Einstellungen">
            <section className="space-y-6">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-900/20">
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Konto</p>
                    <p className="mt-2 text-sm text-emerald-900">{user?.username ?? 'Nicht angemeldet'}</p>
                    {user?.email ? (
                        <p className="mt-1 text-xs text-emerald-700">{user.email}</p>
                    ) : null}
                    {profile?.gender ? (
                        <div className="mt-3 grid gap-2 text-xs text-emerald-700">
                            <label className="grid gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                                Geschlecht ändern
                                <select
                                    value={profile.gender}
                                    onChange={(event) => saveProfile({ gender: event.target.value as 'male' | 'female' })}
                                    className="rounded-lg border border-emerald-200 px-2 py-1 text-xs dark:border-emerald-800/60 dark:bg-slate-900"
                                >
                                    <option value="female">Weiblich</option>
                                    <option value="male">Männlich</option>
                                </select>
                            </label>
                        </div>
                    ) : null}
                </div>

                {vaultStatus !== 'unlocked' ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                        Entsperre deinen Vault, um Einstellungen zu ändern.
                        <button
                            onClick={() => navigate('/vault/unlock')}
                            className="mt-3 w-full rounded-2xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800"
                        >
                            Jetzt entsperren
                        </button>
                    </div>
                ) : null}

                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <h2 className="text-lg font-semibold">Präferenzen</h2>
                    <div className="mt-4 space-y-3 text-sm">
                        <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                            Theme
                            <select
                                disabled={vaultStatus !== 'unlocked' || preferencesStatus === 'loading'}
                                value={preferences.theme}
                                onChange={(event) =>
                                    updatePreferences({ theme: event.target.value as typeof preferences.theme })
                                }
                                className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                                <option value="system">System</option>
                                <option value="light">Hell</option>
                                <option value="dark">Dunkel</option>
                            </select>
                        </label>
                        <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                            Auto‑Lock
                            <select
                                disabled={vaultStatus !== 'unlocked' || preferencesStatus === 'loading'}
                                value={preferences.autoLockMinutes}
                                onChange={(event) =>
                                    updatePreferences({ autoLockMinutes: Number(event.target.value) })
                                }
                                className="rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                            >
                                {autoLockOptions.map((minutes) => (
                                    <option key={minutes} value={minutes}>
                                        {minutes} Minuten
                                    </option>
                                ))}
                            </select>
                        </label>
                        {preferencesError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                                {preferencesError}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Nacht-Zeiten Block entfernt */}

                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <h2 className="text-lg font-semibold">Ramadan‑Zeiten (pro Tag)</h2>
                    <p className="mt-2 text-xs text-slate-500">
                        Ramadan startet am 17.02.2026 (ab Maghrib) und umfasst 30 Tage. Trage pro Tag Fajr und Maghrib
                        ein. Diese Zeiten werden pro Tag gespeichert.
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Tipp: Du kannst die Zeiten aus Pillars oder Mawaqit übernehmen.
                        <span className="ml-1">
                            <a
                                href="https://www.thepillarsapp.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-700 underline"
                            >
                                Pillars
                            </a>
                            {' · '}
                            <a
                                href="https://mawaqit.net/"
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-700 underline"
                            >
                                Mawaqit
                            </a>
                        </span>
                    </p>
                    <div className="mt-4 grid gap-3 text-sm">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                            Zeitraum: {ramadanStart} – {ramadanEnd}
                        </div>
                        {ramadanDays.length ? (
                            <div className="grid gap-2">
                                <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
                                    <span>Ramadan</span>
                                    <span>Fajr</span>
                                    <span>Maghrib</span>
                                </div>
                                {ramadanDays.map((row, index) => (
                                    <div
                                        key={row.date}
                                        className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 rounded-2xl border border-slate-100 px-3 py-2 text-xs"
                                    >
                                        <div className="grid gap-1 text-slate-600">
                                            <span>
                                                {formatRamadanNightLabel(row.date)} ({formatShortDate(row.date)})
                                            </span>
                                        </div>
                                        <input
                                            type="time"
                                            value={row.fajr}
                                            onChange={(event) =>
                                                setRamadanDays((current) => {
                                                    const next = [...current];
                                                    next[index] = { ...next[index], fajr: event.target.value };
                                                    return next;
                                                })
                                            }
                                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                        />
                                        <input
                                            type="time"
                                            value={row.maghrib}
                                            onChange={(event) =>
                                                setRamadanDays((current) => {
                                                    const next = [...current];
                                                    next[index] = { ...next[index], maghrib: event.target.value };
                                                    return next;
                                                })
                                            }
                                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        <button
                            type="button"
                            onClick={handleRamadanApply}
                            disabled={ramadanSaving}
                            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {ramadanSaving ? 'Speichern…' : 'Für Ramadan übernehmen'}
                        </button>
                        {ramadanError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                                {ramadanError}
                            </div>
                        ) : null}
                        {ramadanSuccess ? (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                                {ramadanSuccess}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-800/60 dark:bg-amber-950/30">
                    <h3 className="text-sm font-semibold text-amber-800">Master‑Passwort ändern</h3>
                    <p className="mt-2 text-xs text-amber-700">
                        Das Ändern des Master‑Passworts wrappt nur den DEK neu. Deine Einträge bleiben verschlüsselt.
                    </p>
                    <form className="mt-4 space-y-3" onSubmit={handleRotate}>
                        <input
                            type="password"
                            placeholder="Aktuelles Master‑Passwort"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(event) => setCurrentPassword(event.target.value)}
                            className="w-full rounded-2xl border border-amber-200 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-slate-900"
                        />
                        <input
                            type="password"
                            placeholder="Neues Master‑Passwort"
                            autoComplete="new-password"
                            value={nextPassword}
                            onChange={(event) => setNextPassword(event.target.value)}
                            className="w-full rounded-2xl border border-amber-200 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-slate-900"
                        />
                        <input
                            type="password"
                            placeholder="Neues Master‑Passwort bestätigen"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            className="w-full rounded-2xl border border-amber-200 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-slate-900"
                        />
                        <button
                            type="submit"
                            disabled={vaultStatus !== 'unlocked' || rotateStatus === 'loading'}
                            className="w-full rounded-2xl border border-amber-200 px-4 py-3 text-sm font-semibold text-amber-800 disabled:opacity-60"
                        >
                            {rotateStatus === 'loading' ? 'Ändere Passwort…' : 'Passwort ändern'}
                        </button>
                    </form>
                    {rotateError ? (
                        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                            {rotateError}
                        </div>
                    ) : null}
                    {rotateStatus === 'success' ? (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                            Master‑Passwort aktualisiert.
                        </div>
                    ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <button
                        onClick={handleExport}
                        disabled={exportStatus === 'loading'}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-60"
                    >
                        {exportStatus === 'loading' ? 'Export läuft…' : 'Verschlüsselte Daten exportieren'}
                    </button>
                    {exportError ? (
                        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                            {exportError}
                        </div>
                    ) : null}
                    {exportStatus === 'success' ? (
                        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
                            Export erstellt.
                        </div>
                    ) : null}
                    <button
                        onClick={handleLogout}
                        className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold"
                    >
                        Abmelden
                    </button>
                    <button className="mt-3 w-full rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600">
                        Konto löschen
                    </button>
                </div>
            </section>
        </AppShell>
    );
}

type EntryData = {
    mood: number;
    fasted: boolean;
    prayers: {
        fajr: { fard: 'none' | 'on_time' | 'late' | 'qada' | 'missed'; sunnahBefore: boolean; dhikrAfter: boolean };
        dhuhr: {
            fard: 'none' | 'on_time' | 'late' | 'qada' | 'missed';
            sunnahBefore: [boolean, boolean];
            sunnahAfter: boolean;
            dhikrAfter: boolean;
        };
        asr: { fard: 'none' | 'on_time' | 'late' | 'qada' | 'missed'; dhikrAfter: boolean };
        maghrib: { fard: 'none' | 'on_time' | 'late' | 'qada' | 'missed'; sunnahAfter: boolean; dhikrAfter: boolean };
        isha: { fard: 'none' | 'on_time' | 'late' | 'qada' | 'missed'; sunnahAfter: boolean; dhikrAfter: boolean };
        witr: number;
        taraweeh: number;
    };
    text: string;
    menstruation: boolean;
    quran: {
        mode: 'juz' | 'hizb' | 'rub' | 'pages' | 'surah_ayah';
        amount: number;
        pagesFrom: number;
        pagesTo: number;
        surahRanges: { surah: number; from: number; to: number }[];
    };
    night: {
        maghrib: string;
        fajr: string;
    };
    duaDone: boolean;
    charityGiven: boolean;
};

function defaultEntry(): EntryData {
    return {
        mood: 3,
        fasted: false,
        text: '',
        menstruation: false,
        quran: { mode: 'juz', amount: 0, pagesFrom: 0, pagesTo: 0, surahRanges: [] },
        night: { maghrib: '', fajr: '' },
        duaDone: false,
        charityGiven: false,
        prayers: {
            fajr: { fard: 'none', sunnahBefore: false, dhikrAfter: false },
            dhuhr: { fard: 'none', sunnahBefore: [false, false], sunnahAfter: false, dhikrAfter: false },
            asr: { fard: 'none', dhikrAfter: false },
            maghrib: { fard: 'none', sunnahAfter: false, dhikrAfter: false },
            isha: { fard: 'none', sunnahAfter: false, dhikrAfter: false },
            witr: 0,
            taraweeh: 0,
        },
    };
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildDateRange(start: string, end: string) {
    const dates: string[] = [];
    const current = new Date(`${start}T00:00:00`);
    const last = new Date(`${end}T00:00:00`);
    if (Number.isNaN(current.getTime()) || Number.isNaN(last.getTime()) || current > last) {
        return dates;
    }
    while (current <= last) {
        dates.push(formatLocalDate(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

function addDays(dateString: string, days: number) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
}

function formatShortDate(dateString: string) {
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) return dateString;
    return `${day}.${month}.`;
}

function formatRamadanDayLabel(dateString: string) {
    const ramadanStart = '2026-02-17';
    const dayNumber = dayDiff(ramadanStart, dateString) + 1;
    if (dayNumber < 1 || dayNumber > 30) return dateString;
    return `${dayNumber}. Ramadan`;
}

function formatRamadanNightLabel(dateString: string) {
    const ramadanStart = '2026-02-17';
    const dayNumber = dayDiff(ramadanStart, dateString) + 1;
    if (dayNumber < 1 || dayNumber > 30) return dateString;
    if (dayNumber === 1) {
        return '1. Ramadan';
    }
    if (dayNumber === 30) {
        return '30. Ramadan';
    }
    return `${dayNumber - 1}. / ${dayNumber}. Ramadan`;
}

function dayDiff(start: string, end: string) {
    const a = new Date(`${start}T00:00:00`);
    const b = new Date(`${end}T00:00:00`);
    const diff = b.getTime() - a.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
}
