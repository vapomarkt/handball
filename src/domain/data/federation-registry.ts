import { LeagueProviderType } from "../schemas/league";

export type DirectorySyncMode =
  | "NIGHTLY_CRAWL"
  | "ON_DEMAND_CACHE"
  | "HYBRID"
  | "NONE";

export type NuligaSeasonSlugFormat = "YY/YY" | "YYYY/YY";

export interface CountryRegistryEntry {
  /** ISO-3166-1 Alpha-2 Ländercode (z. B. "DE", "AT", "CH"). */
  code: string;
  /** Anzeigename (Default-Sprache). */
  name: string;
  /** Eigenname im Land (für künftige i18n-Länderwahl). */
  nativeName: string;
  /** Standard-BCP-47-Locale (z. B. "de-DE", "de-AT"). */
  defaultLocale: string;
  /** Unterstützte Locales für dieses Land. */
  supportedLocales: readonly string[];
  /** IANA-Zeitzone für lokale Spieldaten/Anwurfzeiten. */
  timezone: string;
  /** Aktiv im produktiven Liga- & Verzeichnis-Onboarding. */
  isActive: boolean;
}

export interface NuligaSubChampionshipConfig {
  code: string;
  /** Platzhalter `{season}` wird durch das formatierte Saison-Kürzel ersetzt. */
  championshipTemplate: string;
  regionName: string;
}

export interface NuligaFederationConfig {
  baseUrl: string;
  webObjectsApp: "nuLigaHBDE.woa" | "nuLigaHBAT.woa";
  /** Wert für den `federation`-Parameter bei `clubSearch`. */
  federationParam: string;
  seasonSlugFormat: NuligaSeasonSlugFormat;
  /** Haupt-Meisterschaft auf Verbandsebene, z. B. "BHV {season}". */
  rootChampionshipTemplate: string;
  /** Optionale Fallback-Templates, falls der Verband das Namensschema variiert. */
  altRootChampionshipTemplates?: readonly string[];
  /** Name der Verbandsebene im Verzeichnis. */
  rootRegionName: string;
  /** Wenn true, liest der Crawler Links unter "Untergeordnete Spielklassen" automatisch mit. */
  discoverSubChampionships: boolean;
  /** Explizit bekannte Unterregionen (z. B. HVNB-Handballregionen). */
  knownSubChampionships?: readonly NuligaSubChampionshipConfig[];
}

export interface Handball360FederationConfig {
  portalBaseUrl: string;
  hubBaseUrl: string;
  federationSlug: string;
  /** Kennzeichnet, ob der Verband bereits in Saison 2026/27 produktiv auf Handball360 spielt. */
  isLiveInSeason2627: boolean;
}

export interface FederationProviderConfig {
  countryCode: string;
  federationCode: string;
  name: string;
  shortLabel: string;
  regionLabel: string;
  isNational: boolean;
  locale: string;
  timezone: string;
  primaryProvider: LeagueProviderType | "MANUAL_ONLY";
  fallbackProviders: readonly LeagueProviderType[];
  directorySyncMode: DirectorySyncMode;
  plannedMigration?: {
    targetProvider: LeagueProviderType;
    targetSeason: string;
  };
  nuliga?: NuligaFederationConfig;
  handball360?: Handball360FederationConfig;
}

export const SUPPORTED_COUNTRIES: readonly CountryRegistryEntry[] = [
  {
    code: "DE",
    name: "Deutschland",
    nativeName: "Deutschland",
    defaultLocale: "de-DE",
    supportedLocales: ["de-DE"],
    timezone: "Europe/Berlin",
    isActive: true,
  },
  {
    code: "AT",
    name: "Österreich",
    nativeName: "Österreich",
    defaultLocale: "de-AT",
    supportedLocales: ["de-AT"],
    timezone: "Europe/Vienna",
    isActive: true,
  },
  {
    code: "CH",
    name: "Schweiz",
    nativeName: "Schweiz / Suisse / Svizzera",
    defaultLocale: "de-CH",
    supportedLocales: ["de-CH", "fr-CH", "it-CH"],
    timezone: "Europe/Zurich",
    isActive: false,
  },
];

export const COUNTRY_BY_CODE: ReadonlyMap<string, CountryRegistryEntry> =
  new Map(SUPPORTED_COUNTRIES.map((c) => [c.code, c]));

const DHB_H360_PORTAL = "https://www.handball.net";
const DHB_H360_HUB = "https://handball360.net";

export const FEDERATION_REGISTRY: readonly FederationProviderConfig[] = [
  // =========================================================================
  // Deutschland (DE) — Bundesebene & 18 Landesverbands-Einträge
  // =========================================================================
  {
    countryCode: "DE",
    federationCode: "DHB",
    name: "Deutscher Handballbund (Bundesebene)",
    shortLabel: "DHB",
    regionLabel: "Bundesweit · 1.–3. Liga & JBLH",
    isNational: true,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "dhb",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVNB",
    name: "Handballverband Niedersachsen-Bremen",
    shortLabel: "HVNB",
    regionLabel: "Niedersachsen & Bremen",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://hvnb-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "HVNB",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "HVNB {season}",
      rootRegionName: "HVNB Verbandsebene",
      discoverSubChampionships: false,
      knownSubChampionships: [
        {
          code: "HRBG",
          championshipTemplate: "HRBG {season}",
          regionName: "HR Braunschweig-Göttingen",
        },
        {
          code: "HRHWL",
          championshipTemplate: "HR HWL {season}",
          regionName: "HR Hannover-Weser-Leine",
        },
        {
          code: "HRBN",
          championshipTemplate: "HRBN {season}",
          regionName: "HR Bremen-Nordsee",
        },
        {
          code: "HRLS",
          championshipTemplate: "HRLS {season}",
          regionName: "HR Lüneburg-Stade",
        },
        {
          code: "HRWN",
          championshipTemplate: "HRWN {season}",
          regionName: "HR West Niedersachsen",
        },
      ],
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hvnb",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "BHV",
    name: "Bayerischer Handball-Verband",
    shortLabel: "BHV",
    regionLabel: "Bayern",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://bhv-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "BHV",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "BHV {season}",
      altRootChampionshipTemplates: ["BHV 20{season}"],
      rootRegionName: "BHV Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "bhv",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HHV",
    name: "Hessischer Handball-Verband",
    shortLabel: "HHV",
    regionLabel: "Hessen",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://hhv-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "HHV",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "HHV {season}",
      rootRegionName: "HHV Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hhv",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVS",
    name: "Handball-Verband Sachsen",
    shortLabel: "HVS",
    regionLabel: "Sachsen",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://hvs-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "HVS",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "HVS {season}",
      rootRegionName: "HVS Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hvs",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVSA",
    name: "Handball-Verband Sachsen-Anhalt",
    shortLabel: "HVSA",
    regionLabel: "Sachsen-Anhalt",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://hvsa-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "HVSA",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "HVSA {season}",
      rootRegionName: "HVSA Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hvsa",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "THV",
    name: "Thüringer Handball-Verband",
    shortLabel: "THV",
    regionLabel: "Thüringen",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://thv-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "THV",
      seasonSlugFormat: "YYYY/YY",
      rootChampionshipTemplate: "THV {season}",
      altRootChampionshipTemplates: ["THV 26/27"],
      rootRegionName: "THV Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "thv",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVBER",
    name: "Handball-Verband Berlin",
    shortLabel: "HVB Berlin",
    regionLabel: "Berlin",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://hvberlin-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "HVBER",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "HVB {season}",
      altRootChampionshipTemplates: ["HV Berlin {season}", "HVB 20{season}"],
      rootRegionName: "HV Berlin Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hvberlin",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVBB",
    name: "Handball-Verband Brandenburg",
    shortLabel: "HVB Brandenburg",
    regionLabel: "Brandenburg",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://hvbrandenburg-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "HVBB",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "HVBB {season}",
      altRootChampionshipTemplates: ["HVB {season}"],
      rootRegionName: "HV Brandenburg Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hvbrandenburg",
      isLiveInSeason2627: false,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVMV",
    name: "Handballverband Mecklenburg-Vorpommern",
    shortLabel: "HVMV",
    regionLabel: "Mecklenburg-Vorpommern",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    nuliga: {
      baseUrl: "https://hvmv-handball.liga.nu",
      webObjectsApp: "nuLigaHBDE.woa",
      federationParam: "HVMV",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "HVMV {season}",
      rootRegionName: "HVMV Verbandsebene",
      discoverSubChampionships: true,
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hvmv",
      isLiveInSeason2627: false,
    },
  },
  // --- Handball360-Verbände (bereits 2026/27 produktiv) ---
  {
    countryCode: "DE",
    federationCode: "HVSH",
    name: "Handballverband Schleswig-Holstein",
    shortLabel: "HVSH",
    regionLabel: "Schleswig-Holstein",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hvsh",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HHV_HH",
    name: "Hamburger Handball-Verband",
    shortLabel: "HHV Hamburg",
    regionLabel: "Hamburg",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hamburger-hv",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HNR",
    name: "Handball Nordrhein",
    shortLabel: "HNR",
    regionLabel: "Nordrhein (Niederrhein & Mittelrhein)",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "handball-nordrhein",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVW",
    name: "Handball-Verband Westfalen",
    shortLabel: "HVW Westfalen",
    regionLabel: "Westfalen",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hv-westfalen",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVR",
    name: "Handball-Verband Rheinland",
    shortLabel: "HVR",
    regionLabel: "Rheinland",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hv-rheinland",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVRH",
    name: "Handball-Verband Rheinhessen",
    shortLabel: "HVRH",
    regionLabel: "Rheinhessen (Rheinhessen-Pfalz)",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hv-rheinhessen-pfalz",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "PFHV",
    name: "Pfälzer Handball-Verband",
    shortLabel: "PfHV",
    regionLabel: "Pfalz (Rheinhessen-Pfalz)",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hv-rheinhessen-pfalz",
      isLiveInSeason2627: true,
    },
  },
  {
    countryCode: "DE",
    federationCode: "HVSAAR",
    name: "Handball-Verband Saar",
    shortLabel: "HV Saar",
    regionLabel: "Saarland",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "HANDBALL360",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "ON_DEMAND_CACHE",
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "hv-saar",
      isLiveInSeason2627: true,
    },
  },
  // --- Übergangsverband ohne Handball4All-Adapter (iCal/CSV in 2026/27, H360 ab 2027/28) ---
  {
    countryCode: "DE",
    federationCode: "HBW",
    name: "Handball Baden-Württemberg",
    shortLabel: "HBW",
    regionLabel: "Baden-Württemberg (Baden, Württemberg, Südbaden)",
    isNational: false,
    locale: "de-DE",
    timezone: "Europe/Berlin",
    primaryProvider: "MANUAL_ONLY",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NONE",
    plannedMigration: {
      targetProvider: "HANDBALL360",
      targetSeason: "2027/28",
    },
    handball360: {
      portalBaseUrl: DHB_H360_PORTAL,
      hubBaseUrl: DHB_H360_HUB,
      federationSlug: "bwhv",
      isLiveInSeason2627: false,
    },
  },

  // =========================================================================
  // Österreich (AT) — Erster Europa-Pilot über nuLiga (nuLigaHBAT.woa)
  // =========================================================================
  {
    countryCode: "AT",
    federationCode: "OEHB",
    name: "Österreichischer Handballbund",
    shortLabel: "ÖHB",
    regionLabel: "Österreich (Bundesligen & Landesverbände)",
    isNational: true,
    locale: "de-AT",
    timezone: "Europe/Vienna",
    primaryProvider: "NULIGA",
    fallbackProviders: ["ICAL_URL", "CSV_MANUAL"],
    directorySyncMode: "NIGHTLY_CRAWL",
    nuliga: {
      baseUrl: "https://oehb-handball.liga.nu",
      webObjectsApp: "nuLigaHBAT.woa",
      federationParam: "ÖHB",
      seasonSlugFormat: "YY/YY",
      rootChampionshipTemplate: "ÖHB {season}",
      rootRegionName: "ÖHB Bundesebene",
      discoverSubChampionships: true,
    },
  },
];

export const FEDERATION_CONFIG_BY_CODE: ReadonlyMap<
  string,
  FederationProviderConfig
> = new Map(FEDERATION_REGISTRY.map((f) => [f.federationCode, f]));

export function getFederationConfig(
  federationCode: string | null | undefined
): FederationProviderConfig | null {
  if (!federationCode) return null;
  return FEDERATION_CONFIG_BY_CODE.get(federationCode.trim().toUpperCase()) ?? null;
}

export function getFederationsByCountry(
  countryCode: string
): FederationProviderConfig[] {
  const normalized = countryCode.trim().toUpperCase();
  return FEDERATION_REGISTRY.filter((f) => f.countryCode === normalized);
}

export function getNuligaFederations(
  countryCode?: string
): FederationProviderConfig[] {
  const normalizedCountry = countryCode?.trim().toUpperCase();
  return FEDERATION_REGISTRY.filter(
    (f) =>
      f.primaryProvider === "NULIGA" &&
      Boolean(f.nuliga) &&
      (!normalizedCountry || f.countryCode === normalizedCountry)
  );
}

export function getHandball360Federations(
  onlyLiveIn2627 = true
): FederationProviderConfig[] {
  return FEDERATION_REGISTRY.filter(
    (f) =>
      Boolean(f.handball360) &&
      (!onlyLiveIn2627 ||
        (f.primaryProvider === "HANDBALL360" && f.handball360?.isLiveInSeason2627))
  );
}

export function getNuligaWebObjectsBaseUrl(
  federationCode: string | null | undefined
): string | null {
  const cfg = getFederationConfig(federationCode);
  if (!cfg?.nuliga) return null;
  return `${cfg.nuliga.baseUrl}/cgi-bin/WebObjects/${cfg.nuliga.webObjectsApp}/wa/`;
}

export function resolveFederationByNuligaHost(
  hostname: string
): FederationProviderConfig | null {
  const host = hostname.trim().toLowerCase();
  for (const fed of FEDERATION_REGISTRY) {
    if (!fed.nuliga) continue;
    try {
      if (new URL(fed.nuliga.baseUrl).hostname.toLowerCase() === host) {
        return fed;
      }
    } catch {
      // ignore invalid URL
    }
  }
  return null;
}

export function isDirectoryLinkingSupported(
  federationCode: string | null | undefined
): boolean {
  const cfg = getFederationConfig(federationCode);
  if (!cfg) return false;
  return cfg.directorySyncMode !== "NONE" && cfg.primaryProvider !== "MANUAL_ONLY";
}

/**
 * Formatiert einen Saisonnamen wie "2026/27" oder "2026/2027" ins nuLiga-Slug-Format
 * ("26/27" für YY/YY oder "2026/27" für YYYY/YY).
 */
export function formatNuligaSeasonSlug(
  seasonName: string,
  format: NuligaSeasonSlugFormat
): string {
  const match = seasonName.trim().match(/^(\d{2,4})\s*\/\s*(\d{2,4})$/);
  if (!match) return seasonName.trim();
  const startRaw = match[1];
  const endRaw = match[2];
  const startFull = startRaw.length === 2 ? `20${startRaw}` : startRaw;
  const startShort = startFull.slice(-2);
  const endShort = endRaw.slice(-2);
  return format === "YYYY/YY"
    ? `${startFull}/${endShort}`
    : `${startShort}/${endShort}`;
}

export function renderChampionshipName(
  template: string,
  seasonName: string,
  format: NuligaSeasonSlugFormat
): string {
  return template.replace(
    /\{season\}/g,
    formatNuligaSeasonSlug(seasonName, format)
  );
}
