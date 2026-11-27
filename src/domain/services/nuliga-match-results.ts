import { FetchTextFn } from "../adapters/league-provider";
import {
  decodeHtmlEntities,
  isAllowedNuligaUrl,
  normalizeCompareText,
  teamNamesMatch,
} from "./nuliga-opponent-players";

export interface ParsedNuligaMatchResult {
  dateKey: string; // YYYY-MM-DD (lokales deutsches Spieldatum)
  timeText: string | null;
  matchNumber: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScoreFull: number;
  awayScoreFull: number;
  homeScoreHalf: number | null;
  awayScoreHalf: number | null;
}

export interface NuligaMatchResultsTarget {
  /** Offizielle Mannschaftsseite (z. B. teamPortrait?teamtable=...) */
  teamUrl?: string | null;
  /** Offizielle Staffelseite (z. B. groupPage?championship=...&group=...) */
  groupUrl?: string | null;
  /** Optionale nuLiga-Basis-/Feed-URL (z. B. getTeamMeetingsWebcal) für Fallback-Auflösung */
  fallbackNuligaUrl?: string | null;
  clubName?: string | null;
  teamName?: string | null;
  groupName?: string | null;
}

export interface ScorePair {
  home: number;
  away: number;
}

const SKIP_SCORE_CELL_PATTERN =
  /\b(?:abgesagt|verlegt|spielfrei|ausgefallen|zur[uü]ckgezogen|offen)\b/i;

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

function parseGermanDateToKey(raw: string): string | null {
  const m = raw.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const month = Number.parseInt(m[2], 10);
  let year = Number.parseInt(m[3], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseScorePair(raw: string): ScorePair | null {
  const m = raw.match(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/);
  if (!m) return null;
  const home = Number.parseInt(m[1], 10);
  const away = Number.parseInt(m[2], 10);
  if (
    !Number.isFinite(home) ||
    !Number.isFinite(away) ||
    home < 0 ||
    home > 99 ||
    away < 0 ||
    away > 99
  ) {
    return null;
  }
  return { home, away };
}

/**
 * Parst Spielstand und optionalen Halbzeitstand aus einem Text wie
 * `"22:26"` oder `"22:26 (9:17)"`.
 */
export function parseScoreWithOptionalHalf(raw: string): {
  full: ScorePair;
  half: ScorePair | null;
} | null {
  const cleaned = raw.trim();
  if (!cleaned || SKIP_SCORE_CELL_PATTERN.test(cleaned)) return null;

  const withHalf = cleaned.match(
    /(\d{1,2})\s*:\s*(\d{1,2})\s*\(\s*(\d{1,2})\s*:\s*(\d{1,2})\s*\)/
  );
  if (withHalf) {
    const full = parseScorePair(`${withHalf[1]}:${withHalf[2]}`);
    const half = parseScorePair(`${withHalf[3]}:${withHalf[4]}`);
    if (full) return { full, half };
  }

  const full = parseScorePair(cleaned);
  if (!full) return null;
  return { full, half: null };
}

function parseScoreFromNuLigaCellHtml(cellHtml: string): {
  full: ScorePair;
  half: ScorePair | null;
} | null {
  const text = stripHtml(cellHtml);
  if (!text || SKIP_SCORE_CELL_PATTERN.test(text)) return null;

  const parsedInline = parseScoreWithOptionalHalf(text);
  if (!parsedInline) return null;

  let half = parsedInline.half;
  if (!half) {
    // nuLiga legt den Halbzeitstand im title/alt-Attribut ab:
    // <span alt="9:17 zur Halbzeit" title="9:17 zur Halbzeit">22:26</span>
    const halfAttrMatch = decodeHtmlEntities(cellHtml).match(
      /(?:title|alt)\s*=\s*["'][^"']*?(\d{1,2})\s*:\s*(\d{1,2})\s*(?:zur\s+)?Halbzeit[^"']*["']/i
    );
    if (halfAttrMatch) {
      half = parseScorePair(`${halfAttrMatch[1]}:${halfAttrMatch[2]}`);
    }
  }

  return { full: parsedInline.full, half };
}

/**
 * Parst offizielle Spielergebnisse (inkl. Halbzeitstand) aus einer nuLiga-HTML-Seite
 * (`teamPortrait` oder `groupPage`).
 */
export function parseNuligaMatchResultsHtml(html: string): {
  hasScheduleTable: boolean;
  results: ParsedNuligaMatchResult[];
} {
  const tables = extractResultSetTables(html);
  const results: ParsedNuligaMatchResult[] = [];
  let hasScheduleTable = false;

  for (const table of tables) {
    const trs = table.split(/<tr\b[^>]*>/i).slice(1);
    if (trs.length < 2) continue;

    let dateIdx = -1;
    let timeIdx = -1;
    let nrIdx = -1;
    let homeIdx = -1;
    let awayIdx = -1;
    let headerRowIndex = -1;

    for (let i = 0; i < Math.min(trs.length, 3); i++) {
      const ths = extractTagCells(trs[i], "th").map((h) =>
        stripHtml(h).toLowerCase()
      );
      if (ths.length < 5) continue;

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
        nrIdx = ths.findIndex((h) => h === "nr." || h === "nr" || h.includes("begegnung"));
        headerRowIndex = i;
        hasScheduleTable = true;
        break;
      }
    }

    if (headerRowIndex === -1) continue;

    let lastDateKey: string | null = null;
    for (let i = headerRowIndex + 1; i < trs.length; i++) {
      const cells = extractTagCells(trs[i], "td");
      if (cells.length <= awayIdx + 1) continue;

      const rawDate = stripHtml(cells[dateIdx] ?? "");
      const parsedDateKey = parseGermanDateToKey(rawDate);
      if (parsedDateKey) {
        lastDateKey = parsedDateKey;
      }
      if (!lastDateKey) continue;

      const homeTeam = stripHtml(cells[homeIdx] ?? "");
      const awayTeam = stripHtml(cells[awayIdx] ?? "");
      if (!homeTeam || !awayTeam) continue;

      const scoreCellHtml = cells[awayIdx + 1] ?? "";
      const parsedScore = parseScoreFromNuLigaCellHtml(scoreCellHtml);
      if (!parsedScore) continue;

      const rawTime = timeIdx >= 0 ? stripHtml(cells[timeIdx] ?? "") : "";
      const timeMatch = rawTime.match(/\b(\d{1,2}:\d{2})\b/);
      const rawNr = nrIdx >= 0 ? stripHtml(cells[nrIdx] ?? "") : "";
      const nrMatch = rawNr.match(/^\d+$/);

      results.push({
        dateKey: lastDateKey,
        timeText: timeMatch ? timeMatch[1] : null,
        matchNumber: nrMatch ? nrMatch[0] : null,
        homeTeam,
        awayTeam,
        homeScoreFull: parsedScore.full.home,
        awayScoreFull: parsedScore.full.away,
        homeScoreHalf: parsedScore.half?.home ?? null,
        awayScoreHalf: parsedScore.half?.away ?? null,
      });
    }
  }

  return { hasScheduleTable, results };
}

/**
 * Wandelt ein UTC-Datum in das deutsche Kalendertags-Format `YYYY-MM-DD` (Europe/Berlin) um.
 */
export function toBerlinDateKey(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback auf UTC-Datum
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Leitet aus einer nuLiga-Staffel- oder Mannschafts-URL die Gesamt-Spielplan-URL
 * (`groupPage?displayTyp=gesamt&displayDetail=meetings`) ab.
 */
export function deriveNuligaGroupMeetingsUrl(sourceUrl: string): string | null {
  if (!isAllowedNuligaUrl(sourceUrl)) return null;
  try {
    const parsed = new URL(sourceUrl);
    const championship = parsed.searchParams.get("championship");
    const group = parsed.searchParams.get("group");
    if (!championship || !group) return null;

    const base = new URL(".", parsed);
    const groupUrl = new URL("groupPage", base);
    groupUrl.searchParams.set("displayTyp", "gesamt");
    groupUrl.searchParams.set("displayDetail", "meetings");
    groupUrl.searchParams.set("championship", championship);
    groupUrl.searchParams.set("group", group);
    return groupUrl.toString();
  } catch {
    return null;
  }
}

interface HtmlLink {
  href: string;
  text: string;
}

function findLinks(html: string, needle: string): HtmlLink[] {
  const links: HtmlLink[] = [];
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    if (!match[1].includes(needle)) continue;
    links.push({
      href: decodeHtmlEntities(match[1]),
      text: stripHtml(match[2]),
    });
  }
  return links;
}

function pickLinkByName(links: HtmlLink[], name: string): HtmlLink | null {
  const wanted = normalizeCompareText(name);
  if (!wanted) return null;
  return (
    links.find((l) => normalizeCompareText(l.text) === wanted) ??
    links.find((l) => teamNamesMatch(l.text, name)) ??
    null
  );
}

function pickGroupLinkFromClubTeams(
  html: string,
  groupName: string
): HtmlLink | null {
  const wanted = normalizeCompareText(groupName);
  if (!wanted) return null;
  const rows = html.split(/<tr\b[^>]*>/i).slice(1);
  for (const row of rows) {
    const cells = extractTagCells(row, "td");
    if (cells.length < 2) continue;
    const link = findLinks(cells[1], "groupPage")[0];
    if (!link) continue;
    const linkNorm = normalizeCompareText(link.text);
    if (
      linkNorm === wanted ||
      linkNorm.includes(wanted) ||
      wanted.includes(linkNorm)
    ) {
      return link;
    }
  }
  return null;
}

/**
 * Best-effort Abruf offizieller Spielergebnisse aus nuLiga:
 * 1. Direkt über `teamPortrait?teamtable=...` (1 Request)
 * 2. Über die Staffelseite `groupPage?displayTyp=gesamt&displayDetail=meetings` (1 Request)
 * 3. Fallback über Vereinssuche (`clubSearch` → `clubTeams` → `groupPage`)
 *
 * Fehler werden bewusst abgefangen, damit der Spielplan-Sync nie am Ergebnis-Abruf scheitert.
 */
export async function fetchNuligaMatchResults(
  fetchText: FetchTextFn,
  target: NuligaMatchResultsTarget
): Promise<ParsedNuligaMatchResult[]> {
  const triedUrls = new Set<string>();

  const tryParseUrl = async (
    url: string | null | undefined
  ): Promise<{ ok: boolean; results: ParsedNuligaMatchResult[] }> => {
    if (!url || !isAllowedNuligaUrl(url) || triedUrls.has(url)) {
      return { ok: false, results: [] };
    }
    triedUrls.add(url);
    try {
      const html = await fetchText(url);
      const parsed = parseNuligaMatchResultsHtml(html);
      if (parsed.hasScheduleTable) {
        return { ok: true, results: parsed.results };
      }
    } catch {
      // Best-effort: nächste Fallback-Quelle probieren
    }
    return { ok: false, results: [] };
  };

  // 1. Direkte teamPortrait-URL (mit teamtable-Parameter)
  if (target.teamUrl && target.teamUrl.includes("teamtable=")) {
    const res = await tryParseUrl(target.teamUrl);
    if (res.ok) return res.results;
  }

  // 2. Gesamt-Spielplan der Staffel (Vorrunde + Rückrunde)
  const meetingsUrl =
    (target.groupUrl ? deriveNuligaGroupMeetingsUrl(target.groupUrl) : null) ??
    (target.teamUrl ? deriveNuligaGroupMeetingsUrl(target.teamUrl) : null);
  if (meetingsUrl) {
    const res = await tryParseUrl(meetingsUrl);
    if (res.ok) return res.results;
  }

  // 3. Fallback: direkte groupUrl falls ohne championship/group-Parameter
  if (target.groupUrl && target.groupUrl.includes("groupPage")) {
    const res = await tryParseUrl(target.groupUrl);
    if (res.ok) return res.results;
  }

  // 4. Fallback über Vereinssuche (hilft z. B. bei reinen nuLiga-iCal-Quellen ohne leagueGroupTeamId)
  const baseCandidate =
    target.groupUrl ?? target.teamUrl ?? target.fallbackNuligaUrl ?? null;
  const clubQuery = (target.clubName ?? target.teamName ?? "").trim();
  const groupName = (target.groupName ?? "").trim();

  if (baseCandidate && isAllowedNuligaUrl(baseCandidate) && clubQuery && groupName) {
    try {
      const parsedBaseUrl = new URL(baseCandidate);
      const base = new URL(".", parsedBaseUrl);
      const federation =
        parsedBaseUrl.hostname.split("-")[0]?.toUpperCase() || "HVNB";
      const searchTerm = (clubQuery.split("/")[0] ?? "")
        .replace(/\([^)]*\)/g, "")
        .trim();
      if (searchTerm.length >= 2) {
        const searchUrl = new URL(
          `clubSearch?federation=${encodeURIComponent(federation)}&searchFor=${encodeURIComponent(searchTerm)}`,
          base
        ).toString();
        const searchHtml = await fetchText(searchUrl);
        const clubLink = pickLinkByName(
          findLinks(searchHtml, "clubInfoDisplay"),
          clubQuery
        );
        const clubId = clubLink?.href.match(/club=(\d+)/)?.[1];
        if (clubId) {
          const teamsHtml = await fetchText(
            new URL(`clubTeams?club=${clubId}`, base).toString()
          );
          const groupLink = pickGroupLinkFromClubTeams(teamsHtml, groupName);
          if (groupLink) {
            const absGroupUrl = new URL(groupLink.href, base).toString();
            const derived =
              deriveNuligaGroupMeetingsUrl(absGroupUrl) ?? absGroupUrl;
            const res = await tryParseUrl(derived);
            if (res.ok) return res.results;
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  return [];
}

export interface MatchLookupCriteria {
  startAt: Date;
  isHome: boolean;
  opponentName: string;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  teamNameMatch?: string | null;
  matchNumber?: string | null;
}

function teamsAlignWithResult(
  result: ParsedNuligaMatchResult,
  match: MatchLookupCriteria
): boolean {
  if (match.homeTeamName && match.awayTeamName) {
    return (
      teamNamesMatch(result.homeTeam, match.homeTeamName) &&
      teamNamesMatch(result.awayTeam, match.awayTeamName)
    );
  }

  if (match.teamNameMatch) {
    if (match.isHome) {
      return (
        teamNamesMatch(result.homeTeam, match.teamNameMatch) &&
        teamNamesMatch(result.awayTeam, match.opponentName)
      );
    }
    return (
      teamNamesMatch(result.awayTeam, match.teamNameMatch) &&
      teamNamesMatch(result.homeTeam, match.opponentName)
    );
  }

  return match.isHome
    ? teamNamesMatch(result.awayTeam, match.opponentName)
    : teamNamesMatch(result.homeTeam, match.opponentName);
}

/**
 * Ordnet ein geparstes nuLiga-Ergebnis einem Spieltermin zu.
 * Bevorzugt exakte Übereinstimmung über Begegnungs-Nr. + Paarung,
 * sonst über das deutsche Spieldatum (`Europe/Berlin`) + Heim/Auswärts-Paarung.
 */
export function findMatchingNuligaResult(
  results: ParsedNuligaMatchResult[],
  match: MatchLookupCriteria
): ParsedNuligaMatchResult | null {
  if (results.length === 0) return null;

  if (match.matchNumber) {
    const byNumber = results.find(
      (r) =>
        r.matchNumber === match.matchNumber && teamsAlignWithResult(r, match)
    );
    if (byNumber) return byNumber;
  }

  const dateKey = toBerlinDateKey(match.startAt);
  const byDateAndTeams = results.find(
    (r) => r.dateKey === dateKey && teamsAlignWithResult(r, match)
  );
  if (byDateAndTeams) return byDateAndTeams;

  return null;
}
