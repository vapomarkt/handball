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
  OpponentDTO,
  OpponentPlayerDTO,
  ScoutingNoteDTO,
  UpdateOpponentSchema,
  UpdateScoutingNoteSchema,
} from "../schemas/scouting";

export class ScoutingService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly scouting: ScoutingRepository
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
