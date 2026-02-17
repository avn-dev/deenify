<!DOCTYPE html>
<html lang="de">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
        <title>Deenify – Ramadan Tagebuch</title>
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="shortcut icon" href="/favicon.ico">
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">
        <link rel="manifest" href="/manifest.webmanifest">
        <meta name="theme-color" content="#10b981">
        @vite(['resources/css/app.css'])
    </head>
    <body class="min-h-screen bg-[radial-gradient(circle_at_top,_#ecfdf5,_#ffffff)] text-slate-900">
        <main class="mx-auto w-full max-w-5xl px-6 py-12 md:py-16">
            <header class="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
                <div class="flex items-center gap-4">
                    <img
                        src="/android-chrome-192x192.png"
                        alt="Deenify Logo"
                        class="h-12 w-12 rounded-2xl border border-emerald-100 bg-white p-1 shadow-sm"
                    >
                    <div>
                        <p class="text-xs uppercase tracking-[0.3em] text-emerald-700">Deenify</p>
                        <h1 class="text-2xl font-semibold">Dein Ramadan Tagebuch</h1>
                    </div>
                </div>
                <div class="flex flex-wrap gap-3">
                    <a
                        href="/today"
                        class="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white"
                    >
                        App öffnen
                    </a>
                    <a
                        href="/auth"
                        class="rounded-full border border-emerald-200 bg-white px-5 py-2 text-sm font-semibold text-emerald-700"
                    >
                        Konto erstellen
                    </a>
                </div>
            </header>

            <section class="mt-12 grid gap-8 md:grid-cols-2">
                <div class="rounded-3xl border border-emerald-100 bg-white/80 p-6 shadow-sm">
                    <h2 class="text-xl font-semibold">Ruhig. Klar. Privatsphärisch.</h2>
                    <p class="mt-3 text-sm text-slate-600">
                        Deenify hilft dir, deine Ramadan Tage zu reflektieren und wichtige Gewohnheiten zu verfolgen
                        – ohne dass jemand deine Einträge lesen kann.
                    </p>
                    <div class="mt-5 space-y-3 text-sm text-slate-700">
                        <div class="flex items-start gap-3">
                            <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                            Ende zu Ende verschlüsselt. Nur du kannst deine Einträge lesen.
                        </div>
                        <div class="flex items-start gap-3">
                            <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                            Gebets und Qurʾān Tracking, Stimmungen, Ziele und Reflexion.
                        </div>
                        <div class="flex items-start gap-3">
                            <span class="mt-1 h-2 w-2 rounded-full bg-emerald-500"></span>
                            Funktioniert als PWA offline für Lesen und Entwürfe.
                        </div>
                    </div>
                </div>

                <div class="rounded-3xl border border-emerald-100 bg-white/80 p-6 shadow-sm">
                    <h2 class="text-xl font-semibold">Was du tracken kannst</h2>
                    <div class="mt-4 grid gap-3 text-sm text-slate-700">
                        <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                            Fard Gebete pünktlich, verspätet, nachgeholt oder ausgelassen
                        </div>
                        <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                            Sunnah Gebete, Tarawih und Witr
                        </div>
                        <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                            Qurʾān Einheiten in Juz, Hizb, Rubʿ oder Suren
                        </div>
                        <div class="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                            Fasten, Suhūr, Iftār, Dhikr und Sadaqah
                        </div>
                    </div>
                </div>
            </section>

            <section class="mt-10 grid gap-6 md:grid-cols-3">
                <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 class="text-sm font-semibold text-emerald-700">Schnell entsperren</h3>
                    <p class="mt-2 text-sm text-slate-600">
                        Optional mit Geräte Entsperrung, ohne dein Master Passwort zu verlieren.
                    </p>
                </div>
                <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 class="text-sm font-semibold text-emerald-700">Kalender & Streaks</h3>
                    <p class="mt-2 text-sm text-slate-600">
                        Überblick über deinen Monat, Streaks und Highlights.
                    </p>
                </div>
                <div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 class="text-sm font-semibold text-emerald-700">Offline bereit</h3>
                    <p class="mt-2 text-sm text-slate-600">
                        Lesen und Entwürfe auch ohne Internetverbindung.
                    </p>
                </div>
            </section>

            <section class="mt-12 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6">
                <h2 class="text-lg font-semibold text-emerald-700">Deine Daten bleiben deine Daten</h2>
                <p class="mt-2 text-sm text-emerald-800">
                    Deenify speichert nur verschlüsselte Inhalte. Ohne Master Passwort kann niemand deine Einträge
                    lesen – auch wir nicht.
                </p>
            </section>

            <section class="mt-10 flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 class="text-base font-semibold">Bereit für deinen Ramadan?</h3>
                    <p class="mt-1 text-sm text-slate-600">Starte dein Tagebuch und entsperre es mit deinem Master Passwort.</p>
                </div>
                <div class="flex gap-3">
                    <a
                        href="/today"
                        class="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white"
                    >
                        Jetzt starten
                    </a>
                    <a
                        href="mailto:feedback@deenify.de"
                        class="rounded-full border border-emerald-200 bg-white px-5 py-2 text-sm font-semibold text-emerald-700"
                    >
                        Feedback senden
                    </a>
                </div>
            </section>

            <footer class="mt-12 text-xs text-slate-500">
                © Deenify. Mobile First Ramadan Diary mit maximalem Datenschutz.
            </footer>
        </main>
    </body>
</html>
