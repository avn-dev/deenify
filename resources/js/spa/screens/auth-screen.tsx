import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/auth-store';
import type { ApiError } from '../lib/api';
import { useProfileStore } from '../lib/profile-store';
import { Mars, Venus } from 'lucide-react';

export function AuthScreen() {
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const register = useAuthStore((state) => state.register);
    const status = useAuthStore((state) => state.status);
    const authError = useAuthStore((state) => state.error);
    const setPendingProfile = useProfileStore((state) => state.setPendingProfile);
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const isLoading = status === 'loading';

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFieldErrors(null);
        setLocalError(null);
        try {
            const normalized = username.trim().toLowerCase();
            if (mode === 'login') {
                await login(normalized, password);
            } else {
                if (!gender) {
                    setLocalError('Bitte wähle dein Geschlecht aus.');
                    return;
                }
                await register({ username: normalized, password, password_confirmation: passwordConfirmation });
                setPendingProfile({ gender });
            }
            navigate('/vault/unlock');
        } catch (error) {
            const apiError = error as ApiError;
            setFieldErrors(apiError.errors ?? null);
        }
    }

    function handleSocial(provider: 'google' | 'apple') {
        window.location.href = `/api/auth/${provider}/redirect`;
    }

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5,_#ffffff)] px-5 py-10 text-slate-900 dark:bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] dark:text-slate-100">
            <div className="mx-auto flex max-w-md flex-col gap-8">
                <header className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-700">Deenify</p>
                    <h1 className="text-3xl font-semibold">
                        {mode === 'login' ? 'Willkommen zurück' : 'Konto erstellen'}
                    </h1>
                    <p className="text-sm text-slate-600">
                        {mode === 'login'
                            ? 'Melde dich an, um dein verschlüsseltes Ramadan‑Tagebuch zu öffnen.'
                            : 'Erstelle ein Konto, um dein verschlüsseltes Ramadan‑Tagebuch zu sichern.'}{' '}
                        Dein Master‑Passwort verlässt dieses Gerät nie.
                    </p>
                </header>

                <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm dark:border-emerald-800/60 dark:bg-slate-900/80">
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <label className="block text-sm font-medium">
                            Benutzername
                            <input
                                type="text"
                                autoComplete="username"
                                value={username}
                                onChange={(event) => setUsername(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                placeholder="deinname"
                            />
                            {fieldErrors?.username?.length ? (
                                <p className="mt-2 text-xs text-red-600">{fieldErrors.username[0]}</p>
                            ) : null}
                        </label>
                        {mode === 'register' ? (
                            <div className="space-y-3">
                                <p className="text-sm font-medium">Geschlecht</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: 'male', label: 'Männlich', icon: Mars },
                                        { value: 'female', label: 'Weiblich', icon: Venus },
                                    ].map(({ value, label, icon: Icon }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setGender(value as 'male' | 'female')}
                                            aria-pressed={gender === value}
                                            className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm ${
                                                gender === value
                                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                                                    : 'border-slate-200 text-slate-600'
                                            }`}
                                        >
                                            <Icon className="h-5 w-5" />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        <label className="block text-sm font-medium">
                            Passwort
                            <input
                                type="password"
                                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                placeholder="••••••••"
                            />
                            {fieldErrors?.password?.length ? (
                                <p className="mt-2 text-xs text-red-600">{fieldErrors.password[0]}</p>
                            ) : null}
                        </label>
                        {mode === 'register' ? (
                            <label className="block text-sm font-medium">
                                Passwort bestätigen
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    value={passwordConfirmation}
                                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    placeholder="••••••••"
                                />
                            </label>
                        ) : null}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                            {mode === 'login' ? 'Anmelden' : 'Registrieren'}
                        </button>
                        {authError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                                {authError}
                            </div>
                        ) : null}
                        {localError ? (
                            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
                                {localError}
                            </div>
                        ) : null}
                        <div className="text-center text-xs text-slate-500">
                            {mode === 'login' ? 'Noch kein Konto?' : 'Schon registriert?'}{' '}
                            <Link
                                className="text-emerald-700"
                                to="#"
                                onClick={(event) => {
                                    event.preventDefault();
                                    setFieldErrors(null);
                                    setPassword('');
                                    setPasswordConfirmation('');
                                    setMode(mode === 'login' ? 'register' : 'login');
                                }}
                            >
                                {mode === 'login' ? 'Jetzt registrieren' : 'Zum Login'}
                            </Link>
                        </div>
                    </form>
                </div>

                <footer className="text-xs text-slate-500">
                    Deenify speichert dein Tagebuch verschlüsselt. Wir können deine Einträge nie lesen.
                </footer>
            </div>
        </div>
    );
}
