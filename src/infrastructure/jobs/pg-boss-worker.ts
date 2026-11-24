import { PgBoss } from "pg-boss";
import { services } from "../services/container";

export const LEAGUE_AUTO_SYNC_QUEUE = "league-auto-sync";

export async function startPgBossWorker(): Promise<PgBoss> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL ist für pg-boss nicht gesetzt.");
  }

  const boss = new PgBoss(connectionString);
  boss.on("error", (err) => {
    console.error("[pg-boss error]", err);
  });

  await boss.start();
  await boss.createQueue(LEAGUE_AUTO_SYNC_QUEUE);

  // Stündlicher Auto-Sync aller aktiven Liga-iCal-Quellen (kein Redis nötig)
  await boss.schedule(LEAGUE_AUTO_SYNC_QUEUE, "0 * * * *", {}, {
    tz: "Europe/Berlin",
  });

  await boss.work(LEAGUE_AUTO_SYNC_QUEUE, async () => {
    const result = await services.leagueSync.syncAllEnabledIcalSources();
    console.log(
      `[pg-boss] Liga-Auto-Sync abgeschlossen: ${result.sourcesProcessed} Quellen geprüft, ${result.errors.length} Fehler.`
    );
  });

  return boss;
}
