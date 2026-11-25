import { JerseySetRepository } from "../adapters/jersey-set-repository";
import { TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canManageJerseySets,
  canViewClub,
  ViewerContext,
} from "../policies/rbac";
import {
  CreateJerseySetSchema,
  JerseySetDTO,
  UpdateJerseySetSchema,
} from "../schemas/jersey-set";

export class JerseySetService {
  constructor(
    private readonly jerseySets: JerseySetRepository,
    private readonly teams: TeamRepository
  ) {}

  async listJerseySets(
    viewer: ViewerContext,
    clubId: string,
    filter?: { teamId?: string }
  ): Promise<JerseySetDTO[]> {
    if (!canViewClub(viewer, clubId)) {
      throw DomainError.forbidden(
        "Kein Zugriff auf die Trikotsätze dieses Vereins."
      );
    }
    return this.jerseySets.findByClubId(clubId, filter);
  }

  async createJerseySet(
    viewer: ViewerContext,
    clubId: string,
    rawInput: unknown
  ): Promise<JerseySetDTO> {
    const parsed = CreateJerseySetSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Trikotsatz-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const data = parsed.data;

    if (data.teamId) {
      const team = await this.teams.findById(data.teamId);
      if (!team || team.clubId !== clubId) {
        throw DomainError.notFound("Ausgewählte Mannschaft nicht gefunden.");
      }
    }

    if (!canManageJerseySets(viewer, clubId, data.teamId ?? null)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Trikotsätze anlegen."
      );
    }

    return this.jerseySets.create(clubId, data);
  }

  async updateJerseySet(
    viewer: ViewerContext,
    clubId: string,
    jerseySetId: string,
    rawInput: unknown
  ): Promise<JerseySetDTO> {
    const existing = await this.jerseySets.findById(jerseySetId);
    if (!existing || existing.clubId !== clubId) {
      throw DomainError.notFound("Trikotsatz nicht gefunden.");
    }

    if (!canManageJerseySets(viewer, clubId, existing.teamId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen diesen Trikotsatz bearbeiten."
      );
    }

    const parsed = UpdateJerseySetSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Trikotsatz-Daten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const data = parsed.data;
    if (data.teamId !== undefined && data.teamId !== existing.teamId) {
      if (data.teamId) {
        const team = await this.teams.findById(data.teamId);
        if (!team || team.clubId !== clubId) {
          throw DomainError.notFound("Ausgewählte Mannschaft nicht gefunden.");
        }
      }
      if (!canManageJerseySets(viewer, clubId, data.teamId)) {
        throw DomainError.forbidden(
          "Keine Berechtigung, den Trikotsatz dieser Mannschaft zuzuordnen."
        );
      }
    }

    return this.jerseySets.update(jerseySetId, data);
  }

  async deleteJerseySet(
    viewer: ViewerContext,
    clubId: string,
    jerseySetId: string
  ): Promise<void> {
    const existing = await this.jerseySets.findById(jerseySetId);
    if (!existing || existing.clubId !== clubId) {
      throw DomainError.notFound("Trikotsatz nicht gefunden.");
    }

    if (!canManageJerseySets(viewer, clubId, existing.teamId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen diesen Trikotsatz löschen."
      );
    }

    await this.jerseySets.delete(jerseySetId);
  }
}
