import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { getNuligaFederations } from "../src/domain/data/federation-registry";
import { importNuligaFederationLive } from "../src/infrastructure/leagues/directory-importer";

interface CliArgs {
  federations: string[];
  countryCode?: string;
  seasonName: string;
  dryRun: boolean;
  delayMs: number;
}

function parseCliArgs(argv: string[]): CliArgs {
  let federations: string[] = [];
  let countryCode: string | undefined;
  let seasonName = "2026/27";
  let dryRun = false;
  let delayMs = 150;
  let allNuliga = false;

  for (const arg of argv) {
    if (arg.startsWith("--federation=")) {
      const list = arg
        .slice("--federation=".length)
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      federations.push(...list);
    } else if (arg.startsWith("--country=")) {
      countryCode = arg.slice("--country=".length).trim().toUpperCase();
    } else if (arg.startsWith("--season=")) {
      seasonName = arg.slice("--season=".length).trim();
    } else if (arg.startsWith("--delay=")) {
      const parsed = Number.parseInt(arg.slice("--delay=".length), 10);
      if (Number.isFinite(parsed) && parsed >= 0) delayMs = parsed;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--all-nuliga") {
      allNuliga = true;
    }
  }

  if (allNuliga || federations.length === 0) {
    federations = getNuligaFederations(countryCode).map((f) => f.federationCode);
  }

  return { federations, countryCode, seasonName, dryRun, delayMs };
}

async function runCli() {
  const args = parseCliArgs(process.argv.slice(2));
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
    console.log(
      `Starte Multi-Verbands-Verzeichnis-Import (${args.federations.join(", ")}, Saison ${args.seasonName}${args.dryRun ? ", DRY-RUN" : ""})…`
    );

    for (const fedCode of args.federations) {
      const result = await importNuligaFederationLive(prisma, fedCode, {
        seasonName: args.seasonName,
        delayMs: args.delayMs,
        dryRun: args.dryRun,
      });

      console.log(
        `[${result.countryCode}/${result.federationCode}] Status=${result.status}: ` +
          `${result.groups} Staffeln, ${result.teams} Mannschaften, ` +
          `${result.deactivatedGroups} Staffeln / ${result.deactivatedTeams} Teams deaktiviert, ` +
          `${result.failures.length} Fehler.`
      );
      for (const failure of result.failures.slice(0, 5)) {
        console.log(`  Fehler: ${failure.url} – ${failure.reason}`);
      }
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("import-directory.ts") ||
    process.argv[1].endsWith("import-directory.js"));

if (isDirectExecution) {
  runCli().catch((err) => {
    console.error("Fehler beim Verzeichnis-Import:", err);
    process.exit(1);
  });
}
