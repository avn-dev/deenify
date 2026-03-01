import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { listEntries } from '../lib/api';
import { useVaultStore } from '../lib/vault-store';

function daysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatMonthLabel(date: Date): string {
    return date.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
}

export function CalendarScreen() {
    const navigate = useNavigate();
    const vaultStatus = useVaultStore((state) => state.status);
    const decryptEntry = useVaultStore((state) => state.decryptEntry);
    const [entries, setEntries] = useState<Record<number, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [empty, setEmpty] = useState(false);
    const [streak, setStreak] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const today = useMemo(() => new Date(), []);
    const [monthCursor, setMonthCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
    const todayDay = today.getDate();
    const totalDays = daysInMonth(monthCursor);
    const days = Array.from({ length: totalDays }, (_, index) => index + 1);
    const monthStart = useMemo(
        () => formatLocalDate(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1)),
        [monthCursor],
    );
    const monthEnd = useMemo(
        () => formatLocalDate(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), totalDays)),
        [monthCursor, totalDays],
    );
    const isCurrentMonth =
        monthCursor.getFullYear() === today.getFullYear() && monthCursor.getMonth() === today.getMonth();
    const monthLabel = formatMonthLabel(monthCursor);

    useEffect(() => {
        if (vaultStatus !== 'unlocked') {
            return;
        }
        setLoading(true);
        const load = async () => {
            try {
                const items = await listEntries({ start: monthStart, end: monthEnd });
                const map: Record<number, boolean> = {};
                setEmpty(items.length === 0);

                for (const entry of items) {
                    const day = Number(entry.day.split('-')[2]);
                    if (Number.isNaN(day)) {
                        continue;
                    }

                    const kind =
                        entry.aad && typeof entry.aad === 'object' && 'kind' in entry.aad
                            ? (entry.aad as { kind?: string }).kind
                            : null;

                    if (kind === 'times') {
                        continue;
                    }

                    if (kind === 'entry') {
                        map[day] = true;
                        continue;
                    }

                    try {
                        const decrypted = await decryptEntry<unknown>({
                            ciphertext: entry.ciphertext,
                            iv: entry.iv,
                        });
                        if (isMeaningfulEntry(decrypted)) {
                            map[day] = true;
                        }
                    } catch {
                        // ignore decrypt errors in calendar
                    }
                }

                setEntries(map);
                setStreak(calculateStreak(items));
            } catch {
                setError('Kalender konnte nicht geladen werden.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [monthEnd, monthStart, vaultStatus, decryptEntry]);

    return (
        <AppShell title="Kalender">
            <section className="space-y-6">
                {vaultStatus !== 'unlocked' ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                        Entsperre deinen Vault, um den Kalender zu sehen.
                    </div>
                ) : null}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h2 className="text-lg font-semibold">Ramadan 1447</h2>
                        <p className="text-xs text-slate-500">{monthLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() =>
                                setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                            }
                            className="rounded-2xl border border-slate-200 px-3 py-1 text-xs"
                        >
                            Zurück
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                            }
                            className="rounded-2xl border border-slate-200 px-3 py-1 text-xs"
                        >
                            Weiter
                        </button>
                        <button
                            type="button"
                            onClick={() => setMonthCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
                            className="rounded-2xl border border-slate-200 px-3 py-1 text-xs"
                        >
                            Dieser Monat
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/today')}
                            className="rounded-2xl border border-slate-200 px-3 py-1 text-xs"
                        >
                            Heute
                        </button>
                    </div>
                </div>
                    {loading ? (
                        <p className="mt-3 text-xs text-slate-500">Lade Einträge…</p>
                    ) : empty ? (
                        <p className="mt-3 text-xs text-slate-500">Noch keine Einträge in diesem Monat.</p>
                    ) : null}
                    <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-slate-500">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label) => (
                            <div key={label} className="text-center">
                                {label}
                            </div>
                        ))}
                    </div>
                    <div className="mt-2 grid grid-cols-7 gap-2">
                        {days.map((day) => (
                            <button
                                key={day}
                                type="button"
                                aria-label={`Tag ${day}`}
                            onClick={() => {
                                    const date = formatLocalDate(
                                        new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day),
                                    );
                                    navigate(`/today?date=${date}`);
                                }}
                                className={`aspect-square rounded-xl border bg-slate-50 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 ${
                                    isCurrentMonth && day === todayDay
                                        ? 'border-emerald-400 ring-2 ring-emerald-300/60'
                                        : 'border-slate-100'
                                }`}
                            >
                                {day}
                                {entries[day] ? (
                                    <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                ) : null}
                            </button>
                        ))}
                    </div>
                </div>
                {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                        {error}
                    </div>
                ) : null}
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-900/20">
                    <h3 className="text-sm font-semibold text-emerald-700">Streak</h3>
                    <p className="mt-2 text-2xl font-semibold text-emerald-800">{streak} Tage</p>
                    <p className="mt-1 text-xs text-emerald-700">Bleib dran und reflektiere täglich.</p>
                </div>
            </section>
        </AppShell>
    );
}

function calculateStreak(entries: { day: string }[]): number {
    if (!entries.length) return 0;
    const dates = entries
        .map((entry) => entry.day)
        .filter(Boolean)
        .sort((a, b) => (a < b ? 1 : -1));
    let streak = 0;
    let current = new Date().toISOString().slice(0, 10);
    const set = new Set(dates);
    while (set.has(current)) {
        streak += 1;
        const d = new Date(current);
        d.setDate(d.getDate() - 1);
        current = d.toISOString().slice(0, 10);
    }
    return streak;
}

function isMeaningfulEntry(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') return false;
    const data = payload as {
        mood?: number;
        fasted?: boolean;
        text?: string;
        menstruation?: boolean;
        quran?: { amount?: number; pagesFrom?: number; pagesTo?: number; surahRanges?: unknown[] };
        meals?: { suhoor?: boolean; iftar?: boolean };
        duaDone?: boolean;
        charityGiven?: boolean;
        prayers?: {
            fajr?: { fard?: string; sunnahBefore?: boolean; dhikrAfter?: boolean };
            dhuhr?: { fard?: string; sunnahBefore?: boolean[]; sunnahAfter?: boolean; dhikrAfter?: boolean };
            asr?: { fard?: string; dhikrAfter?: boolean };
            maghrib?: { fard?: string; sunnahAfter?: boolean; dhikrAfter?: boolean };
            isha?: { fard?: string; sunnahAfter?: boolean; dhikrAfter?: boolean };
            witr?: number;
            taraweeh?: number;
        };
    };

    if (typeof data.text === 'string' && data.text.trim() !== '') return true;
    if (typeof data.mood === 'number' && data.mood !== 3) return true;
    if (data.fasted) return true;
    if (data.menstruation) return true;
    if (data.duaDone || data.charityGiven) return true;
    if (data.meals?.suhoor || data.meals?.iftar) return true;
    if (data.quran) {
        if ((data.quran.amount ?? 0) > 0) return true;
        if ((data.quran.pagesFrom ?? 0) > 0 || (data.quran.pagesTo ?? 0) > 0) return true;
        if (Array.isArray(data.quran.surahRanges) && data.quran.surahRanges.length > 0) return true;
    }
    if (data.prayers) {
        const fardStatuses = [
            data.prayers.fajr?.fard,
            data.prayers.dhuhr?.fard,
            data.prayers.asr?.fard,
            data.prayers.maghrib?.fard,
            data.prayers.isha?.fard,
        ];
        if (fardStatuses.some((status) => status && status !== 'none')) return true;
        if (data.prayers.fajr?.sunnahBefore) return true;
        if (data.prayers.dhuhr?.sunnahBefore?.some(Boolean)) return true;
        if (data.prayers.dhuhr?.sunnahAfter) return true;
        if (data.prayers.maghrib?.sunnahAfter) return true;
        if (data.prayers.isha?.sunnahAfter) return true;
        if (data.prayers.fajr?.dhikrAfter) return true;
        if (data.prayers.dhuhr?.dhikrAfter) return true;
        if (data.prayers.asr?.dhikrAfter) return true;
        if (data.prayers.maghrib?.dhikrAfter) return true;
        if (data.prayers.isha?.dhikrAfter) return true;
        if ((data.prayers.witr ?? 0) > 0) return true;
        if ((data.prayers.taraweeh ?? 0) > 0) return true;
    }

    return false;
}
