import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { importHvnbLive } from "../src/infrastructure/leagues/hvnb-live-importer";

async function runCli() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("Keine Datenbank-URL gefunden (DATABASE_URL).");
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const result = await importHvnbLive(prisma);
    console.log(
      `HVNB-Live-Import: ${result.groups} Staffeln, ${result.teams} Mannschaften, ` +
        `${result.deactivatedGroups} Staffeln und ${result.deactivatedTeams} Mannschaften deaktiviert, ` +
        `${result.failures.length} Fehler.`
    );
    for (const failure of result.failures.slice(0, 10)) {
      console.log(`  Fehler: ${failure.url} – ${failure.reason}`);
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("import-hvnb-live.ts") ||
    process.argv[1].endsWith("import-hvnb-live.js"));

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error("Fehler beim HVNB-Live-Import:", err);
    process.exit(1);
  });
}
