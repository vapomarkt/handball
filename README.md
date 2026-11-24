# Anwurf – Handball-Plattform (M1–M5)

Mobile-First Webapp & PWA für Handballvereine, Trainer, Spieler und Eltern (Next.js 16 App Router, TypeScript, Tailwind CSS, Prisma 7, PostgreSQL, Better Auth, Zod, Vitest & Playwright).

## 1-Klick-Deployment (Vercel + Neon PostgreSQL)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvapomarkt%2Fhandball&env=BETTER_AUTH_SECRET,SEED_DEMO_ON_DEPLOY&envDescription=BETTER_AUTH_SECRET%20(min.%2032%20Zeichen)%20und%20optional%20SEED_DEMO_ON_DEPLOY%3Dtrue%20f%C3%BCr%20Demo-Daten&project-name=anwurf-handball&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D)

### Kurzanleitung (ca. 2 Minuten)
1. Auf den **Deploy with Vercel**-Button klicken (oder das Repo `vapomarkt/handball` in Vercel importieren).
2. Unter **Storage / Integration** eine **Neon PostgreSQL**-Datenbank hinzufügen (setzt `DATABASE_URL` automatisch).
3. Zwei Environment-Variablen eintragen:
   - `BETTER_AUTH_SECRET`: beliebiger geheimer String (mind. 32 Zeichen)
   - `SEED_DEMO_ON_DEPLOY`: `true` *(optional – legt beim ersten Deploy automatisch die Demo-Daten für TSV Musterstadt an; danach kannst du sie wieder entfernen oder auf `false` setzen, der Seed ist idempotent)*
4. **Deploy** klicken – `npm run vercel-build` führt automatisch `prisma generate`, `prisma migrate deploy`, optional `db:seed` und `next build` aus.

### Demo-Zugänge (Passwort: `Anwurf2026!`)
- **Trainer (`COACH`)**: `trainer@tsv-musterstadt.de`
- **Vereins-Admin (`CLUB_ADMIN`)**: `admin@tsv-musterstadt.de`
- **Spieler (`PLAYER`)**: `spieler@tsv-musterstadt.de`
- **Elternteil (`PARENT`)**: `eltern@tsv-musterstadt.de`

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
