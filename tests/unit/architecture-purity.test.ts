import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_IMPORTS = [
  "next/",
  "next\"",
  "next'",
  "react",
  "@prisma/client",
  "better-auth",
  "pg-boss",
  "@/infrastructure",
];

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

describe("Architektur-Guardrail: src/domain/ bleibt reines TypeScript", () => {
  it("enthält keinerlei Next.js-, React-, Prisma- oder Better-Auth-Imports", () => {
    const domainDir = join(process.cwd(), "src", "domain");
    const files = collectTsFiles(domainDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      const importLines = content
        .split("\n")
        .filter((line) => line.trim().startsWith("import "));

      for (const line of importLines) {
        for (const forbidden of FORBIDDEN_IMPORTS) {
          expect(
            line.includes(forbidden),
            `Verbotener Import "${forbidden}" in ${file}: ${line}`
          ).toBe(false);
        }
      }
    }
  });
});
