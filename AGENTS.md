<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI/UX & Design-Prinzipien

- Verbindliche Design- und UX-Leitlinien für Web, PWA und Mobile stehen in `docs/DESIGN_PRINCIPLES.md` (vor jeder UI-Änderung beachten).
- **Kern-Leitplanken:** Maximal **1 Primär-CTA** (`bg-primary`) pro Viewport, max. **2 Aktionen** im Page-Header (weitere ins `···`-Menü), max. **2–3 Badges** pro Listenkarte (nur abweichende/handlungsrelevante Zustände), max. **5 Mobile Bottom-Tabs**, ruhige Tabs (Segmented Control / Underline statt `bg-primary`-Buttons), Progressive Disclosure (Details & seltene Admin-Aktionen in Sheets/Dialoge/Einstellungen), strikte Rollen-Adaptivität (`PLAYER`/`PARENT` nicht mit Staff-Tools überladen) und keine `window.confirm()`-Aufrufe.

## Git-Workflow

- Nach jeder erfolgreich getesteten Änderung (Lint, Typecheck, Tests/Build) immer direkt ein sauberes `git commit` und `git push` durchführen.

## Hosting & Deployment

- Das Hosting läuft **nicht mehr bei Vercel**, sondern auf dem eigenen **Dedicated Server bei Hetzner** (Self-Hosted über Docker / `docker-compose.prod.yml`). Hinweise, Konfigurationen und Deploy-Abläufe entsprechend auf den Hetzner-Server ausrichten (inkl. `prisma migrate deploy` beim Deployment).
