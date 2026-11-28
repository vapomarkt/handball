import { describe, expect, it } from "vitest";
import {
  GuardianRepository,
  InviteRepository,
  MemberRepository,
  TeamRecord,
  TeamRepository,
} from "@/domain/adapters/repositories";
import {
  canViewSensitiveMemberFields,
  projectTeamMemberDTO,
} from "@/domain/policies/gdpr";
import {
  canCreateTeam,
  canManageCashbox,
  canManageEvents,
  canManageRoster,
  canManageTacticsAndTraining,
  isClubAdmin,
  isTeamStaff,
  isTeamTreasurer,
  ViewerContext,
} from "@/domain/policies/rbac";
import {
  formatMemberRoles,
  getEffectiveRoles,
  getPrimaryMemberRole,
  hasMemberRole,
  isStaffMember,
  isTreasurerMember,
  normalizeMemberRoles,
} from "@/domain/schemas/handball";
import { GuardianLinkDTO, TeamInviteEntity } from "@/domain/schemas/invite";
import { TeamMemberEntity } from "@/domain/schemas/member";
import { InviteService } from "@/domain/services/invite-service";
import { calculateProfileCompleteness } from "@/domain/services/onboarding-state-service";
import { RosterService } from "@/domain/services/roster-service";
import { deriveSelectableTeams } from "../../packages/shared/src/types/dto";

const CLUB_ID = "club-1";
const TEAM_ID = "team-1";

function makeViewer(
  memberships: ViewerContext["memberships"],
  userId = "user-1"
): ViewerContext {
  return {
    userId,
    email: `${userId}@verein.de`,
    name: "Max Mustermann",
    memberships,
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };
}

function createFixtures() {
  const team: TeamRecord = {
    id: TEAM_ID,
    clubId: CLUB_ID,
    seasonId: "season-1",
    name: "1. Herren",
    category: "Aktive",
    ageGroup: "ADULT",
    gender: "MALE",
    usesResin: true,
    leagueId: null,
    leagueName: "Verbandsliga",
    clubName: "TSV Musterstadt",
    seasonName: "2026/27",
  };

  const members: TeamMemberEntity[] = [];
  const invites: TeamInviteEntity[] = [];
  const guardians: GuardianLinkDTO[] = [];

  const teamRepo: TeamRepository = {
    async findById(id) {
      return id === TEAM_ID ? team : null;
    },
    async findByClubId() {
      return [team];
    },
    async create() {
      return team;
    },
    async update() {
      return team;
    },
  };

  const memberRepo: MemberRepository = {
    async findByTeamId(teamId) {
      return members.filter((m) => m.teamId === teamId);
    },
    async findById(memberId) {
      return members.find((m) => m.id === memberId) ?? null;
    },
    async findByTeamAndUser(teamId, userId) {
      return (
        members.find((m) => m.teamId === teamId && m.userId === userId) ?? null
      );
    },
    async create(clubId, teamId, input) {
      const roles = normalizeMemberRoles({
        roles: input.roles,
        role: input.role,
        isClubAdmin: input.isClubAdmin,
      });
      const entity: TeamMemberEntity = {
        id: `m-${members.length + 1}`,
        clubId,
        teamId,
        userId: input.userId ?? null,
        role: getPrimaryMemberRole(roles, input.roles ? null : input.role),
        roles,
        isClubAdmin: roles.includes("CLUB_ADMIN"),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jerseyNumber: input.jerseyNumber ?? null,
        primaryPosition: input.primaryPosition ?? null,
        secondaryPosition: input.secondaryPosition ?? null,
        throwingHand: input.throwingHand ?? null,
        availabilityStatus: input.availabilityStatus,
        teamRoles: input.teamRoles ?? [],
        isMinor: input.isMinor ?? false,
        passNumber: input.passNumber ?? null,
        injuryNote: input.injuryNote ?? null,
        emergencyContact: input.emergencyContact ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      members.push(entity);
      return entity;
    },
    async update(memberId, input) {
      const idx = members.findIndex((m) => m.id === memberId);
      const defined = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
      );
      members[idx] = {
        ...members[idx],
        ...defined,
        updatedAt: new Date(),
      };
      return members[idx];
    },
    async assignUser(memberId, userId) {
      const idx = members.findIndex((m) => m.id === memberId);
      members[idx] = { ...members[idx], userId, updatedAt: new Date() };
      return members[idx];
    },
    async delete(memberId) {
      const idx = members.findIndex((m) => m.id === memberId);
      if (idx >= 0) members.splice(idx, 1);
    },
  };

  const inviteRepo: InviteRepository = {
    async findByTeamId(teamId) {
      return invites
        .filter((i) => i.teamId === teamId)
        .map((invite) => ({ invite, targetMemberName: null }));
    },
    async findById(inviteId) {
      return invites.find((i) => i.id === inviteId) ?? null;
    },
    async findByTokenWithContext(tokenOrCode) {
      const found = invites.find(
        (i) => i.token === tokenOrCode || i.shortCode === tokenOrCode
      );
      if (!found) return null;
      return {
        invite: found,
        clubName: "TSV Musterstadt",
        clubLogoUrl: null,
        teamName: "1. Herren",
        seasonName: "2026/27",
        targetMember: found.targetMemberId
          ? (members.find((m) => m.id === found.targetMemberId) ?? null)
          : null,
      };
    },
    async create(input) {
      const entity: TeamInviteEntity = {
        id: `inv-${invites.length + 1}`,
        clubId: input.clubId,
        teamId: input.teamId,
        token: input.token,
        shortCode: input.shortCode ?? null,
        type: input.type,
        role: input.role,
        roles: input.roles ?? [input.role],
        targetMemberId: input.targetMemberId,
        createdByUserId: input.createdByUserId,
        maxUses: input.maxUses,
        usedCount: 0,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
      };
      invites.push(entity);
      return entity;
    },
    async incrementUsedCount(inviteId) {
      const found = invites.find((i) => i.id === inviteId);
      if (found) found.usedCount += 1;
    },
    async revoke(inviteId) {
      const found = invites.find((i) => i.id === inviteId);
      if (found) found.revokedAt = new Date();
    },
  };

  const guardianRepo: GuardianRepository = {
    async findByGuardianUserId(userId) {
      return guardians.filter((g) => g.guardianUserId === userId);
    },
    async findByTeamId(teamId) {
      return guardians.filter((g) => g.teamId === teamId);
    },
    async findById(linkId) {
      const g = guardians.find((x) => x.id === linkId);
      if (!g) return null;
      return {
        id: g.id,
        guardianUserId: g.guardianUserId,
        childMemberId: g.childMemberId,
        teamId: g.teamId,
        clubId: CLUB_ID,
      };
    },
    async exists(guardianUserId, childMemberId) {
      return guardians.some(
        (g) =>
          g.guardianUserId === guardianUserId &&
          g.childMemberId === childMemberId
      );
    },
    async create(input) {
      const dto: GuardianLinkDTO = {
        id: `gl-${guardians.length + 1}`,
        guardianUserId: input.guardianUserId,
        guardianName: "Max Mustermann",
        guardianEmail: "max@verein.de",
        childMemberId: input.childMemberId,
        childFirstName: "Leo",
        childLastName: "Mustermann",
        teamId: TEAM_ID,
        teamName: "1. Herren",
        relationship: input.relationship,
        createdAt: new Date().toISOString(),
      };
      guardians.push(dto);
      return dto;
    },
    async delete(linkId) {
      const idx = guardians.findIndex((g) => g.id === linkId);
      if (idx >= 0) guardians.splice(idx, 1);
    },
  };

  return {
    teamRepo,
    memberRepo,
    inviteRepo,
    guardianRepo,
    members,
    rosterService: new RosterService(teamRepo, memberRepo),
    inviteService: new InviteService(
      teamRepo,
      memberRepo,
      inviteRepo,
      guardianRepo
    ),
  };
}

describe("Multi-Rollen-Hilfsfunktionen & Normalisierung", () => {
  it("normalisiert Mehrfachrollen deterministisch, dedupliziert und formatiert lesbare Labels", () => {
    const roles = normalizeMemberRoles({
      roles: ["PLAYER", "TREASURER", "PLAYER", "COACH"],
    });
    expect(roles).toEqual(["COACH", "TREASURER", "PLAYER"]);
    expect(getPrimaryMemberRole(roles)).toBe("COACH");
    expect(formatMemberRoles(roles)).toBe("Trainer · Kassenwart · Spieler");

    const dualAdmin = normalizeMemberRoles({
      role: "COACH",
      isClubAdmin: true,
    });
    expect(dualAdmin).toEqual(["CLUB_ADMIN", "COACH"]);
    expect(getPrimaryMemberRole(dualAdmin)).toBe("COACH");
  });

  it("erkennt Staff-, Spieler- und Kassenwart-Rollen über Mehrfachrollen hinweg", () => {
    const playerTreasurer = {
      role: "TREASURER" as const,
      roles: ["TREASURER" as const, "PLAYER" as const],
    };
    expect(hasMemberRole(playerTreasurer, "PLAYER")).toBe(true);
    expect(hasMemberRole(playerTreasurer, "TREASURER")).toBe(true);
    expect(isTreasurerMember(playerTreasurer)).toBe(true);
    expect(isStaffMember(playerTreasurer)).toBe(false);
  });
});

describe("Multi-Rollen RBAC & strikte Kassenwart-Trennung", () => {
  it("trennt Kassenwart-Rechte strikt von Trainer/Betreuer/Vereins-Admin und schützt DSGVO-Daten", () => {
    const coachOnly = makeViewer([
      {
        memberId: "m-coach",
        clubId: CLUB_ID,
        teamId: TEAM_ID,
        role: "COACH",
        roles: ["COACH"],
      },
    ]);
    expect(isTeamStaff(coachOnly, TEAM_ID, CLUB_ID)).toBe(true);
    expect(canManageRoster(coachOnly, TEAM_ID, CLUB_ID)).toBe(true);
    expect(canManageTacticsAndTraining(coachOnly, TEAM_ID, CLUB_ID)).toBe(true);
    expect(isTeamTreasurer(coachOnly, TEAM_ID)).toBe(false);
    expect(canManageCashbox(coachOnly, TEAM_ID)).toBe(false);

    const adminOnly = makeViewer([
      {
        memberId: "m-admin",
        clubId: CLUB_ID,
        teamId: TEAM_ID,
        role: "CLUB_ADMIN",
        roles: ["CLUB_ADMIN"],
        isClubAdmin: true,
      },
    ]);
    expect(isClubAdmin(adminOnly, CLUB_ID)).toBe(true);
    expect(canManageCashbox(adminOnly, TEAM_ID)).toBe(false);

    const playerTreasurer = makeViewer(
      [
        {
          memberId: "m-pt",
          clubId: CLUB_ID,
          teamId: TEAM_ID,
          role: "TREASURER",
          roles: ["TREASURER", "PLAYER"],
        },
      ],
      "user-pt"
    );
    expect(canManageCashbox(playerTreasurer, TEAM_ID)).toBe(true);
    expect(canManageCashbox(playerTreasurer, "other-team")).toBe(false);
    expect(canManageRoster(playerTreasurer, TEAM_ID, CLUB_ID)).toBe(false);
    expect(canManageEvents(playerTreasurer, TEAM_ID, CLUB_ID)).toBe(false);
    // Kassenwart darf KEINE fremden DSGVO-sensiblen Profildaten sehen
    expect(
      canViewSensitiveMemberFields(playerTreasurer, {
        id: "m-other",
        clubId: CLUB_ID,
        teamId: TEAM_ID,
        userId: "user-other",
      })
    ).toBe(false);

    // Spielertrainer + Kassenwart kombiniert alle Rechte
    const playerCoachTreasurer = makeViewer([
      {
        memberId: "m-pct",
        clubId: CLUB_ID,
        teamId: TEAM_ID,
        role: "COACH",
        roles: ["COACH", "TREASURER", "PLAYER"],
      },
    ]);
    expect(canManageCashbox(playerCoachTreasurer, TEAM_ID)).toBe(true);
    expect(canManageRoster(playerCoachTreasurer, TEAM_ID, CLUB_ID)).toBe(true);
    expect(canCreateTeam(playerCoachTreasurer, CLUB_ID)).toBe(true);
  });
});

describe("RosterService & InviteService mit Mehrfachrollen", () => {
  it("legt Mitglieder mit Mehrfachrollen an, aktualisiert Rollen sicher und schützt CLUB_ADMIN", async () => {
    const { rosterService, memberRepo } = createFixtures();

    const coachViewer = makeViewer(
      [
        {
          memberId: "m-coach",
          clubId: CLUB_ID,
          teamId: TEAM_ID,
          role: "COACH",
          roles: ["COACH"],
        },
      ],
      "user-coach"
    );
    const adminViewer = makeViewer(
      [
        {
          memberId: "m-admin",
          clubId: CLUB_ID,
          teamId: TEAM_ID,
          role: "CLUB_ADMIN",
          roles: ["CLUB_ADMIN"],
          isClubAdmin: true,
        },
      ],
      "user-admin"
    );

    // Trainer darf Spieler + Kassenwart anlegen
    const created = await rosterService.addMember(coachViewer, TEAM_ID, {
      firstName: "Lukas",
      lastName: "Hartmann",
      roles: ["PLAYER", "TREASURER"],
      jerseyNumber: 10,
    });
    expect(created.roles).toEqual(["TREASURER", "PLAYER"]);
    expect(created.isClubAdmin).toBe(false);

    // Trainer darf Vereins-Admin-Rolle NICHT hinzufügen
    await expect(
      rosterService.updateMember(coachViewer, TEAM_ID, created.id, {
        roles: ["PLAYER", "TREASURER", "CLUB_ADMIN"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    // Admin darf CLUB_ADMIN hinzufügen, ohne PLAYER/TREASURER zu verlieren
    const promoted = await rosterService.updateMember(
      adminViewer,
      TEAM_ID,
      created.id,
      { roles: ["PLAYER", "TREASURER", "CLUB_ADMIN"] }
    );
    expect(promoted.roles).toEqual(["CLUB_ADMIN", "TREASURER", "PLAYER"]);
    expect(promoted.isClubAdmin).toBe(true);

    // Trainer darf bei einem bestehenden CLUB_ADMIN-Mitglied die Rolle TREASURER entfernen,
    // solange CLUB_ADMIN unverändert bestehen bleibt
    const updatedByCoach = await rosterService.updateMember(
      coachViewer,
      TEAM_ID,
      created.id,
      { roles: ["PLAYER", "CLUB_ADMIN"] }
    );
    expect(updatedByCoach.roles).toEqual(["CLUB_ADMIN", "PLAYER"]);

    // Trainer darf CLUB_ADMIN NICHT entziehen
    await expect(
      rosterService.updateMember(coachViewer, TEAM_ID, created.id, {
        roles: ["PLAYER"],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });

    // Selbst-Bearbeitung: Spieler + Kassenwart darf trotz primärer Rolle TREASURER seine Position pflegen
    const selfMember = await memberRepo.create(CLUB_ID, TEAM_ID, {
      firstName: "Timo",
      lastName: "Kasse",
      role: "TREASURER",
      roles: ["TREASURER", "PLAYER"],
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: false,
      userId: "user-timo",
      phone: null,
    });
    const selfViewer = makeViewer(
      [
        {
          memberId: selfMember.id,
          clubId: CLUB_ID,
          teamId: TEAM_ID,
          role: "TREASURER",
          roles: ["TREASURER", "PLAYER"],
        },
      ],
      "user-timo"
    );
    const selfUpdated = await rosterService.updateMember(
      selfViewer,
      TEAM_ID,
      selfMember.id,
      { primaryPosition: "RM" }
    );
    expect(selfUpdated.primaryPosition).toBe("RM");
    expect(selfUpdated.roles).toEqual(["TREASURER", "PLAYER"]);
  });

  it("erstellt und löst Multi-Rollen-Einladungen ein und ergänzt PARENT bei bestehenden Mitgliedern", async () => {
    const { inviteService, memberRepo } = createFixtures();

    const coachViewer = makeViewer(
      [
        {
          memberId: "m-coach",
          clubId: CLUB_ID,
          teamId: TEAM_ID,
          role: "COACH",
          roles: ["COACH"],
        },
      ],
      "user-coach"
    );

    const invite = await inviteService.createInvite(coachViewer, TEAM_ID, {
      type: "TEAM_JOIN",
      roles: ["PLAYER", "TREASURER"],
    });
    expect(invite.roles).toEqual(["TREASURER", "PLAYER"]);

    const preview = await inviteService.previewInvite(invite.token);
    expect(preview.roles).toEqual(["TREASURER", "PLAYER"]);

    const newUserViewer = makeViewer([], "user-new");
    const claimed = await inviteService.claimInvite(
      newUserViewer,
      invite.token,
      { firstName: "Anna", lastName: "Schmidt" }
    );
    expect(claimed.roles).toEqual(["TREASURER", "PLAYER"]);

    const persisted = await memberRepo.findByTeamAndUser(TEAM_ID, "user-new");
    expect(getEffectiveRoles(persisted)).toEqual(["TREASURER", "PLAYER"]);

    // Bestehendes Mitglied (COACH) löst GUARDIAN_LINK für eigenes Kind ein -> erhält zusätzlich PARENT
    const existingCoach = await memberRepo.create(CLUB_ID, TEAM_ID, {
      firstName: "Markus",
      lastName: "Coach",
      role: "COACH",
      roles: ["COACH"],
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: false,
      userId: "user-coach-parent",
      phone: null,
    });
    const child = await memberRepo.create(CLUB_ID, TEAM_ID, {
      firstName: "Leo",
      lastName: "Coach",
      role: "PLAYER",
      roles: ["PLAYER"],
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: true,
      userId: null,
      phone: null,
    });

    const guardianInvite = await inviteService.createInvite(
      coachViewer,
      TEAM_ID,
      { type: "GUARDIAN_LINK", targetMemberId: child.id }
    );
    const coachParentViewer = makeViewer(
      [
        {
          memberId: existingCoach.id,
          clubId: CLUB_ID,
          teamId: TEAM_ID,
          role: "COACH",
          roles: ["COACH"],
        },
      ],
      "user-coach-parent"
    );
    const guardianClaimed = await inviteService.claimInvite(
      coachParentViewer,
      guardianInvite.token,
      { relationship: "Vater" }
    );
    expect(guardianClaimed.roles).toEqual(["COACH", "PARENT"]);
  });

  it("berücksichtigt Mehrfachrollen in Profil-Vollständigkeit, DTO-Projektion und deriveSelectableTeams", () => {
    const completeness = calculateProfileCompleteness(
      ["TREASURER", "PLAYER"],
      {
        firstName: "Lukas",
        lastName: "Hartmann",
        primaryPosition: null,
        throwingHand: "RIGHT",
        phone: null,
        emergencyContact: null,
      }
    );
    // Weil PLAYER in roles enthalten ist, werden auch Position & Notfallkontakt geprüft
    expect(completeness.missingFields.map((f) => f.key)).toEqual([
      "primaryPosition",
      "phone",
      "emergencyContact",
    ]);

    const viewer = makeViewer([
      {
        memberId: "m-1",
        clubId: CLUB_ID,
        teamId: TEAM_ID,
        role: "PLAYER",
        roles: ["PLAYER"],
      },
    ]);
    const dto = projectTeamMemberDTO(viewer, {
      id: "m-2",
      clubId: CLUB_ID,
      teamId: TEAM_ID,
      userId: "u-2",
      role: "TREASURER",
      roles: ["TREASURER", "PLAYER"],
      isClubAdmin: false,
      firstName: "Eva",
      lastName: "Kasse",
      email: "eva@verein.de",
      phone: "+49170123456",
      jerseyNumber: 8,
      primaryPosition: "LA",
      secondaryPosition: null,
      throwingHand: "LEFT",
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: false,
      passNumber: "P-1",
      injuryNote: null,
      emergencyContact: "Notfall",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(dto.roles).toEqual(["TREASURER", "PLAYER"]);
    expect(dto.canViewSensitive).toBe(false);

    const selectable = deriveSelectableTeams({
      user: { id: "u1", email: "eva@verein.de", name: "Eva Kasse" },
      memberships: [
        {
          memberId: "m-2",
          role: "PLAYER",
          roles: ["PLAYER", "TREASURER"],
          firstName: "Eva",
          lastName: "Kasse",
          jerseyNumber: 8,
          primaryPosition: "LA",
          availabilityStatus: "FIT",
          club: {
            id: CLUB_ID,
            name: "TSV Musterstadt",
            shortName: "TSV",
            slug: "tsv",
            logoUrl: null,
          },
          team: {
            id: TEAM_ID,
            name: "1. Damen",
            category: "Aktive",
            ageGroup: "ADULT",
            gender: "FEMALE",
            usesResin: true,
            leagueName: "Verbandsliga",
            seasonName: "2026/27",
          },
        },
      ],
      adminClubTeams: [],
      guardianLinks: [],
    });
    expect(selectable[0]?.roles).toEqual(["TREASURER", "PLAYER"]);
  });
});
