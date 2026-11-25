import { FetchTextFn } from "../adapters/league-provider";
import type { ThreatLevel } from "../schemas/scouting";

export interface NuligaOpponentPlayerCandidate {
  externalPlayerId: string | null;
  name: string;
  jerseyNumber: number | null;
  goalsTotal: number | null;
  gamesPlayed: number | null;
  goalsPerGame: number | null;
  sevenMeterGoals: number | null;
  sevenMeterAttempts: number | null;
  isSevenMeterShooter: boolean;
  suggestedThreatLevel: ThreatLevel;
  sourceMatchesAnalyzed: number;
}

export interface NuligaOpponentFetchTarget {
  opponentName: string;
  clubName?: string | null;
  groupUrl?: string | null;
  teamUrl?: string | null;
  maxMatchReports?: number;
}

export interface NuligaOpponentFetchResult {
  resolvedTeamUrl: string | null;
  resolvedGroupUrl: string | null;
  players: NuligaOpponentPlayerCandidate[];
  reportsAnalyzed: number;
  statisticsAvailable: boolean;
  anonymizedDetected: boolean;
  warning: string | null;
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
  "&auml;": "ä",
  "&ouml;": "ö",
  "&uuml;": "ü",
  "&Auml;": "Ä",
  "&Ouml;": "Ö",
  "&Uuml;": "Ü",
  "&szlig;": "ß",
  "&ndash;": "–",
  "&mdash;": "—",
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(
      /&(?:amp|quot|#39|apos|nbsp|lt|gt|auml|ouml|uuml|Auml|Ouml|Uuml|szlig|ndash|mdash);/g,
      (m) => ENTITY_MAP[m] ?? m
    )
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    });
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeCompareText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prüft, ob eine URL eine zulässige nuLiga-URL (*.liga.nu über https) ist.
 */
export function isAllowedNuligaUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      /(^|\.)liga\.nu$/i.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Formatiert nuLiga-Spielernamen ("Dreyer, Noah") zu "Noah Dreyer".
 */
export function formatPlayerDisplayName(rawName: string): string {
  const cleaned = rawName.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const commaIdx = cleaned.indexOf(",");
  if (commaIdx === -1) return cleaned;
  const last = cleaned.slice(0, commaIdx).trim();
  const first = cleaned.slice(commaIdx + 1).trim();
  if (!first) return last;
  if (!last) return first;
  return `${first} ${last}`;
}

/**
 * Erzeugt einen stabilen Vergleichsschlüssel für Spielernamen unabhängig von
 * "Nachname, Vorname" vs. "Vorname Nachname".
 */
export function normalizePlayerNameKey(name: string): string {
  const formatted = formatPlayerDisplayName(name);
  return normalizeCompareText(formatted)
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

const ANONYMIZED_NAME_PATTERN =
  /^(?:-+|n\.?\s*n\.?|anonym(?:isiert)?|unbekannt|spieler(?:in)?\s*\d*|nicht\s+genannt|gesperrt|\*+)$/i;

export function isAnonymizedPlayerName(rawName: string): boolean {
  const cleaned = rawName.replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return true;
  return ANONYMIZED_NAME_PATTERN.test(cleaned);
}

/**
 * Prüft, ob ein Vereins-/Mannschaftsname aus nuLiga zum gesuchten Gegner passt.
 */
export function teamNamesMatch(candidate: string, target: string): boolean {
  const c = normalizeCompareText(candidate);
  const t = normalizeCompareText(target);
  if (!c || !t) return false;
  if (c === t) return true;
  // Römische/arabische Mannschaftsnummern am Ende (z. B. "II", "2") nur beim exakten Suffix-Abgleich beachten,
  // für Vereins-Spalte in groupMeetingStatistics steht oft nur der Vereinsname ohne "2".
  const stripTrailingTeamNum = (s: string) =>
    s.replace(/\s+(?:i{1,3}|iv|v|\d+)$/i, "").trim();
  const cBase = stripTrailingTeamNum(c);
  const tBase = stripTrailingTeamNum(t);
  if (cBase && tBase && (cBase === tBase || cBase.includes(tBase) || tBase.includes(cBase))) {
    return true;
  }
  return c.includes(t) || t.includes(c);
}

export function suggestThreatLevel(
  goalsPerGame: number | null,
  goalsTotal: number | null,
  isSevenMeterShooter: boolean
): ThreatLevel {
  if (goalsPerGame !== null) {
    if (goalsPerGame >= 4.0) return "HIGH";
    if (goalsPerGame >= 2.0 || isSevenMeterShooter) return "MEDIUM";
    return "LOW";
  }
  if (goalsTotal !== null) {
    if (goalsTotal >= 5) return "HIGH";
    if (goalsTotal >= 2 || isSevenMeterShooter) return "MEDIUM";
  }
  return isSevenMeterShooter ? "MEDIUM" : "LOW";
}

function parseIntSafe(value: string): number | null {
  const cleaned = value.trim();
  if (!/^\d+$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 10);
}

function parseDecimalSafe(value: string): number | null {
  const cleaned = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function extractPersonId(cellHtml: string): string | null {
  return cellHtml.match(/person=(\d+)/i)?.[1] ?? null;
}

function extractTablesByClass(html: string, className: string): string[] {
  const pattern = new RegExp(
    `<table\\b[^>]*class\\s*=\\s*["'][^"']*\\b${className}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/table>`,
    "gi"
  );
  return [...html.matchAll(pattern)].map((m) => m[0]);
}

function extractCells(rowHtml: string): string[] {
  return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
    (m) => m[1]
  );
}

export interface ParsedGoalStatRow {
  personId: string | null;
  rawName: string;
  clubName: string;
  goals: number;
  games: number | null;
  goalsPerGame: number | null;
}

export function parsePlayerGoalsHtml(html: string): {
  rows: ParsedGoalStatRow[];
  anonymizedCount: number;
} {
  const tables = extractTablesByClass(html, "result-set");
  const rows: ParsedGoalStatRow[] = [];
  let anonymizedCount = 0;

  for (const table of tables) {
    const trs = table.split(/<tr\b[^>]*>/i).slice(1);
    for (const tr of trs) {
      const cells = extractCells(tr);
      if (cells.length < 5) continue;
      const rawName = stripTags(cells[1]);
      if (isAnonymizedPlayerName(rawName)) {
        if (rawName.length > 0) anonymizedCount += 1;
        continue;
      }
      const clubName = stripTags(cells[2]);
      const goals = parseIntSafe(stripTags(cells[3]));
      if (goals === null) continue;
      const games = parseIntSafe(stripTags(cells[4]));
      const goalsPerGame =
        cells.length >= 6
          ? parseDecimalSafe(stripTags(cells[5]))
          : games && games > 0
            ? Math.round((goals / games) * 100) / 100
            : null;
      rows.push({
        personId: extractPersonId(cells[1]),
        rawName,
        clubName,
        goals,
        games,
        goalsPerGame,
      });
    }
  }

  return { rows, anonymizedCount };
}

export interface ParsedSevenMeterStatRow {
  personId: string | null;
  rawName: string;
  clubName: string;
  sevenMeterGoals: number;
  sevenMeterAttempts: number | null;
}

export function parseSevenMeterGoalsHtml(html: string): {
  rows: ParsedSevenMeterStatRow[];
  anonymizedCount: number;
} {
  const tables = extractTablesByClass(html, "result-set");
  const rows: ParsedSevenMeterStatRow[] = [];
  let anonymizedCount = 0;

  for (const table of tables) {
    const trs = table.split(/<tr\b[^>]*>/i).slice(1);
    for (const tr of trs) {
      const cells = extractCells(tr);
      if (cells.length < 5) continue;
      const rawName = stripTags(cells[1]);
      if (isAnonymizedPlayerName(rawName)) {
        if (rawName.length > 0) anonymizedCount += 1;
        continue;
      }
      const clubName = stripTags(cells[2]);
      const sevenMeterGoals = parseIntSafe(stripTags(cells[3]));
      if (sevenMeterGoals === null) continue;
      const sevenMeterAttempts = parseIntSafe(stripTags(cells[4]));
      rows.push({
        personId: extractPersonId(cells[1]),
        rawName,
        clubName,
        sevenMeterGoals,
        sevenMeterAttempts,
      });
    }
  }

  return { rows, anonymizedCount };
}

export interface ParsedMeetingReportPlayer {
  personId: string | null;
  rawName: string;
  jerseyNumber: number | null;
  goals: number;
  sevenMeterGoals: number;
  sevenMeterAttempts: number;
}

export function parseMeetingReportTeamRosterHtml(
  html: string,
  targetTeamName: string,
  fallbackClubName?: string | null
): {
  players: ParsedMeetingReportPlayer[];
  anonymizedCount: number;
  matchedSection: boolean;
} {
  const sectionPattern =
    /<h2\b[^>]*>([\s\S]*?)<\/h2>\s*<table\b[^>]*class\s*=\s*["'][^"']*\bresult-set\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/gi;

  let matchedTable: string | null = null;
  for (const match of html.matchAll(sectionPattern)) {
    const heading = stripTags(match[1]);
    if (
      teamNamesMatch(heading, targetTeamName) ||
      (fallbackClubName && teamNamesMatch(heading, fallbackClubName))
    ) {
      matchedTable = match[2];
      break;
    }
  }

  if (!matchedTable) {
    return { players: [], anonymizedCount: 0, matchedSection: false };
  }

  const players: ParsedMeetingReportPlayer[] = [];
  let anonymizedCount = 0;

  const trs = matchedTable.split(/<tr\b[^>]*>/i).slice(1);
  for (const tr of trs) {
    const cells = extractCells(tr);
    if (cells.length < 6) continue;

    const jerseyText = stripTags(cells[0]);
    // Offizielle (A, B, C, D) überspringen
    if (/^[A-Za-z]$/.test(jerseyText)) continue;
    const jerseyNumber = parseIntSafe(jerseyText);
    if (jerseyNumber !== null && (jerseyNumber < 1 || jerseyNumber > 99)) {
      continue;
    }

    const rawName = stripTags(cells[1]);
    if (isAnonymizedPlayerName(rawName)) {
      if (rawName.length > 0) anonymizedCount += 1;
      continue;
    }

    const goals = parseIntSafe(stripTags(cells[4])) ?? 0;
    const sevenMText = stripTags(cells[5]);
    let sevenMeterGoals = 0;
    let sevenMeterAttempts = 0;
    const sevenMMatch = sevenMText.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (sevenMMatch) {
      sevenMeterGoals = Number.parseInt(sevenMMatch[1], 10);
      sevenMeterAttempts = Number.parseInt(sevenMMatch[2], 10);
    } else {
      const single = parseIntSafe(sevenMText);
      if (single !== null) {
        sevenMeterGoals = single;
        sevenMeterAttempts = single;
      }
    }

    players.push({
      personId: extractPersonId(cells[1]),
      rawName,
      jerseyNumber,
      goals,
      sevenMeterGoals,
      sevenMeterAttempts,
    });
  }

  return { players, anonymizedCount, matchedSection: true };
}

export function extractMeetingReportUrls(
  html: string,
  baseUrl: string,
  limit = 4
): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  const pattern = /<a\b[^>]*href="([^"]*groupMeetingReport[^"]*)"/gi;
  for (const match of html.matchAll(pattern)) {
    const href = decodeHtmlEntities(match[1]);
    try {
      const abs = new URL(href, baseUrl).toString();
      if (!seen.has(abs)) {
        seen.add(abs);
        urls.push(abs);
      }
    } catch {
      // Ungültige relative URL ignorieren
    }
  }
  // Spielpläne stehen chronologisch; die letzten gespielten Partien haben die aktuellsten Trikotnummern.
  return urls.slice(-limit).reverse();
}

export function deriveGroupStatisticsUrls(sourceUrl: string): {
  groupUrl: string;
  playerGoalsUrl: string;
  sevenMeterUrl: string;
} | null {
  if (!isAllowedNuligaUrl(sourceUrl)) return null;
  const parsed = new URL(sourceUrl);
  const championship = parsed.searchParams.get("championship");
  const group = parsed.searchParams.get("group");
  if (!championship || !group) return null;

  const base = new URL(".", parsed);
  const groupUrl = new URL("groupPage", base);
  groupUrl.searchParams.set("championship", championship);
  groupUrl.searchParams.set("group", group);

  const playerGoalsUrl = new URL("groupMeetingStatistics", base);
  playerGoalsUrl.searchParams.set("displayType", "playerGoals");
  playerGoalsUrl.searchParams.set("championship", championship);
  playerGoalsUrl.searchParams.set("group", group);

  const sevenMeterUrl = new URL("groupMeetingStatistics", base);
  sevenMeterUrl.searchParams.set("displayType", "playerSevenMeterGoals");
  sevenMeterUrl.searchParams.set("championship", championship);
  sevenMeterUrl.searchParams.set("group", group);

  return {
    groupUrl: groupUrl.toString(),
    playerGoalsUrl: playerGoalsUrl.toString(),
    sevenMeterUrl: sevenMeterUrl.toString(),
  };
}

function findTeamPortraitUrlInGroupHtml(
  groupHtml: string,
  groupUrl: string,
  opponentName: string,
  clubName?: string | null
): string | null {
  const pattern = /<a\b[^>]*href="([^"]*teamPortrait[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of groupHtml.matchAll(pattern)) {
    const text = stripTags(match[2]);
    if (
      teamNamesMatch(text, opponentName) ||
      (clubName && teamNamesMatch(text, clubName))
    ) {
      return new URL(decodeHtmlEntities(match[1]), groupUrl).toString();
    }
  }
  return null;
}

interface MergedPlayerAccumulator {
  externalPlayerId: string | null;
  name: string;
  jerseyCounts: Map<number, number>;
  goalsTotal: number | null;
  gamesPlayed: number | null;
  goalsPerGame: number | null;
  sevenMeterGoals: number | null;
  sevenMeterAttempts: number | null;
  reportMatches: number;
  reportGoals: number;
  reportSevenMeterGoals: number;
  reportSevenMeterAttempts: number;
}

function pickMostFrequentJersey(counts: Map<number, number>): number | null {
  let bestNum: number | null = null;
  let bestCount = -1;
  for (const [num, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestNum = num;
    }
  }
  return bestNum;
}

/**
 * Lädt gegnerische Spielerdaten (Torschützen, 7m-Schützen & Trikotnummern aus Spielberichten)
 * direkt aus nuLiga und führt sie zu einer deduplizierten Vorschlagsliste zusammen.
 */
export async function fetchNuligaOpponentPlayers(
  fetchText: FetchTextFn,
  target: NuligaOpponentFetchTarget
): Promise<NuligaOpponentFetchResult> {
  const maxReports = target.maxMatchReports ?? 4;
  let resolvedTeamUrl =
    target.teamUrl && isAllowedNuligaUrl(target.teamUrl) ? target.teamUrl : null;
  let resolvedGroupUrl =
    target.groupUrl && isAllowedNuligaUrl(target.groupUrl) ? target.groupUrl : null;

  const statsUrls =
    (resolvedGroupUrl ? deriveGroupStatisticsUrls(resolvedGroupUrl) : null) ??
    (resolvedTeamUrl ? deriveGroupStatisticsUrls(resolvedTeamUrl) : null);

  if (!resolvedGroupUrl && statsUrls) {
    resolvedGroupUrl = statsUrls.groupUrl;
  }

  // Falls wir eine Staffelseite haben, aber noch keine Mannschaftsseite, lösen wir sie auf.
  if (!resolvedTeamUrl && resolvedGroupUrl) {
    try {
      const groupHtml = await fetchText(resolvedGroupUrl);
      resolvedTeamUrl = findTeamPortraitUrlInGroupHtml(
        groupHtml,
        resolvedGroupUrl,
        target.opponentName,
        target.clubName
      );
    } catch {
      // Best-effort: Statistiken können trotzdem geladen werden.
    }
  }

  if (!resolvedTeamUrl && !statsUrls) {
    return {
      resolvedTeamUrl: null,
      resolvedGroupUrl: null,
      players: [],
      reportsAnalyzed: 0,
      statisticsAvailable: false,
      anonymizedDetected: false,
      warning:
        "Keine gültige nuLiga-URL für diesen Gegner gefunden. Bitte eine nuLiga-Mannschafts- oder Staffelseite (https://...liga.nu/...) angeben.",
    };
  }

  const accByKey = new Map<string, MergedPlayerAccumulator>();
  const keyByName = new Map<string, string>();

  const getOrCreate = (
    personId: string | null,
    rawName: string
  ): MergedPlayerAccumulator => {
    const displayName = formatPlayerDisplayName(rawName);
    const nameKey = normalizePlayerNameKey(displayName);
    const existingKey =
      (personId && accByKey.has(`p:${personId}`) ? `p:${personId}` : null) ??
      keyByName.get(nameKey) ??
      null;

    if (existingKey) {
      const existing = accByKey.get(existingKey)!;
      if (personId && !existing.externalPlayerId) {
        existing.externalPlayerId = personId;
        accByKey.set(`p:${personId}`, existing);
      }
      return existing;
    }

    const key = personId ? `p:${personId}` : `n:${nameKey}`;
    const created: MergedPlayerAccumulator = {
      externalPlayerId: personId,
      name: displayName,
      jerseyCounts: new Map(),
      goalsTotal: null,
      gamesPlayed: null,
      goalsPerGame: null,
      sevenMeterGoals: null,
      sevenMeterAttempts: null,
      reportMatches: 0,
      reportGoals: 0,
      reportSevenMeterGoals: 0,
      reportSevenMeterAttempts: 0,
    };
    accByKey.set(key, created);
    keyByName.set(nameKey, key);
    return created;
  };

  let anonymizedCount = 0;
  let statisticsAvailable = false;

  // 1. Staffel-Statistiken (Tore & 7m-Tore) parallel abrufen
  if (statsUrls) {
    const [goalsResult, sevenMResult] = await Promise.allSettled([
      fetchText(statsUrls.playerGoalsUrl),
      fetchText(statsUrls.sevenMeterUrl),
    ]);

    if (goalsResult.status === "fulfilled") {
      const parsed = parsePlayerGoalsHtml(goalsResult.value);
      anonymizedCount += parsed.anonymizedCount;
      if (parsed.rows.length > 0) {
        statisticsAvailable = true;
      }
      for (const row of parsed.rows) {
        if (
          !teamNamesMatch(row.clubName, target.opponentName) &&
          !(target.clubName && teamNamesMatch(row.clubName, target.clubName))
        ) {
          continue;
        }
        const entry = getOrCreate(row.personId, row.rawName);
        entry.goalsTotal = row.goals;
        entry.gamesPlayed = row.games;
        entry.goalsPerGame = row.goalsPerGame;
      }
    }

    if (sevenMResult.status === "fulfilled") {
      const parsed = parseSevenMeterGoalsHtml(sevenMResult.value);
      anonymizedCount += parsed.anonymizedCount;
      for (const row of parsed.rows) {
        if (
          !teamNamesMatch(row.clubName, target.opponentName) &&
          !(target.clubName && teamNamesMatch(row.clubName, target.clubName))
        ) {
          continue;
        }
        const entry = getOrCreate(row.personId, row.rawName);
        entry.sevenMeterGoals = row.sevenMeterGoals;
        entry.sevenMeterAttempts = row.sevenMeterAttempts;
      }
    }
  }

  // 2. Mannschaftsseite & letzte Spielberichte für Trikotnummern & Komplett-Kader abrufen
  let reportsAnalyzed = 0;
  if (resolvedTeamUrl) {
    try {
      const portraitHtml = await fetchText(resolvedTeamUrl);
      const reportUrls = extractMeetingReportUrls(
        portraitHtml,
        resolvedTeamUrl,
        maxReports
      );
      const reportResults = await Promise.allSettled(
        reportUrls.map((url) => fetchText(url))
      );

      for (const res of reportResults) {
        if (res.status !== "fulfilled") continue;
        const parsed = parseMeetingReportTeamRosterHtml(
          res.value,
          target.opponentName,
          target.clubName
        );
        if (!parsed.matchedSection) continue;
        reportsAnalyzed += 1;
        anonymizedCount += parsed.anonymizedCount;

        for (const p of parsed.players) {
          const entry = getOrCreate(p.personId, p.rawName);
          if (p.jerseyNumber !== null) {
            entry.jerseyCounts.set(
              p.jerseyNumber,
              (entry.jerseyCounts.get(p.jerseyNumber) ?? 0) + 1
            );
          }
          entry.reportMatches += 1;
          entry.reportGoals += p.goals;
          entry.reportSevenMeterGoals += p.sevenMeterGoals;
          entry.reportSevenMeterAttempts += p.sevenMeterAttempts;
        }
      }
    } catch {
      // Falls teamPortrait nicht erreichbar ist, liefern wir trotzdem ggf. die Statistikdaten.
    }
  }

  // Deduplizieren (accByKey kann wegen p:-Alias auf dasselbe Objekt zeigen)
  const uniquePlayers = Array.from(new Set(accByKey.values()));

  const players: NuligaOpponentPlayerCandidate[] = uniquePlayers
    .map((p) => {
      const goalsTotal = p.goalsTotal ?? (p.reportMatches > 0 ? p.reportGoals : null);
      const gamesPlayed = p.gamesPlayed ?? (p.reportMatches > 0 ? p.reportMatches : null);
      const goalsPerGame =
        p.goalsPerGame ??
        (goalsTotal !== null && gamesPlayed && gamesPlayed > 0
          ? Math.round((goalsTotal / gamesPlayed) * 100) / 100
          : null);
      const sevenMeterGoals =
        p.sevenMeterGoals ??
        (p.reportSevenMeterAttempts > 0 || p.reportSevenMeterGoals > 0
          ? p.reportSevenMeterGoals
          : null);
      const sevenMeterAttempts =
        p.sevenMeterAttempts ??
        (p.reportSevenMeterAttempts > 0 ? p.reportSevenMeterAttempts : null);
      const isSevenMeterShooter =
        (sevenMeterAttempts !== null && sevenMeterAttempts >= 2) ||
        (sevenMeterGoals !== null && sevenMeterGoals >= 1);

      return {
        externalPlayerId: p.externalPlayerId,
        name: p.name,
        jerseyNumber: pickMostFrequentJersey(p.jerseyCounts),
        goalsTotal,
        gamesPlayed,
        goalsPerGame,
        sevenMeterGoals,
        sevenMeterAttempts,
        isSevenMeterShooter,
        suggestedThreatLevel: suggestThreatLevel(
          goalsPerGame,
          goalsTotal,
          isSevenMeterShooter
        ),
        sourceMatchesAnalyzed: p.reportMatches,
      };
    })
    .sort((a, b) => {
      const goalsDiff = (b.goalsTotal ?? -1) - (a.goalsTotal ?? -1);
      if (goalsDiff !== 0) return goalsDiff;
      const numA = a.jerseyNumber ?? 999;
      const numB = b.jerseyNumber ?? 999;
      if (numA !== numB) return numA - numB;
      return a.name.localeCompare(b.name, "de");
    });

  const anonymizedDetected = anonymizedCount > 0;
  let warning: string | null = null;
  if (players.length === 0 && anonymizedDetected) {
    warning =
      "nuLiga blendet Spielernamen in dieser Staffel aus Datenschutzgründen (z. B. Jugendbereich) aus. Schlüsselspieler können weiterhin manuell erfasst werden.";
  } else if (players.length === 0) {
    warning =
      "Für diesen Gegner wurden in nuLiga aktuell noch keine Spielberichte oder Torschützenstatistiken gefunden.";
  } else if (anonymizedDetected) {
    warning =
      "Einzelne Spielernamen sind in nuLiga anonymisiert und wurden übersprungen.";
  }

  return {
    resolvedTeamUrl,
    resolvedGroupUrl,
    players,
    reportsAnalyzed,
    statisticsAvailable,
    anonymizedDetected,
    warning,
  };
}
