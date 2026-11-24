import {
  GuardianRepository,
  MemberRepository,
  TeamRepository,
  UserLookupRepository,
} from "../adapters/repositories";
import { DomainError } from "../errors";
import { canManageGuardians, ViewerContext } from "../policies/rbac";
import {
  CreateGuardianLinkSchema,
  GuardianLinkDTO,
} from "../schemas/invite";

export class GuardianService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly guardians: GuardianRepository,
    private readonly users: UserLookupRepository
  ) {}

  async listMyLinkedChildren(viewer: ViewerContext): Promise<GuardianLinkDTO[]> {
    return this.guardians.findByGuardianUserId(viewer.userId);
  }

  async listTeamGuardianLinks(
    viewer: ViewerContext,
    teamId: string
  ): Promise<GuardianLinkDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageGuardians(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen alle Eltern-Kind-Verknüpfungen einsehen."
      );
    }
    return this.guardians.findByTeamId(teamId);
  }

  async linkGuardianToChild(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<GuardianLinkDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageGuardians(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen Eltern-Kind-Verknüpfungen anlegen."
      );
    }

    const parsed = CreateGuardianLinkSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Daten für Eltern-Kind-Verknüpfung.",
        parsed.error.flatten().fieldErrors
      );
    }

    const child = await this.members.findById(parsed.data.childMemberId);
    if (!child || child.teamId !== teamId) {
      throw DomainError.notFound("Jugendspieler-Profil nicht gefunden.");
    }

    const guardianUser = await this.users.findByEmail(parsed.data.guardianEmail);
    if (!guardianUser) {
      throw DomainError.notFound(
        "Kein Benutzerkonto mit dieser E-Mail gefunden. Nutze alternativ einen Eltern-Einladungslink."
      );
    }

    const already = await this.guardians.exists(guardianUser.id, child.id);
    if (already) {
      throw DomainError.conflict(
        "Diese Eltern-Kind-Verknüpfung existiert bereits."
      );
    }

    // Sicherstellen, dass das Elternteil eine PARENT-Mitgliedschaft im Team hat
    const existingMember = await this.members.findByTeamAndUser(
      team.id,
      guardianUser.id
    );
    if (!existingMember) {
      const parts = guardianUser.name.trim().split(/\s+/);
      await this.members.create(team.clubId, team.id, {
        firstName: parts[0] ?? "Elternteil",
        lastName: parts.slice(1).join(" ") || "Eltern",
        role: "PARENT",
        userId: guardianUser.id,
        email: guardianUser.email,
        availabilityStatus: "FIT",
        teamRoles: [],
        isMinor: false,
        jerseyNumber: null,
        primaryPosition: null,
        secondaryPosition: null,
        throwingHand: null,
        passNumber: null,
        injuryNote: null,
        emergencyContact: null,
        phone: null,
      });
    }

    return this.guardians.create({
      guardianUserId: guardianUser.id,
      childMemberId: child.id,
      relationship: parsed.data.relationship,
    });
  }

  async unlinkGuardian(
    viewer: ViewerContext,
    teamId: string,
    linkId: string
  ): Promise<void> {
    const link = await this.guardians.findById(linkId);
    if (!link || link.teamId !== teamId) {
      throw DomainError.notFound("Eltern-Kind-Verknüpfung nicht gefunden.");
    }
    if (!canManageGuardians(viewer, link.teamId, link.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen Eltern-Kind-Verknüpfungen lösen."
      );
    }
    await this.guardians.delete(linkId);
  }
}
