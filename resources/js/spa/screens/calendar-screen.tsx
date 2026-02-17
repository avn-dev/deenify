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

export function CalendarScreen() {
    const navigate = useNavigate();
    const vaultStatus = useVaultStore((state) => state.status);
    const [entries, setEntries] = useState<Record<number, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [empty, setEmpty] = useState(false);
    const [streak, setStreak] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const today = useMemo(() => new Date(), []);
    const todayDay = today.getDate();
    const totalDays = daysInMonth(today);
    const days = Array.from({ length: totalDays }, (_, index) => index + 1);
    const monthStart = useMemo(() => formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)), [today]);
    const monthEnd = useMemo(
        () => formatLocalDate(new Date(today.getFullYear(), today.getMonth(), totalDays)),
        [today, totalDays],
    );

    useEffect(() => {
        if (vaultStatus !== 'unlocked') {
            return;
        }
        setLoading(true);
        listEntries({ start: monthStart, end: monthEnd })
            .then((items) => {
                const map: Record<number, boolean> = {};
                if (items.length === 0) {
                    setEmpty(true);
                } else {
                    setEmpty(false);
                }
                items.forEach((entry) => {
                    const day = Number(entry.day.split('-')[2]);
                    if (!Number.isNaN(day)) {
                        map[day] = true;
                    }
                });
                setEntries(map);
                setStreak(calculateStreak(items));
            })
            .catch(() => setError('Kalender konnte nicht geladen werden.'))
            .finally(() => setLoading(false));
    }, [monthEnd, monthStart, vaultStatus]);

    return (
        <AppShell title="Kalender">
            <section className="space-y-6">
                {vaultStatus !== 'unlocked' ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                        Entsperre deinen Vault, um den Kalender zu sehen.
                    </div>
                ) : null}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Ramadan 1447</h2>
                        <button
                            type="button"
                            onClick={() => navigate('/today')}
                            className="rounded-2xl border border-slate-200 px-3 py-1 text-xs"
                        >
                            Heute
                        </button>
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
                                    const date = formatLocalDate(new Date(today.getFullYear(), today.getMonth(), day));
                                    navigate(`/today?date=${date}`);
                                }}
                                className={`aspect-square rounded-xl border bg-slate-50 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200 ${
                                    day === todayDay
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
