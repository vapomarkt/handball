import { describe, expect, it } from "vitest";
import {
  ClubRepository,
  MemberRepository,
  TeamRecord,
  TeamRepository,
} from "@/domain/adapters/repositories";
import {
  defaultUsesResinForAgeGroup,
  GERMAN_AGE_GROUPS,
  resolveTeamUsesResin,
} from "@/domain/data/german-leagues";
import { ViewerContext } from "@/domain/policies/rbac";
import { getCommonTeamRoles } from "@/domain/schemas/handball";
import { ClubService } from "@/domain/services/club-service";
import { OnboardingService } from "@/domain/services/onboarding-service";

function makeInMemoryTeamSetup() {
  const teams = new Map<string, TeamRecord>();

  const clubRepo: ClubRepository = {
    async findClubsForUser() {
      return [];
    },
    async findByIdWithDetails() {
      return null;
    },
    async findBySlug() {
      return null;
    },
    async createClubWithSeason(input) {
      return {
        club: {
          id: "club-1",
          name: input.name,
          shortName: input.shortName ?? null,
          slug: input.slug,
          city: input.city ?? null,
          logoUrl: null,
          createdAt: new Date().toISOString(),
        },
        season: {
          id: "season-1",
          clubId: "club-1",
          name: input.seasonName,
          startDate: null,
          endDate: null,
          isActive: true,
        },
      };
    },
    async createSeason(input) {
      return {
        id: "season-2",
        clubId: input.clubId,
        name: input.name,
        startDate: null,
        endDate: null,
        isActive: input.isActive,
      };
    },
  };

  const teamRepo: TeamRepository = {
    async findById(id) {
      return teams.get(id) ?? null;
    },
    async findByClubId(clubId) {
      return Array.from(teams.values()).filter((t) => t.clubId === clubId);
    },
    async create(input) {
      const rec: TeamRecord = {
        id: `team-${teams.size + 1}`,
        clubId: input.clubId,
        seasonId: input.seasonId,
        name: input.name,
        category: input.category,
        ageGroup: input.ageGroup ?? null,
        gender: input.gender,
        usesResin: input.usesResin ?? true,
        leagueId: input.leagueId ?? null,
        leagueName: input.leagueName ?? null,
        leagueGroupTeamId: input.leagueGroupTeamId ?? null,
      };
      teams.set(rec.id, rec);
      return rec;
    },
    async update(teamId, input) {
      const existing = teams.get(teamId);
      if (!existing) throw new Error("Team not found");
      const updated: TeamRecord = { ...existing, ...input };
      teams.set(teamId, updated);
      return updated;
    },
  };

  const memberRepo: MemberRepository = {
    async findByTeamId() {
      return [];
    },
    async findById() {
      return null;
    },
    async findByTeamAndUser() {
      return null;
    },
    async create(clubId, teamId, input) {
      return {
        id: "member-1",
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
    },
    async update() {
      throw new Error("not used");
    },
    async assignUser() {
      throw new Error("not used");
    },
    async delete() {
      throw new Error("not used");
    },
  };

  const adminViewer: ViewerContext = {
    userId: "user-1",
    email: "coach@example.de",
    name: "Max Trainer",
    memberships: [
      {
        memberId: "m-admin",
        clubId: "club-1",
        teamId: "team-0",
        role: "CLUB_ADMIN",
      },
    ],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  return { clubRepo, teamRepo, memberRepo, adminViewer };
}

describe("Team Harz-/Backe-Regelung (usesResin)", () => {
  it("setzt sinnvolle Standardwerte pro Altersklasse", () => {
    expect(defaultUsesResinForAgeGroup("YOUTH_F_MINI")).toBe(false);
    expect(defaultUsesResinForAgeGroup("YOUTH_E")).toBe(false);
    expect(defaultUsesResinForAgeGroup("YOUTH_D")).toBe(false);
    expect(defaultUsesResinForAgeGroup("YOUTH_C")).toBe(false);
    expect(defaultUsesResinForAgeGroup("YOUTH_B")).toBe(true);
    expect(defaultUsesResinForAgeGroup("YOUTH_A")).toBe(true);
    expect(defaultUsesResinForAgeGroup("ADULT")).toBe(true);
    expect(defaultUsesResinForAgeGroup("SENIOR")).toBe(true);
    expect(defaultUsesResinForAgeGroup(null)).toBe(true);

    for (const option of GERMAN_AGE_GROUPS) {
      expect(option.defaultUsesResin).toBe(
        defaultUsesResinForAgeGroup(option.value)
      );
    }
  });

  it("priorisiert explizite Angabe vor Altersklasse und Namens-Fallback", () => {
    expect(
      resolveTeamUsesResin({ usesResin: true, ageGroup: "YOUTH_C" })
    ).toBe(true);
    expect(
      resolveTeamUsesResin({ usesResin: false, ageGroup: "ADULT" })
    ).toBe(false);
    expect(resolveTeamUsesResin({ ageGroup: "YOUTH_D" })).toBe(false);
    expect(
      resolveTeamUsesResin({ category: "Jugend", teamName: "mD-Jugend" })
    ).toBe(false);
    expect(
      resolveTeamUsesResin({ category: "Jugend", teamName: "Minis" })
    ).toBe(false);
    expect(
      resolveTeamUsesResin({ category: "Aktive", teamName: "Herren 1" })
    ).toBe(true);
  });

  it("passt Team-Ämter kontextabhängig an (Harz- & Ballwart vs. Ballwart)", () => {
    expect(getCommonTeamRoles(true)).toContain("Harz- & Ballwart");
    expect(getCommonTeamRoles(false)).toContain("Ballwart");
    expect(getCommonTeamRoles(false)).not.toContain("Harz- & Ballwart");
  });

  it("setzt usesResin im Onboarding automatisch auf false für D-Jugend", async () => {
    const { clubRepo, teamRepo, memberRepo, adminViewer } =
      makeInMemoryTeamSetup();
    const onboarding = new OnboardingService(clubRepo, teamRepo, memberRepo);

    const result = await onboarding.completeOnboarding(adminViewer, {
      clubName: "TSV Musterstadt",
      seasonName: "2026/27",
      teamName: "mD-Jugend",
      category: "Jugend",
      ageGroup: "YOUTH_D",
      gender: "MALE",
      creatorFirstName: "Max",
      creatorLastName: "Trainer",
      creatorRole: "COACH",
    });

    expect(result.team.ageGroup).toBe("YOUTH_D");
    expect(result.team.usesResin).toBe(false);
  });

  it("erlaubt Umschalten von usesResin über ClubService.updateTeam", async () => {
    const { clubRepo, teamRepo, adminViewer } = makeInMemoryTeamSetup();
    const clubService = new ClubService(clubRepo, teamRepo);

    const created = await clubService.createTeam(adminViewer, "club-1", {
      name: "wC-Jugend",
      seasonId: "season-1",
      category: "Jugend",
      ageGroup: "YOUTH_C",
      gender: "FEMALE",
    });
    expect(created.usesResin).toBe(false);

    const updated = await clubService.updateTeam(adminViewer, created.id, {
      usesResin: true,
    });
    expect(updated.usesResin).toBe(true);
  });
});
