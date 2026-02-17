import { ReactNode, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Home, Settings, Sparkles } from 'lucide-react';
import { useAuthStore } from '../lib/auth-store';

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

    useEffect(() => {
        if (status === 'ready' && !user) {
            navigate('/auth', { replace: true });
        }
    }, [navigate, status, user]);

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
