import {
  LeagueProviderAdapter,
  NormalizedLeagueMatch,
} from "../adapters/league-provider";
import { DomainError } from "../errors";
import { CsvColumnMapping } from "../schemas/league";

export interface CsvParseOptions {
  teamNameMatch: string;
  mapping: CsvColumnMapping;
}

function splitCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDateAndTime(dateRaw: string, timeRaw?: string | null): Date | null {
  const cleanedDate = dateRaw.trim();
  const cleanedTime = (timeRaw ?? "18:00").trim().replace(/\s*Uhr$/i, "");

  let year: number;
  let month: number;
  let day: number;

  // DD.MM.YYYY (deutsches nuLiga/Excel-Format)
  const deMatch = cleanedDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  // YYYY-MM-DD (ISO)
  const isoMatch = cleanedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (deMatch) {
    day = Number(deMatch[1]);
    month = Number(deMatch[2]) - 1;
    year = Number(deMatch[3]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]) - 1;
    day = Number(isoMatch[3]);
  } else {
    return null;
  }

  const timeMatch = cleanedTime.match(/^(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 18;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  return new Date(Date.UTC(year, month, day, hour, minute, 0));
}

export class CsvLeagueProviderAdapter
  implements LeagueProviderAdapter<CsvParseOptions>
{
  readonly provider = "CSV_MANUAL" as const;

  parse(
    rawContent: string,
    options: CsvParseOptions
  ): NormalizedLeagueMatch[] {
    const lines = rawContent
      .replace(/^\uFEFF/, "") // BOM entfernen
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw DomainError.validation(
        "Die CSV-Datei muss eine Kopfzeile und mindestens eine Datenzeile enthalten."
      );
    }

    const { mapping, teamNameMatch } = options;
    const headers = splitCsvRow(lines[0], mapping.delimiter).map((h) =>
      h.toLowerCase()
    );

    const colIndex = (colName?: string | null): number => {
      if (!colName) return -1;
      return headers.indexOf(colName.trim().toLowerCase());
    };

    const dateIdx = colIndex(mapping.dateColumn);
    const timeIdx = colIndex(mapping.timeColumn);
    const homeIdx = colIndex(mapping.homeTeamColumn);
    const awayIdx = colIndex(mapping.awayTeamColumn);
    const venueIdx = colIndex(mapping.venueColumn);
    const extIdx = colIndex(mapping.externalIdColumn);

    if (dateIdx === -1 || homeIdx === -1 || awayIdx === -1) {
      throw DomainError.validation(
        "Mindestens eine zugeordnete Spalte (Datum, Heimteam oder Gastteam) wurde in der CSV-Kopfzeile nicht gefunden."
      );
    }

    const needle = teamNameMatch.trim().toLowerCase();
    const matches: NormalizedLeagueMatch[] = [];

    for (let rowNum = 1; rowNum < lines.length; rowNum++) {
      const cells = splitCsvRow(lines[rowNum], mapping.delimiter);
      const dateRaw = cells[dateIdx] ?? "";
      const timeRaw = timeIdx >= 0 ? cells[timeIdx] : null;
      const homeTeam = (cells[homeIdx] ?? "").trim();
      const awayTeam = (cells[awayIdx] ?? "").trim();
      const venueName =
        venueIdx >= 0 && cells[venueIdx] ? cells[venueIdx].trim() : null;

      if (!dateRaw || !homeTeam || !awayTeam) continue;

      const startAt = parseDateAndTime(dateRaw, timeRaw);
      if (!startAt) continue;

      const isHome = homeTeam.toLowerCase().includes(needle);
      const isAway = awayTeam.toLowerCase().includes(needle);
      // Wenn keins der beiden Teams passt, überspringen (z. B. komplette Liga-CSV!)
      if (!isHome && !isAway) continue;

      const opponentName = isHome ? awayTeam : homeTeam;
      const explicitExtId =
        extIdx >= 0 && cells[extIdx] ? cells[extIdx].trim() : null;
      const externalId =
        explicitExtId ||
        `csv-${homeTeam.toLowerCase().replace(/\s+/g, "-")}-vs-${awayTeam
          .toLowerCase()
          .replace(/\s+/g, "-")}-${startAt.toISOString().slice(0, 10)}`;

      matches.push({
        externalId,
        title: `${homeTeam} vs. ${awayTeam}`,
        opponentName,
        isHome,
        startAt,
        endAt: new Date(startAt.getTime() + 105 * 60 * 1000),
        venueName,
        isCancelled: false,
      });
    }

    return matches;
  }
}
