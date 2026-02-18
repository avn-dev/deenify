import { ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Home, Settings, Sparkles } from 'lucide-react';
import { useAuthStore } from '../lib/auth-store';
import { useProfileStore } from '../lib/profile-store';
import { useVaultStore } from '../lib/vault-store';

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
};

const navItems = [
    { to: '/today', label: 'Heute', icon: Home },
    { to: '/calendar', label: 'Kalender', icon: Calendar },
    { to: '/insights', label: 'Statistiken', icon: Sparkles },
    { to: '/settings', label: 'Einstellungen', icon: Settings },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
    const navigate = useNavigate();
    const user = useAuthStore((state) => state.user);
    const status = useAuthStore((state) => state.status);
    const vaultStatus = useVaultStore((state) => state.status);
    const loadProfileFromUser = useProfileStore((state) => state.loadFromUser);
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPwaHint, setShowPwaHint] = useState(false);

    const isStandalone = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    }, []);

    const isIos = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    }, []);

    useEffect(() => {
        if (status === 'ready' && !user) {
            navigate('/auth', { replace: true });
        }
    }, [navigate, status, user]);

    useEffect(() => {
        if (!user || vaultStatus !== 'unlocked') {
            return;
        }
        loadProfileFromUser(user).catch(() => null);
    }, [loadProfileFromUser, user, vaultStatus]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (isStandalone) return;
        if (localStorage.getItem('deenify_pwa_hint_dismissed') === '1') return;

        const handler = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
            setShowPwaHint(true);
        };

        window.addEventListener('beforeinstallprompt', handler as EventListener);
        if (isIos) {
            setShowPwaHint(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler as EventListener);
        };
    }, [isIos, isStandalone]);

    async function handleInstallClick() {
        if (!installPrompt) return;
        await installPrompt.prompt();
        setInstallPrompt(null);
    }

    function handleDismissHint() {
        localStorage.setItem('deenify_pwa_hint_dismissed', '1');
        setShowPwaHint(false);
    }

    useEffect(() => {
        if (!('visualViewport' in window)) {
            return;
        }

        const viewport = window.visualViewport;
        if (!viewport) {
            return;
        }

        const baseHeight = viewport.height;
        const update = () => {
            const keyboardOpen = viewport.height < baseHeight - 120;
            document.body.classList.toggle('keyboard-open', keyboardOpen);
        };

        update();
        viewport.addEventListener('resize', update);
        return () => {
            viewport.removeEventListener('resize', update);
            document.body.classList.remove('keyboard-open');
        };
    }, []);

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f1f5f9,_#ffffff)] text-slate-900 dark:bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] dark:text-slate-100">
            <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/80">
                <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">Deenify</p>
                        <h1 className="text-xl font-semibold">{title}</h1>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-200">
                        {user?.username?.slice(0, 2).toUpperCase() ?? 'DU'}
                    </div>
                </div>
            </header>
            <main className="mx-auto w-full max-w-md px-5 pb-28 pt-6 animate-[fadein_500ms_ease-out]">
                {showPwaHint ? (
                    <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-800">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                                <p className="text-sm font-semibold text-emerald-800">Als App nutzen</p>
                                {isIos ? (
                                    <p>
                                        Tippe unten auf <span className="font-semibold">Teilen</span> und wähle
                                        <span className="font-semibold"> „Zum Home‑Bildschirm“</span>, um Deenify wie eine
                                        App zu öffnen.
                                    </p>
                                ) : (
                                    <p>Installiere Deenify als PWA für schnelleren Zugriff und Offline‑Modus.</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleDismissHint}
                                className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] text-emerald-700"
                            >
                                Später
                            </button>
                        </div>
                        {!isIos && installPrompt ? (
                            <button
                                type="button"
                                onClick={handleInstallClick}
                                className="mt-3 w-full rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
                            >
                                Jetzt installieren
                            </button>
                        ) : null}
                    </div>
                ) : null}
                {children}
            </main>
            <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 border-t border-slate-200/60 bg-white/90 backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/90">
                <div className="mx-auto flex max-w-md items-center justify-between px-6 py-3">
                    {navItems.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex min-h-[48px] min-w-[48px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-xs transition ${
                                    isActive
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
                                        : 'text-slate-500 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-slate-800/60'
                                }`
                            }
                        >
                            <Icon className="h-5 w-5" />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                </div>
            </nav>
        </div>
    );
}
