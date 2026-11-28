import {
  GuardianRepository,
  InviteRepository,
  MemberRepository,
  TeamRepository,
} from "../adapters/repositories";
import { DomainError } from "../errors";
import { canManageInvites, isClubAdmin, ViewerContext } from "../policies/rbac";
import {
  formatMemberRoles,
  getEffectiveRoles,
  getPrimaryMemberRole,
  hasMemberRole,
  InviteType,
  MemberRole,
  normalizeMemberRoles,
} from "../schemas/handball";
import {
  ClaimInviteSchema,
  CreateTeamInviteSchema,
  InvitePreviewDTO,
  TeamInviteDTO,
  TeamInviteEntity,
} from "../schemas/invite";
import { normalizePlayerNameKey } from "./nuliga-opponent-players";

const TOKEN_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateToken(): string {
  let token = "";
  for (let i = 0; i < 20; i++) {
    token += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)];
  }
  return token;
}

export function generateShortCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code +=
      SHORT_CODE_ALPHABET[
        Math.floor(Math.random() * SHORT_CODE_ALPHABET.length)
      ];
  }
  return code;
}

export function formatShortCode(code: string | null | undefined): string {
  if (!code) return "";
  const clean = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
}

/**
 * Formatiert Mannschafts- und Vereinsname gemeinsam (z. B. für Einladungslinks,
 * Kurzcodes, QR-Codes und Link-Vorschauen). Vermeidet Doppelungen, falls der
 * Vereinsname bereits im Mannschaftsnamen enthalten ist.
 */
export function formatTeamClubLabel(
  teamName?: string | null,
  clubName?: string | null
): string {
  const team = teamName?.trim() ?? "";
  const club = clubName?.trim() ?? "";
  if (team && club) {
    if (team.toLowerCase().includes(club.toLowerCase())) {
      return team;
    }
    return `${team} · ${club}`;
  }
  return team || club;
}

export interface InviteShareTextParams {
  type: InviteType;
  role: MemberRole;
  roles?: readonly MemberRole[];
  inviteUrl: string;
  shortCode?: string | null;
  targetMemberName?: string | null;
  teamName?: string | null;
  clubName?: string | null;
}

/**
 * Erzeugt den vollständigen Einladungstext zum Teilen (WhatsApp, Kopieren etc.)
 * inkl. Mannschafts- und Vereinsname, Link sowie 6-stelligem Kurzcode.
 */
export function buildInviteShareText(params: InviteShareTextParams): string {
  const short = params.shortCode ? formatShortCode(params.shortCode) : null;
  const teamClub = formatTeamClubLabel(params.teamName, params.clubName);
  const teamLabel = teamClub ? ` (${teamClub})` : "";
  const roleLabel = formatMemberRoles(
    normalizeMemberRoles({ roles: params.roles, role: params.role }),
    " / "
  );

  const greeting =
    params.type === "GUARDIAN_LINK" && params.targetMemberName
      ? `Hallo! Hier ist euer Eltern-Zugang zu ThrowOff${teamLabel} für ${params.targetMemberName}:`
      : params.type === "PROFILE_CLAIM" && params.targetMemberName
        ? `Hi ${params.targetMemberName.split(" ")[0]}! Hier ist dein persönlicher Link zu ThrowOff${teamLabel}:`
        : `Hallo! Tritt unserem Team${teamLabel} als ${roleLabel} bei ThrowOff bei:`;

  const lines = [
    greeting,
    params.inviteUrl,
    ...(short ? [`Oder gib einfach den Team-Code ein: ${short}`] : []),
    "Anmeldung geht in 30 Sekunden per E-Mail-Code – kein Passwort nötig.",
  ];

  return lines.join("\n");
}

/**
 * Normalisiert Benutzereingaben aus WhatsApp, QR-Code oder Code-Feld:
 * - Volle URL (`https://throwoff.app/invite/abc...`) -> `abc...`
 * - 6-stelliger Kurzcode mit Bindestrich/Leerzeichen (`h7k-4p9`, `H7K 4P9`) -> `H7K4P9`
 * - 20-stelliger Token bleibt case-sensitive erhalten.
 */
export function normalizeInviteLookup(raw: string): string {
  let trimmed = raw.trim();
  if (!trimmed) return "";

  const inviteSegment = trimmed.match(/\/invite\/([^/?#\s]+)/i);
  if (inviteSegment && inviteSegment[1]) {
    trimmed = decodeURIComponent(inviteSegment[1]).trim();
  }

  const strippedShort = trimmed.replace(/[-\s]/g, "");
  if (/^[a-zA-Z0-9]{6}$/.test(strippedShort)) {
    return strippedShort.toUpperCase();
  }

  return trimmed;
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

function resolveInviteRoles(invite: Pick<TeamInviteEntity, "role" | "roles">): MemberRole[] {
  return normalizeMemberRoles({ roles: invite.roles, role: invite.role });
}

function toInviteDTO(
  invite: TeamInviteEntity,
  targetMemberName?: string | null
): TeamInviteDTO {
  const roles = resolveInviteRoles(invite);
  return {
    id: invite.id,
    clubId: invite.clubId,
    teamId: invite.teamId,
    token: invite.token,
    shortCode: invite.shortCode ?? null,
    type: invite.type,
    role: getPrimaryMemberRole(roles, invite.role),
    roles,
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

  private async allocateShortCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = generateShortCode();
      if (!this.invites.findByShortCode) {
        return candidate;
      }
      const existing = await this.invites.findByShortCode(candidate);
      if (!existing) {
        return candidate;
      }
    }
    return generateShortCode();
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
        "Nur Trainer, Co-Trainer, Betreuer oder Vereins-Admins dürfen Einladungen erstellen."
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
    let targetMemberRoles: MemberRole[] | null = null;

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
      targetMemberRoles = getEffectiveRoles(target);
    }

    const expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
    );

    const maxUses =
      input.type === "PROFILE_CLAIM"
        ? 1
        : input.maxUses ?? (input.type === "GUARDIAN_LINK" ? 2 : 30);

    const shortCode = await this.allocateShortCode();

    const effectiveRoles: MemberRole[] =
      input.type === "GUARDIAN_LINK"
        ? ["PARENT"]
        : input.type === "PROFILE_CLAIM" && targetMemberRoles
          ? targetMemberRoles
          : normalizeMemberRoles({ roles: input.roles, role: input.role });

    if (
      effectiveRoles.includes("CLUB_ADMIN") &&
      !isClubAdmin(viewer, team.clubId)
    ) {
      throw DomainError.forbidden(
        "Nur Vereins-Admins dürfen Einladungen mit der Rolle Vereins-Admin erstellen."
      );
    }

    const effectivePrimaryRole = getPrimaryMemberRole(
      effectiveRoles,
      input.roles ? null : input.role
    );

    const invite = await this.invites.create({
      clubId: team.clubId,
      teamId: team.id,
      token: generateToken(),
      shortCode,
      type: input.type,
      role: effectivePrimaryRole,
      roles: effectiveRoles,
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

  async previewInvite(
    rawTokenOrCode: string,
    now = new Date()
  ): Promise<InvitePreviewDTO> {
    const lookup = normalizeInviteLookup(rawTokenOrCode);
    const found = lookup
      ? await this.invites.findByTokenWithContext(lookup)
      : null;
    if (!found) {
      throw DomainError.notFound("Einladungslink oder Code nicht gefunden.");
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

    const roles = resolveInviteRoles(found.invite);

    return {
      token: found.invite.token,
      shortCode: found.invite.shortCode ?? null,
      type: found.invite.type,
      role: getPrimaryMemberRole(roles, found.invite.role),
      roles,
      clubName: found.clubName,
      clubLogoUrl: found.clubLogoUrl ?? null,
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
    rawTokenOrCode: string,
    rawInput: unknown,
    now = new Date()
  ) {
    const lookup = normalizeInviteLookup(rawTokenOrCode);
    const found = lookup
      ? await this.invites.findByTokenWithContext(lookup)
      : null;
    if (!found) {
      throw DomainError.notFound("Einladungslink oder Code nicht gefunden.");
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
    const inviteRoles = resolveInviteRoles(invite);

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
      const claimedRoles = getEffectiveRoles(claimed);
      await this.invites.incrementUsedCount(invite.id);
      return {
        type: invite.type,
        role: claimed.role,
        roles: claimedRoles,
        teamId: invite.teamId,
        memberId: claimed.id,
        memberProfile: {
          firstName: claimed.firstName,
          lastName: claimed.lastName,
          phone: claimed.phone,
          emergencyContact: claimed.emergencyContact,
          primaryPosition: claimed.primaryPosition,
          throwingHand: claimed.throwingHand,
        },
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

      // Falls das Elternteil noch kein Mitglied im Team ist, anlegen – sonst PARENT-Rolle ergänzen
      let parentMember = await this.members.findByTeamAndUser(
        invite.teamId,
        viewer.userId
      );
      if (!parentMember) {
        const nameParts = viewer.name.trim().split(/\s+/);
        const firstName = parsed.data.firstName ?? nameParts[0] ?? "Elternteil";
        const lastName =
          parsed.data.lastName ??
          (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

        parentMember = await this.members.create(invite.clubId, invite.teamId, {
          firstName,
          lastName: lastName || firstName,
          role: "PARENT",
          roles: ["PARENT"],
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
          emergencyContact: parsed.data.emergencyContact ?? null,
          phone: parsed.data.phone ?? null,
        });
      } else if (!hasMemberRole(parentMember, "PARENT")) {
        const nextRoles = normalizeMemberRoles({
          roles: [...getEffectiveRoles(parentMember), "PARENT"],
        });
        parentMember = await this.members.update(parentMember.id, {
          roles: nextRoles,
          phone: undefined,
        });
      }

      await this.invites.incrementUsedCount(invite.id);
      return {
        type: invite.type,
        role: "PARENT" as const,
        roles: getEffectiveRoles(parentMember),
        teamId: invite.teamId,
        memberId: parentMember.id,
        childMemberId: targetMember.id,
        childEmergencyContact: targetMember.emergencyContact,
        memberProfile: {
          firstName: parentMember.firstName,
          lastName: parentMember.lastName,
          phone: parentMember.phone,
          emergencyContact: parentMember.emergencyContact,
          primaryPosition: parentMember.primaryPosition,
          throwingHand: parentMember.throwingHand,
        },
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

    // DSGVO-konformes Auto-Matching: Falls der Trainer bereits ein Profil (z. B. aus nuLiga-Spielberichten)
    // ohne Login vorangelegt hat, wird es anhand des Namens automatisch verknüpft statt dupliziert.
    const incomingNameKey = normalizePlayerNameKey(`${firstName} ${lastName}`);
    if (incomingNameKey) {
      const roster = await this.members.findByTeamId(invite.teamId);
      const staffRoles = new Set<MemberRole>([
        "COACH",
        "ASSISTANT_COACH",
        "TEAM_MANAGER",
      ]);
      const isRoleCompatible = (candidateRoles: MemberRole[]) => {
        if (inviteRoles.some((r) => candidateRoles.includes(r))) return true;
        if (
          inviteRoles.some((r) => staffRoles.has(r)) &&
          candidateRoles.some((r) => staffRoles.has(r))
        ) {
          return true;
        }
        return false;
      };

      const matchingUnclaimed = roster.filter(
        (m) =>
          m.userId === null &&
          isRoleCompatible(getEffectiveRoles(m)) &&
          normalizePlayerNameKey(`${m.firstName} ${m.lastName}`) ===
            incomingNameKey
      );

      if (matchingUnclaimed.length === 1) {
        const matched = matchingUnclaimed[0];
        let claimed = await this.members.assignUser(matched.id, viewer.userId);
        let hasPatch = false;
        const patch: {
          email?: string;
          phone: string | null | undefined;
          emergencyContact?: string | null;
          roles?: MemberRole[];
          role?: MemberRole;
          isClubAdmin?: boolean;
        } = { phone: undefined };
        if (!claimed.email && viewer.email) {
          patch.email = viewer.email;
          hasPatch = true;
        }
        if (!claimed.phone && parsed.data.phone) {
          patch.phone = parsed.data.phone;
          hasPatch = true;
        }
        if (!claimed.emergencyContact && parsed.data.emergencyContact) {
          patch.emergencyContact = parsed.data.emergencyContact;
          hasPatch = true;
        }
        // Zusätzliche Rollen aus der Einladung (z. B. TREASURER) direkt übernehmen
        const existingClaimedRoles = getEffectiveRoles(claimed);
        const missingInviteRoles = inviteRoles.filter(
          (r) => !existingClaimedRoles.includes(r)
        );
        if (missingInviteRoles.length > 0) {
          const mergedRoles = normalizeMemberRoles({
            roles: [...existingClaimedRoles, ...missingInviteRoles],
          });
          patch.roles = mergedRoles;
          patch.role = getPrimaryMemberRole(mergedRoles, claimed.role);
          patch.isClubAdmin = mergedRoles.includes("CLUB_ADMIN");
          hasPatch = true;
        }
        if (hasPatch) {
          claimed = await this.members.update(claimed.id, patch);
        }

        await this.invites.incrementUsedCount(invite.id);
        return {
          type: invite.type,
          role: claimed.role,
          roles: getEffectiveRoles(claimed),
          teamId: invite.teamId,
          memberId: claimed.id,
          claimedExistingProfile: true,
          jerseyNumber: claimed.jerseyNumber,
          memberProfile: {
            firstName: claimed.firstName,
            lastName: claimed.lastName,
            phone: claimed.phone,
            emergencyContact: claimed.emergencyContact,
            primaryPosition: claimed.primaryPosition,
            throwingHand: claimed.throwingHand,
          },
        };
      }
    }

    const joinedPrimaryRole = getPrimaryMemberRole(inviteRoles, invite.role);
    const joined = await this.members.create(invite.clubId, invite.teamId, {
      firstName,
      lastName,
      role: joinedPrimaryRole,
      roles: inviteRoles,
      isClubAdmin: inviteRoles.includes("CLUB_ADMIN"),
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
      emergencyContact: parsed.data.emergencyContact ?? null,
      phone: parsed.data.phone ?? null,
    });

    await this.invites.incrementUsedCount(invite.id);
    return {
      type: invite.type,
      role: joined.role,
      roles: getEffectiveRoles(joined),
      teamId: invite.teamId,
      memberId: joined.id,
      claimedExistingProfile: false,
      jerseyNumber: joined.jerseyNumber,
      memberProfile: {
        firstName: joined.firstName,
        lastName: joined.lastName,
        phone: joined.phone,
        emergencyContact: joined.emergencyContact,
        primaryPosition: joined.primaryPosition,
        throwingHand: joined.throwingHand,
      },
    };
  }
}
