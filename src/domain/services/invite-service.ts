import {
  GuardianRepository,
  InviteRepository,
  MemberRepository,
  TeamRepository,
} from "../adapters/repositories";
import { DomainError } from "../errors";
import { canManageInvites, ViewerContext } from "../policies/rbac";
import {
  ClaimInviteSchema,
  CreateTeamInviteSchema,
  InvitePreviewDTO,
  TeamInviteDTO,
  TeamInviteEntity,
} from "../schemas/invite";

function generateToken(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let token = "";
  for (let i = 0; i < 20; i++) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return token;
}

function validateInviteUsable(
  invite: TeamInviteEntity,
  now: Date
): { valid: boolean; reason?: string } {
  if (invite.revokedAt) {
    return { valid: false, reason: "Diese Einladung wurde widerrufen." };
  }
  if (invite.expiresAt.getTime() < now.getTime()) {
    return { valid: false, reason: "Diese Einladung ist abgelaufen." };
  }
  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) {
    return {
      valid: false,
      reason: "Diese Einladung wurde bereits vollständig eingelöst.",
    };
  }
  return { valid: true };
}

function toInviteDTO(
  invite: TeamInviteEntity,
  targetMemberName?: string | null
): TeamInviteDTO {
  return {
    id: invite.id,
    clubId: invite.clubId,
    teamId: invite.teamId,
    token: invite.token,
    type: invite.type,
    role: invite.role,
    targetMemberId: invite.targetMemberId,
    targetMemberName: targetMemberName ?? null,
    maxUses: invite.maxUses,
    usedCount: invite.usedCount,
    expiresAt: invite.expiresAt.toISOString(),
    revokedAt: invite.revokedAt ? invite.revokedAt.toISOString() : null,
    createdAt: invite.createdAt.toISOString(),
  };
}

export class InviteService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly members: MemberRepository,
    private readonly invites: InviteRepository,
    private readonly guardians: GuardianRepository
  ) {}

  async listInvites(
    viewer: ViewerContext,
    teamId: string
  ): Promise<TeamInviteDTO[]> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageInvites(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Keine Berechtigung zum Einsehen der Einladungslinks."
      );
    }

    const rows = await this.invites.findByTeamId(teamId);
    return rows.map((row) => toInviteDTO(row.invite, row.targetMemberName));
  }

  async createInvite(
    viewer: ViewerContext,
    teamId: string,
    rawInput: unknown
  ): Promise<TeamInviteDTO> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageInvites(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer, Co-Trainer oder Vereins-Admins dürfen Einladungen erstellen."
      );
    }

    const parsed = CreateTeamInviteSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Einladungsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const input = parsed.data;
    let targetMemberName: string | null = null;

    if (input.targetMemberId) {
      const target = await this.members.findById(input.targetMemberId);
      if (!target || target.teamId !== team.id) {
        throw DomainError.notFound("Ziel-Kaderprofil nicht gefunden.");
      }
      if (input.type === "PROFILE_CLAIM" && target.userId !== null) {
        throw DomainError.conflict(
          "Dieses Kader-Profil ist bereits mit einem Benutzerkonto verknüpft."
        );
      }
      targetMemberName = `${target.firstName} ${target.lastName}`;
    }

    const expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
    );

    const maxUses =
      input.type === "PROFILE_CLAIM"
        ? 1
        : input.maxUses ?? (input.type === "GUARDIAN_LINK" ? 2 : 30);

    const invite = await this.invites.create({
      clubId: team.clubId,
      teamId: team.id,
      token: generateToken(),
      type: input.type,
      role: input.type === "GUARDIAN_LINK" ? "PARENT" : input.role,
      targetMemberId: input.targetMemberId ?? null,
      createdByUserId: viewer.userId,
      maxUses,
      expiresAt,
    });

    return toInviteDTO(invite, targetMemberName);
  }

  async revokeInvite(
    viewer: ViewerContext,
    teamId: string,
    inviteId: string
  ): Promise<void> {
    const team = await this.teams.findById(teamId);
    if (!team) {
      throw DomainError.notFound("Mannschaft nicht gefunden.");
    }
    if (!canManageInvites(viewer, team.id, team.clubId)) {
      throw DomainError.forbidden("Keine Berechtigung zum Widerrufen.");
    }
    const invite = await this.invites.findById(inviteId);
    if (!invite || invite.teamId !== teamId) {
      throw DomainError.notFound("Einladung nicht gefunden.");
    }
    await this.invites.revoke(inviteId);
  }

  async previewInvite(token: string, now = new Date()): Promise<InvitePreviewDTO> {
    const found = await this.invites.findByTokenWithContext(token);
    if (!found) {
      throw DomainError.notFound("Einladungslink nicht gefunden.");
    }

    const validity = validateInviteUsable(found.invite, now);
    let isValid = validity.valid;
    let invalidReason = validity.reason;

    if (
      isValid &&
      found.invite.type === "PROFILE_CLAIM" &&
      found.targetMember?.userId
    ) {
      isValid = false;
      invalidReason = "Dieses Kader-Profil wurde bereits übernommen.";
    }

    return {
      token: found.invite.token,
      type: found.invite.type,
      role: found.invite.role,
      clubName: found.clubName,
      teamName: found.teamName,
      seasonName: found.seasonName,
      // DSGVO: In der öffentlichen Vorschau nur Vorname des Zielprofils
      targetMemberFirstName: found.targetMember?.firstName ?? null,
      isValid,
      ...(invalidReason ? { invalidReason } : {}),
    };
  }

  async claimInvite(
    viewer: ViewerContext,
    token: string,
    rawInput: unknown,
    now = new Date()
  ) {
    const found = await this.invites.findByTokenWithContext(token);
    if (!found) {
      throw DomainError.notFound("Einladungslink nicht gefunden.");
    }

    const validity = validateInviteUsable(found.invite, now);
    if (!validity.valid) {
      throw DomainError.inviteInvalid(
        validity.reason ?? "Einladung ist ungültig."
      );
    }

    const parsed = ClaimInviteSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Eingaben.",
        parsed.error.flatten().fieldErrors
      );
    }

    const { invite, targetMember } = found;

    if (invite.type === "PROFILE_CLAIM") {
      if (!targetMember) {
        throw DomainError.notFound("Zugehöriges Kader-Profil nicht gefunden.");
      }
      if (targetMember.userId !== null) {
        throw DomainError.conflict(
          "Dieses Kader-Profil wurde bereits von einem anderen Konto übernommen."
        );
      }

      const existingInTeam = await this.members.findByTeamAndUser(
        invite.teamId,
        viewer.userId
      );
      if (existingInTeam) {
        throw DomainError.conflict(
          "Dein Konto ist bereits Mitglied dieser Mannschaft."
        );
      }

      const claimed = await this.members.assignUser(
        targetMember.id,
        viewer.userId
      );
      await this.invites.incrementUsedCount(invite.id);
      return {
        type: invite.type,
        teamId: invite.teamId,
        memberId: claimed.id,
      };
    }

    if (invite.type === "GUARDIAN_LINK") {
      if (!targetMember) {
        throw DomainError.notFound("Jugendspieler-Profil nicht gefunden.");
      }

      const alreadyLinked = await this.guardians.exists(
        viewer.userId,
        targetMember.id
      );
      if (!alreadyLinked) {
        await this.guardians.create({
          guardianUserId: viewer.userId,
          childMemberId: targetMember.id,
          relationship: parsed.data.relationship,
        });
      }

      // Falls das Elternteil noch kein PARENT-Mitglied im Team ist, anlegen
      const existingParent = await this.members.findByTeamAndUser(
        invite.teamId,
        viewer.userId
      );
      if (!existingParent) {
        const nameParts = viewer.name.trim().split(/\s+/);
        const firstName = parsed.data.firstName ?? nameParts[0] ?? "Elternteil";
        const lastName =
          parsed.data.lastName ??
          (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

        await this.members.create(invite.clubId, invite.teamId, {
          firstName,
          lastName: lastName || firstName,
          role: "PARENT",
          userId: viewer.userId,
          email: viewer.email,
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

      await this.invites.incrementUsedCount(invite.id);
      return {
        type: invite.type,
        teamId: invite.teamId,
        childMemberId: targetMember.id,
      };
    }

    // TEAM_JOIN
    const existingInTeam = await this.members.findByTeamAndUser(
      invite.teamId,
      viewer.userId
    );
    if (existingInTeam) {
      throw DomainError.conflict("Du bist bereits Mitglied dieser Mannschaft.");
    }

    const nameParts = viewer.name.trim().split(/\s+/);
    const firstName = parsed.data.firstName ?? nameParts[0] ?? "Mitglied";
    const lastName =
      parsed.data.lastName ??
      (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "Neu");

    const joined = await this.members.create(invite.clubId, invite.teamId, {
      firstName,
      lastName,
      role: invite.role,
      userId: viewer.userId,
      email: viewer.email,
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

    await this.invites.incrementUsedCount(invite.id);
    return {
      type: invite.type,
      teamId: invite.teamId,
      memberId: joined.id,
    };
  }
}
