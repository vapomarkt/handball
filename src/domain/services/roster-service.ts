import { MemberRepository, TeamRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import { projectTeamMemberDTO } from "../policies/gdpr";
import {
  canDeleteMember,
  canManageRoster,
  canViewTeam,
  getMemberEditScope,
  ViewerContext,
} from "../policies/rbac";
import {
  CreateTeamMemberSchema,
  SelfUpdateMemberSchema,
  TeamMemberResponseDTO,
  UpdateTeamMemberSchema,
} from "../schemas/member";

export class RosterService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository
  ) {}

  async listRoster(
    viewer: ViewerContext,
    teamId: string
  ): Promise<TeamMemberResponseDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canViewTeam(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Kader.");
    }

    const roster = await this.members.findByTeamId(teamId);
    return roster.map((member) => projectTeamMemberDTO(viewer, member));
  }

  async getMember(
    viewer: ViewerContext,
    teamId: string,
    memberId: string
  ): Promise<TeamMemberResponseDTO> {
    const member = await this.members.findById(memberId);
    if (!member || member.teamId !== teamId) {
      throw DomainError.notFound("Kader-Mitglied nicht gefunden.");
    }
    if (!canViewTeam(viewer, member.teamId, member.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf dieses Profil.");
    }
    return projectTeamMemberDTO(viewer, member);
  }

  async addMember(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TeamMemberResponseDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageRoster(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer, Betreuer oder Vereins-Admins dürfen Spieler anlegen."
      );
    }

    const parsed = CreateTeamMemberSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Spielerdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const created = await this.members.create(team.clubId, team.id, {
      ...parsed.data,
      userId: null, // Entkoppeltes Profil bis zum Claim-Flow
    });

    return projectTeamMemberDTO(viewer, created);
  }

  async updateMember(
    viewer: ViewerContext,
    teamId: string,
    memberId: string,
    rawInput: unknown
  ): Promise<TeamMemberResponseDTO> {
    const existing = await this.members.findById(memberId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Kader-Mitglied nicht gefunden.");
    }

    const scope = getMemberEditScope(viewer, existing);
    if (scope === "NONE") {
      throw DomainError.forbidden(
        "Keine Berechtigung zum Bearbeiten dieses Profils."
      );
    }

    if (scope === "FULL") {
      const parsed = UpdateTeamMemberSchema.safeParse(rawInput);
      if (!parsed.success) {
        throw DomainError.validation(
          "Ungültige Profildaten.",
          parsed.error.flatten().fieldErrors
        );
      }
      const updated = await this.members.update(memberId, parsed.data);
      return projectTeamMemberDTO(viewer, updated);
    }

    // SELF_OR_GUARDIAN: nur erlaubte Profilfelder (Positionen nur bei Spielern)
    const parsed = SelfUpdateMemberSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Profildaten.",
        parsed.error.flatten().fieldErrors
      );
    }
    const sanitized =
      existing.role === "PLAYER"
        ? parsed.data
        : {
            ...parsed.data,
            primaryPosition: undefined,
            secondaryPosition: undefined,
          };
    const updated = await this.members.update(memberId, sanitized);
    return projectTeamMemberDTO(viewer, updated);
  }

  async deleteMember(
    viewer: ViewerContext,
    teamId: string,
    memberId: string
  ): Promise<void> {
    const existing = await this.members.findById(memberId);
    if (!existing || existing.teamId !== teamId) {
      throw DomainError.notFound("Kader-Mitglied nicht gefunden.");
    }
    if (!canDeleteMember(viewer, existing.teamId, existing.clubId)) {
      throw DomainError.forbidden(
        "Nur Cheftrainer oder Vereins-Admins dürfen Kader-Profile entfernen."
      );
    }

    await this.members.delete(memberId);
  }
}
