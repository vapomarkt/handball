import { FetchTextFn, NormalizedLeagueMatch } from "../adapters/league-provider";
import {
  deriveNuligaGroupMeetingsUrl,
  parseScoreWithOptionalHalf,
} from "./nuliga-match-results";
import {
  decodeHtmlEntities,
  isAllowedNuligaUrl,
  teamNamesMatch,
} from "./nuliga-opponent-players";

const CANCELLED_OR_POSTPONED_PATTERN =
  /\b(?:abgesagt|ausgefallen|zur[uü]ckgezogen|abgesetzt)\b/i;

function stripHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractResultSetTables(html: string): string[] {
  const pattern =
    /<table\b[^>]*class\s*=\s*["'][^"']*\bresult-set\b[^"']*["'][^>]*>[\s\S]*?<\/table>/gi;
  return [...html.matchAll(pattern)].map((m) => m[0]);
}

function extractTagCells(rowHtml: string, tag: "th" | "td"): string[] {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  return [...rowHtml.matchAll(pattern)].map((m) => m[1]);
}

function parseGermanDateParts(
  raw: string
): { year: number; month: number; day: number } | null {
  const m = raw.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  let year = Number.parseInt(m[3], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * Berechnet ein UTC-Date-Objekt aus lokalem deutschem/österreichischem Datum + Uhrzeit
 * (Europe/Berlin bzw. Europe/Vienna, inkl. korrekter Sommer-/Winterzeit).
 */
function buildZonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = "Europe/Berlin"
): Date {
  // Näherung in UTC, dann Offset über Intl in Zielzeitzone korrigieren
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(utcGuess);
    const get = (type: string) =>
      Number.parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);
    const tzYear = get("year");
    const tzMonth = get("month");
    const tzDay = get("day");
    const tzHour = get("hour") === 24 ? 0 : get("hour");
    const tzMinute = get("minute");
    const renderedAsUtc = Date.UTC(
      tzYear,
      tzMonth - 1,
      tzDay,
      tzHour,
      tzMinute,
      0,
      0
    );
    const offsetMs = renderedAsUtc - utcGuess.getTime();
    return new Date(utcGuess.getTime() - offsetMs);
  } catch {
    return utcGuess;
  }
}

function parseScoreFromCellHtml(cellHtml: string): {
  homeFull: number;
  awayFull: number;
  homeHalf: number | null;
  awayHalf: number | null;
} | null {
  const text = stripHtml(cellHtml);
  const parsed = parseScoreWithOptionalHalf(text);
  if (!parsed) return null;

  let half = parsed.half;
  if (!half) {
    const halfAttr = decodeHtmlEntities(cellHtml).match(
      /(?:title|alt)\s*=\s*["'][^"']*?(\d{1,2})\s*:\s*(\d{1,2})\s*(?:zur\s+)?Halbzeit[^"']*["']/i
    );
    if (halfAttr) {
      half = {
        home: Number.parseInt(halfAttr[1], 10),
        away: Number.parseInt(halfAttr[2], 10),
      };
    }
  }

  return {
    homeFull: parsed.full.home,
    awayFull: parsed.full.away,
    homeHalf: half?.home ?? null,
    awayHalf: half?.away ?? null,
  };
}

export interface ParseNuligaScheduleOptions {
  teamNameMatch: string;
  leagueGroupName?: string | null;
  externalIdPrefix?: string;
  timeZone?: string;
}

/**
 * Parst vollständige Spielpläne (vergangene UND künftige Spiele inkl. Ergebnis,
 * Halbzeitstand, Halle und Absage-Status) direkt aus einer nuLiga-HTML-Seite
 * (`teamPortrait` oder `groupPage?displayTyp=gesamt&displayDetail=meetings`).
 * Dient als vollwertiger Fallback, wenn ein nuLiga-Verband keinen iCal-Feed anbietet.
 */
export function parseNuligaScheduleHtml(
  html: string,
  options: ParseNuligaScheduleOptions
): NormalizedLeagueMatch[] {
  const tables = extractResultSetTables(html);
  const matches: NormalizedLeagueMatch[] = [];
  const seenExternalIds = new Set<string>();
  const prefix = options.externalIdPrefix ?? "nuliga-html";
  const timeZone = options.timeZone ?? "Europe/Berlin";

  for (const table of tables) {
    const trs = table.split(/<tr\b[^>]*>/i).slice(1);
    if (trs.length < 2) continue;

    let dateIdx = -1;
    let timeIdx = -1;
    let nrIdx = -1;
    let venueIdx = -1;
    let homeIdx = -1;
    let awayIdx = -1;
    let headerRowIndex = -1;

    for (let i = 0; i < Math.min(trs.length, 3); i++) {
      const ths = extractTagCells(trs[i], "th").map((h) =>
        stripHtml(h).toLowerCase()
      );
      if (ths.length < 4) continue;

      const dIdx = ths.findIndex((h) => h.includes("datum"));
      const hIdx = ths.findIndex(
        (h) => h.includes("heimmannschaft") || h === "heim"
      );
      const aIdx = ths.findIndex(
        (h) => h.includes("gastmannschaft") || h === "gast"
      );

      if (dIdx !== -1 && hIdx !== -1 && aIdx !== -1) {
        dateIdx = dIdx;
        homeIdx = hIdx;
        awayIdx = aIdx;
        timeIdx = ths.findIndex((h) => h.includes("zeit"));
        nrIdx = ths.findIndex(
          (h) => h === "nr." || h === "nr" || h.includes("begegnung")
        );
        venueIdx = ths.findIndex(
          (h) => h.includes("halle") || h.includes("ort") || h.includes("spielstätte")
        );
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) continue;

    let lastDate: { year: number; month: number; day: number } | null = null;
    for (let i = headerRowIndex + 1; i < trs.length; i++) {
      const cells = extractTagCells(trs[i], "td");
      if (cells.length <= awayIdx) continue;

      const rawDate = stripHtml(cells[dateIdx] ?? "");
      const parsedDate = parseGermanDateParts(rawDate);
      if (parsedDate) lastDate = parsedDate;
      if (!lastDate) continue;

      const homeTeam = stripHtml(cells[homeIdx] ?? "");
      const awayTeam = stripHtml(cells[awayIdx] ?? "");
      if (!homeTeam || !awayTeam) continue;

      const matchesHome = teamNamesMatch(homeTeam, options.teamNameMatch);
      const matchesAway = teamNamesMatch(awayTeam, options.teamNameMatch);
      if (!matchesHome && !matchesAway) continue;

      const isHome = matchesHome;
      const opponentName = isHome ? awayTeam : homeTeam;

      const rawTime = timeIdx >= 0 ? stripHtml(cells[timeIdx] ?? "") : "";
      const timeMatch = rawTime.match(/\b(\d{1,2}):(\d{2})\b/);
      const hour = timeMatch ? Number.parseInt(timeMatch[1], 10) : 12;
      const minute = timeMatch ? Number.parseInt(timeMatch[2], 10) : 0;

      const startAt = buildZonedDate(
        lastDate.year,
        lastDate.month,
        lastDate.day,
        hour,
        minute,
        timeZone
      );
      const endAt = timeMatch
        ? new Date(startAt.getTime() + 90 * 60 * 1000)
        : null;

      const rawNr = nrIdx >= 0 ? stripHtml(cells[nrIdx] ?? "") : "";
      const matchNumber = rawNr.match(/^\d+$/)?.[0] ?? null;

      let venueName: string | null = null;
      if (venueIdx >= 0 && cells[venueIdx]) {
        const titleAttr = decodeHtmlEntities(cells[venueIdx]).match(
          /\btitle\s*=\s*["']([^"']+)["']/i
        )?.[1];
        const cellText = stripHtml(cells[venueIdx]);
        venueName = (titleAttr || cellText || "").trim() || null;
      }

      const scoreCellHtml = cells[awayIdx + 1] ?? "";
      const scoreCellText = stripHtml(scoreCellHtml);
      const parsedScore = parseScoreFromCellHtml(scoreCellHtml);
      const isCancelled =
        CANCELLED_OR_POSTPONED_PATTERN.test(scoreCellText) ||
        CANCELLED_OR_POSTPONED_PATTERN.test(rawTime);

      const dateSlug = `${lastDate.year}-${String(lastDate.month).padStart(2, "0")}-${String(lastDate.day).padStart(2, "0")}`;
      const externalId = matchNumber
        ? `${prefix}-nr-${matchNumber}`
        : `${prefix}-${dateSlug}-${homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

      if (seenExternalIds.has(externalId)) continue;
      seenExternalIds.add(externalId);

      matches.push({
        externalId,
        title: `${homeTeam} – ${awayTeam}`,
        opponentName,
        isHome,
        startAt,
        endAt,
        venueName,
        isCancelled,
        matchNumber,
        leagueGroupName: options.leagueGroupName ?? null,
        homeTeamName: homeTeam,
        awayTeamName: awayTeam,
        homeScoreFull: parsedScore?.homeFull ?? null,
        awayScoreFull: parsedScore?.awayFull ?? null,
        homeScoreHalf: parsedScore?.homeHalf ?? null,
        awayScoreHalf: parsedScore?.awayHalf ?? null,
      });
    }
  }

  return matches;
}

export async function fetchNuligaHtmlSchedule(
  fetchText: FetchTextFn,
  target: {
    teamUrl?: string | null;
    groupUrl?: string | null;
    teamNameMatch: string;
    leagueGroupName?: string | null;
    timeZone?: string;
  }
): Promise<NormalizedLeagueMatch[]> {
  const candidates: string[] = [];
  if (target.teamUrl && isAllowedNuligaUrl(target.teamUrl)) {
    candidates.push(target.teamUrl);
  }
  const meetingsUrl =
    (target.groupUrl ? deriveNuligaGroupMeetingsUrl(target.groupUrl) : null) ??
    (target.teamUrl ? deriveNuligaGroupMeetingsUrl(target.teamUrl) : null);
  if (meetingsUrl && !candidates.includes(meetingsUrl)) {
    candidates.push(meetingsUrl);
  }
  if (
    target.groupUrl &&
    isAllowedNuligaUrl(target.groupUrl) &&
    !candidates.includes(target.groupUrl)
  ) {
    candidates.push(target.groupUrl);
  }

  for (const url of candidates) {
    try {
      const html = await fetchText(url);
      const parsed = parseNuligaScheduleHtml(html, {
        teamNameMatch: target.teamNameMatch,
        leagueGroupName: target.leagueGroupName,
        timeZone: target.timeZone,
      });
      if (parsed.length > 0) {
        return parsed;
      }
    } catch {
      // Nächste Kandidaten-URL probieren
    }
  }

  return [];
}
