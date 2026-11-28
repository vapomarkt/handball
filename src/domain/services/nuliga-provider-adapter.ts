import {
  ExternalLeagueDataProvider,
  ProviderCapabilities,
  ProviderScheduleContext,
  ProviderScheduleFetchResult,
} from "../adapters/league-data-provider";
import { LeagueDirectoryGroupTeamRecord } from "../adapters/league-directory-repository";
import { FetchTextFn, NormalizedLeagueMatch } from "../adapters/league-provider";
import { getFederationConfig } from "../data/federation-registry";
import { IcalLeagueProviderAdapter } from "./ical-parser";
import { resolveNuligaTeamFeed } from "./nuliga-feed-resolver";
import {
  fetchNuligaMatchResults,
  findMatchingNuligaResult,
  NuligaMatchResultsTarget,
  ParsedNuligaMatchResult,
} from "./nuliga-match-results";
import { isAllowedNuligaUrl } from "./nuliga-opponent-players";
import { fetchNuligaHtmlSchedule } from "./nuliga-schedule-parser";

/**
 * Multi-Verbands-Adapter für nuLiga (alle deutschen Landesverbände auf *.liga.nu
 * sowie Österreich/ÖHB auf oehb-handball.liga.nu).
 *
 * Sync-Strategie:
 * 1. Primär über offiziellen Webcal/iCal-Feed (sofern vorhanden), angereichert mit
 *    offiziellen Halbzeit- und Endständen aus `teamPortrait` / `groupPage`.
 * 2. Vollwertiger HTML-Spielplan-Fallback über `nuliga-schedule-parser.ts`, wenn
 *    für eine Staffel/Mannschaft kein Webcal-Feed hinterlegt ist.
 */
export class NuligaProviderAdapter implements ExternalLeagueDataProvider {
  readonly provider = "NULIGA" as const;
  readonly capabilities: ProviderCapabilities = {
    directoryCrawl: true,
    liveSearch: false,
    directScheduleSync: true,
    matchResults: true,
    rosterImport: true,
    opponentStats: true,
    clubLogo: true,
  };

  private readonly icalAdapter = new IcalLeagueProviderAdapter();

  constructor(private readonly fetchText: FetchTextFn) {}

  async resolveTeamFeedUrl(
    groupTeam: LeagueDirectoryGroupTeamRecord
  ): Promise<string | null> {
    return resolveNuligaTeamFeed(this.fetchText, {
      clubName: groupTeam.clubName,
      teamName: groupTeam.name,
      groupName: groupTeam.group.name,
      federationCode: groupTeam.group.federationCode,
      groupUrl: groupTeam.group.externalUrl,
      teamUrl: groupTeam.externalUrl,
    });
  }

  async fetchScheduleAndResults(
    context: ProviderScheduleContext
  ): Promise<ProviderScheduleFetchResult> {
    const { source, groupTeam, inlineContent } = context;
    let matches: NormalizedLeagueMatch[] = [];
    let rawIcal = inlineContent;

    if (!rawIcal && source.sourceUrl) {
      rawIcal = await this.fetchText(source.sourceUrl);
    }

    if (rawIcal) {
      matches = this.icalAdapter.parse(rawIcal, {
        teamNameMatch: source.teamNameMatch,
      });
    }

    const teamNameMatch =
      groupTeam?.name ?? source.teamNameMatch ?? groupTeam?.clubName ?? "";
    const fedConfig = getFederationConfig(groupTeam?.group.federationCode);
    const timeZone = fedConfig?.timezone ?? "Europe/Berlin";

    // Wenn kein iCal-Feed vorliegt, Spielplan direkt aus den nuLiga-HTML-Seiten lesen
    if (matches.length === 0 && !inlineContent && teamNameMatch) {
      matches = await fetchNuligaHtmlSchedule(this.fetchText, {
        teamUrl: groupTeam?.externalUrl,
        groupUrl: groupTeam?.group.externalUrl,
        teamNameMatch,
        leagueGroupName: groupTeam?.group.name ?? null,
        timeZone,
      });
    }

    let officialResults: ParsedNuligaMatchResult[] = [];
    if (!inlineContent) {
      const target = this.buildResultsTarget(source, groupTeam, matches);
      if (target) {
        officialResults = await fetchNuligaMatchResults(this.fetchText, target);
        matches = this.enrichMatchesWithResults(
          matches,
          officialResults,
          target.teamName ?? source.teamNameMatch
        );
      }
    }

    return { matches, officialResults };
  }

  private buildResultsTarget(
    source: ProviderScheduleContext["source"],
    groupTeam: LeagueDirectoryGroupTeamRecord | null | undefined,
    parsedMatches: NormalizedLeagueMatch[]
  ): NuligaMatchResultsTarget | null {
    const teamUrl = groupTeam?.externalUrl ?? null;
    const groupUrl = groupTeam?.group.externalUrl ?? null;
    const clubName = groupTeam?.clubName ?? null;
    const teamName = groupTeam?.name ?? source.teamNameMatch ?? null;
    const groupName =
      groupTeam?.group.name ??
      parsedMatches.find((m) => m.leagueGroupName)?.leagueGroupName ??
      null;

    const fallbackNuligaUrl =
      source.sourceUrl && isAllowedNuligaUrl(source.sourceUrl)
        ? source.sourceUrl
        : null;

    if (!teamUrl && !groupUrl && !fallbackNuligaUrl) {
      return null;
    }

    return {
      teamUrl,
      groupUrl,
      fallbackNuligaUrl,
      clubName,
      teamName,
      groupName,
    };
  }

  private enrichMatchesWithResults(
    matches: NormalizedLeagueMatch[],
    results: ParsedNuligaMatchResult[],
    teamNameMatch?: string | null
  ): NormalizedLeagueMatch[] {
    if (results.length === 0) return matches;

    return matches.map((match) => {
      if (
        match.homeScoreFull !== null &&
        match.homeScoreFull !== undefined &&
        match.awayScoreFull !== null &&
        match.awayScoreFull !== undefined
      ) {
        return match;
      }

      const found = findMatchingNuligaResult(results, {
        startAt: match.startAt,
        isHome: match.isHome,
        opponentName: match.opponentName,
        homeTeamName: match.homeTeamName,
        awayTeamName: match.awayTeamName,
        teamNameMatch,
        matchNumber: match.matchNumber,
      });

      if (!found) return match;

      return {
        ...match,
        homeScoreFull: found.homeScoreFull,
        awayScoreFull: found.awayScoreFull,
        homeScoreHalf: found.homeScoreHalf,
        awayScoreHalf: found.awayScoreHalf,
      };
    });
  }
}
