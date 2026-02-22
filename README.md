# Deenify – Ramadan Diary (PWA)

Deenify ist eine Mobile‑First Web‑App für verschlüsselte Ramadan‑Einträge. Die Diary‑Inhalte werden **clientseitig** per E2EE verschlüsselt – der Server sieht niemals Klartext.

## Open‑Source & Sicherheit
Dieses Repo enthält **keine Secrets**. Produktions‑Werte (DB‑Passwörter, `APP_KEY`, OAuth‑Keys) müssen über `.env` oder CI‑Secrets gesetzt werden.

## Setup (lokal)

### Voraussetzungen
- PHP 8.2+
- Composer
- Node.js 18+
- SQLite (Default)

### Installation
```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate
```

### Dev‑Server
```bash
php artisan serve
npm run dev
```

Die SPA läuft unter `http://localhost:8000` (Laravel liefert das SPA‑Shell aus). Vite nutzt `http://localhost:5173`.

## Wichtige Umgebungsvariablen
```env
APP_URL=http://localhost:8000
SANCTUM_STATEFUL_DOMAINS=localhost,localhost:5173,127.0.0.1,127.0.0.1:8000
FRONTEND_URLS=http://localhost:5173
FRONTEND_APP_URL=http://localhost:5173
VITE_API_BASE=http://localhost:8000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
APPLE_CLIENT_ID=
APPLE_CLIENT_SECRET=
APPLE_REDIRECT_URI=
```

## Production (Self‑Hosting)
Setze deine Secrets in einer `.env` (nicht committen) und starte dann:
```bash
docker compose -f docker-compose.prod.yml up -d
```
Wichtig:
- `APP_KEY` ist **erforderlich**
- `DB_PASSWORD`/`MYSQL_ROOT_PASSWORD` setzen
- `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS` passend zur Domain setzen

## Auth
- Login/Registrierung mit **Benutzername + Passwort**
- Social Login: Google, Apple
- Session‑Auth via Laravel Sanctum (cookie‑basiert, CSRF geschützt)

## Crypto‑Design (Kurzfassung)
- **Master‑Passwort verlässt nie den Client**
- Pro Nutzer: **DEK** (Data Encryption Key, 256‑bit)
- DEK wird mit **MK/KEK** (abgeleitet via KDF) mit AES‑GCM gewrappt
- KDF: **Argon2id (WASM)**, Fallback **PBKDF2**
- Einträge: **AES‑256‑GCM**, pro Record eigener IV
- Passwort‑Änderung: **nur re‑wrap des DEK** (keine Re‑Encrypt aller Einträge)

## Wichtiger Hinweis zur Wiederherstellung
Ohne Master‑Passwort können Einträge **nicht** wiederhergestellt werden. Es gibt aktuell **keinen** Passwort‑Reset für verschlüsselte Daten.

## Offline / PWA
- Manifest + Service Worker aktiv
- App‑Shell wird gecached (Basis‑Offline‑Support)

## Tests
### Backend (Pest)
```bash
php artisan test
```

### Frontend (Vitest)
```bash
npm test
```

## Projektstruktur (Auszug)
- `app/Http/Controllers/Api/*` – API Controller
- `resources/js/spa/*` – React SPA
- `resources/js/spa/lib/crypto.ts` – Krypto‑Helper
- `resources/js/spa/lib/vault-store.ts` – Vault/Keyring im Speicher
- `resources/js/spa/lib/preferences-store.ts` – Verschlüsselte Preferences
- `public/manifest.webmanifest` + `public/sw.js` – PWA

## Sicherheit & Datenschutz
- Server speichert nur Ciphertext + Metadaten
- Keine Klartext‑Notizen oder Klartext‑Profilfelder auf dem Server
- Session‑Auth via Sanctum (CSRF/Origin geschützt)

---

Für Fragen oder Änderungen an der Crypto‑Schicht bitte zuerst im `resources/js/spa/lib/crypto.ts` und `resources/js/spa/lib/vault-store.ts` nachsehen.
