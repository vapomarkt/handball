import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { DEFAULT_SEASON_CATALOG } from "../src/domain/data/default-seasons";

export interface ImportSeasonsResult {
  total: number;
  created: number;
}

/**
 * Synchronisiert die Standard-Handballsaisons idempotent in `season_catalog`.
 * Bestehende, im Hintergrund gepflegte Einträge werden nicht überschrieben.
 */
export async function importDefaultSeasons(
  prisma: PrismaClient
): Promise<ImportSeasonsResult> {
  let created = 0;

  for (const entry of DEFAULT_SEASON_CATALOG) {
    const existing = await prisma.seasonCatalog.findUnique({
      where: { name: entry.name },
      select: { id: true },
    });

    if (!existing) {
      await prisma.seasonCatalog.create({
        data: {
          id: entry.id,
          name: entry.name,
          startDate: new Date(entry.startDate),
          endDate: new Date(entry.endDate),
          sortOrder: entry.sortOrder,
          isDefault: entry.isDefault,
          isActive: entry.isActive,
        },
      });
      created += 1;
    }
  }

  return {
    total: DEFAULT_SEASON_CATALOG.length,
    created,
  };
}

async function runCli() {
  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error(
      "Keine Datenbank-URL gefunden (DATABASE_URL / POSTGRES_PRISMA_URL / POSTGRES_URL)."
    );
  }

  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    console.log("Starte Import der Standard-Handballsaisons...");
    const result = await importDefaultSeasons(prisma);
    console.log(
      `Saison-Katalog synchronisiert: ${result.created} neu angelegt (${result.total} Standardsaisons geprüft).`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("import-seasons.ts") ||
    process.argv[1].endsWith("import-seasons.js"));

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error("Fehler beim Import der Standard-Handballsaisons:", err);
    process.exit(1);
  });
}
