import { TeamGender } from "../schemas/handball";
import {
  LeagueImportSourceDTO,
  LeagueProviderType,
  normalizeProviderType,
} from "../schemas/league";
import { LeagueAgeGroup } from "../schemas/league-catalog";
import { LeagueDirectoryGroupTeamRecord } from "./league-directory-repository";
import { NormalizedLeagueMatch } from "./league-provider";

export interface ProviderCapabilities {
  /** Unterstützt vollständiges nächtliches Crawlen der Verbandsstaffeln. */
  directoryCrawl: boolean;
  /** Unterstützt Live-Vereinssuche On-Demand (z. B. Handball360 / handball.net). */
  liveSearch: boolean;
  /** Kann Spielpläne direkt abrufen (auch ohne Webcal-/iCal-URL). */
  directScheduleSync: boolean;
  /** Kann offizielle Halbzeit- & Endstände separat nachliefern. */
  matchResults: boolean;
  /** Kann Mannschaftskader / Spielbericht-Aufstellungen importieren. */
  rosterImport: boolean;
  /** Kann gegnerische Spieler & Torschützenstatistiken abrufen. */
  opponentStats: boolean;
  /** Kann offizielle Vereinslogos beziehen. */
  clubLogo: boolean;
}

export interface DirectoryTeamSeed {
  externalTeamId: string;
  externalClubId?: string | null;
  name: string;
  clubName: string;
  shortName?: string | null;
  icalUrl?: string | null;
  externalUrl?: string | null;
  providerMeta?: Record<string, unknown> | null;
}

export interface DirectoryGroupSeed {
  code: string;
  countryCode: string;
  federationCode: string;
  regionCode: string;
  regionName: string;
  seasonName: string;
  leagueCode?: string | null;
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
  name: string;
  shortName?: string | null;
  externalProvider: LeagueProviderType;
  externalGroupId?: string | null;
  externalUrl?: string | null;
  providerMeta?: Record<string, unknown> | null;
  teams: DirectoryTeamSeed[];
}

export interface DirectoryLiveSearchQuery {
  countryCode: string;
  federationCode?: string;
  seasonName?: string;
  clubName?: string;
  q?: string;
  ageGroup?: LeagueAgeGroup;
  gender?: TeamGender;
}

export interface ProviderScheduleContext {
  source: LeagueImportSourceDTO;
  groupTeam?: LeagueDirectoryGroupTeamRecord | null;
  inlineContent?: string;
}

export interface ProviderMatchResultSnapshot {
  dateKey: string; // YYYY-MM-DD in lokaler Verbands-Zeitzone
  timeText: string | null;
  matchNumber: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScoreFull: number;
  awayScoreFull: number;
  homeScoreHalf: number | null;
  awayScoreHalf: number | null;
}

export interface ProviderScheduleFetchResult {
  matches: NormalizedLeagueMatch[];
  /** Zusätzliche offizielle Ergebnisse für Backfill bereits vergangener Spiele. */
  officialResults: ProviderMatchResultSnapshot[];
}

/**
 * Einheitlicher Vertrag für externe Handball-Datenprovider
 * (nuLiga, Handball360 / handball.net, künftig weitere europäische Verbände).
 * Bleibt strikt frei von Infrastruktur-/Framework-Abhängigkeiten.
 */
export interface ExternalLeagueDataProvider {
  readonly provider: LeagueProviderType;
  readonly capabilities: ProviderCapabilities;

  /** Optional: Live-Suche nach Vereinen/Staffeln (z. B. On-Demand für Handball360). */
  searchDirectoryLive?(
    query: DirectoryLiveSearchQuery
  ): Promise<DirectoryGroupSeed[]>;

  /** Optional: Löst eine persistierbare Feed-/Sync-URL beim Verknüpfen einer Mannschaft auf. */
  resolveTeamFeedUrl?(
    groupTeam: LeagueDirectoryGroupTeamRecord
  ): Promise<string | null>;

  /** Ruft Spielplan (und idealerweise offizielle Ergebnisse) für eine Importquelle ab. */
  fetchScheduleAndResults(
    context: ProviderScheduleContext
  ): Promise<ProviderScheduleFetchResult>;
}

/**
 * Zentrale Provider-Registry im Domain-Layer.
 * Bildet Legacy-Werte wie HVNB_NULIGA transparent auf den NULIGA-Adapter ab.
 */
export class LeagueProviderRegistry {
  private readonly providers = new Map<
    LeagueProviderType,
    ExternalLeagueDataProvider
  >();

  register(adapter: ExternalLeagueDataProvider): void {
    this.providers.set(normalizeProviderType(adapter.provider), adapter);
  }

  get(provider: LeagueProviderType): ExternalLeagueDataProvider | null {
    return this.providers.get(normalizeProviderType(provider)) ?? null;
  }

  list(): ExternalLeagueDataProvider[] {
    return Array.from(this.providers.values());
  }
}
