import { TeamGender } from "@/domain/schemas/handball";
import { LeagueAgeGroup } from "@/domain/schemas/league-catalog";

export interface CrawledDirectoryTeam {
  externalTeamId: string;
  name: string;
  clubName: string;
  externalUrl: string;
}

export interface CrawledDirectoryGroup {
  code: string;
  federationCode: "HVNB";
  regionCode: string;
  regionName: string;
  seasonName: string;
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
  name: string;
  externalGroupId: string;
  externalUrl: string;
  teams: CrawledDirectoryTeam[];
}

export interface HvnbChampionship {
  code: string;
  championship: string;
  regionName: string;
}

export const HVNB_SEASON_SLUG = "26/27";

/** Hauptwettbewerbe der Saison – ohne Pokal, Relegation, Freundschafts- und Beachturniere. */
export const HVNB_CHAMPIONSHIPS: HvnbChampionship[] = [
  { code: "HVNB", championship: `HVNB ${HVNB_SEASON_SLUG}`, regionName: "HVNB Verbandsebene" },
  { code: "HRBG", championship: `HRBG ${HVNB_SEASON_SLUG}`, regionName: "HR Braunschweig-Göttingen" },
  { code: "HRHWL", championship: `HR HWL ${HVNB_SEASON_SLUG}`, regionName: "HR Hannover-Weser-Leine" },
  { code: "HRBN", championship: `HRBN ${HVNB_SEASON_SLUG}`, regionName: "HR Bremen-Nordsee" },
  { code: "HRLS", championship: `HRLS ${HVNB_SEASON_SLUG}`, regionName: "HR Lüneburg-Stade" },
  { code: "HRWN", championship: `HRWN ${HVNB_SEASON_SLUG}`, regionName: "HR West Niedersachsen" },
];

export const HVNB_LIGA_BASE = "https://hvnb-handball.liga.nu";

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

const cleanText = (value: string): string =>
  decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

function anchors(html: string, needle: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!match[1].includes(needle)) continue;
    const text = cleanText(match[2]);
    if (!text) continue;
    out.push({ href: decodeHtml(match[1]), text });
  }
  return out;
}

/** Sammel-/Verwaltungsseiten ohne eigenen Spielbetrieb. */
const JUNK_GROUP = /^(\.|\d{1,2}\.\d{1,2}\.\d{4})$/;
const JUNK_GROUP_PREFIX = /^(Nachmeldungen|Teilnehmer|Final4)\b/i;
const JUNK_GROUP_PART = /\bMeldungen\b|Five-a-[Ss]ide|^Bremen-Pokal/i;
const REGION_ONLY = /^[A-ZÄÖÜ]{2,4}(-[A-ZÄÖÜ]{2,4})+$/;

export function isImportableGroupName(name: string): boolean {
  return (
    !JUNK_GROUP.test(name) &&
    !JUNK_GROUP_PREFIX.test(name) &&
    !JUNK_GROUP_PART.test(name) &&
    !REGION_ONLY.test(name)
  );
}

/** Altersklasse und Geschlecht aus einem nuLiga-Staffelnamen ableiten. */
export function parseAgeGroupAndGender(name: string): {
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
} {
  const n = name.toLowerCase();

  const gender: TeamGender =
    /weiblich|\bwj[a-f]?\b|\bdamen\b|\bfrauen\b/.test(n)
      ? "FEMALE"
      : /gemischt|\bgj[a-f]?\b/.test(n)
        ? "MIXED"
        : /\b(w|f)\s*$/.test(n.trim())
          ? "FEMALE"
          : "MALE";

  if (/mini/.test(n)) return { ageGroup: "YOUTH_F_MINI", gender: "MIXED" };
  if (/alte herren|senior/.test(n)) return { ageGroup: "SENIOR", gender };

  const jugend = n.match(/jugend\s+([a-f])\b/);
  const short = n.match(/\b([mwg])?j\s*([a-f])\b/);
  const letter = (jugend?.[1] ?? short?.[2])?.toUpperCase();
  if (letter) {
    return {
      ageGroup: `YOUTH_${letter}` as LeagueAgeGroup,
      gender,
    };
  }

  if (/männer|frauen|damen|herren/.test(n)) {
    return { ageGroup: "ADULT", gender };
  }

  return { ageGroup: "ADULT", gender };
}

/** Staffel-Ebene → Kürzel im deutschen Liga-Katalog (z. B. `ROL`). */
export function parseLeagueLevel(name: string): string | null {
  const n = name.toLowerCase();
  if (/regionalliga/.test(n)) return "RL";
  if (/regionsoberliga/.test(n)) return "ROL";
  if (/regionsliga/.test(n)) return "RLG";
  if (/regionsklasse/.test(n)) return "RK";
  if (/oberliga/.test(n)) return "OL";
  if (/verbandsliga/.test(n)) return "VL";
  if (/landesliga/.test(n)) return "LL";
  if (/anfänger/.test(n)) return "MINI_ANF";
  if (/fortgeschrittene/.test(n)) return "MINI_FORT";
  if (/alte herren|senior/.test(n)) return "SEN_LIGA";
  if (/inklusionsliga|five-a-side|hobby/.test(n)) return "HOBBY";
  return null;
}

export function buildLeagueCode(
  ageGroup: LeagueAgeGroup,
  gender: TeamGender,
  name: string
): string | null {
  const level = parseLeagueLevel(name);
  return level ? `DE-HVNB-${ageGroup}-${gender}-${level}` : null;
}

/** Liest die Mannschaften einer nuLiga-Staffelseite (Portrait-Links mit teamtable-ID). */
export function parseGroupPage(html: string): CrawledDirectoryTeam[] {
  const teams = new Map<string, CrawledDirectoryTeam>();
  for (const link of anchors(html, "teamPortrait")) {
    const teamId = link.href.match(/teamtable=(\d+)/)?.[1];
    if (!teamId) continue;
    const absolute = new URL(link.href, HVNB_LIGA_BASE).toString();
    if (!teams.has(teamId)) {
      teams.set(teamId, {
        externalTeamId: teamId,
        name: link.text,
        clubName: link.text,
        externalUrl: absolute,
      });
    }
  }
  return [...teams.values()];
}

export interface CrawlOptions {
  fetchText: (url: string) => Promise<string>;
  delayMs?: number;
  championships?: HvnbChampionship[];
  onProgress?: (done: number, total: number) => void;
}

/** Liest alle Staffeln und Mannschaften der HVNB-Hauptwettbewerbe aus nuLiga. */
export async function crawlHvnbDirectory({
  fetchText,
  delayMs = 120,
  championships = HVNB_CHAMPIONSHIPS,
  onProgress,
}: CrawlOptions): Promise<{
  groups: CrawledDirectoryGroup[];
  failures: Array<{ url: string; reason: string }>;
}> {
  const failures: Array<{ url: string; reason: string }> = [];
  const groups: CrawledDirectoryGroup[] = [];

  const wait = () => new Promise((resolve) => setTimeout(resolve, delayMs));

  for (const champ of championships) {
    const leagueUrl = `${HVNB_LIGA_BASE}/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=${encodeURIComponent(champ.championship)}`;
    let leagueHtml: string;
    try {
      leagueHtml = await fetchText(leagueUrl);
    } catch (err) {
      failures.push({ url: leagueUrl, reason: String(err) });
      continue;
    }

    const groupLinks = new Map<string, string>();
    for (const link of anchors(leagueHtml, "groupPage")) {
      const groupId = link.href.match(/group=(\d+)/)?.[1];
      if (!groupId || !isImportableGroupName(link.text)) continue;
      if (!groupLinks.has(groupId)) groupLinks.set(groupId, link.text);
    }

    for (const [groupId, groupName] of groupLinks) {
      await wait();
      const groupUrl = `${HVNB_LIGA_BASE}/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=${encodeURIComponent(champ.championship)}&group=${groupId}`;
      try {
        const html = await fetchText(groupUrl);
        const teams = parseGroupPage(html);
        if (teams.length === 0) continue;
        const { ageGroup, gender } = parseAgeGroupAndGender(groupName);
        groups.push({
          code: `HVNB-2627-${champ.code}-${groupId}`,
          federationCode: "HVNB",
          regionCode: champ.code,
          regionName: champ.regionName,
          seasonName: "2026/27",
          ageGroup,
          gender,
          name: groupName,
          externalGroupId: groupId,
          externalUrl: groupUrl,
          teams: teams,
        });
      } catch (err) {
        failures.push({ url: groupUrl, reason: String(err) });
      }
      onProgress?.(groups.length, groups.length + failures.length);
    }
  }

  return { groups, failures };
}
