import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { useAuthStore } from '../lib/auth-store';
import { useVaultStore } from '../lib/vault-store';
import { createEntry, listEntries, updateEntry } from '../lib/api';
import { useProfileStore } from '../lib/profile-store';
import { usePreferencesStore } from '../lib/preferences-store';
import { Frown, Meh, Smile, SmilePlus, Laugh } from 'lucide-react';

type EntryData = {
    mood: number;
    fasted: boolean;
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
    meals: {
        suhoor: boolean;
        iftar: boolean;
    };
    duaDone: boolean;
    charityGiven: boolean;
};

type FardStatus = 'none' | 'on_time' | 'late' | 'qada' | 'missed';

export function TodayScreen() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const user = useAuthStore((state) => state.user);
    const authStatus = useAuthStore((state) => state.status);
    const vaultStatus = useVaultStore((state) => state.status);
    const encryptEntry = useVaultStore((state) => state.encryptEntry);
    const decryptEntry = useVaultStore((state) => state.decryptEntry);
    const profile = useProfileStore((state) => state.profile);
    const preferences = usePreferencesStore((state) => state.preferences);
    const [entryId, setEntryId] = useState<string | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const lastSavedTextRef = useRef('');
    const saveButtonRef = useRef<HTMLButtonElement | null>(null);
    const [data, setData] = useState<EntryData>(defaultEntry());

    const rawDate = searchParams.get('date') ?? '';
    const today = useMemo(() => formatLocalDate(new Date()), []);
    const entryDate = useMemo(() => {
        return isValidDateString(rawDate) ? rawDate : today;
    }, [rawDate, today]);
    const [nextFajr, setNextFajr] = useState<string>('');
    const nextDate = useMemo(() => addDays(entryDate, 1), [entryDate]);
    const nightInfo = useMemo(
        () => computeNightInfo(data.night.maghrib, nextFajr),
        [data.night.maghrib, nextFajr],
    );
    const fastingDuration = useMemo(
        () => computeFastingDuration(data.night.fajr, data.night.maghrib),
        [data.night.fajr, data.night.maghrib],
    );
    const ramadanStart = preferences.ramadanStart ?? '2026-02-17';
    const oddNightInfo = useMemo(
        () => computeOddNightInfo(entryDate, data.night.maghrib, ramadanStart),
        [entryDate, data.night.maghrib, ramadanStart],
    );
    const ramadanDayLabel = useMemo(() => computeRamadanNightLabel(entryDate, ramadanStart), [entryDate, ramadanStart]);
    const fastingDayLabel = useMemo(() => computeFastingDayLabel(entryDate, ramadanStart), [entryDate, ramadanStart]);
    const fastingAllowed = useMemo(() => isFastingAllowed(entryDate, ramadanStart), [entryDate, ramadanStart]);

    useEffect(() => {
        if (authStatus !== 'ready') {
            return;
        }
        if (!user) {
            navigate('/auth', { replace: true });
        }
    }, [authStatus, navigate, user]);

    useEffect(() => {
        if (vaultStatus !== 'unlocked') {
            setLoading(false);
            return;
        }
        setLoading(true);
        listEntries({ start: entryDate, end: nextDate })
            .then(async (entries) => {
                const currentEntry = entries.find((item) => item.day === entryDate);
                const nextEntry = entries.find((item) => item.day === nextDate);
                const nextFajr = nextEntry
                    ? (await decryptEntry<EntryData>({
                          ciphertext: nextEntry.ciphertext,
                          iv: nextEntry.iv,
                      }))?.night?.fajr ?? ''
                    : '';
                setNextFajr(nextFajr);
                const entry = currentEntry;
                if (!entry) {
                    const empty = defaultEntry();
                    setEntryId(null);
                    setData(empty);
                    lastSavedTextRef.current = empty.text ?? '';
                    setIsEmpty(true);
                    return;
                }
                setEntryId(entry.id);
                const decrypted = await decryptEntry<EntryData>({
                    ciphertext: entry.ciphertext,
                    iv: entry.iv,
                });
                const normalized = normalizeEntry(decrypted);
                setData(normalized);
                lastSavedTextRef.current = normalized.text ?? '';
                setIsEmpty(false);
            })
            .catch(() => setError('Eintrag konnte nicht geladen werden.'))
            .finally(() => setLoading(false));
    }, [decryptEntry, entryDate, vaultStatus]);

    async function handleSave() {
        setSaving(true);
        setError(null);
        try {
            const encrypted = await encryptEntry(data);
            if (entryId) {
                await updateEntry(entryId, {
                    ciphertext: encrypted.ciphertext,
                    iv: encrypted.iv,
                    aad: { kind: 'entry' },
                });
            } else {
                const created = await createEntry({
                    day: entryDate,
                    ciphertext: encrypted.ciphertext,
                    iv: encrypted.iv,
                    aad: { kind: 'entry' },
                });
                setEntryId(created.id);
            }
            lastSavedTextRef.current = data.text ?? '';
        } catch (error) {
            setError('Eintrag konnte nicht gespeichert werden.');
        } finally {
            setSaving(false);
        }
    }

    const handleTextBlur = (event: React.FocusEvent<HTMLTextAreaElement>) => {
        if (event.relatedTarget === saveButtonRef.current) {
            return;
        }
        if (vaultStatus !== 'unlocked' || saving || loading) {
            return;
        }
        if (data.text === lastSavedTextRef.current) {
            return;
        }
        if (!entryId && data.text.trim() === '') {
            return;
        }
        void handleSave();
    };

    return (
        <AppShell title="Heute">
            <section className="space-y-6">
                {vaultStatus !== 'unlocked' ? (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span>Dein Vault ist gesperrt. Bitte entsperren, um Einträge zu sehen.</span>
                            <button
                                type="button"
                                onClick={() => navigate('/vault/unlock')}
                                className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs text-amber-800"
                            >
                                Jetzt entsperren
                            </button>
                        </div>
                    </div>
                ) : null}
                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Wie fühlst du dich?</h2>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                            Stimmung {data.mood}/5
                        </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                            <span>{entryDate === today ? 'Heute' : entryDate}</span>
                            {ramadanDayLabel ? (
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600">
                                    {ramadanDayLabel}
                                </span>
                            ) : null}
                        </div>
                        {entryDate !== today ? (
                            <button
                                type="button"
                                onClick={() => navigate('/today')}
                                className="rounded-full border border-slate-200 px-3 py-1"
                            >
                                Zu heute
                            </button>
                        ) : null}
                    </div>
                    <div className="mt-4 grid grid-cols-5 gap-2">
                        {[
                            { value: 1, label: 'Sehr schlecht', icon: Frown, tone: 'rose' },
                            { value: 2, label: 'Schlecht', icon: Meh, tone: 'amber' },
                            { value: 3, label: 'Neutral', icon: Smile, tone: 'slate' },
                            { value: 4, label: 'Gut', icon: SmilePlus, tone: 'emerald' },
                            { value: 5, label: 'Sehr gut', icon: Laugh, tone: 'emerald' },
                        ].map(({ value, label, icon: Icon, tone }) => {
                            const isActive = data.mood === value;
                            const activeStyles =
                                tone === 'rose'
                                    ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-500/10 dark:text-rose-200'
                                    : tone === 'amber'
                                      ? 'border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-500/10 dark:text-amber-200'
                                      : tone === 'emerald'
                                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200'
                                        : 'border-slate-400 bg-slate-50 text-slate-700 dark:border-slate-500 dark:bg-slate-500/10 dark:text-slate-200';
                            const activeIcon =
                                tone === 'rose'
                                    ? 'text-rose-700 dark:text-rose-200'
                                    : tone === 'amber'
                                      ? 'text-amber-700 dark:text-amber-200'
                                      : tone === 'emerald'
                                        ? 'text-emerald-800 dark:text-emerald-200'
                                        : 'text-slate-700 dark:text-slate-200';
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setData((current) => ({ ...current, mood: value }))}
                                    aria-pressed={isActive}
                                    aria-label={label}
                                    className={`flex h-11 items-center justify-center rounded-2xl border px-3 py-2 text-sm text-slate-700 dark:text-slate-100 ${
                                        isActive
                                            ? activeStyles
                                            : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:border-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    <Icon className={`h-5 w-5 ${isActive ? activeIcon : ''}`} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Gebetstracking</h3>
                    <p className="mt-2 text-xs text-slate-500">
                        Ein neuer islamischer Tag beginnt mit Maghrib.
                    </p>
                    <div className="mt-4 space-y-3 text-sm">
                        {profile?.gender === 'female' ? (
                            <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                                Periode heute
                                <input
                                    type="checkbox"
                                    aria-label="Periode heute"
                                    checked={data.menstruation}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            menstruation: event.target.checked,
                                            fasted: event.target.checked ? false : current.fasted,
                                        }))
                                    }
                                />
                            </label>
                        ) : null}
                        {fastingAllowed ? (
                            <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                                Heute gefastet
                                <input
                                    type="checkbox"
                                    aria-label="Heute gefastet"
                                    checked={data.fasted}
                                    disabled={data.menstruation}
                                    onChange={(event) =>
                                        setData((current) => ({ ...current, fasted: event.target.checked }))
                                    }
                                />
                            </label>
                        ) : null}
                        {data.menstruation ? (
                            <p className="text-xs text-slate-500">Fasten ist während der Periode nicht auswählbar.</p>
                        ) : null}
                    </div>

                    <div className="mt-5 space-y-3">
                        {renderPrayerSection({
                            title: 'Fajr',
                            fard: data.prayers.fajr.fard,
                            onFardChange: (value) =>
                                setData((current) => ({
                                    ...current,
                                    prayers: { ...current.prayers, fajr: { ...current.prayers.fajr, fard: value } },
                                })),
                            sunnah: [
                                {
                                    label: '2 vor Fajr',
                                    checked: data.prayers.fajr.sunnahBefore,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                fajr: { ...current.prayers.fajr, sunnahBefore: checked },
                                            },
                                        })),
                                },
                            ],
                            dhikr: [
                                {
                                    label: 'Dhikr nach Fajr',
                                    checked: data.prayers.fajr.dhikrAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                fajr: { ...current.prayers.fajr, dhikrAfter: checked },
                                            },
                                        })),
                                },
                            ],
                        })}

                        {renderPrayerSection({
                            title: 'Dhuhr',
                            fard: data.prayers.dhuhr.fard,
                            onFardChange: (value) =>
                                setData((current) => ({
                                    ...current,
                                    prayers: { ...current.prayers, dhuhr: { ...current.prayers.dhuhr, fard: value } },
                                })),
                            sunnah: [
                                {
                                    label: '2 vor (1)',
                                    checked: data.prayers.dhuhr.sunnahBefore[0],
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                dhuhr: {
                                                    ...current.prayers.dhuhr,
                                                    sunnahBefore: [checked, current.prayers.dhuhr.sunnahBefore[1]],
                                                },
                                            },
                                        })),
                                },
                                {
                                    label: '2 vor (2)',
                                    checked: data.prayers.dhuhr.sunnahBefore[1],
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                dhuhr: {
                                                    ...current.prayers.dhuhr,
                                                    sunnahBefore: [current.prayers.dhuhr.sunnahBefore[0], checked],
                                                },
                                            },
                                        })),
                                },
                                {
                                    label: '2 nach Dhuhr',
                                    checked: data.prayers.dhuhr.sunnahAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                dhuhr: { ...current.prayers.dhuhr, sunnahAfter: checked },
                                            },
                                        })),
                                },
                            ],
                            dhikr: [
                                {
                                    label: 'Dhikr nach Dhuhr',
                                    checked: data.prayers.dhuhr.dhikrAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                dhuhr: { ...current.prayers.dhuhr, dhikrAfter: checked },
                                            },
                                        })),
                                },
                            ],
                        })}

                        {renderPrayerSection({
                            title: 'Asr',
                            fard: data.prayers.asr.fard,
                            onFardChange: (value) =>
                                setData((current) => ({
                                    ...current,
                                    prayers: { ...current.prayers, asr: { ...current.prayers.asr, fard: value } },
                                })),
                            dhikr: [
                                {
                                    label: 'Dhikr nach Asr',
                                    checked: data.prayers.asr.dhikrAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                asr: { ...current.prayers.asr, dhikrAfter: checked },
                                            },
                                        })),
                                },
                            ],
                        })}

                        {renderPrayerSection({
                            title: 'Maghrib',
                            fard: data.prayers.maghrib.fard,
                            onFardChange: (value) =>
                                setData((current) => ({
                                    ...current,
                                    prayers: {
                                        ...current.prayers,
                                        maghrib: { ...current.prayers.maghrib, fard: value },
                                    },
                                })),
                            sunnah: [
                                {
                                    label: '2 nach Maghrib',
                                    checked: data.prayers.maghrib.sunnahAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                maghrib: { ...current.prayers.maghrib, sunnahAfter: checked },
                                            },
                                        })),
                                },
                            ],
                            dhikr: [
                                {
                                    label: 'Dhikr nach Maghrib',
                                    checked: data.prayers.maghrib.dhikrAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                maghrib: { ...current.prayers.maghrib, dhikrAfter: checked },
                                            },
                                        })),
                                },
                            ],
                        })}

                        {renderPrayerSection({
                            title: 'ʿIshāʾ',
                            fard: data.prayers.isha.fard,
                            onFardChange: (value) =>
                                setData((current) => ({
                                    ...current,
                                    prayers: { ...current.prayers, isha: { ...current.prayers.isha, fard: value } },
                                })),
                            sunnah: [
                                {
                                    label: '2 nach ʿIshāʾ',
                                    checked: data.prayers.isha.sunnahAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                isha: { ...current.prayers.isha, sunnahAfter: checked },
                                            },
                                        })),
                                },
                            ],
                            dhikr: [
                                {
                                    label: 'Dhikr nach ʿIshāʾ',
                                    checked: data.prayers.isha.dhikrAfter,
                                    onChange: (checked) =>
                                        setData((current) => ({
                                            ...current,
                                            prayers: {
                                                ...current.prayers,
                                                isha: { ...current.prayers.isha, dhikrAfter: checked },
                                            },
                                        })),
                                },
                            ],
                        })}
                            <div className="grid gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tarawih</p>
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    {[0, 2, 4, 6, 8].map((count) => (
                                        <button
                                            key={count}
                                            type="button"
                                            aria-pressed={data.prayers.taraweeh === count}
                                            onClick={() =>
                                                setData((current) => ({
                                                    ...current,
                                                    prayers: { ...current.prayers, taraweeh: count },
                                                }))
                                            }
                                            className={`rounded-xl border px-2 py-2 text-xs ${
                                                data.prayers.taraweeh === count
                                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                    : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {count === 0 ? 'Kein' : `${count} Rakʿāt`}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        aria-pressed={![0, 2, 4, 6, 8].includes(data.prayers.taraweeh)}
                                        onClick={() =>
                                            setData((current) => ({
                                                ...current,
                                                prayers: {
                                                    ...current.prayers,
                                                    taraweeh:
                                                        current.prayers.taraweeh &&
                                                        ![0, 2, 4, 6, 8].includes(current.prayers.taraweeh)
                                                            ? current.prayers.taraweeh
                                                            : 10,
                                                },
                                            }))
                                        }
                                        className={`rounded-xl border px-2 py-2 text-xs ${
                                            ![0, 2, 4, 6, 8].includes(data.prayers.taraweeh)
                                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        Custom
                                    </button>
                                </div>
                                {![0, 2, 4, 6, 8].includes(data.prayers.taraweeh) ? (
                                    <div className="mt-2 flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-xs">
                                        <span>Eigene Rakʿāt</span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={20}
                                            step={2}
                                            value={data.prayers.taraweeh}
                                            onChange={(event) => {
                                                const next = normalizeTaraweehValue(Number(event.target.value));
                                                setData((current) => ({
                                                    ...current,
                                                    prayers: {
                                                        ...current.prayers,
                                                        taraweeh: next,
                                                    },
                                                }));
                                            }}
                                            className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                        />
                                    </div>
                                ) : null}
                            </div>
                            <div className="grid gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Witr</p>
                                <div className="mt-2 grid grid-cols-3 gap-2">
                                    {[0, 3, 5, 7, 9, 11].map((count) => (
                                        <button
                                            key={count}
                                            type="button"
                                            aria-pressed={data.prayers.witr === count}
                                            onClick={() =>
                                                setData((current) => ({
                                                    ...current,
                                                    prayers: {
                                                        ...current.prayers,
                                                        witr: count,
                                                    },
                                                }))
                                            }
                                            className={`rounded-xl border px-2 py-2 text-xs ${
                                                data.prayers.witr === count
                                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                    : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {count === 0 ? 'Kein' : `${count} Rakʿāt`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <h3 className="text-sm font-semibold text-slate-700">Fasten</h3>
                    <div className="mt-4 grid gap-3 text-sm">
                        {fastingDayLabel ? (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
                                {fastingDayLabel}
                            </div>
                        ) : null}
                        <div className="grid gap-3 rounded-2xl border border-slate-100 px-4 py-3 text-xs">
                            <label className="grid gap-2">
                                Fajr (heute)
                                <input
                                    type="time"
                                    value={data.night.fajr}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            night: { ...current.night, fajr: event.target.value },
                                        }))
                                    }
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                            <label className="grid gap-2">
                                Maghrib (heute)
                                <input
                                    type="time"
                                    value={data.night.maghrib}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            night: { ...current.night, maghrib: event.target.value },
                                        }))
                                    }
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                            {fastingAllowed ? (
                                <div className="flex items-center justify-between text-[11px] text-slate-500">
                                    <span>Fasten‑Dauer</span>
                                    <span>{fastingDuration ?? '–'}</span>
                                </div>
                            ) : null}
                            {oddNightInfo ? (
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-800">
                                    {oddNightInfo}
                                </div>
                            ) : null}
                        </div>
                        {fastingAllowed ? (
                            <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                                Suhūr gegessen
                                <input
                                    type="checkbox"
                                    checked={data.meals.suhoor}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            meals: { ...current.meals, suhoor: event.target.checked },
                                        }))
                                    }
                                />
                            </label>
                        ) : null}
                        {fastingAllowed ? (
                            <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                                Iftār gemacht
                                <input
                                    type="checkbox"
                                    checked={data.meals.iftar}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            meals: { ...current.meals, iftar: event.target.checked },
                                        }))
                                    }
                                />
                            </label>
                        ) : null}
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-800">
                            <div className="flex items-center justify-between">
                                <span>Nacht‑Dauer</span>
                                <span>{nightInfo?.durationLabel ?? '–'}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span>Mitternacht</span>
                                <span>{nightInfo?.midnight ?? '–'}</span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span>Letztes Drittel</span>
                                <span>
                                    {nightInfo ? `${nightInfo.lastThirdStart} – ${nightInfo.fajr}` : '–'}
                                </span>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                                <span>Fajr (nächster Tag)</span>
                                <span>{nextFajr || '–'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <h3 className="text-sm font-semibold text-slate-700">Qurʾān</h3>
                    <div className="mt-4 space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { value: 'juz', label: 'Juz' },
                                { value: 'hizb', label: 'Hizb' },
                                { value: 'rub', label: 'Rubʿ' },
                                { value: 'pages', label: 'Seiten' },
                                { value: 'surah_ayah', label: 'Sure/Verse' },
                            ].map((item) => (
                                <button
                                    key={item.value}
                                    type="button"
                                    aria-pressed={data.quran.mode === item.value}
                                    onClick={() =>
                                        setData((current) => ({
                                            ...current,
                                            quran: { ...current.quran, mode: item.value as EntryData['quran']['mode'] },
                                        }))
                                    }
                                    className={`rounded-2xl border px-3 py-2 text-xs ${
                                        data.quran.mode === item.value
                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200'
                                            : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>

                        {['juz', 'hizb', 'rub'].includes(data.quran.mode) ? (
                            <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                                {data.quran.mode === 'juz'
                                    ? 'Juz gelesen'
                                    : data.quran.mode === 'hizb'
                                      ? 'Hizb gelesen'
                                      : 'Rubʿ gelesen'}
                                <input
                                    type="number"
                                    min={0}
                                    max={data.quran.mode === 'juz' ? 30 : data.quran.mode === 'hizb' ? 60 : 240}
                                    value={data.quran.amount}
                                    onChange={(event) =>
                                        setData((current) => ({
                                            ...current,
                                            quran: {
                                                ...current.quran,
                                                amount: Math.max(0, Number(event.target.value || 0)),
                                            },
                                        }))
                                    }
                                    className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                />
                            </label>
                        ) : null}

                        {data.quran.mode === 'pages' ? (
                            <div className="grid gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Seiten (von – bis)</p>
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                    <input
                                        type="number"
                                        min={0}
                                        value={data.quran.pagesFrom}
                                        onChange={(event) =>
                                            setData((current) => ({
                                                ...current,
                                                quran: {
                                                    ...current.quran,
                                                    pagesFrom: Math.max(0, Number(event.target.value || 0)),
                                                },
                                            }))
                                        }
                                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                    />
                                    <span className="text-xs text-slate-500">bis</span>
                                    <input
                                        type="number"
                                        min={data.quran.pagesFrom}
                                        value={data.quran.pagesTo}
                                        onChange={(event) =>
                                            setData((current) => ({
                                                ...current,
                                                quran: {
                                                    ...current.quran,
                                                    pagesTo: Math.max(0, Number(event.target.value || 0)),
                                                },
                                            }))
                                        }
                                        onBlur={() =>
                                            setData((current) => ({
                                                ...current,
                                                quran: {
                                                    ...current.quran,
                                                    pagesTo:
                                                        current.quran.pagesTo < current.quran.pagesFrom
                                                            ? current.quran.pagesFrom
                                                            : current.quran.pagesTo,
                                                },
                                            }))
                                        }
                                        className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                    />
                                    <span className="text-xs text-slate-500">
                                        {data.quran.pagesTo >= data.quran.pagesFrom && data.quran.pagesTo > 0
                                            ? `(${data.quran.pagesTo - data.quran.pagesFrom + 1} Seiten)`
                                            : ''}
                                    </span>
                                </div>
                            </div>
                        ) : null}

                        {data.quran.mode === 'surah_ayah' ? (
                            <div className="grid gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sure &amp; Verse</p>
                                <div className="grid gap-2">
                                    {data.quran.surahRanges.map((range, index) => (
                                        <div key={`${range.surah}-${index}`} className="grid gap-2 rounded-xl border border-slate-100 px-3 py-2">
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <span>Abschnitt {index + 1}</span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setData((current) => ({
                                                            ...current,
                                                            quran: {
                                                                ...current.quran,
                                                                surahRanges: current.quran.surahRanges.filter(
                                                                    (_, idx) => idx !== index,
                                                                ),
                                                            },
                                                        }))
                                                    }
                                                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px]"
                                                >
                                                    Entfernen
                                                </button>
                                            </div>
                                            <div className="grid gap-2">
                                                <label className="grid gap-1 text-[11px] text-slate-500">
                                                    Sure
                                                    <select
                                                        value={range.surah}
                                                        onChange={(event) => {
                                                            const value = Math.max(1, Math.min(114, Number(event.target.value || 1)));
                                                            setData((current) => {
                                                                const surahRanges = [...current.quran.surahRanges];
                                                                const max = getSurahAyahCount(value);
                                                                surahRanges[index] = { ...surahRanges[index], surah: value, from: 1, to: max };
                                                                return { ...current, quran: { ...current.quran, surahRanges } };
                                                            });
                                                        }}
                                                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                                                    >
                                                        {SURAH_OPTIONS.map((surah) => (
                                                            <option key={surah.number} value={surah.number}>
                                                                {surah.name} ({surah.number})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <div className="grid gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">
                                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                                        <span>Verse</span>
                                                        <span>
                                                            {range.from}–{range.to} / {getSurahAyahCount(range.surah)}
                                                        </span>
                                                    </div>
                                                    <div className="relative grid gap-2">
                                                        <input
                                                            type="range"
                                                            min={1}
                                                            max={getSurahAyahCount(range.surah)}
                                                            value={range.from}
                                                            onChange={(event) => {
                                                                const value = Number(event.target.value || 1);
                                                                setData((current) => {
                                                                    const surahRanges = [...current.quran.surahRanges];
                                                                    const nextFrom = Math.min(value, surahRanges[index].to);
                                                                    surahRanges[index] = { ...surahRanges[index], from: nextFrom };
                                                                    return { ...current, quran: { ...current.quran, surahRanges } };
                                                                });
                                                            }}
                                                            className="w-full"
                                                        />
                                                        <input
                                                            type="range"
                                                            min={1}
                                                            max={getSurahAyahCount(range.surah)}
                                                            value={range.to}
                                                            onChange={(event) => {
                                                                const value = Number(event.target.value || 1);
                                                                setData((current) => {
                                                                    const surahRanges = [...current.quran.surahRanges];
                                                                    const nextTo = Math.max(value, surahRanges[index].from);
                                                                    surahRanges[index] = { ...surahRanges[index], to: nextTo };
                                                                    return { ...current, quran: { ...current.quran, surahRanges } };
                                                                });
                                                            }}
                                                            className="w-full"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        setData((current) => ({
                                            ...current,
                                            quran: {
                                                ...current.quran,
                                                surahRanges: [
                                                    ...current.quran.surahRanges,
                                                    { surah: 1, from: 1, to: getSurahAyahCount(1) },
                                                ],
                                            },
                                        }))
                                    }
                                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600"
                                >
                                    Abschnitt hinzufügen
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <h3 className="text-sm font-semibold text-slate-700">Weitere Taten</h3>
                    <div className="mt-4 space-y-3 text-sm">
                        <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                            Duʿāʾ gemacht
                            <input
                                type="checkbox"
                                aria-label="Duʿāʾ gemacht"
                                checked={data.duaDone}
                                onChange={(event) =>
                                    setData((current) => ({ ...current, duaDone: event.target.checked }))
                                }
                            />
                        </label>
                        <label className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
                            Sadaqah gegeben
                            <input
                                type="checkbox"
                                aria-label="Sadaqah gegeben"
                                checked={data.charityGiven}
                                onChange={(event) =>
                                    setData((current) => ({ ...current, charityGiven: event.target.checked }))
                                }
                            />
                        </label>
                    </div>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-white/80 p-5 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <h3 className="text-sm font-semibold text-slate-700">Reflexion</h3>
                    {loading ? (
                        <p className="mt-3 text-xs text-slate-500">Lade Eintrag…</p>
                    ) : isEmpty ? (
                        <p className="mt-3 text-xs text-slate-500">Noch kein Eintrag für diesen Tag.</p>
                    ) : null}
                    <textarea
                        rows={5}
                        placeholder="Schreibe deine Reflexion..."
                        aria-label="Reflexion"
                        value={data.text}
                        onChange={(event) => setData((current) => ({ ...current, text: event.target.value }))}
                        onBlur={handleTextBlur}
                        className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    />
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading || vaultStatus !== 'unlocked'}
                        ref={saveButtonRef}
                        className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        {saving
                            ? 'Speichern…'
                            : entryId
                              ? 'Eintrag aktualisieren'
                              : 'Eintrag speichern'}
                    </button>
                    {error ? (
                        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                            {error}
                        </div>
                    ) : null}
                </div>
            </section>
        </AppShell>
    );
}

function defaultEntry(): EntryData {
    return {
        mood: 3,
        fasted: false,
        text: '',
        menstruation: false,
        quran: { mode: 'juz', amount: 0, pagesFrom: 0, pagesTo: 0, surahRanges: [] },
        night: { maghrib: '', fajr: '' },
        meals: { suhoor: false, iftar: false },
        duaDone: false,
        charityGiven: false,
        prayers: {
            fajr: { fard: 'none', sunnahBefore: false, dhikrAfter: false },
            dhuhr: {
                fard: 'none',
                sunnahBefore: [false, false],
                sunnahAfter: false,
                dhikrAfter: false,
            },
            asr: { fard: 'none', dhikrAfter: false },
            maghrib: { fard: 'none', sunnahAfter: false, dhikrAfter: false },
            isha: { fard: 'none', sunnahAfter: false, dhikrAfter: false },
            witr: 0,
            taraweeh: 0,
        },
    };
}

function normalizeEntry(data: EntryData): EntryData {
    const defaults = defaultEntry();
    return {
        ...defaults,
        ...data,
        quran: {
            ...defaults.quran,
            ...data.quran,
            surahRanges: data.quran?.surahRanges ?? defaults.quran.surahRanges,
        },
        night: {
            ...defaults.night,
            ...data.night,
        },
        meals: {
            ...defaults.meals,
            ...data.meals,
        },
        prayers: {
            ...defaults.prayers,
            ...data.prayers,
            fajr: { ...defaults.prayers.fajr, ...data.prayers?.fajr },
            dhuhr: {
                ...defaults.prayers.dhuhr,
                ...data.prayers?.dhuhr,
                sunnahBefore: data.prayers?.dhuhr?.sunnahBefore ?? defaults.prayers.dhuhr.sunnahBefore,
            },
            asr: { ...defaults.prayers.asr, ...data.prayers?.asr },
            maghrib: { ...defaults.prayers.maghrib, ...data.prayers?.maghrib },
            isha: { ...defaults.prayers.isha, ...data.prayers?.isha },
            witr: typeof data.prayers?.witr === 'number' ? data.prayers.witr : defaults.prayers.witr,
            taraweeh: typeof data.prayers?.taraweeh === 'number' ? data.prayers.taraweeh : defaults.prayers.taraweeh,
        },
    };
}

function renderPrayerRow(
    label: string,
    value: FardStatus,
    onChange: (status: FardStatus) => void,
) {
    const options: { label: string; value: FardStatus }[] = [
        { label: 'Pünktlich', value: 'on_time' },
        { label: 'Verspätet', value: 'late' },
        { label: 'Nachgeholt', value: 'qada' },
        { label: 'Ausgelassen', value: 'missed' },
    ];

    return (
        <div className="grid gap-2 rounded-2xl border border-slate-100 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
            <div className="grid grid-cols-2 gap-2">
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={value === option.value}
                        onClick={() => onChange(option.value)}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                            value === option.value
                                ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-200'
                                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300 dark:border-slate-700 dark:text-slate-300'
                        }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

function renderPrayerSection({
    title,
    fard,
    onFardChange,
    sunnah = [],
    dhikr = [],
}: {
    title: string;
    fard: FardStatus;
    onFardChange: (status: FardStatus) => void;
    sunnah?: { label: string; checked: boolean; onChange: (checked: boolean) => void }[];
    dhikr?: { label: string; checked: boolean; onChange: (checked: boolean) => void }[];
}) {
    return (
        <details className="rounded-2xl border border-slate-100 px-4 py-3">
            <summary className="flex items-center justify-between text-sm font-semibold">
                <span>{title}</span>
                <span className="text-xs text-slate-500">{statusLabel(fard)}</span>
            </summary>
            <div className="mt-3 space-y-3">
                {renderPrayerRow('Fard', fard, onFardChange)}
                {sunnah.length ? (
                    <div className="grid gap-2 rounded-2xl border border-slate-100 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Sunnah</p>
                        {sunnah.map((item) => (
                            <label key={item.label} className="flex items-center justify-between">
                                {item.label}
                                <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={(event) => item.onChange(event.target.checked)}
                                />
                            </label>
                        ))}
                    </div>
                ) : null}
                {dhikr.length ? (
                    <div className="grid gap-2 rounded-2xl border border-slate-100 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dhikr</p>
                        {dhikr.map((item) => (
                            <label key={item.label} className="flex items-center justify-between">
                                {item.label}
                                <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={(event) => item.onChange(event.target.checked)}
                                />
                            </label>
                        ))}
                    </div>
                ) : null}
            </div>
        </details>
    );
}

function statusLabel(status: FardStatus) {
    switch (status) {
        case 'on_time':
            return 'Pünktlich';
        case 'late':
            return 'Verspätet';
        case 'qada':
            return 'Nachgeholt';
        case 'missed':
            return 'Ausgelassen';
        default:
            return 'Nicht gesetzt';
    }
}

function normalizeTaraweehValue(value: number) {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value > 20) return 20;
    if (value % 2 !== 0) return value + 1;
    return value;
}

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isValidDateString(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(dateString: string, days: number) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return formatLocalDate(date);
}

function parseTimeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return hours * 60 + minutes;
}

function formatMinutes(minutes: number) {
    const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = String(Math.floor(total / 60)).padStart(2, '0');
    const m = String(total % 60).padStart(2, '0');
    return `${h}:${m}`;
}

function computeNightInfo(maghrib: string, fajrNext: string) {
    const maghribMinutes = parseTimeToMinutes(maghrib);
    const fajrMinutesBase = parseTimeToMinutes(fajrNext);
    if (maghribMinutes === null || fajrMinutesBase === null) return null;

    let fajrMinutes = fajrMinutesBase;
    if (fajrMinutes <= maghribMinutes) {
        fajrMinutes += 24 * 60;
    }

    const duration = fajrMinutes - maghribMinutes;
    if (duration <= 0) return null;

    const midnight = maghribMinutes + duration / 2;
    const lastThirdStart = fajrMinutes - duration / 3;
    const durationHours = Math.floor(duration / 60);
    const durationMinutes = duration % 60;

    return {
        fajr: formatMinutes(fajrMinutes),
        midnight: formatMinutes(Math.round(midnight)),
        lastThirdStart: formatMinutes(Math.round(lastThirdStart)),
        durationLabel: `${durationHours}h ${String(durationMinutes).padStart(2, '0')}m`,
    };
}

function computeFastingDuration(fajr: string, maghrib: string) {
    const fajrMinutes = parseTimeToMinutes(fajr);
    const maghribMinutesBase = parseTimeToMinutes(maghrib);
    if (fajrMinutes === null || maghribMinutesBase === null) return null;

    let maghribMinutes = maghribMinutesBase;
    if (maghribMinutes <= fajrMinutes) {
        maghribMinutes += 24 * 60;
    }
    const duration = maghribMinutes - fajrMinutes;
    if (duration <= 0) return null;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function computeOddNightInfo(entryDate: string, maghrib: string, ramadanStart: string) {
    if (!maghrib || !isValidDateString(entryDate)) return null;
    const dayNumber = dayDiff(ramadanStart, entryDate) + 1;
    if (dayNumber < 1 || dayNumber > 30) return null;
    const nightNumber = dayNumber + 1;
    const isOddNight = nightNumber >= 21 && nightNumber <= 30 && nightNumber % 2 === 1;
    const startsAt = `Heute ab ${maghrib} beginnt der islamische Tag.`;
    const oddText = isOddNight
        ? `Das ist die ${nightNumber}. Nacht (ungerade).`
        : `Das ist die ${nightNumber}. Nacht.`;
    if (nightNumber >= 21 && nightNumber <= 30) {
        return `${startsAt} ${oddText}`;
    }
    return startsAt;
}

function dayDiff(start: string, end: string) {
    const a = new Date(`${start}T00:00:00`);
    const b = new Date(`${end}T00:00:00`);
    const diff = b.getTime() - a.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function computeRamadanNightLabel(entryDate: string, ramadanStart: string) {
    if (!isValidDateString(entryDate)) return null;
    const dayNumber = dayDiff(ramadanStart, entryDate) + 1;
    if (dayNumber < 1 || dayNumber > 30) return null;
    if (dayNumber === 1) return '1. Ramadan';
    if (dayNumber === 30) return '30. Ramadan';
    return `${dayNumber - 1}. / ${dayNumber}. Ramadan`;
}

function computeFastingDayLabel(entryDate: string, ramadanStart: string) {
    if (!isValidDateString(entryDate)) return null;
    const fastingStart = addDays(ramadanStart, 1);
    const fastingDay = dayDiff(fastingStart, entryDate) + 1;
    if (fastingDay < 1 || fastingDay > 30) {
        if (entryDate === ramadanStart) {
            return 'Heute beginnt Ramadan (ab Maghrib). Fasten startet morgen.';
        }
        return null;
    }
    return `Fasten‑Tag ${fastingDay}`;
}

function isFastingAllowed(entryDate: string, ramadanStart: string) {
    if (!isValidDateString(entryDate)) return true;
    return entryDate >= addDays(ramadanStart, 1);
}
const SURAH_OPTIONS = [
    { number: 1, name: 'Al-Fatihah' },
    { number: 2, name: 'Al-Baqarah' },
    { number: 3, name: "Ali 'Imran" },
    { number: 4, name: 'An-Nisa' },
    { number: 5, name: "Al-Ma'idah" },
    { number: 6, name: "Al-An'am" },
    { number: 7, name: "Al-A'raf" },
    { number: 8, name: 'Al-Anfal' },
    { number: 9, name: 'At-Tawbah' },
    { number: 10, name: 'Yunus' },
    { number: 11, name: 'Hud' },
    { number: 12, name: 'Yusuf' },
    { number: 13, name: "Ar-Ra'd" },
    { number: 14, name: 'Ibrahim' },
    { number: 15, name: 'Al-Hijr' },
    { number: 16, name: 'An-Nahl' },
    { number: 17, name: 'Al-Isra' },
    { number: 18, name: 'Al-Kahf' },
    { number: 19, name: 'Maryam' },
    { number: 20, name: 'Ta-Ha' },
    { number: 21, name: 'Al-Anbiya' },
    { number: 22, name: 'Al-Hajj' },
    { number: 23, name: "Al-Mu'minun" },
    { number: 24, name: 'An-Nur' },
    { number: 25, name: 'Al-Furqan' },
    { number: 26, name: "Ash-Shu'ara" },
    { number: 27, name: 'An-Naml' },
    { number: 28, name: 'Al-Qasas' },
    { number: 29, name: 'Al-Ankabut' },
    { number: 30, name: 'Ar-Rum' },
    { number: 31, name: 'Luqman' },
    { number: 32, name: 'As-Sajdah' },
    { number: 33, name: 'Al-Ahzab' },
    { number: 34, name: 'Saba' },
    { number: 35, name: 'Fatir' },
    { number: 36, name: 'Ya-Sin' },
    { number: 37, name: 'As-Saffat' },
    { number: 38, name: 'Sad' },
    { number: 39, name: 'Az-Zumar' },
    { number: 40, name: 'Ghafir' },
    { number: 41, name: 'Fussilat' },
    { number: 42, name: 'Ash-Shura' },
    { number: 43, name: 'Az-Zukhruf' },
    { number: 44, name: 'Ad-Dukhan' },
    { number: 45, name: 'Al-Jathiyah' },
    { number: 46, name: 'Al-Ahqaf' },
    { number: 47, name: 'Muhammad' },
    { number: 48, name: 'Al-Fath' },
    { number: 49, name: 'Al-Hujurat' },
    { number: 50, name: 'Qaf' },
    { number: 51, name: 'Adh-Dhariyat' },
    { number: 52, name: 'At-Tur' },
    { number: 53, name: 'An-Najm' },
    { number: 54, name: 'Al-Qamar' },
    { number: 55, name: 'Ar-Rahman' },
    { number: 56, name: "Al-Waqi'ah" },
    { number: 57, name: 'Al-Hadid' },
    { number: 58, name: 'Al-Mujadila' },
    { number: 59, name: 'Al-Hashr' },
    { number: 60, name: 'Al-Mumtahanah' },
    { number: 61, name: 'As-Saff' },
    { number: 62, name: "Al-Jumu'ah" },
    { number: 63, name: 'Al-Munafiqun' },
    { number: 64, name: 'At-Taghabun' },
    { number: 65, name: 'At-Talaq' },
    { number: 66, name: 'At-Tahrim' },
    { number: 67, name: 'Al-Mulk' },
    { number: 68, name: 'Al-Qalam' },
    { number: 69, name: 'Al-Haqqah' },
    { number: 70, name: "Al-Ma'arij" },
    { number: 71, name: 'Nuh' },
    { number: 72, name: 'Al-Jinn' },
    { number: 73, name: 'Al-Muzzammil' },
    { number: 74, name: 'Al-Muddaththir' },
    { number: 75, name: 'Al-Qiyamah' },
    { number: 76, name: 'Al-Insan' },
    { number: 77, name: 'Al-Mursalat' },
    { number: 78, name: 'An-Naba' },
    { number: 79, name: "An-Nazi'at" },
    { number: 80, name: 'Abasa' },
    { number: 81, name: 'At-Takwir' },
    { number: 82, name: 'Al-Infitar' },
    { number: 83, name: 'Al-Mutaffifin' },
    { number: 84, name: 'Al-Inshiqaq' },
    { number: 85, name: 'Al-Buruj' },
    { number: 86, name: 'At-Tariq' },
    { number: 87, name: "Al-A'la" },
    { number: 88, name: 'Al-Ghashiyah' },
    { number: 89, name: 'Al-Fajr' },
    { number: 90, name: 'Al-Balad' },
    { number: 91, name: 'Ash-Shams' },
    { number: 92, name: 'Al-Layl' },
    { number: 93, name: 'Ad-Duha' },
    { number: 94, name: 'Ash-Sharh' },
    { number: 95, name: 'At-Tin' },
    { number: 96, name: "Al-'Alaq" },
    { number: 97, name: 'Al-Qadr' },
    { number: 98, name: 'Al-Bayyinah' },
    { number: 99, name: 'Az-Zalzalah' },
    { number: 100, name: "Al-'Adiyat" },
    { number: 101, name: "Al-Qari'ah" },
    { number: 102, name: 'At-Takathur' },
    { number: 103, name: "Al-'Asr" },
    { number: 104, name: 'Al-Humazah' },
    { number: 105, name: 'Al-Fil' },
    { number: 106, name: 'Quraysh' },
    { number: 107, name: "Al-Ma'un" },
    { number: 108, name: 'Al-Kawthar' },
    { number: 109, name: 'Al-Kafirun' },
    { number: 110, name: 'An-Nasr' },
    { number: 111, name: 'Al-Masad' },
    { number: 112, name: 'Al-Ikhlas' },
    { number: 113, name: 'Al-Falaq' },
    { number: 114, name: 'An-Nas' },
];

const SURAH_VERSE_COUNTS = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78,
    118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38,
    29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20,
    56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

function getSurahAyahCount(surah: number) {
    return SURAH_VERSE_COUNTS[surah - 1] ?? 0;
}
