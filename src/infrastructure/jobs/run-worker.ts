import "dotenv/config";
import { startPgBossWorker } from "./pg-boss-worker";

async function main() {
  console.log("[Anwurf Worker] Starte pg-boss Liga-Auto-Sync Worker...");
  const boss = await startPgBossWorker();
  console.log("[Anwurf Worker] Bereit. Stündlicher Liga-Sync aktiv.");

  const shutdown = async () => {
    console.log("[Anwurf Worker] Beende Worker sauber...");
    await boss.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Anwurf Worker] Start fehlgeschlagen:", err);
  process.exit(1);
});
