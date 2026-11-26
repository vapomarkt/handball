# ThrowOff – Handball-Plattform (M1–M5)

Mobile-First Webapp & PWA für Handballvereine, Trainer, Spieler und Eltern (Next.js 16 App Router, TypeScript, Tailwind CSS, Prisma 7, PostgreSQL, Better Auth, Zod, Vitest & Playwright).

- **Produktion:** [https://throwoff.app](https://throwoff.app)
- **Kontakt:** `hello@throwoff.app`

## 1-Klick-Deployment (Vercel + Neon PostgreSQL)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvapomarkt%2Fhandball&env=BETTER_AUTH_SECRET,BETTER_AUTH_URL,NEXT_PUBLIC_APP_URL,SEED_DEMO_ON_DEPLOY&envDescription=BETTER_AUTH_SECRET%20(min.%2032%20Zeichen),%20BETTER_AUTH_URL%20%26%20NEXT_PUBLIC_APP_URL%20(z.%20B.%20https%3A%2F%2Fthrowoff.app)%20und%20optional%20SEED_DEMO_ON_DEPLOY%3Dtrue&project-name=throwoff&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

### Kurzanleitung (ca. 2 Minuten)
1. Auf den **Deploy with Vercel**-Button klicken (oder das Repo `vapomarkt/handball` in Vercel importieren).
2. Unter **Storage / Integration** eine **Neon PostgreSQL**-Datenbank hinzufügen (setzt `DATABASE_URL` automatisch).
3. Environment-Variablen eintragen:
   - `BETTER_AUTH_SECRET`: beliebiger geheimer String (mind. 32 Zeichen)
   - `BETTER_AUTH_URL`: `https://throwoff.app`
   - `NEXT_PUBLIC_APP_URL`: `https://throwoff.app`
   - `SEED_DEMO_ON_DEPLOY`: `true` *(optional – legt beim ersten Deploy automatisch die Demo-Daten für die männliche D-Jugend des TuS Jahn Hollenstedt inkl. Vereinslogo & nuLiga-Spielplan an; danach kannst du sie wieder entfernen oder auf `false` setzen, der Seed ist idempotent)*
4. **Deploy** klicken – `npm run vercel-build` führt automatisch `prisma generate`, `prisma migrate deploy`, optional `db:seed` und `next build` aus.

### Demo-Zugänge – TuS Jahn Hollenstedt · männliche D-Jugend (Passwort: `ThrowOff2026!`)
- **Trainer (`COACH`) – Hans-Peter Lehmann**: `trainer@tus-jahn-hollenstedt.de`
- **Vereins-Admin (`CLUB_ADMIN`) – Kay Kröpfl**: `admin@tus-jahn-hollenstedt.de`
- **Spieler (`PLAYER`) – Jarle Hofmann (#9)**: `spieler@tus-jahn-hollenstedt.de`
- **Elternteil (`PARENT`) – Familie Hofmann (Jarle #9)**: `eltern@tus-jahn-hollenstedt.de`

---

## Self-Hosting / Produktion (Hetzner + Docker + nginx)

Betrieb wie VapoMarkt: Images werden auf dem Server aus dem exakten Commit gebaut, die App lauscht nur auf `127.0.0.1:3003`, TLS macht das Host-nginx.

1. Env-Datei anlegen (nicht in Git):
   ```bash
   sudo mkdir -p /srv/throwoff/shared/env
   sudo install -m 600 -o vmadmin -g vmadmin .env.prod.example /srv/throwoff/shared/env/.env.prod
   # POSTGRES_PASSWORD (openssl rand -hex 24) und BETTER_AUTH_SECRET (openssl rand -hex 32) eintragen
   ```
2. Deployen (baut `throwoff-app:<sha>` / `throwoff-worker:<sha>`, migriert, startet neu, prüft `/api/health`):
   ```bash
   git pull
   /srv/throwoff/deploy/update-app "$(git rev-parse HEAD)"
   ```
3. Optional Demo-Daten einmalig einspielen:
   ```bash
   IMAGE_TAG="$(git rev-parse HEAD)" docker compose --env-file /srv/throwoff/shared/env/.env.prod \
     -f docker-compose.prod.yml run --rm migrate npm run db:seed
   ```
4. Healthcheck prüfen:
   ```bash
   curl -i https://throwoff.app/api/health
   ```

---

## Lokale Entwicklung

```bash
cp .env.example .env
docker compose up -d
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

## Qualitäts-Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

---

## Mobile Apps (iOS & Android, Expo)

Monorepo mit npm-Workspaces – die Web-App bleibt unverändert im Root:

| Pfad | Inhalt |
| --- | --- |
| `/` (`src/`, `prisma/`) | Next.js Web-App, REST-API `/api/v1/*`, pg-boss-Worker |
| `packages/shared` | `@throwoff/shared`: typisierter API-Client, Push-Schemas, Re-Export der Domain-Schemas aus `src/domain` |
| `apps/mobile` | Expo / React Native App (Expo Router, Better Auth, Offline-Cache, Push) |

```bash
cp apps/mobile/.env.example apps/mobile/.env   # EXPO_PUBLIC_API_URL setzen
npm install
npm run mobile:start        # QR-Code mit Expo Go scannen
npm run mobile:typecheck
```

> Lokales Backend vom Handy aus: `EXPO_PUBLIC_API_URL=http://<LAN-IP>:3000` (nicht `localhost`).

### Regeln für die parallele Entwicklung
- **Domain zuerst:** neue Schemas/DTOs in `src/domain/schemas/*` – Web *und* Mobile nutzen sie automatisch über `@throwoff/shared`.
- **API nur additiv ändern:** ausgelieferte App-Versionen bleiben im Umlauf. Felder ergänzen statt umbenennen/entfernen; Breaking Changes → neuer Endpoint bzw. `/api/v2`.
- **Push senden:** Job in die pg-boss-Queue `push-notifications` legen (`{ userIds, title, body, data: { kind, url: "throwoff://…" } }`). RSVP-Erinnerungen laufen täglich um 18:00 Uhr automatisch.

### Builds & Store-Releases (EAS)
Einmalig: Expo-Account, `cd apps/mobile && npx eas init` (setzt `extra.eas.projectId`, nötig für Push), GitHub-Secret `EXPO_TOKEN`, Apple Developer Program, Google Play Console + FCM-Credentials (`eas credentials`).

- GitHub Actions → **Mobile CI** → *Run workflow* (`preview`/`production`) startet `eas build`.
- Git-Tag `mobile-v*` → Production-Build + `eas submit` (TestFlight / Play Internal Testing).
