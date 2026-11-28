import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  formatDepartureTime,
  formatGermanCalendarDate,
  formatGermanDate,
  formatGermanDateTime,
  formatGermanTime,
  GERMAN_TIME_ZONE,
  isoDateToGermanDate,
  parseGermanDateToIso,
  parseGermanTimeTo24h,
  toLocalIsoDate,
} from "@/domain/date-time";
import * as shared from "@throwoff/shared";
import { CreateRecurringEventsSchema } from "@/domain/schemas/event";
import { CreateSeasonCatalogSchema } from "@/domain/schemas/season-catalog";
import { computeLeagueMergePlan } from "@/domain/services/league-merge";

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      results.push(full);
    }
  }
  return results;
}

describe("Deutsches Datums- (TT.MM.JJJJ) & 24h-Zeitformat (HH:MM)", () => {
  it("formatiert Daten strikt als TT.MM.JJJJ inkl. führender Nullen", () => {
    expect(
      formatGermanDate("2026-01-05T08:05:00.000Z", { timeZone: "UTC" })
    ).toBe("05.01.2026");
    expect(
      formatGermanDate("2026-11-28T19:30:00.000Z", {
        includeWeekday: true,
        timeZone: "UTC",
      })
    ).toBe("Sa., 28.11.2026");
    expect(formatGermanDate(null)).toBe("");
    expect(formatGermanDate("ungültig")).toBe("");
  });

  it("hält Kalendertage (z. B. Saison-Start/Ende) zeitzonenstabil im Format TT.MM.JJJJ", () => {
    expect(formatGermanCalendarDate("2026-07-01")).toBe("01.07.2026");
    expect(formatGermanCalendarDate("2026-07-01T00:00:00.000Z")).toBe(
      "01.07.2026"
    );
    expect(formatGermanCalendarDate("2027-06-30T23:59:59.000Z")).toBe(
      "30.06.2027"
    );
    expect(formatGermanCalendarDate(null)).toBe("");
  });

  it("formatiert Uhrzeiten immer im 24h-Format HH:MM (00:00–23:59, niemals AM/PM oder 24:xx)", () => {
    const cases: Array<[string, string]> = [
      ["2026-01-05T00:00:00.000Z", "00:00"],
      ["2026-01-05T00:05:00.000Z", "00:05"],
      ["2026-01-05T09:07:00.000Z", "09:07"],
      ["2026-01-05T12:00:00.000Z", "12:00"],
      ["2026-01-05T13:45:00.000Z", "13:45"],
      ["2026-01-05T19:30:00.000Z", "19:30"],
      ["2026-01-05T23:59:00.000Z", "23:59"],
    ];

    for (const [iso, expected] of cases) {
      const formatted = formatGermanTime(iso, { timeZone: "UTC" });
      expect(formatted).toBe(expected);
      expect(formatted).not.toMatch(/am|pm/i);
      expect(formatted).not.toMatch(/^24:/);
    }

    expect(
      formatGermanTime("2026-11-28T18:30:00.000Z", {
        includeUhr: true,
        timeZone: GERMAN_TIME_ZONE,
      })
    ).toBe("19:30 Uhr");
  });

  it("formatiert Datum & Uhrzeit einheitlich mit Jahr (TT.MM.JJJJ) und 24h-Zeit", () => {
    expect(
      formatGermanDateTime("2026-01-05T08:05:00.000Z", {
        timeZone: GERMAN_TIME_ZONE,
        includeUhr: true,
      })
    ).toBe("05.01.2026, 09:05 Uhr");

    expect(
      formatGermanDateTime("2026-07-18T17:30:00.000Z", {
        includeWeekday: true,
        includeUhr: true,
        timeZone: GERMAN_TIME_ZONE,
      })
    ).toBe("Sa., 18.07.2026, 19:30 Uhr");
  });

  it("parst und konvertiert deutsche Daten (TT.MM.JJJJ) inkl. Schaltjahrprüfung", () => {
    expect(isoDateToGermanDate("2026-01-05")).toBe("05.01.2026");
    expect(isoDateToGermanDate("2026-11-28T18:00:00.000Z")).toBe("28.11.2026");
    expect(isoDateToGermanDate("")).toBe("");

    expect(parseGermanDateToIso("28.11.2026")).toBe("2026-11-28");
    expect(parseGermanDateToIso("5.1.2026")).toBe("2026-01-05");
    expect(parseGermanDateToIso("05012026")).toBe("2026-01-05");
    expect(parseGermanDateToIso("2026-11-28")).toBe("2026-11-28");
    expect(parseGermanDateToIso("29.02.2028")).toBe("2028-02-29");

    // Ungültige Kalenderdaten ablehnen
    expect(parseGermanDateToIso("29.02.2026")).toBeNull();
    expect(parseGermanDateToIso("31.04.2026")).toBeNull();
    expect(parseGermanDateToIso("11/28/2026")).toBeNull();
    expect(parseGermanDateToIso("")).toBeNull();
  });

  it("parst 24h-Uhrzeiten strikt und lehnt 12h AM/PM sowie ungültige Zeiten ab", () => {
    expect(parseGermanTimeTo24h("00:00")).toBe("00:00");
    expect(parseGermanTimeTo24h("9:05")).toBe("09:05");
    expect(parseGermanTimeTo24h("19:30")).toBe("19:30");
    expect(parseGermanTimeTo24h("19:30 Uhr")).toBe("19:30");
    expect(parseGermanTimeTo24h("1930")).toBe("19:30");
    expect(parseGermanTimeTo24h("930")).toBe("09:30");
    expect(parseGermanTimeTo24h("23:59")).toBe("23:59");

    // 12h AM/PM und ungültige Uhrzeiten ablehnen
    expect(parseGermanTimeTo24h("7:30 PM")).toBeNull();
    expect(parseGermanTimeTo24h("12:00 AM")).toBeNull();
    expect(parseGermanTimeTo24h("24:00")).toBeNull();
    expect(parseGermanTimeTo24h("25:15")).toBeNull();
    expect(parseGermanTimeTo24h("12:60")).toBeNull();
  });

  it("formatiert Fahrgemeinschafts-Abfahrtszeiten robust ohne Invalid Date", () => {
    expect(formatDepartureTime("16:15")).toBe("16:15 Uhr");
    expect(formatDepartureTime("13:00 Uhr")).toBe("13:00 Uhr");
    expect(formatDepartureTime("ca. 16:15 Uhr ab Halle")).toBe(
      "ca. 16:15 Uhr ab Halle"
    );
    expect(
      formatDepartureTime("2026-11-28T15:15:00.000Z", {
        timeZone: GERMAN_TIME_ZONE,
      })
    ).toBe("Sa., 28.11.2026, 16:15 Uhr");
    expect(formatDepartureTime(null)).toBe("");
  });

  it("erzeugt lokale ISO-Daten ohne UTC-Verschiebung", () => {
    const localDate = new Date(2026, 0, 5, 0, 30, 0);
    expect(toLocalIsoDate(localDate)).toBe("2026-01-05");
  });

  it("re-exportiert alle Datums- und Zeit-Helfer in @throwoff/shared für Mobile", () => {
    expect(shared.formatGermanDate).toBe(formatGermanDate);
    expect(shared.formatGermanTime).toBe(formatGermanTime);
    expect(shared.formatGermanDateTime).toBe(formatGermanDateTime);
    expect(shared.formatDepartureTime).toBe(formatDepartureTime);
  });

  it("akzeptiert TT.MM.JJJJ in Zod-Schemas für Serientermine und Saison-Katalog", () => {
    const recurring = CreateRecurringEventsSchema.safeParse({
      type: "TRAINING",
      title: "Mannschaftstraining",
      daysOfWeek: [2, 4],
      startTime: "19:30",
      endTime: "21:00",
      startDate: "01.10.2026",
      endDate: "31.12.2026",
      excludedDates: ["24.12.2026", "31.12.2026"],
    });
    expect(recurring.success).toBe(true);
    if (recurring.success) {
      expect(recurring.data.startDate).toBe("2026-10-01");
      expect(recurring.data.endDate).toBe("2026-12-31");
      expect(recurring.data.excludedDates).toEqual(["2026-12-24", "2026-12-31"]);
    }

    const season = CreateSeasonCatalogSchema.safeParse({
      name: "2026/27",
      startDate: "01.07.2026",
      endDate: "30.06.2027",
    });
    expect(season.success).toBe(true);
    if (season.success) {
      expect(season.data.startDate).toBe("2026-07-01T00:00:00.000Z");
      expect(season.data.endDate).toBe("2027-06-30T00:00:00.000Z");
    }
  });

  it("formatiert Liga-Sync-Änderungsprotokolle im deutschen TT.MM.JJJJ- und 24h-Format (Europe/Berlin)", () => {
    const plan = computeLeagueMergePlan(
      [],
      [
        {
          externalId: "M-1",
          title: "TSV Musterstadt – SG Neustadt",
          opponentName: "SG Neustadt",
          isHome: true,
          startAt: new Date("2026-11-29T18:00:00.000Z"), // 19:00 CET
          endAt: new Date("2026-11-29T19:45:00.000Z"),
          venueName: "Sporthalle Süd",
          isCancelled: false,
        },
      ]
    );
    expect(plan[0]?.summary).toContain("29.11.2026, 19:00 Uhr");
  });

  it("Guardrail: keine rohen toLocale*Date/Time-Aufrufe oder nativen type=date/time-Inputs in UI und Mobile", () => {
    const uiDirs = [
      join(process.cwd(), "src", "app"),
      join(process.cwd(), "src", "components"),
      join(process.cwd(), "apps", "mobile"),
    ];

    const forbiddenPatterns: Array<{ name: string; regex: RegExp }> = [
      { name: "toLocaleDateString", regex: /\.toLocaleDateString\s*\(/ },
      { name: "toLocaleTimeString", regex: /\.toLocaleTimeString\s*\(/ },
      { name: "toLocaleString", regex: /\.toLocaleString\s*\(/ },
      { name: "Intl.DateTimeFormat", regex: /new\s+Intl\.DateTimeFormat\s*\(/ },
      { name: 'type="date"', regex: /type=["']date["']/ },
      { name: 'type="time"', regex: /type=["']time["']/ },
      { name: 'type="datetime-local"', regex: /type=["']datetime-local["']/ },
    ];

    for (const dir of uiDirs) {
      for (const file of collectSourceFiles(dir)) {
        const content = readFileSync(file, "utf-8");
        for (const { name, regex } of forbiddenPatterns) {
          expect(
            regex.test(content),
            `Unerlaubtes Datums-/Zeit-Pattern "${name}" in ${file} – bitte zentrale Helfer aus @/domain/date-time bzw. GermanDateInput/GermanTimeInput nutzen.`
          ).toBe(false);
        }
      }
    }
  });
});
