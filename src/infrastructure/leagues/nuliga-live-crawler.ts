import {
  FederationProviderConfig,
  formatNuligaSeasonSlug,
  getFederationConfig,
  renderChampionshipName,
} from "@/domain/data/federation-registry";
import { TeamGender } from "@/domain/schemas/handball";
import { LeagueAgeGroup } from "@/domain/schemas/league-catalog";

export interface CrawledDirectoryTeam {
  externalTeamId: string;
  externalClubId?: string | null;
  name: string;
  clubName: string;
  externalUrl: string;
}

export interface CrawledDirectoryGroup {
  code: string;
  countryCode: string;
  federationCode: string;
  regionCode: string;
  regionName: string;
  seasonName: string;
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
  name: string;
  externalGroupId: string;
  externalUrl: string;
  providerMeta?: Record<string, unknown>;
  teams: CrawledDirectoryTeam[];
}

export interface NuligaChampionshipTarget {
  code: string;
  championship: string;
  regionName: string;
}

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");

const cleanText = (value: string): string =>
  decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

function anchors(
  html: string,
  needle: string
): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  )) {
    if (!match[1].includes(needle)) continue;
    const text = cleanText(match[2]);
    if (!text) continue;
    out.push({ href: decodeHtml(match[1]), text });
  }
  return out;
}

/** Sammel-/Verwaltungsseiten ohne eigenen regulären Staffel-Spielbetrieb. */
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

/** Altersklasse und Geschlecht aus einem nuLiga-Staffelnamen ableiten (DE & AT). */
export function parseAgeGroupAndGender(name: string): {
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
} {
  const n = name.toLowerCase();

  const gender: TeamGender =
    /weiblich|\bwj[a-f]?\b|\bwu\d{2}\b|\bwha\b|\bdamen\b|\bfrauen\b/.test(n)
      ? "FEMALE"
      : /gemischt|\bgj[a-f]?\b|\bgu\d{2}\b/.test(n)
        ? "MIXED"
        : /\b(w|f)\s*$/.test(n.trim())
          ? "FEMALE"
          : "MALE";

  if (/mini/.test(n)) return { ageGroup: "YOUTH_F_MINI", gender: "MIXED" };
  if (/alte herren|senior|ü3\d|ü4\d/.test(n)) {
    return { ageGroup: "SENIOR", gender };
  }

  // Deutsche Jugend-Bezeichnungen (Jugend A–F, mJA, wJD, gJE)
  const jugend = n.match(/jugend\s+([a-f])\b/);
  const short = n.match(/\b([mwg])?j\s*([a-f])\b/);
  const letter = (jugend?.[1] ?? short?.[2])?.toUpperCase();
  if (letter) {
    return {
      ageGroup: (letter === "F"
        ? "YOUTH_F_MINI"
        : `YOUTH_${letter}`) as LeagueAgeGroup,
      gender,
    };
  }

  // Österreichische / europäische U-Altersklassen (U18/U19 -> A, U16/U17 -> B, U14/U15 -> C, U12/U13 -> D, U10/U11 -> E, U8/U9 -> F)
  const uMatch = n.match(/\b[mwg]?j?u(\d{1,2})\b/);
  if (uMatch) {
    const age = Number.parseInt(uMatch[1], 10);
    if (age >= 18) return { ageGroup: "YOUTH_A", gender };
    if (age >= 16) return { ageGroup: "YOUTH_B", gender };
    if (age >= 14) return { ageGroup: "YOUTH_C", gender };
    if (age >= 12) return { ageGroup: "YOUTH_D", gender };
    if (age >= 10) return { ageGroup: "YOUTH_E", gender };
    return { ageGroup: "YOUTH_F_MINI", gender: "MIXED" };
  }

  if (/männer|frauen|damen|herren|hla|wha/.test(n)) {
    return { ageGroup: "ADULT", gender };
  }

  return { ageGroup: "ADULT", gender };
}

/** Staffel-Ebene → Kürzel im Liga-Katalog (DE-Landesverbände & AT-ÖHB). */
export function parseLeagueLevel(
  name: string,
  countryCode = "DE"
): string | null {
  const n = name.toLowerCase();

  if (countryCode === "AT") {
    if (/\bhla\s*(?:meisterliga|1)\b/.test(n)) return "HLA1";
    if (/\bhla\s*(?:challenge|2)\b/.test(n)) return "HLA2";
    if (/\bwha\s*(?:meisterliga|1)\b/.test(n)) return "WHA1";
    if (/\bwha\s*(?:challenge|2)\b/.test(n)) return "WHA2";
    if (/elite|meisterliga/.test(n)) return "ELITE";
    if (/regionalliga/.test(n)) return "RL";
    if (/landesliga|landesmeisterschaft/.test(n)) return "LL";
    if (/bezirk|klasse|kreis/.test(n)) return "KL";
    return null;
  }

  if (/regionalliga/.test(n)) return "RL";
  if (/regionsoberliga/.test(n)) return "ROL";
  if (/regionsliga/.test(n)) return "RLG";
  if (/regionsklasse/.test(n)) return "RK";
  if (/bezirksoberliga|\bbol\b/.test(n)) return "BOL";
  if (/bezirksliga|\bbl\b/.test(n)) return "BL";
  if (/bezirksklasse|\bbk\b/.test(n)) return "BK";
  if (/oberliga|bayernliga/.test(n)) return "OL";
  if (/verbandsliga/.test(n)) return "VL";
  if (/landesliga/.test(n)) return "LL";
  if (/kreisliga|\bkl\b/.test(n)) return "KL";
  if (/kreisklasse|\bkk\b/.test(n)) return "KK";
  if (/anfänger/.test(n)) return "MINI_ANF";
  if (/fortgeschrittene/.test(n)) return "MINI_FORT";
  if (/alte herren|senior/.test(n)) return "SEN_LIGA";
  if (/inklusionsliga|five-a-side|hobby/.test(n)) return "HOBBY";
  return null;
}

export function buildFederationLeagueCode(
  countryCode: string,
  federationCode: string,
  ageGroup: LeagueAgeGroup,
  gender: TeamGender,
  name: string
): string | null {
  const level = parseLeagueLevel(name, countryCode);
  return level
    ? `${countryCode}-${federationCode}-${ageGroup}-${gender}-${level}`
    : null;
}

/** Liest die Mannschaften einer nuLiga-Staffelseite (Portrait-Links mit teamtable-ID). */
export function parseNuligaGroupPage(
  html: string,
  baseUrl: string
): CrawledDirectoryTeam[] {
  const teams = new Map<string, CrawledDirectoryTeam>();
  for (const link of anchors(html, "teamPortrait")) {
    const teamId = link.href.match(/teamtable=(\d+)/)?.[1];
    if (!teamId) continue;
    const absolute = new URL(link.href, baseUrl).toString();
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

function slugifyRegionCode(raw: string): string {
  const cleaned = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return cleaned.slice(0, 20) || "REG";
}

/**
 * Extrahiert Links zu untergeordneten Spielklassen (Bezirke/Kreise/Regionen)
 * direkt aus dem Block "Untergeordnete Spielklassen" einer nuLiga-`leaguePage`.
 */
export function parseSubChampionshipLinks(
  leaguePageHtml: string,
  rootChampionship: string
): NuligaChampionshipTarget[] {
  const subSectionMatch = leaguePageHtml.match(
    /Untergeordnete\s+Spielklassen[\s\S]*?(?:<h\d\b|<table\b|<\/div>\s*<\/div>|$)/i
  );
  const scope = subSectionMatch ? subSectionMatch[0] : "";
  if (!scope) return [];

  const seen = new Set<string>([rootChampionship.toLowerCase()]);
  const targets: NuligaChampionshipTarget[] = [];

  for (const link of anchors(scope, "leaguePage")) {
    let championship: string | null = null;
    try {
      const url = new URL(link.href, "https://example.liga.nu");
      championship = url.searchParams.get("championship")?.trim() ?? null;
    } catch {
      const m = link.href.match(/championship=([^&]+)/i);
      if (m) championship = decodeURIComponent(m[1].replace(/\+/g, " ")).trim();
    }
    if (!championship) continue;

    // Keine Pokal-/Freundschafts-/Quali-/Beach-Meisterschaften als reguläre Liga crawlen
    if (
      /\b(pokal|cup|quali|relegation|freundschaft|beach|turnier)\b/i.test(
        `${championship} ${link.text}`
      )
    ) {
      continue;
    }

    const key = championship.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    targets.push({
      code: slugifyRegionCode(link.text),
      championship,
      regionName: link.text,
    });
  }

  return targets;
}

export interface CrawlNuligaFederationOptions {
  federationCode: string;
  seasonName?: string;
  fetchText: (url: string) => Promise<string>;
  delayMs?: number;
  championships?: NuligaChampionshipTarget[];
  onProgress?: (done: number, total: number) => void;
}

export function buildGroupCode(
  countryCode: string,
  federationCode: string,
  seasonName: string,
  regionCode: string,
  groupId: string
): string {
  const seasonCompact = formatNuligaSeasonSlug(seasonName, "YY/YY").replace(
    /\//g,
    ""
  );
  // Bestehende HVNB-Codes beibehalten für 100 % Abwärtskompatibilität bestehender Verknüpfungen
  if (countryCode === "DE" && federationCode === "HVNB") {
    return `HVNB-${seasonCompact}-${regionCode}-${groupId}`;
  }
  return `${countryCode}-${federationCode}-${seasonCompact}-${regionCode}-${groupId}`;
}

export async function crawlNuligaFederation({
  federationCode,
  seasonName = "2026/27",
  fetchText,
  delayMs = 150,
  championships,
  onProgress,
}: CrawlNuligaFederationOptions): Promise<{
  federation: FederationProviderConfig;
  groups: CrawledDirectoryGroup[];
  failures: Array<{ url: string; reason: string }>;
}> {
  const fed = getFederationConfig(federationCode);
  if (!fed?.nuliga) {
    throw new Error(
      `Verband „${federationCode}“ hat keine aktive nuLiga-Konfiguration in der FederationRegistry.`
    );
  }

  const nu = fed.nuliga;
  const waBase = `${nu.baseUrl}/cgi-bin/WebObjects/${nu.webObjectsApp}/wa`;
  const failures: Array<{ url: string; reason: string }> = [];
  const groups: CrawledDirectoryGroup[] = [];
  const wait = () =>
    delayMs > 0
      ? new Promise((resolve) => setTimeout(resolve, delayMs))
      : Promise.resolve();

  const buildLeagueUrl = (championship: string) =>
    `${waBase}/leaguePage?championship=${encodeURIComponent(championship)}`;
  const buildGroupUrl = (championship: string, groupId: string) =>
    `${waBase}/groupPage?championship=${encodeURIComponent(championship)}&group=${groupId}`;

  // 1. Ziel-Championships bestimmen (explizit übergeben, bekannt oder per Auto-Discovery)
  const targetChampionships: NuligaChampionshipTarget[] = [];
  const prefetchedLeagueHtml = new Map<string, string>();

  if (championships && championships.length > 0) {
    targetChampionships.push(...championships);
  } else {
    const rootCandidates = [
      renderChampionshipName(
        nu.rootChampionshipTemplate,
        seasonName,
        nu.seasonSlugFormat
      ),
      ...(nu.altRootChampionshipTemplates ?? []).map((tpl) =>
        renderChampionshipName(tpl, seasonName, nu.seasonSlugFormat)
      ),
    ];

    let resolvedRootChampionship = rootCandidates[0];
    let rootHtml: string | null = null;

    for (const candidate of rootCandidates) {
      const candidateUrl = buildLeagueUrl(candidate);
      try {
        const html = await fetchText(candidateUrl);
        const hasGroups = anchors(html, "groupPage").length > 0;
        const hasSubs =
          parseSubChampionshipLinks(html, candidate).length > 0;
        if (hasGroups || hasSubs) {
          resolvedRootChampionship = candidate;
          rootHtml = html;
          prefetchedLeagueHtml.set(candidate, html);
          break;
        }
      } catch (err) {
        failures.push({ url: candidateUrl, reason: String(err) });
      }
    }

    targetChampionships.push({
      code: fed.federationCode,
      championship: resolvedRootChampionship,
      regionName: nu.rootRegionName,
    });

    if (nu.knownSubChampionships) {
      for (const sub of nu.knownSubChampionships) {
        targetChampionships.push({
          code: sub.code,
          championship: renderChampionshipName(
            sub.championshipTemplate,
            seasonName,
            nu.seasonSlugFormat
          ),
          regionName: sub.regionName,
        });
      }
    }

    if (nu.discoverSubChampionships && rootHtml) {
      const discovered = parseSubChampionshipLinks(
        rootHtml,
        resolvedRootChampionship
      );
      const existingChamps = new Set(
        targetChampionships.map((t) => t.championship.toLowerCase())
      );
      for (const d of discovered) {
        if (!existingChamps.has(d.championship.toLowerCase())) {
          existingChamps.add(d.championship.toLowerCase());
          targetChampionships.push(d);
        }
      }
    }
  }

  // 2. Staffeln & Mannschaften pro Championship crawlen
  for (const champ of targetChampionships) {
    const leagueUrl = buildLeagueUrl(champ.championship);
    let leagueHtml = prefetchedLeagueHtml.get(champ.championship);
    if (!leagueHtml) {
      try {
        leagueHtml = await fetchText(leagueUrl);
      } catch (err) {
        failures.push({ url: leagueUrl, reason: String(err) });
        continue;
      }
    }

    const groupLinks = new Map<string, string>();
    for (const link of anchors(leagueHtml, "groupPage")) {
      const groupId = link.href.match(/group=(\d+)/)?.[1];
      if (!groupId || !isImportableGroupName(link.text)) continue;
      if (!groupLinks.has(groupId)) groupLinks.set(groupId, link.text);
    }

    for (const [groupId, groupName] of groupLinks) {
      await wait();
      const groupUrl = buildGroupUrl(champ.championship, groupId);
      try {
        const html = await fetchText(groupUrl);
        const teams = parseNuligaGroupPage(html, nu.baseUrl);
        if (teams.length === 0) continue;
        const { ageGroup, gender } = parseAgeGroupAndGender(groupName);
        groups.push({
          code: buildGroupCode(
            fed.countryCode,
            fed.federationCode,
            seasonName,
            champ.code,
            groupId
          ),
          countryCode: fed.countryCode,
          federationCode: fed.federationCode,
          regionCode: champ.code,
          regionName: champ.regionName,
          seasonName,
          ageGroup,
          gender,
          name: groupName,
          externalGroupId: groupId,
          externalUrl: groupUrl,
          providerMeta: {
            championship: champ.championship,
            webObjectsApp: nu.webObjectsApp,
          },
          teams,
        });
      } catch (err) {
        failures.push({ url: groupUrl, reason: String(err) });
      }
      onProgress?.(groups.length, groups.length + failures.length);
    }
  }

  return { federation: fed, groups, failures };
}
