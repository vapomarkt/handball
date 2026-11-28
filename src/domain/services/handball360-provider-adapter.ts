import {
  Handball360Client,
  Handball360ClubSearchItem,
  Handball360LineupPlayerPayload,
  Handball360MatchPayload,
} from "../adapters/handball360-client";
import {
  DirectoryGroupSeed,
  DirectoryLiveSearchQuery,
  ExternalLeagueDataProvider,
  ProviderCapabilities,
  ProviderMatchResultSnapshot,
  ProviderScheduleContext,
  ProviderScheduleFetchResult,
} from "../adapters/league-data-provider";
import { NormalizedLeagueMatch } from "../adapters/league-provider";
import { getFederationConfig } from "../data/federation-registry";
import { DomainError } from "../errors";
import { TeamGender } from "../schemas/handball";
import { LeagueAgeGroup } from "../schemas/league-catalog";
import { toBerlinDateKey } from "./nuliga-match-results";
import { teamNamesMatch } from "./nuliga-opponent-players";

export interface NormalizedHandball360Player {
  externalPlayerId: string | null;
  name: string;
  jerseyNumber: number | null;
  goals: number;
  sevenMeterGoals: number;
  sevenMeterAttempts: number;
  isAnonymized: boolean;
}

function inferAgeGroupAndGenderFromName(
  name: string,
  ageGroupHint?: string | null,
  genderHint?: string | null
): { ageGroup: LeagueAgeGroup; gender: TeamGender } {
  const combined = `${name} ${ageGroupHint ?? ""} ${genderHint ?? ""}`.toLowerCase();

  const gender: TeamGender =
    /weiblich|\bwj[a-f]?\b|\bfrauen\b|\bdamen\b|\bfemale\b/.test(combined)
      ? "FEMALE"
      : /gemischt|\bgj[a-f]?\b|\bmixed\b/.test(combined)
        ? "MIXED"
        : "MALE";

  if (/mini/.test(combined)) return { ageGroup: "YOUTH_F_MINI", gender: "MIXED" };
  if (/senior|alte herren|ü3\d|ü4\d/.test(combined)) {
    return { ageGroup: "SENIOR", gender };
  }

  const jugendAfter = combined.match(/jugend\s+([a-f])\b/);
  const jugendBefore = combined.match(/\b([a-f])\s*-\s*jugend\b/);
  const short = combined.match(/\b([mwg])?j\s*([a-f])\b/);
  const letter = (jugendAfter?.[1] ?? jugendBefore?.[1] ?? short?.[2])?.toUpperCase();
  if (letter) {
    return {
      ageGroup: (letter === "F"
        ? "YOUTH_F_MINI"
        : `YOUTH_${letter}`) as LeagueAgeGroup,
      gender,
    };
  }

  const uMatch = combined.match(/\bu(\d{1,2})\b/);
  if (uMatch) {
    const age = Number.parseInt(uMatch[1], 10);
    if (age >= 18) return { ageGroup: "YOUTH_A", gender };
    if (age >= 16) return { ageGroup: "YOUTH_B", gender };
    if (age >= 14) return { ageGroup: "YOUTH_C", gender };
    if (age >= 12) return { ageGroup: "YOUTH_D", gender };
    if (age >= 10) return { ageGroup: "YOUTH_E", gender };
    return { ageGroup: "YOUTH_F_MINI", gender: "MIXED" };
  }

  return { ageGroup: "ADULT", gender };
}

function parseHandball360StartDate(raw: string, timeTbd?: boolean): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Nur Datum ("2026-12-12") ohne konkrete Anwurfzeit -> 12:00 UTC als sicherer Tagesträger
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T${timeTbd ? "00:00:00.000Z" : "12:00:00.000Z"}`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normalizeHandball360LineupPlayer(
  raw: Handball360LineupPlayerPayload
): NormalizedHandball360Player {
  const rawName = (raw.displayName ?? "").trim();
  const isAnonymized =
    Boolean(raw.anonymized) ||
    rawName.length === 0 ||
    /^(?:n\.?\s*n\.?|anonym|datenschutz|spieler\s*#?\d*)$/i.test(rawName);

  const fallbackLabel =
    raw.jerseyNumber !== null && raw.jerseyNumber !== undefined
      ? `Nr. ${raw.jerseyNumber}`
      : "Unbekannt";

  return {
    externalPlayerId: raw.playerId?.trim() || null,
    name: isAnonymized ? fallbackLabel : rawName,
    jerseyNumber: raw.jerseyNumber ?? null,
    goals: raw.goals ?? 0,
    sevenMeterGoals: raw.sevenMeterGoals ?? 0,
    sevenMeterAttempts: raw.sevenMeterAttempts ?? 0,
    isAnonymized,
  };
}

export function normalizeHandball360SearchResults(
  items: Handball360ClubSearchItem[],
  defaults: { countryCode?: string; federationCode?: string; seasonName?: string }
): DirectoryGroupSeed[] {
  const byGroupCode = new Map<string, DirectoryGroupSeed>();
  const defaultSeason = defaults.seasonName ?? "2026/27";

  for (const club of items) {
    for (const t of club.teams) {
      const fedCode = (
        club.federationCode ??
        defaults.federationCode ??
        "DHB"
      ).toUpperCase();
      const fedCfg = getFederationConfig(fedCode);
      const countryCode = fedCfg?.countryCode ?? defaults.countryCode ?? "DE";
      const seasonName = t.seasonName?.trim() || defaultSeason;
      const regionCode = (t.regionCode?.trim() || fedCode).toUpperCase();
      const regionName =
        t.regionName?.trim() || fedCfg?.regionLabel || fedCode;
      const code = `${countryCode}-${fedCode}-H360-${t.tournamentId}`;

      const { ageGroup, gender } = inferAgeGroupAndGenderFromName(
        t.tournamentName,
        t.ageGroupHint,
        t.genderHint
      );

      let group = byGroupCode.get(code);
      if (!group) {
        group = {
          code,
          countryCode,
          federationCode: fedCode,
          regionCode,
          regionName,
          seasonName,
          ageGroup,
          gender,
          name: t.tournamentName,
          externalProvider: "HANDBALL360",
          externalGroupId: t.tournamentId,
          externalUrl: t.tournamentUrl ?? null,
          providerMeta: {
            handball360TournamentId: t.tournamentId,
          },
          teams: [],
        };
        byGroupCode.set(code, group);
      }

      const addTeam = (entry: {
        teamId: string;
        teamName: string;
        clubId?: string | null;
        clubName?: string | null;
        teamUrl?: string | null;
      }) => {
        if (group!.teams.some((x) => x.externalTeamId === entry.teamId)) return;
        group!.teams.push({
          externalTeamId: entry.teamId,
          externalClubId: entry.clubId ?? null,
          name: entry.teamName,
          clubName: entry.clubName ?? entry.teamName,
          externalUrl: entry.teamUrl ?? null,
          providerMeta: {
            handball360TeamId: entry.teamId,
            handball360ClubId: entry.clubId ?? null,
            handball360TournamentId: t.tournamentId,
          },
        });
      };

      addTeam({
        teamId: t.teamId,
        teamName: t.teamName,
        clubId: club.clubId,
        clubName: club.clubName,
        teamUrl: t.teamUrl,
      });

      for (const sibling of t.siblingTeams ?? []) {
        addTeam(sibling);
      }
    }
  }

  return Array.from(byGroupCode.values());
}

export function normalizeHandball360Matches(
  payloads: Handball360MatchPayload[],
  options: {
    teamExternalId?: string | null;
    teamNameMatch?: string | null;
  }
): ProviderScheduleFetchResult {
  const matches: NormalizedLeagueMatch[] = [];
  const officialResults: ProviderMatchResultSnapshot[] = [];

  for (const m of payloads) {
    const startAt = parseHandball360StartDate(m.startsAt, m.timeTbd);
    if (!startAt) continue;

    let isHome = true;
    if (options.teamExternalId && (m.homeTeamId || m.awayTeamId)) {
      isHome = m.homeTeamId === options.teamExternalId;
    } else if (options.teamNameMatch) {
      const homeMatches = teamNamesMatch(m.homeTeamName, options.teamNameMatch);
      const awayMatches = teamNamesMatch(m.awayTeamName, options.teamNameMatch);
      if (awayMatches && !homeMatches) isHome = false;
    }

    const opponentName = isHome ? m.awayTeamName : m.homeTeamName;
    const isCancelled = m.status === "CANCELLED" || m.status === "FORFEIT";
    const endAt = m.timeTbd
      ? null
      : new Date(startAt.getTime() + 90 * 60 * 1000);

    const venueName = m.venueName?.trim()
      ? m.venueAddress?.trim()
        ? `${m.venueName.trim()} (${m.venueAddress.trim()})`
        : m.venueName.trim()
      : null;

    const hasFullScore =
      m.homeScoreFull !== null &&
      m.homeScoreFull !== undefined &&
      m.awayScoreFull !== null &&
      m.awayScoreFull !== undefined;

    matches.push({
      externalId: `h360-${m.matchId}`,
      title: `${m.homeTeamName} – ${m.awayTeamName}`,
      opponentName,
      isHome,
      startAt,
      endAt,
      venueName,
      isCancelled,
      matchNumber: m.matchNumber ?? null,
      leagueGroupName: m.leagueGroupName ?? null,
      homeTeamName: m.homeTeamName,
      awayTeamName: m.awayTeamName,
      homeScoreFull: hasFullScore ? m.homeScoreFull! : null,
      awayScoreFull: hasFullScore ? m.awayScoreFull! : null,
      homeScoreHalf: m.homeScoreHalf ?? null,
      awayScoreHalf: m.awayScoreHalf ?? null,
    });

    if (hasFullScore) {
      officialResults.push({
        dateKey: toBerlinDateKey(startAt),
        timeText: null,
        matchNumber: m.matchNumber ?? null,
        homeTeam: m.homeTeamName,
        awayTeam: m.awayTeamName,
        homeScoreFull: m.homeScoreFull!,
        awayScoreFull: m.awayScoreFull!,
        homeScoreHalf: m.homeScoreHalf ?? null,
        awayScoreHalf: m.awayScoreHalf ?? null,
      });
    }
  }

  return { matches, officialResults };
}

/**
 * Vorbereiteter Multi-Verbands-Adapter für DHB Handball360 / handball.net (iSquad).
 * Arbeitet komplett ohne iCal-Feed-Zwang und normalisiert Spielpläne, Ergebnisse
 * und Aufstellungen über das einheitliche `ExternalLeagueDataProvider`-Interface.
 */
export class Handball360ProviderAdapter implements ExternalLeagueDataProvider {
  readonly provider = "HANDBALL360" as const;
  readonly capabilities: ProviderCapabilities = {
    directoryCrawl: false,
    liveSearch: true,
    directScheduleSync: true,
    matchResults: true,
    rosterImport: true,
    opponentStats: true,
    clubLogo: true,
  };

  constructor(private readonly client: Handball360Client) {}

  async searchDirectoryLive(
    query: DirectoryLiveSearchQuery
  ): Promise<DirectoryGroupSeed[]> {
    if (!this.client.isConfigured()) {
      return [];
    }
    const q = (query.clubName ?? query.q ?? "").trim();
    if (q.length < 2) return [];

    const items = await this.client.searchClubsAndTeams({
      query: q,
      federationCode: query.federationCode,
      seasonName: query.seasonName,
    });

    return normalizeHandball360SearchResults(items, {
      countryCode: query.countryCode,
      federationCode: query.federationCode,
      seasonName: query.seasonName,
    });
  }

  async fetchScheduleAndResults(
    context: ProviderScheduleContext
  ): Promise<ProviderScheduleFetchResult> {
    if (!this.client.isConfigured()) {
      throw DomainError.validation(
        "Die Handball360 / handball.net-Schnittstelle ist auf diesem Server noch nicht konfiguriert (HANDBALL360_API_BASE_URL fehlt). Nutze bis zur Freischaltung den iCal- oder CSV-Import."
      );
    }

    const cfg = context.source.providerConfig ?? {};
    const teamExternalId =
      (typeof cfg.handball360TeamId === "string" ? cfg.handball360TeamId : null) ??
      (typeof cfg.externalTeamId === "string" ? cfg.externalTeamId : null) ??
      context.groupTeam?.externalTeamId ??
      null;

    if (!teamExternalId) {
      throw DomainError.validation(
        "Für diese Handball360-Quelle ist keine externe Mannschafts-ID hinterlegt."
      );
    }

    const tournamentExternalId =
      (typeof cfg.handball360TournamentId === "string"
        ? cfg.handball360TournamentId
        : null) ??
      (typeof cfg.externalGroupId === "string" ? cfg.externalGroupId : null) ??
      context.groupTeam?.group.externalGroupId ??
      null;

    const payloads = await this.client.fetchTeamSchedule({
      teamExternalId,
      tournamentExternalId,
      seasonName: context.groupTeam?.group.seasonName ?? null,
    });

    return normalizeHandball360Matches(payloads, {
      teamExternalId,
      teamNameMatch: context.groupTeam?.name ?? context.source.teamNameMatch,
    });
  }
}
