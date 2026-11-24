import "dotenv/config";
import { defineConfig } from "prisma/config";

// Unterstützt sowohl lokales DATABASE_URL als auch Neon-/Vercel-Postgres-Variablen.
// Der Placeholder greift ausschließlich während `prisma generate` (ohne DB-Verbindung).
const datasourceUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL ??
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
