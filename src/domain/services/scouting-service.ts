import { LeagueDirectoryRepository } from "../adapters/league-directory-repository";
import { FetchTextFn } from "../adapters/league-provider";
import { ScoutingRepository } from "../adapters/m4-repositories";
import { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canManageEvents,
  canViewTeam,
  isTeamStaff,
  ViewerContext,
} from "../policies/rbac";
import {
  CreateOpponentPlayerSchema,
  CreateOpponentSchema,
  CreateScoutingNoteSchema,
  DEFAULT_SHOT_ZONES,
  NuligaImportOpponentPlayersResultDTO,
  NuligaImportOpponentPlayersSchema,
  NuligaOpponentPlayersPreviewResponseDTO,
  NuligaPreviewOpponentPlayersSchema,
  OpponentDTO,
  OpponentPlayerDTO,
  ScoutingNoteDTO,
  UpdateOpponentSchema,
  UpdateScoutingNoteSchema,
} from "../schemas/scouting";
import {
  fetchNuligaOpponentPlayers,
  isAllowedNuligaUrl,
  normalizePlayerNameKey,
  teamNamesMatch,
} from "./nuliga-opponent-players";

export class ScoutingService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scouting: ScoutingRepository,
    private readonly leagueDirectory?: LeagueDirectoryRepository,
    private readonly fetchText?: FetchTextFn
  ) {}

  async listOpponents(
    viewer: ViewerContext,
    teamId: string
  ): Promise<OpponentDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf Gegner-Dossiers.");
    }
    const staff = isTeamStaff(viewer, team.id, team.clubId);
    return this.scouting.listOpponentsByTeam(team.id, !staff);
  }

  async createOpponent(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<OpponentDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Gegner-Dossiers anlegen."
      );
    }

    const parsed = CreateOpponentSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Gegnerdaten.",
        parsed.error.flatten().fieldErrors
      );
    }
    return this.scouting.createOpponent(team.clubId, team.id, parsed.data);
  }

  async updateOpponent(
    viewer: ViewerContext,
    teamId: string,
    opponentId: string,
    rawInput: unknown
  ): Promise<OpponentDTO> {
    const existing = await this.scouting.findOpponentById(opponentId, false);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Gegner-Dossier nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Bearbeiten.");
    }

    const parsed = UpdateOpponentSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Gegnerdaten.",
        parsed.error.flatten().fieldErrors
      );
    }
    return this.scouting.updateOpponent(opponentId, parsed.data);
  }

  async deleteOpponent(
    viewer: ViewerContext,
    teamId: string,
    opponentId: string
  ): Promise<void> {
    const existing = await this.scouting.findOpponentById(opponentId, false);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Gegner-Dossier nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.scouting.deleteOpponent(opponentId);
  }

  async addKeyPlayer(
    viewer: ViewerContext,
    teamId: string,
    opponentId: string,
    rawInput: unknown
  ): Promise<OpponentPlayerDTO> {
    const opponent = await this.scouting.findOpponentById(opponentId, false);
    if (!opponent || opponent.teamId !== teamId) {
      throw DomainError.notFound("Gegner-Dossier nicht gefunden.");
    }
    if (!canManageEvents(viewer, opponent.teamId, opponent.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Schlüsselspieler anlegen."
      );
    }

    const parsed = CreateOpponentPlayerSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Schlüsselspieler-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }
    return this.scouting.addOpponentPlayer(opponentId, parsed.data);
  }

  async deleteKeyPlayer(
    viewer: ViewerContext,
    teamId: string,
    opponentId: string,
    playerId: string
  ): Promise<void> {
    const found = await this.scouting.findOpponentPlayerById(playerId);
    if (!found || found.opponentId !== opponentId || found.teamId !== teamId) {
      throw DomainError.notFound("Schlüsselspieler nicht gefunden.");
    }
    if (!canManageEvents(viewer, found.teamId, found.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.scouting.deleteOpponentPlayer(playerId);
  }

  async previewNuligaOpponentPlayers(
    viewer: ViewerContext,
    teamId: string,
    opponentId: string,
    rawInput: unknown = {}
  ): Promise<NuligaOpponentPlayersPreviewResponseDTO> {
    const opponent = await this.scouting.findOpponentById(opponentId, false);
    if (!opponent || opponent.teamId !== teamId) {
      throw DomainError.notFound("Gegner-Dossier nicht gefunden.");
    }
    if (!canManageEvents(viewer, opponent.teamId, opponent.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen nuLiga-Spielerdaten abrufen."
      );
    }
    if (!this.fetchText) {
      throw DomainError.conflict(
        "Der nuLiga-Abruf ist in dieser Umgebung nicht konfiguriert."
      );
    }

    const parsed = NuligaPreviewOpponentPlayersSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige nuLiga-URL.",
        parsed.error.flatten().fieldErrors
      );
    }

    const manualUrl = parsed.data.sourceUrl ?? null;
    if (manualUrl && !isAllowedNuligaUrl(manualUrl)) {
      throw DomainError.validation(
        "Bitte eine gültige nuLiga-URL (https://...liga.nu/...) eingeben.",
        { sourceUrl: ["Es werden nur nuLiga-URLs (*.liga.nu) unterstützt."] }
      );
    }

    let teamUrl: string | null = null;
    let groupUrl: string | null = null;
    let clubName: string | null = null;

    const assignUrl = (url: string | null | undefined) => {
      if (!url || !isAllowedNuligaUrl(url)) return;
      if (url.includes("teamPortrait")) {
        if (!teamUrl) teamUrl = url;
      } else if (!groupUrl) {
        groupUrl = url;
      }
    };

    assignUrl(manualUrl);
    assignUrl(opponent.externalUrl);

    if (this.leagueDirectory) {
      const team = await this.teams.findById(teamId);
      if (team?.leagueGroupTeamId) {
        const groupTeam = await this.leagueDirectory.findGroupTeamById(
          team.leagueGroupTeamId
        );
        if (groupTeam) {
          if (!groupUrl) groupUrl = groupTeam.group.externalUrl;
          const sibling = groupTeam.siblingTeams.find(
            (s) =>
              teamNamesMatch(s.name, opponent.name) ||
              teamNamesMatch(s.clubName, opponent.name)
          );
          if (sibling) {
            clubName = sibling.clubName;
            if (!teamUrl && sibling.externalUrl) {
              teamUrl = sibling.externalUrl;
            }
          }
        }
      }
    }

    const fetched = await fetchNuligaOpponentPlayers(this.fetchText, {
      opponentName: opponent.name,
      clubName,
      groupUrl,
      teamUrl,
    });

    const existingByExternalId = new Map<string, OpponentPlayerDTO>();
    const existingByNameKey = new Map<string, OpponentPlayerDTO>();
    for (const kp of opponent.keyPlayers) {
      if (kp.externalPlayerId) {
        existingByExternalId.set(kp.externalPlayerId, kp);
      }
      existingByNameKey.set(normalizePlayerNameKey(kp.name), kp);
    }

    const players = fetched.players.map((candidate) => {
      const match =
        (candidate.externalPlayerId
          ? existingByExternalId.get(candidate.externalPlayerId)
          : undefined) ??
        existingByNameKey.get(normalizePlayerNameKey(candidate.name));
      return {
        ...candidate,
        alreadyImported: Boolean(match),
        existingPlayerId: match?.id ?? null,
      };
    });

    return {
      resolvedTeamUrl: fetched.resolvedTeamUrl,
      resolvedGroupUrl: fetched.resolvedGroupUrl,
      reportsAnalyzed: fetched.reportsAnalyzed,
      statisticsAvailable: fetched.statisticsAvailable,
      anonymizedDetected: fetched.anonymizedDetected,
      warning: fetched.warning,
      players,
    };
  }

  async importNuligaOpponentPlayers(
    viewer: ViewerContext,
    teamId: string,
    opponentId: string,
    rawInput: unknown
  ): Promise<NuligaImportOpponentPlayersResultDTO> {
    const opponent = await this.scouting.findOpponentById(opponentId, false);
    if (!opponent || opponent.teamId !== teamId) {
      throw DomainError.notFound("Gegner-Dossier nicht gefunden.");
    }
    if (!canManageEvents(viewer, opponent.teamId, opponent.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Schlüsselspieler importieren."
      );
    }

    const parsed = NuligaImportOpponentPlayersSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Import-Auswahl.",
        parsed.error.flatten().fieldErrors
      );
    }

    const { sourceUrl, players: selectedPlayers } = parsed.data;
    if (sourceUrl && !isAllowedNuligaUrl(sourceUrl)) {
      throw DomainError.validation(
        "Bitte eine gültige nuLiga-URL (https://...liga.nu/...) eingeben.",
        { sourceUrl: ["Es werden nur nuLiga-URLs (*.liga.nu) unterstützt."] }
      );
    }

    if (sourceUrl && sourceUrl !== opponent.externalUrl) {
      await this.scouting.updateOpponent(opponentId, { externalUrl: sourceUrl });
    }

    const existingByExternalId = new Map<string, OpponentPlayerDTO>();
    const existingByNameKey = new Map<string, OpponentPlayerDTO>();
    for (const kp of opponent.keyPlayers) {
      if (kp.externalPlayerId) {
        existingByExternalId.set(kp.externalPlayerId, kp);
      }
      existingByNameKey.set(normalizePlayerNameKey(kp.name), kp);
    }

    const nowIso = new Date().toISOString();
    let createdCount = 0;
    let updatedCount = 0;
    const saved: OpponentPlayerDTO[] = [];

    for (const p of selectedPlayers) {
      const nameKey = normalizePlayerNameKey(p.name);
      const existing =
        (p.externalPlayerId
          ? existingByExternalId.get(p.externalPlayerId)
          : undefined) ?? existingByNameKey.get(nameKey);

      if (existing) {
        // Manuelle Scouting-Felder (Position, Wurfhand, Wurfzonen, Täuschung, Notizen) bleiben erhalten!
        const updated = await this.scouting.updateOpponentPlayer(existing.id, {
          externalPlayerId: p.externalPlayerId ?? existing.externalPlayerId,
          jerseyNumber: p.jerseyNumber ?? existing.jerseyNumber,
          isSevenMeterShooter:
            p.isSevenMeterShooter || existing.isSevenMeterShooter,
          threatLevel: p.threatLevel,
          goalsTotal: p.goalsTotal ?? existing.goalsTotal,
          gamesPlayed: p.gamesPlayed ?? existing.gamesPlayed,
          sevenMeterGoals: p.sevenMeterGoals ?? existing.sevenMeterGoals,
          sevenMeterAttempts:
            p.sevenMeterAttempts ?? existing.sevenMeterAttempts,
          statsUpdatedAt: nowIso,
        });
        saved.push(updated);
        updatedCount += 1;
      } else {
        const created = await this.scouting.addOpponentPlayer(opponentId, {
          name: p.name,
          externalPlayerId: p.externalPlayerId ?? null,
          jerseyNumber: p.jerseyNumber ?? null,
          position: null,
          throwingHand: null,
          shotZones: DEFAULT_SHOT_ZONES,
          feintPreference: null,
          isSevenMeterShooter: p.isSevenMeterShooter,
          threatLevel: p.threatLevel,
          notes: null,
          goalsTotal: p.goalsTotal ?? null,
          gamesPlayed: p.gamesPlayed ?? null,
          sevenMeterGoals: p.sevenMeterGoals ?? null,
          sevenMeterAttempts: p.sevenMeterAttempts ?? null,
          statsUpdatedAt: nowIso,
        });
        existingByNameKey.set(nameKey, created);
        if (created.externalPlayerId) {
          existingByExternalId.set(created.externalPlayerId, created);
        }
        saved.push(created);
        createdCount += 1;
      }
    }

    return {
      createdCount,
      updatedCount,
      players: saved,
    };
  }

  async listScoutingNotes(
    viewer: ViewerContext,
    teamId: string,
    eventId?: string
  ): Promise<ScoutingNoteDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf Scouting-Notizen.");
    }
    const staff = isTeamStaff(viewer, team.id, team.clubId);
    return this.scouting.listNotesByTeam(team.id, !staff, eventId);
  }

  async createScoutingNote(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<ScoutingNoteDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageEvents(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Scouting-Notizen anlegen."
      );
    }

    const parsed = CreateScoutingNoteSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Scouting-Notiz.",
        parsed.error.flatten().fieldErrors
      );
    }
    return this.scouting.createNote(
      team.clubId,
      team.id,
      viewer.userId,
      parsed.data
    );
  }

  async updateScoutingNote(
    viewer: ViewerContext,
    teamId: string,
    noteId: string,
    rawInput: unknown
  ): Promise<ScoutingNoteDTO> {
    const existing = await this.scouting.findNoteById(noteId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Scouting-Notiz nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Bearbeiten.");
    }

    const parsed = UpdateScoutingNoteSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Scouting-Notiz.",
        parsed.error.flatten().fieldErrors
      );
    }
    return this.scouting.updateNote(noteId, parsed.data);
  }

  async deleteScoutingNote(
    viewer: ViewerContext,
    teamId: string,
    noteId: string
  ): Promise<void> {
    const existing = await this.scouting.findNoteById(noteId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Scouting-Notiz nicht gefunden.");
    }
    if (!canManageEvents(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.scouting.deleteNote(noteId);
  }
}
