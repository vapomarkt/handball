import { TrainingRepository } from "../adapters/m3-repositories";
import { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canManageTacticsAndTraining,
  canViewTeam,
  isTeamCoachingStaff,
  ViewerContext,
} from "../policies/rbac";
import {
  CreateDrillSchema,
  CreateTrainingPlanSchema,
  DrillDTO,
  TrainingPlanDTO,
  UpdateTrainingPlanSchema,
} from "../schemas/training";

export class TrainingService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly training: TrainingRepository
  ) {}

  async listDrills(viewer: ViewerContext, teamId: string): Promise<DrillDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf die Übungsbibliothek.");
    }
    return this.training.listDrills(team.clubId, team.id);
  }

  async createDrill(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<DrillDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageTacticsAndTraining(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Übungen anlegen."
      );
    }

    const parsed = CreateDrillSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Übungsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.training.createDrill(
      team.clubId,
      parsed.data.teamScope === "TEAM" ? team.id : null,
      viewer.userId,
      parsed.data
    );
  }

  async deleteDrill(
    viewer: ViewerContext,
    teamId: string,
    drillId: string
  ): Promise<void> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageTacticsAndTraining(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    const drill = await this.training.findDrillById(drillId);
    if (!drill || drill.clubId !== team.clubId) {
      throw DomainError.notFound("Übung nicht gefunden.");
    }
    await this.training.deleteDrill(drillId);
  }

  async listTrainingPlans(
    viewer: ViewerContext,
    teamId: string
  ): Promise<TrainingPlanDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf die Trainingspläne.");
    }

    const coachingStaff = isTeamCoachingStaff(viewer, team.id, team.clubId);
    return this.training.listTrainingPlansByTeam(team.id, !coachingStaff);
  }

  async createTrainingPlan(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TrainingPlanDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) throw DomainError.notFound("Mannschaft nicht gefunden.");
    if (!canManageTacticsAndTraining(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Trainingspläne anlegen."
      );
    }

    const parsed = CreateTrainingPlanSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Trainingsplandaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.training.createTrainingPlan(
      team.clubId,
      team.id,
      viewer.userId,
      parsed.data
    );
  }

  async updateTrainingPlan(
    viewer: ViewerContext,
    teamId: string,
    planId: string,
    rawInput: unknown
  ): Promise<TrainingPlanDTO> {
    const plan = await this.training.findTrainingPlanById(planId);
    if (!plan || plan.teamId !== teamId) {
      throw DomainError.notFound("Trainingsplan nicht gefunden.");
    }
    if (!canManageTacticsAndTraining(viewer, plan.teamId, plan.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Bearbeiten.");
    }

    const parsed = UpdateTrainingPlanSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Trainingsplandaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.training.updateTrainingPlan(planId, parsed.data);
  }

  async deleteTrainingPlan(
    viewer: ViewerContext,
    teamId: string,
    planId: string
  ): Promise<void> {
    const plan = await this.training.findTrainingPlanById(planId);
    if (!plan || plan.teamId !== teamId) {
      throw DomainError.notFound("Trainingsplan nicht gefunden.");
    }
    if (!canManageTacticsAndTraining(viewer, plan.teamId, plan.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Löschen.");
    }
    await this.training.deleteTrainingPlan(planId);
  }
}
