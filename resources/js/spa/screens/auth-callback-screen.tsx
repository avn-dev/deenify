import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../lib/auth-store';

export function AuthCallbackScreen() {
    const navigate = useNavigate();
    const hydrate = useAuthStore((state) => state.hydrate);

    useEffect(() => {
        const timer = setTimeout(() => {
            hydrate()
                .catch(() => null)
                .finally(() => {
                    navigate('/vault/unlock', { replace: true });
                });
        }, 400);

        return () => clearTimeout(timer);
    }, [hydrate, navigate]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#ecfdf5,_#ffffff)] dark:bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)]">
            <div className="rounded-3xl border border-emerald-100 bg-white/90 p-6 text-center dark:border-emerald-800/60 dark:bg-slate-900/80">
                <p className="text-sm font-semibold text-emerald-800">Anmeldung wird abgeschlossen…</p>
                <p className="mt-2 text-xs text-slate-500">Dein Konto wird sicher synchronisiert.</p>
            </div>
        </div>
    );
}
