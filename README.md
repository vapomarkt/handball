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

## Self-Hosting / Produktion (Hetzner + Docker + `nginx-proxy`)

1. Auf dem Server klonen und `.env` anlegen:
   ```bash
   git clone https://github.com/vapomarkt/handball.git throwoff
   cd throwoff
   cp .env.prod.example .env
   # .env ausfüllen (POSTGRES_PASSWORD, BETTER_AUTH_SECRET, PROXY_NETWORK)
   # Hinweis: Den exakten Netzwerknamen deines nginx-proxy findest du mit: docker network ls
   ```
2. Bauen und starten (inkl. PostgreSQL 16, automatischer Prisma-Migration & `pg-boss`-Worker):
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. Optional Demo-Daten (TSV Musterstadt) einmalig einspielen:
   ```bash
   docker compose -f docker-compose.prod.yml run --rm migrate npm run db:seed
   ```
4. Healthcheck prüfen:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl -i https://throwoff.app/api/health
   ```
5. Updates deployen:
   ```bash
   git pull && docker compose -f docker-compose.prod.yml up -d --build
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
