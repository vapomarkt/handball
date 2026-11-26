import { describe, expect, it } from "vitest";
import {
  GuardianRepository,
  InviteRepository,
  MemberRepository,
  TeamRecord,
  TeamRepository,
} from "@/domain/adapters/repositories";
import { DomainError } from "@/domain/errors";
import { ViewerContext } from "@/domain/policies/rbac";
import { TeamInviteEntity } from "@/domain/schemas/invite";
import { TeamMemberEntity } from "@/domain/schemas/member";
import { InviteService } from "@/domain/services/invite-service";
import { RosterService } from "@/domain/services/roster-service";

function createInMemoryHarness() {
  const team: TeamRecord = {
    id: "team-1",
    clubId: "club-1",
    seasonId: "season-1",
    name: "Herren 1",
    category: "Aktive",
    gender: "MALE",
    leagueName: "Verbandsliga",
    seasonName: "2026/27",
    clubName: "TSV Musterstadt",
  };

  const members: TeamMemberEntity[] = [];
  const invites: TeamInviteEntity[] = [];
  const guardianPairs = new Set<string>();

  const teamRepo: TeamRepository = {
    async findById(id) {
      return id === team.id ? team : null;
    },
    async findByClubId(clubId) {
      return clubId === team.clubId ? [team] : [];
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
      const entity: TeamMemberEntity = {
        id: `m-${members.length + 1}`,
        clubId,
        teamId,
        userId: input.userId ?? null,
        role: input.role,
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
      const definedEntries = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
      );
      members[idx] = {
        ...members[idx],
        ...definedEntries,
        updatedAt: new Date(),
      };
      return members[idx];
    },
    async assignUser(memberId, userId) {
      const idx = members.findIndex((m) => m.id === memberId);
      members[idx] = { ...members[idx], userId };
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
    async findById(id) {
      return invites.find((i) => i.id === id) ?? null;
    },
    async findByTokenWithContext(tokenOrShortCode) {
      const invite = invites.find(
        (i) => i.token === tokenOrShortCode || i.shortCode === tokenOrShortCode
      );
      if (!invite) return null;
      const targetMember = invite.targetMemberId
        ? members.find((m) => m.id === invite.targetMemberId) ?? null
        : null;
      return {
        invite,
        clubName: "TSV Musterstadt",
        teamName: "Herren 1",
        seasonName: "2026/27",
        targetMember,
      };
    },
    async findByShortCode(shortCode) {
      return invites.find((i) => i.shortCode === shortCode) ?? null;
    },
    async create(input) {
      const entity: TeamInviteEntity = {
        id: `inv-${invites.length + 1}`,
        ...input,
        shortCode: input.shortCode ?? null,
        usedCount: 0,
        revokedAt: null,
        createdAt: new Date(),
      };
      invites.push(entity);
      return entity;
    },
    async incrementUsedCount(id) {
      const inv = invites.find((i) => i.id === id);
      if (inv) inv.usedCount += 1;
    },
    async revoke(id) {
      const inv = invites.find((i) => i.id === id);
      if (inv) inv.revokedAt = new Date();
    },
  };

  const guardianRepo: GuardianRepository = {
    async findByGuardianUserId() {
      return [];
    },
    async findByTeamId() {
      return [];
    },
    async findById() {
      return null;
    },
    async exists(guardianUserId, childMemberId) {
      return guardianPairs.has(`${guardianUserId}:${childMemberId}`);
    },
    async create(input) {
      guardianPairs.add(`${input.guardianUserId}:${input.childMemberId}`);
      return {
        id: "g-1",
        guardianUserId: input.guardianUserId,
        guardianName: "Elternteil",
        guardianEmail: "eltern@test.de",
        childMemberId: input.childMemberId,
        childFirstName: "Leo",
        childLastName: "Weber",
        teamId: team.id,
        teamName: team.name,
        relationship: input.relationship,
        createdAt: new Date().toISOString(),
      };
    },
    async delete() {},
  };

  return {
    rosterService: new RosterService(teamRepo, memberRepo),
    inviteService: new InviteService(
      teamRepo,
      memberRepo,
      inviteRepo,
      guardianRepo
    ),
    members,
    invites,
  };
}

const coach: ViewerContext = {
  userId: "u-coach",
  email: "coach@tsv.de",
  name: "Markus Brenner",
  memberships: [
    { memberId: "m-0", clubId: "club-1", teamId: "team-1", role: "COACH" },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const player: ViewerContext = {
  userId: "u-player",
  email: "player@tsv.de",
  name: "Lukas Hartmann",
  memberships: [
    { memberId: "m-p", clubId: "club-1", teamId: "team-1", role: "PLAYER" },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

describe("RosterService & InviteService Fachlogik", () => {
  it("legt entkoppelte Kader-Profile ohne User-Account an und erlaubt Claim per Einladungslink", async () => {
    const { rosterService, inviteService } = createInMemoryHarness();

    const created = await rosterService.addMember(coach, "team-1", {
      firstName: "Tim",
      lastName: "Schneider",
      role: "PLAYER",
      jerseyNumber: 1,
      primaryPosition: "TW",
      passNumber: "DHB-2026-10401",
      emergencyContact: "Peter Schneider",
    });

    expect(created.isClaimed).toBe(false);
    expect(created.canViewSensitive).toBe(true);

    // Einladungslink für Profil-Claim erzeugen
    const invite = await inviteService.createInvite(coach, "team-1", {
      type: "PROFILE_CLAIM",
      targetMemberId: created.id,
    });
    expect(invite.maxUses).toBe(1);

    // Neuer User übernimmt das Profil
    const newUser: ViewerContext = {
      userId: "u-tim",
      email: "tim@tsv.de",
      name: "Tim Schneider",
      memberships: [],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    const claimed = await inviteService.claimInvite(newUser, invite.token, {});
    expect(claimed.memberId).toBe(created.id);

    // Zweites Einlösen desselben Claim-Links muss fehlschlagen
    await expect(
      inviteService.claimInvite(
        { ...newUser, userId: "u-other" },
        invite.token,
        {}
      )
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("blockiert das Anlegen neuer Spieler durch PLAYER (403 FORBIDDEN)", async () => {
    const { rosterService } = createInMemoryHarness();

    await expect(
      rosterService.addMember(player, "team-1", {
        firstName: "Illegal",
        lastName: "Attempt",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
  });

  it("verhindert Rollen-Eskalation beim Selbst-Bearbeiten durch einen Spieler", async () => {
    const { rosterService, members } = createInMemoryHarness();

    const created = await rosterService.addMember(coach, "team-1", {
      firstName: "Lukas",
      lastName: "Hartmann",
      role: "PLAYER",
    });
    // User verknüpfen
    members[0].userId = player.userId;

    // Spieler versucht sich selbst zum CLUB_ADMIN hochzustufen
    const updated = await rosterService.updateMember(
      player,
      "team-1",
      created.id,
      {
        role: "CLUB_ADMIN",
        emergencyContact: "Neue Notfallnummer",
      }
    );

    expect(updated.role).toBe("PLAYER");
    expect(updated.canViewSensitive).toBe(true);
    if (updated.canViewSensitive) {
      expect(updated.emergencyContact).toBe("Neue Notfallnummer");
    }
  });
});
