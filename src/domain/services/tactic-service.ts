import { TacticRepository } from "../adapters/m4-repositories";
import { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canManageTacticsAndTraining,
  canViewTeam,
  isTeamCoachingStaff,
  ViewerContext,
} from "../policies/rbac";
import {
  CreateTacticPlaySchema,
  TacticPlayDTO,
  UpdateTacticPlaySchema,
} from "../schemas/tactic";

export class TacticService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly tactics: TacticRepository
  ) {}

  async listPlays(
    viewer: ViewerContext,
    teamId: string
  ): Promise<TacticPlayDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf das Playbook.");
    }

    const coachingStaff = isTeamCoachingStaff(viewer, team.id, team.clubId);
    // Spieler, Eltern, Betreuer und Helfer sehen ausschließlich freigegebene Spielzüge
    return this.tactics.listByTeam(team.id, !coachingStaff);
  }

  async getPlay(
    viewer: ViewerContext,
    teamId: string,
    playId: string
  ): Promise<TacticPlayDTO> {
    const play = await this.tactics.findById(playId);
    if (!play || play.teamId !== teamId) {
      throw DomainError.notFound("Spielzug nicht gefunden.");
    }
    if (!canViewTeam(viewer, play.teamId, play.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Spielzug.");
    }
    const coachingStaff = isTeamCoachingStaff(viewer, play.teamId, play.clubId);
    if (!coachingStaff && !play.isSharedWithTeam) {
      throw DomainError.forbidden(
        "Dieser Spielzug ist noch nicht für die Mannschaft freigegeben."
      );
    }
    return play;
  }

  async createPlay(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TacticPlayDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageTacticsAndTraining(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Spielzüge anlegen."
      );
    }

    const parsed = CreateTacticPlaySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Spielzug-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.tactics.create(team.clubId, team.id, viewer.userId, parsed.data);
  }

  async updatePlay(
    viewer: ViewerContext,
    teamId: string,
    playId: string,
    rawInput: unknown
  ): Promise<TacticPlayDTO> {
    const play = await this.tactics.findById(playId);
    if (!play || play.teamId !== teamId) {
      throw DomainError.notFound("Spielzug nicht gefunden.");
    }
    if (!canManageTacticsAndTraining(viewer, play.teamId, play.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Bearbeiten.");
    }

    const parsed = UpdateTacticPlaySchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Spielzug-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.tactics.update(playId, parsed.data);
  }

  async deletePlay(
    viewer: ViewerContext,
    teamId: string,
    playId: string
  ): Promise<void> {
    const play = await this.tactics.findById(playId);
    if (!play || play.teamId !== teamId) {
      throw DomainError.notFound("Spielzug nicht gefunden.");
    }
    if (!canManageTacticsAndTraining(viewer, play.teamId, play.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.tactics.delete(playId);
  }
}
