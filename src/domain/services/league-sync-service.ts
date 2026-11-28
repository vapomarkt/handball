import {
  LeagueProviderRegistry,
  ProviderMatchResultSnapshot,
} from "../adapters/league-data-provider";
import {
  LeagueDirectoryGroupTeamRecord,
  LeagueDirectoryRepository,
} from "../adapters/league-directory-repository";
import {
  FetchTextFn,
  LeagueSyncRepository,
  NormalizedLeagueMatch,
} from "../adapters/league-provider";
import { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import { canManageEvents, canViewTeam, ViewerContext } from "../policies/rbac";
import {
  CreateLeagueSourceSchema,
  CsvLeagueImportSchema,
  isNuligaProvider,
  LeagueImportSourceDTO,
  LeagueSyncChangeLogDTO,
  SyncRunSummaryDTO,
  TriggerIcalSyncSchema,
} from "../schemas/league";
import { CsvLeagueProviderAdapter } from "./csv-parser";
import { IcalLeagueProviderAdapter } from "./ical-parser";
import {
  computeLeagueMergePlan,
  formatScoreSummary,
  resolveScoreSyncUpdate,
} from "./league-merge";
import {
  fetchNuligaMatchResults,
  findMatchingNuligaResult,
  NuligaMatchResultsTarget,
  ParsedNuligaMatchResult,
} from "./nuliga-match-results";
import { isAllowedNuligaUrl } from "./nuliga-opponent-players";
import { NuligaProviderAdapter } from "./nuliga-provider-adapter";

export class LeagueSyncService {
  private readonly icalAdapter = new IcalLeagueProviderAdapter();
  private readonly csvAdapter = new CsvLeagueProviderAdapter();
  private readonly providerRegistry: LeagueProviderRegistry;

  constructor(
    private readonly teams: TeamRepository,
    private readonly leagueSync: LeagueSyncRepository,
    private readonly fetchText: FetchTextFn,
    private readonly leagueDirectory?: LeagueDirectoryRepository,
    providerRegistry?: LeagueProviderRegistry
  ) {
    if (providerRegistry) {
      this.providerRegistry = providerRegistry;
    } else {
      this.providerRegistry = new LeagueProviderRegistry();
      this.providerRegistry.register(new NuligaProviderAdapter(fetchText));
    }
  }

  async listSources(
    viewer: ViewerContext,
    teamId: string
  ): Promise<LeagueImportSourceDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diese Mannschaft.");
    }
    return this.leagueSync.listSourcesByTeam(teamId);
  }

  async createSource(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<LeagueImportSourceDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Liga-Importquellen anlegen."
      );
    }

    const parsed = CreateLeagueSourceSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Importquellen-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.leagueSync.createSource(team.clubId, team.id, parsed.data);
  }

  async deleteSource(
    viewer: ViewerContext,
    teamId: string,
    sourceId: string
  ): Promise<void> {
    const source = await this.leagueSync.findSourceById(sourceId);
    if (!source || source.teamId !== teamId) {
      throw DomainError.notFound("Importquelle nicht gefunden.");
    }
    if (!canManageEvents(viewer, source.teamId, source.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.leagueSync.deleteSource(sourceId);
  }

  async listChangeLogs(
    viewer: ViewerContext,
    teamId: string
  ): Promise<LeagueSyncChangeLogDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf das Änderungsprotokoll.");
    }
    return this.leagueSync.listChangeLogsByTeam(teamId, 50);
  }

  async triggerSourceSync(
    viewer: ViewerContext,
    teamId: string,
    sourceId: string,
    rawInput: unknown
  ): Promise<SyncRunSummaryDTO> {
    const source = await this.leagueSync.findSourceById(sourceId);
    if (!source || source.teamId !== teamId) {
      throw DomainError.notFound("Importquelle nicht gefunden.");
    }
    if (!canManageEvents(viewer, source.teamId, source.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen den Liga-Sync starten."
      );
    }

    const parsed = TriggerIcalSyncSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Sync-Parameter.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.executeSourceSync(source, parsed.data.icalContent);
  }

  /**
   * Wird sowohl manuell als auch vom stündlichen pg-boss Background-Worker aufgerufen.
   */
  async syncSourceById(sourceId: string): Promise<SyncRunSummaryDTO> {
    const source = await this.leagueSync.findSourceById(sourceId);
    if (!source) {
      throw DomainError.notFound("Importquelle nicht gefunden.");
    }
    return this.executeSourceSync(source);
  }

  async syncAllEnabledIcalSources(): Promise<{
    sourcesProcessed: number;
    errors: Array<{ sourceId: string; message: string }>;
  }> {
    const sources = await this.leagueSync.listEnabledIcalSources();
    const errors: Array<{ sourceId: string; message: string }> = [];

    for (const source of sources) {
      try {
        await this.executeSourceSync(source);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Unbekannter Sync-Fehler";
        errors.push({ sourceId: source.id, message: msg });
      }
    }

    return { sourcesProcessed: sources.length, errors };
  }

  async importCsv(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<SyncRunSummaryDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen CSV-Spielpläne importieren."
      );
    }

    const parsed = CsvLeagueImportSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige CSV-Importdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const matches = this.csvAdapter.parse(parsed.data.csvContent, {
      teamNameMatch: parsed.data.teamNameMatch,
      mapping: parsed.data.mapping,
    });

    if (matches.length === 0) {
      throw DomainError.validation(
        `Keine Spiele für „${parsed.data.teamNameMatch}“ in der CSV gefunden. Prüfe Mannschaftsname und Spaltenzuordnung.`
      );
    }

    const source = await this.leagueSync.createSource(team.clubId, team.id, {
      provider: "CSV_MANUAL",
      name: parsed.data.sourceName,
      sourceUrl: null,
      teamNameMatch: parsed.data.teamNameMatch,
      isEnabled: false,
      syncIntervalMinutes: 60,
    });

    const summary = await this.applyMergedMatches(source, matches);
    await this.leagueSync.updateSourceSyncStatus(source.id, "SUCCESS", null);
    return summary;
  }

  private async resolveGroupTeamForSource(
    source: LeagueImportSourceDTO
  ): Promise<LeagueDirectoryGroupTeamRecord | null> {
    if (!this.leagueDirectory) return null;

    let groupTeamId = source.leagueGroupTeamId ?? null;
    if (!groupTeamId) {
      const team = await this.teams.findById(source.teamId);
      groupTeamId = team?.leagueGroupTeamId ?? null;
    }
    if (!groupTeamId) return null;

    try {
      return await this.leagueDirectory.findGroupTeamById(groupTeamId);
    } catch {
      return null;
    }
  }

  private resolveNuligaResultsTarget(
    source: LeagueImportSourceDTO,
    groupTeam: LeagueDirectoryGroupTeamRecord | null,
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
    results: ProviderMatchResultSnapshot[],
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

  private async backfillRemainingPastMatches(
    source: LeagueImportSourceDTO,
    results: ProviderMatchResultSnapshot[],
    skipEventIds: Set<string>
  ): Promise<{ count: number; changes: LeagueSyncChangeLogDTO[] }> {
    if (
      results.length === 0 ||
      !this.leagueSync.findPastMatchesWithoutScoresByTeam ||
      !this.leagueSync.backfillMatchScores
    ) {
      return { count: 0, changes: [] };
    }

    const pastMatches = await this.leagueSync.findPastMatchesWithoutScoresByTeam(
      source.teamId,
      new Date()
    );

    let count = 0;
    const changes: LeagueSyncChangeLogDTO[] = [];

    for (const match of pastMatches) {
      if (skipEventIds.has(match.eventId)) continue;

      const found = findMatchingNuligaResult(results, {
        startAt: match.startAt,
        isHome: match.isHome,
        opponentName: match.opponentName,
        teamNameMatch: source.teamNameMatch,
      });
      if (!found) continue;

      const scoreSyncUpdate = resolveScoreSyncUpdate(match, {
        homeScoreFull: found.homeScoreFull,
        awayScoreFull: found.awayScoreFull,
        homeScoreHalf: found.homeScoreHalf,
        awayScoreHalf: found.awayScoreHalf,
      });
      if (!scoreSyncUpdate) continue;

      await this.leagueSync.backfillMatchScores(match.eventId, scoreSyncUpdate);

      let summaryText: string;
      if (
        scoreSyncUpdate.discrepancyDetected &&
        match.homeScoreFull !== null &&
        match.awayScoreFull !== null
      ) {
        const localSummary = formatScoreSummary({
          homeScoreFull: match.homeScoreFull,
          awayScoreFull: match.awayScoreFull,
          homeScoreHalf: match.homeScoreHalf,
          awayScoreHalf: match.awayScoreHalf,
        });
        summaryText = `Abweichung zum offiziellen Ergebnis (${match.title}): Lokal ${localSummary} vs. Offiziell ${formatScoreSummary(scoreSyncUpdate.officialScores)}`;
      } else if (scoreSyncUpdate.applyToDisplayed) {
        summaryText = `Ergebnis nachgetragen (${match.title}): ${formatScoreSummary(scoreSyncUpdate.officialScores)}`;
      } else {
        summaryText = `Offizielles Ergebnis bestätigt (${match.title}): ${formatScoreSummary(scoreSyncUpdate.officialScores)}`;
      }

      const log = await this.leagueSync.createChangeLog({
        sourceId: source.id,
        teamId: source.teamId,
        eventId: match.eventId,
        externalId: match.externalId ?? `event-${match.eventId}`,
        changeType: "UPDATED",
        summary: summaryText,
      });
      changes.push(log);
      if (scoreSyncUpdate.applyToDisplayed) {
        count += 1;
      }
    }

    return { count, changes };
  }

  private async executeSourceSync(
    source: LeagueImportSourceDTO,
    inlineIcalContent?: string
  ): Promise<SyncRunSummaryDTO> {
    try {
      const groupTeam = await this.resolveGroupTeamForSource(source);
      let matches: NormalizedLeagueMatch[] = [];
      let officialResults: ProviderMatchResultSnapshot[] = [];

      const registeredProvider =
        source.provider !== "ICAL_URL" && source.provider !== "CSV_MANUAL"
          ? this.providerRegistry.get(source.provider)
          : null;

      if (registeredProvider) {
        // Provider-spezifischer Abruf (NULIGA / HVNB_NULIGA / HANDBALL360)
        if (
          !inlineIcalContent &&
          !source.sourceUrl &&
          !source.leagueGroupTeamId &&
          !source.providerConfig
        ) {
          throw DomainError.validation(
            "Für diese Importquelle sind weder eine Feed-URL noch Verbands-IDs hinterlegt."
          );
        }

        const fetched = await registeredProvider.fetchScheduleAndResults({
          source,
          groupTeam,
          inlineContent: inlineIcalContent,
        });
        matches = fetched.matches;
        officialResults = fetched.officialResults;
      } else {
        // Generischer iCal-Feed (mit optionalem nuLiga-Ergebnis-Enrichment)
        let rawIcal = inlineIcalContent;
        if (!rawIcal) {
          if (source.sourceUrl) {
            rawIcal = await this.fetchText(source.sourceUrl);
          } else if (!source.leagueGroupTeamId && !isNuligaProvider(source.provider)) {
            throw DomainError.validation(
              "Für diese Importquelle ist keine iCal-URL hinterlegt."
            );
          }
        }

        if (rawIcal) {
          matches = this.icalAdapter.parse(rawIcal, {
            teamNameMatch: source.teamNameMatch,
          });
        }

        if (!inlineIcalContent) {
          const target = this.resolveNuligaResultsTarget(source, groupTeam, matches);
          if (target) {
            const nuligaResults: ParsedNuligaMatchResult[] =
              await fetchNuligaMatchResults(this.fetchText, target);
            officialResults = nuligaResults;
            matches = this.enrichMatchesWithResults(
              matches,
              nuligaResults,
              target.teamName ?? source.teamNameMatch
            );
          }
        }
      }

      const { summary, touchedEventIds } = await this.applyMergedMatchesDetailed(
        source,
        matches
      );

      const backfilled = await this.backfillRemainingPastMatches(
        source,
        officialResults,
        touchedEventIds
      );

      const finalSummary: SyncRunSummaryDTO = {
        ...summary,
        updatedCount: summary.updatedCount + backfilled.changes.length,
        resultsUpdatedCount:
          (summary.resultsUpdatedCount ?? 0) + backfilled.count,
        changes: [...summary.changes, ...backfilled.changes],
      };

      await this.leagueSync.updateSourceSyncStatus(source.id, "SUCCESS", null);
      return finalSummary;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sync fehlgeschlagen.";
      await this.leagueSync.updateSourceSyncStatus(source.id, "ERROR", message);
      throw error;
    }
  }

  private async applyMergedMatches(
    source: LeagueImportSourceDTO,
    incomingMatches: NormalizedLeagueMatch[]
  ): Promise<SyncRunSummaryDTO> {
    const { summary } = await this.applyMergedMatchesDetailed(
      source,
      incomingMatches
    );
    return summary;
  }

  private async applyMergedMatchesDetailed(
    source: LeagueImportSourceDTO,
    incomingMatches: NormalizedLeagueMatch[]
  ): Promise<{ summary: SyncRunSummaryDTO; touchedEventIds: Set<string> }> {
    const existing = await this.leagueSync.findSyncedMatchesByTeam(
      source.teamId
    );
    const plan = computeLeagueMergePlan(existing, incomingMatches);

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    let resultsUpdatedCount = 0;
    const changes: LeagueSyncChangeLogDTO[] = [];
    const touchedEventIds = new Set<string>();

    for (const action of plan) {
      if (action.kind === "UNCHANGED") {
        if (action.existing) touchedEventIds.add(action.existing.eventId);
        unchangedCount += 1;
        continue;
      }

      let venueId: string | null = action.existing?.venueId ?? null;
      if (action.incoming.venueName) {
        // Halle suchen oder neu anlegen — bestehende resinPolicy bleibt 100% geschützt!
        const venue =
          await this.leagueSync.findOrCreateVenueByNamePreservingResin(
            source.clubId,
            action.incoming.venueName
          );
        venueId = venue.id;
      }

      if (action.kind === "CREATE") {
        const hasInitialScore =
          action.incoming.homeScoreFull !== null &&
          action.incoming.homeScoreFull !== undefined &&
          action.incoming.awayScoreFull !== null &&
          action.incoming.awayScoreFull !== undefined;

        const created = await this.leagueSync.createSyncedMatchEvent({
          clubId: source.clubId,
          teamId: source.teamId,
          externalId: action.incoming.externalId,
          title: action.incoming.title,
          startAt: action.incoming.startAt,
          endAt: action.incoming.endAt,
          venueId,
          isCancelled: action.incoming.isCancelled,
          opponentName: action.incoming.opponentName,
          isHome: action.incoming.isHome,
          homeScoreFull: action.incoming.homeScoreFull ?? null,
          awayScoreFull: action.incoming.awayScoreFull ?? null,
          homeScoreHalf: action.incoming.homeScoreHalf ?? null,
          awayScoreHalf: action.incoming.awayScoreHalf ?? null,
        });
        touchedEventIds.add(created.eventId);

        const log = await this.leagueSync.createChangeLog({
          sourceId: source.id,
          teamId: source.teamId,
          eventId: created.eventId,
          externalId: action.incoming.externalId,
          changeType: action.changeType ?? "CREATED",
          summary: action.summary ?? `Neues Spiel: ${action.incoming.title}`,
          newStartAt: action.incoming.startAt,
          newVenueName: action.incoming.venueName,
        });
        changes.push(log);
        createdCount += 1;
        if (hasInitialScore) resultsUpdatedCount += 1;
      } else if (action.kind === "UPDATE" && action.existing) {
        await this.leagueSync.updateSyncedMatchSchedulePreservingLocal({
          eventId: action.existing.eventId,
          title: action.incoming.title,
          startAt: action.incoming.startAt,
          endAt: action.incoming.endAt,
          venueId,
          isCancelled: action.incoming.isCancelled,
          opponentName: action.incoming.opponentName,
          isHome: action.incoming.isHome,
          scoreSyncUpdate: action.scoreSyncUpdate ?? null,
        });
        touchedEventIds.add(action.existing.eventId);

        const log = await this.leagueSync.createChangeLog({
          sourceId: source.id,
          teamId: source.teamId,
          eventId: action.existing.eventId,
          externalId: action.incoming.externalId,
          changeType: action.changeType ?? "UPDATED",
          summary: action.summary ?? `Aktualisiert: ${action.incoming.title}`,
          oldStartAt: action.existing.startAt,
          newStartAt: action.incoming.startAt,
          oldVenueName: action.existing.venueName,
          newVenueName: action.incoming.venueName,
        });
        changes.push(log);
        updatedCount += 1;
        if (action.scoreSyncUpdate?.applyToDisplayed) resultsUpdatedCount += 1;
      }
    }

    return {
      summary: {
        sourceId: source.id,
        processedCount: incomingMatches.length,
        createdCount,
        updatedCount,
        unchangedCount,
        resultsUpdatedCount,
        changes,
      },
      touchedEventIds,
    };
  }
}
