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
  LeagueImportSourceDTO,
  LeagueSyncChangeLogDTO,
  SyncRunSummaryDTO,
  TriggerIcalSyncSchema,
} from "../schemas/league";
import { CsvLeagueProviderAdapter } from "./csv-parser";
import { IcalLeagueProviderAdapter } from "./ical-parser";
import { computeLeagueMergePlan } from "./league-merge";

export class LeagueSyncService {
  private readonly icalAdapter = new IcalLeagueProviderAdapter();
  private readonly csvAdapter = new CsvLeagueProviderAdapter();

  constructor(
    private readonly teams: TeamRepository,
    private readonly leagueSync: LeagueSyncRepository,
    private readonly fetchText: FetchTextFn
  ) {}

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

    return this.executeIcalSync(source, parsed.data.icalContent);
  }

  /**
   * Wird sowohl manuell als auch vom stündlichen pg-boss Background-Worker aufgerufen.
   */
  async syncSourceById(sourceId: string): Promise<SyncRunSummaryDTO> {
    const source = await this.leagueSync.findSourceById(sourceId);
    if (!source) {
      throw DomainError.notFound("Importquelle nicht gefunden.");
    }
    return this.executeIcalSync(source);
  }

  async syncAllEnabledIcalSources(): Promise<{
    sourcesProcessed: number;
    errors: Array<{ sourceId: string; message: string }>;
  }> {
    const sources = await this.leagueSync.listEnabledIcalSources();
    const errors: Array<{ sourceId: string; message: string }> = [];

    for (const source of sources) {
      try {
        await this.executeIcalSync(source);
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

  private async executeIcalSync(
    source: LeagueImportSourceDTO,
    inlineIcalContent?: string
  ): Promise<SyncRunSummaryDTO> {
    try {
      let rawIcal = inlineIcalContent;
      if (!rawIcal) {
        if (!source.sourceUrl) {
          throw DomainError.validation(
            "Für diese Importquelle ist keine iCal-URL hinterlegt."
          );
        }
        rawIcal = await this.fetchText(source.sourceUrl);
      }

      const matches = this.icalAdapter.parse(rawIcal, {
        teamNameMatch: source.teamNameMatch,
      });

      const summary = await this.applyMergedMatches(source, matches);
      await this.leagueSync.updateSourceSyncStatus(source.id, "SUCCESS", null);
      return summary;
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
    const existing = await this.leagueSync.findSyncedMatchesByTeam(
      source.teamId
    );
    const plan = computeLeagueMergePlan(existing, incomingMatches);

    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const changes: LeagueSyncChangeLogDTO[] = [];

    for (const action of plan) {
      if (action.kind === "UNCHANGED") {
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
        });

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
        });

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
      }
    }

    return {
      sourceId: source.id,
      processedCount: incomingMatches.length,
      createdCount,
      updatedCount,
      unchangedCount,
      changes,
    };
  }
}
