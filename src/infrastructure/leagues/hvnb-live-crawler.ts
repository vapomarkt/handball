import { TeamGender } from "@/domain/schemas/handball";
import { LeagueAgeGroup } from "@/domain/schemas/league-catalog";
import {
  buildFederationLeagueCode,
  CrawledDirectoryGroup as GenericCrawledDirectoryGroup,
  CrawledDirectoryTeam,
  crawlNuligaFederation,
  isImportableGroupName,
  NuligaChampionshipTarget,
  parseAgeGroupAndGender,
  parseLeagueLevel,
  parseNuligaGroupPage,
} from "./nuliga-live-crawler";

export type { CrawledDirectoryTeam };

export interface CrawledDirectoryGroup extends GenericCrawledDirectoryGroup {
  federationCode: "HVNB";
}

export type HvnbChampionship = NuligaChampionshipTarget;

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

export { isImportableGroupName, parseAgeGroupAndGender, parseLeagueLevel };

export function buildLeagueCode(
  ageGroup: LeagueAgeGroup,
  gender: TeamGender,
  name: string
): string | null {
  return buildFederationLeagueCode("DE", "HVNB", ageGroup, gender, name);
}

/** Liest die Mannschaften einer nuLiga-Staffelseite (Portrait-Links mit teamtable-ID). */
export function parseGroupPage(html: string): CrawledDirectoryTeam[] {
  return parseNuligaGroupPage(html, HVNB_LIGA_BASE);
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
  const { groups, failures } = await crawlNuligaFederation({
    federationCode: "HVNB",
    seasonName: "2026/27",
    fetchText,
    delayMs,
    championships,
    onProgress,
  });

  return {
    groups: groups as CrawledDirectoryGroup[],
    failures,
  };
}
