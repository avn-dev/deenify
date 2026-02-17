import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../components/app-shell';
import { listEntries } from '../lib/api';
import { useVaultStore } from '../lib/vault-store';

type FardStatus = 'none' | 'on_time' | 'late' | 'qada' | 'missed';

type EntryData = {
    mood: number;
    fasted: boolean;
    quran: {
        mode: 'juz' | 'hizb' | 'rub' | 'pages' | 'surah_ayah';
        amount: number;
        pagesFrom: number;
        pagesTo: number;
        surahRanges: { surah: number; from: number; to: number }[];
    };
    prayers: {
        fajr: { fard: FardStatus; sunnahBefore: boolean; dhikrAfter: boolean };
        dhuhr: {
            fard: FardStatus;
            sunnahBefore: [boolean, boolean];
            sunnahAfter: boolean;
            dhikrAfter: boolean;
        };
        asr: { fard: FardStatus; dhikrAfter: boolean };
        maghrib: { fard: FardStatus; sunnahAfter: boolean; dhikrAfter: boolean };
        isha: { fard: FardStatus; sunnahAfter: boolean; dhikrAfter: boolean };
        witr: number;
        taraweeh: number;
    };
    text: string;
    menstruation: boolean;
    duaDone: boolean;
    charityGiven: boolean;
};

type Stats = {
    entries: number;
    fasted: number;
    avgMood: number | null;
    fardOnTime: number;
    fardMissed: number;
    quranDays: number;
    quranByMode: {
        juz: number;
        hizb: number;
        rub: number;
        pages: number;
        verses: number;
    };
    dhikrAfter: number;
    duaDays: number;
    charityDays: number;
    taraweehNights: number;
    witrNights: number;
};

type EntryWithDay = {
    day: string;
    data: EntryData;
};

type DayPoint = {
    label: string;
    date: string;
    mood: number;
    fasted: number;
    fardOnTime: number;
    dhikrAfter: number;
};

type PrayerScore = {
    total: number;
    onTime: number;
    late: number;
    qada: number;
    missed: number;
    none: number;
};

export function InsightsScreen() {
    const vaultStatus = useVaultStore((state) => state.status);
    const decryptEntry = useVaultStore((state) => state.decryptEntry);
    const [stats, setStats] = useState<Stats | null>(null);
    const [week, setWeek] = useState<DayPoint[]>([]);
    const [heatmap, setHeatmap] = useState<{ date: string; score: number }[]>([]);
    const [prayerScore, setPrayerScore] = useState<PrayerScore | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const dateRange = useMemo(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 29);
        return {
            start: formatLocalDate(start),
            end: formatLocalDate(end),
        };
    }, []);

    useEffect(() => {
        if (vaultStatus !== 'unlocked') {
            return;
        }
        setLoading(true);
        setError(null);
        listEntries({ start: dateRange.start, end: dateRange.end })
            .then(async (entries) => {
                const decrypted = await Promise.all(
                    entries.map(async (entry) => {
                        const data = await decryptEntry<EntryData>({
                            ciphertext: entry.ciphertext,
                            iv: entry.iv,
                        });
                        return { day: entry.day, data };
                    }),
                );

                const stats = buildStats(decrypted.map((item) => item.data));
                setStats(stats);
                setWeek(buildWeekSeries(decrypted));
                setHeatmap(buildHeatmapSeries(decrypted, 30));
                setPrayerScore(buildPrayerScore(decrypted.map((item) => item.data)));
            })
            .catch(() => setError('Statistiken konnten nicht geladen werden.'))
            .finally(() => setLoading(false));
    }, [dateRange.end, dateRange.start, decryptEntry, vaultStatus]);

    return (
        <AppShell title="Statistiken">
            <section className="space-y-6">
                {vaultStatus !== 'unlocked' ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                        Entsperre deinen Vault, um Statistiken zu sehen.
                    </div>
                ) : null}
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <h2 className="text-lg font-semibold">Letzte 30 Tage</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Übersicht deiner Gewohnheiten und spirituellen Praxis.
                    </p>
                    {loading ? (
                        <p className="mt-3 text-xs text-slate-500">Statistiken werden geladen…</p>
                    ) : error ? (
                        <p className="mt-3 text-xs text-red-600">{error}</p>
                    ) : stats ? (
                        <div className="mt-4 grid gap-3 text-sm">
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Einträge geschrieben: <strong>{stats.entries}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Fasten‑Tage: <strong>{stats.fasted}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Ø Stimmung:{' '}
                                <strong>{stats.avgMood ? stats.avgMood.toFixed(1).replace('.', ',') : '–'}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Fard pünktlich: <strong>{stats.fardOnTime}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Fard ausgelassen: <strong>{stats.fardMissed}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Qurʾān‑Tage: <strong>{stats.quranDays}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Qurʾān‑Tracking:
                                <div className="mt-2 grid gap-1 text-xs text-slate-600">
                                    {stats.quranByMode.juz > 0 ? <span>Juz: {stats.quranByMode.juz}</span> : null}
                                    {stats.quranByMode.hizb > 0 ? <span>Hizb: {stats.quranByMode.hizb}</span> : null}
                                    {stats.quranByMode.rub > 0 ? <span>Rubʿ: {stats.quranByMode.rub}</span> : null}
                                    {stats.quranByMode.pages > 0 ? (
                                        <span>Seiten: {stats.quranByMode.pages}</span>
                                    ) : null}
                                    {stats.quranByMode.verses > 0 ? (
                                        <span>Verse: {stats.quranByMode.verses}</span>
                                    ) : null}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Dhikr nach Gebet: <strong>{stats.dhikrAfter}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Duʿāʾ‑Tage: <strong>{stats.duaDays}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Sadaqah‑Tage: <strong>{stats.charityDays}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Tarawih‑Nächte: <strong>{stats.taraweehNights}</strong>
                            </div>
                            <div className="rounded-2xl border border-slate-100 px-4 py-3">
                                Witr‑Nächte: <strong>{stats.witrNights}</strong>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-3 text-xs text-slate-500">Noch keine Daten vorhanden.</p>
                    )}
                </div>

                {prayerScore ? (
                    <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                        <h2 className="text-lg font-semibold">Gebete‑Score</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Anteil der Fard‑Gebete nach Status (letzte 30 Tage).
                        </p>
                        <div className="mt-4 grid gap-3 text-sm">
                            {[
                                { label: 'Pünktlich', value: prayerScore.onTime },
                                { label: 'Verspätet', value: prayerScore.late },
                                { label: 'Nachgeholt', value: prayerScore.qada },
                                { label: 'Ausgelassen', value: prayerScore.missed },
                                { label: 'Nicht gesetzt', value: prayerScore.none },
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-slate-100 px-4 py-3">
                                    {item.label}:{' '}
                                    <strong>
                                        {item.value} ({formatPercent(item.value, prayerScore.total)})
                                    </strong>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {week.length ? (
                    <div className="space-y-4">
                        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/60 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-900/20">
                            <h3 className="text-sm font-semibold text-emerald-700">Letzte 7 Tage</h3>
                            <div className="mt-4 space-y-4">
                                <MiniBarChart
                                    title="Stimmung"
                                    values={week.map((d) => d.mood)}
                                    labels={week.map((d) => d.label)}
                                    max={5}
                                />
                                <MiniBarChart
                                    title="Fasten"
                                    values={week.map((d) => d.fasted)}
                                    labels={week.map((d) => d.label)}
                                    max={1}
                                />
                                <MiniBarChart
                                    title="Fard pünktlich"
                                    values={week.map((d) => d.fardOnTime)}
                                    labels={week.map((d) => d.label)}
                                    max={5}
                                />
                                <MiniBarChart
                                    title="Dhikr nach Gebet"
                                    values={week.map((d) => d.dhikrAfter)}
                                    labels={week.map((d) => d.label)}
                                    max={5}
                                />
                            </div>
                        </div>
                    </div>
                ) : null}

                {heatmap.length ? (
                    <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                        <h2 className="text-lg font-semibold">Heatmap</h2>
                        <p className="mt-2 text-sm text-slate-600">Aktivität der letzten 30 Tage.</p>
                        <div className="mt-4 grid grid-cols-6 gap-2">
                            {heatmap.map((item) => (
                                <div
                                    key={item.date}
                                    title={`${item.date} • ${item.score} Punkte`}
                                    className={`aspect-square rounded-lg border ${
                                        item.score >= 5
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : item.score >= 4
                                              ? 'border-emerald-400 bg-emerald-400'
                                              : item.score >= 3
                                                ? 'border-emerald-300 bg-emerald-300'
                                                : item.score >= 2
                                                  ? 'border-emerald-200 bg-emerald-200'
                                                  : item.score >= 1
                                                    ? 'border-emerald-100 bg-emerald-100'
                                                    : 'border-slate-200 bg-slate-50'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                ) : null}
            </section>
        </AppShell>
    );
}

function buildStats(entries: EntryData[]): Stats {
    if (!entries.length) {
        return {
            entries: 0,
            fasted: 0,
            avgMood: null,
            fardOnTime: 0,
            fardMissed: 0,
            quranDays: 0,
            quranByMode: { juz: 0, hizb: 0, rub: 0, pages: 0, verses: 0 },
            dhikrAfter: 0,
            duaDays: 0,
            charityDays: 0,
            taraweehNights: 0,
            witrNights: 0,
        };
    }

    let moodSum = 0;
    let moodCount = 0;
    let fasted = 0;
    let fardOnTime = 0;
    let fardMissed = 0;
    let quranDays = 0;
    let quranByMode = { juz: 0, hizb: 0, rub: 0, pages: 0, verses: 0 };
    let dhikrAfter = 0;
    let duaDays = 0;
    let charityDays = 0;
    let taraweehNights = 0;
    let witrNights = 0;

    for (const entry of entries) {
        if (typeof entry.mood === 'number') {
            moodSum += entry.mood;
            moodCount += 1;
        }
        if (entry.fasted) fasted += 1;
        if (hasQuranActivity(entry)) quranDays += 1;
        quranByMode = addQuranUnits(quranByMode, entry);
        if (entry.duaDone) duaDays += 1;
        if (entry.charityGiven) charityDays += 1;
        if (entry.prayers.taraweeh > 0) taraweehNights += 1;
        if (entry.prayers.witr > 0) witrNights += 1;

        const prayers = [entry.prayers.fajr, entry.prayers.dhuhr, entry.prayers.asr, entry.prayers.maghrib, entry.prayers.isha];
        prayers.forEach((prayer) => {
            if (prayer.fard === 'on_time') fardOnTime += 1;
            if (prayer.fard === 'missed') fardMissed += 1;
            if (prayer.dhikrAfter) dhikrAfter += 1;
        });
    }

    return {
        entries: entries.length,
        fasted,
        avgMood: moodCount ? moodSum / moodCount : null,
        fardOnTime,
        fardMissed,
        quranDays,
        quranByMode,
        dhikrAfter,
        duaDays,
        charityDays,
        taraweehNights,
        witrNights,
    };
}

function buildWeekSeries(entries: EntryWithDay[]): DayPoint[] {
    const today = new Date();
    const points: DayPoint[] = [];
    const labels = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const map = new Map(entries.map((item) => [item.day, item.data]));

    for (let i = 6; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const key = formatLocalDate(date);
        const data = map.get(key);
        const label = labels[date.getDay()];
        points.push({
            label,
            date: key,
            mood: data?.mood ?? 0,
            fasted: data?.fasted ? 1 : 0,
            fardOnTime: countFardOnTime(data),
            dhikrAfter: countDhikrAfter(data),
        });
    }

    return points;
}

function buildHeatmapSeries(entries: EntryWithDay[], days: number) {
    const today = new Date();
    const map = new Map(entries.map((item) => [item.day, item.data]));
    const series: { date: string; score: number }[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const key = formatLocalDate(date);
        const entry = map.get(key);
        series.push({ date: key, score: computeDailyScore(entry) });
    }
    return series;
}

function computeDailyScore(entry?: EntryData) {
    if (!entry) return 0;
    let score = 0;
    if (entry.fasted) score += 1;
    if (entry.mood >= 4) score += 1;
    if (hasQuranActivity(entry)) score += 1;
    if (countDhikrAfter(entry) > 0) score += 1;
    if (entry.duaDone || entry.charityGiven) score += 1;
    return Math.min(score, 5);
}

function buildPrayerScore(entries: EntryData[]): PrayerScore {
    const score: PrayerScore = { total: 0, onTime: 0, late: 0, qada: 0, missed: 0, none: 0 };
    entries.forEach((entry) => {
        const prayers = [entry.prayers.fajr, entry.prayers.dhuhr, entry.prayers.asr, entry.prayers.maghrib, entry.prayers.isha];
        prayers.forEach((prayer) => {
            score.total += 1;
            switch (prayer.fard) {
                case 'on_time':
                    score.onTime += 1;
                    break;
                case 'late':
                    score.late += 1;
                    break;
                case 'qada':
                    score.qada += 1;
                    break;
                case 'missed':
                    score.missed += 1;
                    break;
                default:
                    score.none += 1;
            }
        });
    });
    return score;
}

function formatPercent(value: number, total: number) {
    if (!total) return '0%';
    return `${Math.round((value / total) * 100)}%`;
}

function countFardOnTime(entry?: EntryData) {
    if (!entry) return 0;
    const prayers = [entry.prayers.fajr, entry.prayers.dhuhr, entry.prayers.asr, entry.prayers.maghrib, entry.prayers.isha];
    return prayers.filter((prayer) => prayer.fard === 'on_time').length;
}

function countDhikrAfter(entry?: EntryData) {
    if (!entry) return 0;
    const prayers = [entry.prayers.fajr, entry.prayers.dhuhr, entry.prayers.asr, entry.prayers.maghrib, entry.prayers.isha];
    return prayers.filter((prayer) => prayer.dhikrAfter).length;
}

function hasQuranActivity(entry?: EntryData) {
    if (!entry || !entry.quran) return false;
    if (entry.quran.mode === 'pages') {
        return entry.quran.pagesTo >= entry.quran.pagesFrom && entry.quran.pagesTo > 0;
    }
    if (entry.quran.mode === 'surah_ayah') {
        return entry.quran.surahRanges.length > 0;
    }
    return entry.quran.amount > 0;
}

function countQuranUnits(entry?: EntryData) {
    if (!entry || !entry.quran) return 0;
    if (entry.quran.mode === 'pages') {
        if (entry.quran.pagesTo >= entry.quran.pagesFrom && entry.quran.pagesTo > 0) {
            return entry.quran.pagesTo - entry.quran.pagesFrom + 1;
        }
        return 0;
    }
    if (entry.quran.mode === 'surah_ayah') {
        return entry.quran.surahRanges.reduce((sum, range) => {
            const count = Math.max(0, range.to - range.from + 1);
            return sum + count;
        }, 0);
    }
    return entry.quran.amount;
}

function addQuranUnits(
    current: { juz: number; hizb: number; rub: number; pages: number; verses: number },
    entry?: EntryData,
) {
    if (!entry || !entry.quran) return current;
    const next = { ...current };
    if (entry.quran.mode === 'juz') next.juz += entry.quran.amount;
    if (entry.quran.mode === 'hizb') next.hizb += entry.quran.amount;
    if (entry.quran.mode === 'rub') next.rub += entry.quran.amount;
    if (entry.quran.mode === 'pages') {
        next.pages += countQuranUnits(entry);
    }
    if (entry.quran.mode === 'surah_ayah') {
        next.verses += countQuranUnits(entry);
    }
    return next;
}

function MiniBarChart({
    title,
    values,
    labels,
    max,
}: {
    title: string;
    values: number[];
    labels: string[];
    max: number;
}) {
    return (
        <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">{title}</p>
            <div className="mt-3 grid grid-cols-7 gap-2">
                {values.map((value, index) => {
                    const height = max > 0 ? Math.round((value / max) * 100) : 0;
                    return (
                        <div key={`${title}-${index}`} className="flex flex-col items-center gap-2 text-xs text-emerald-800">
                            <div className="flex h-16 w-full items-end rounded-lg bg-emerald-100/60 p-1">
                                <div
                                    className="w-full rounded-md bg-emerald-500"
                                    style={{ height: `${Math.max(6, height)}%` }}
                                />
                            </div>
                            <span>{labels[index]}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
