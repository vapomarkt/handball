import { describe, expect, it, vi } from "vitest";
import {
  ClubRepository,
  MemberRepository,
  TeamRepository,
} from "@/domain/adapters/repositories";
import {
  CreateSeasonCatalogRecord,
  SeasonCatalogRepository,
  UpdateSeasonCatalogRecord,
} from "@/domain/adapters/season-catalog-repository";
import { DEFAULT_SEASON_CATALOG } from "@/domain/data/default-seasons";
import { DomainError } from "@/domain/errors";
import { ViewerContext } from "@/domain/policies/rbac";
import { SeasonCatalogDTO } from "@/domain/schemas/season-catalog";
import { OnboardingService } from "@/domain/services/onboarding-service";
import { SeasonCatalogService } from "@/domain/services/season-catalog-service";

function createInMemorySeasonCatalogRepo(
  initial?: SeasonCatalogDTO[]
): SeasonCatalogRepository {
  const items: SeasonCatalogDTO[] =
    initial ??
    DEFAULT_SEASON_CATALOG.map((entry) => ({
      id: entry.id,
      name: entry.name,
      startDate: entry.startDate,
      endDate: entry.endDate,
      sortOrder: entry.sortOrder,
      isDefault: entry.isDefault,
      isActive: entry.isActive,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }));

  return {
    async findAll(options) {
      return items
        .filter((s) => (options?.activeOnly ? s.isActive : true))
        .sort((a, b) =>
          a.sortOrder !== b.sortOrder
            ? a.sortOrder - b.sortOrder
            : a.name.localeCompare(b.name)
        );
    },
    async findById(id) {
      return items.find((s) => s.id === id) ?? null;
    },
    async findByName(name) {
      return items.find((s) => s.name === name) ?? null;
    },
    async create(input: CreateSeasonCatalogRecord) {
      if (input.isDefault) {
        for (const item of items) item.isDefault = false;
      }
      const created: SeasonCatalogDTO = {
        id: `season-${items.length + 1}`,
        name: input.name,
        startDate: input.startDate ? input.startDate.toISOString() : null,
        endDate: input.endDate ? input.endDate.toISOString() : null,
        sortOrder: input.sortOrder,
        isDefault: input.isDefault,
        isActive: input.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      items.push(created);
      return created;
    },
    async update(id: string, input: UpdateSeasonCatalogRecord) {
      const target = items.find((s) => s.id === id);
      if (!target) throw new Error("not found");
      if (input.isDefault) {
        for (const item of items) {
          if (item.id !== id) item.isDefault = false;
        }
      }
      if (input.name !== undefined) target.name = input.name;
      if (input.startDate !== undefined) {
        target.startDate = input.startDate
          ? input.startDate.toISOString()
          : null;
      }
      if (input.endDate !== undefined) {
        target.endDate = input.endDate ? input.endDate.toISOString() : null;
      }
      if (input.sortOrder !== undefined) target.sortOrder = input.sortOrder;
      if (input.isDefault !== undefined) target.isDefault = input.isDefault;
      if (input.isActive !== undefined) target.isActive = input.isActive;
      target.updatedAt = new Date().toISOString();
      return { ...target };
    },
    async delete(id: string) {
      const idx = items.findIndex((s) => s.id === id);
      if (idx >= 0) items.splice(idx, 1);
    },
  };
}

const adminViewer: ViewerContext = {
  userId: "user-admin",
  email: "admin@verein.de",
  name: "Admin User",
  memberships: [
    {
      memberId: "m-1",
      clubId: "club-1",
      teamId: "team-1",
      role: "CLUB_ADMIN",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const coachViewer: ViewerContext = {
  userId: "user-coach",
  email: "coach@verein.de",
  name: "Coach User",
  memberships: [
    {
      memberId: "m-2",
      clubId: "club-1",
      teamId: "team-1",
      role: "COACH",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

describe("Standard-Saison-Katalog", () => {
  it("enthält eindeutige Namen, gültige Zeiträume und genau eine Standard-Saison", () => {
    expect(DEFAULT_SEASON_CATALOG.length).toBeGreaterThanOrEqual(4);
    const names = new Set(DEFAULT_SEASON_CATALOG.map((s) => s.name));
    expect(names.size).toBe(DEFAULT_SEASON_CATALOG.length);

    const defaults = DEFAULT_SEASON_CATALOG.filter((s) => s.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]?.isActive).toBe(true);

    for (const s of DEFAULT_SEASON_CATALOG) {
      expect(Date.parse(s.endDate)).toBeGreaterThan(Date.parse(s.startDate));
    }
  });
});

describe("SeasonCatalogService", () => {
  it("erlaubt nur Vereins-Admins die Pflege und gibt öffentlich nur aktive Saisons zurück", async () => {
    const repo = createInMemorySeasonCatalogRepo();
    const service = new SeasonCatalogService(repo);

    await expect(service.listAllSeasons(coachViewer)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await expect(
      service.createSeason(coachViewer, { name: "2029/30" })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    await service.createSeason(adminViewer, {
      name: "2029/30",
      startDate: "2029-07-01",
      endDate: "2030-06-30",
      sortOrder: 60,
      isActive: false,
      isDefault: false,
    });

    const publicSeasons = await service.listPublicSeasons();
    const allSeasons = await service.listAllSeasons(adminViewer);

    expect(publicSeasons.some((s) => s.name === "2029/30")).toBe(false);
    expect(allSeasons.some((s) => s.name === "2029/30")).toBe(true);
  });

  it("verhindert doppelte Saisonnamen und ungültige Zeiträume", async () => {
    const service = new SeasonCatalogService(createInMemorySeasonCatalogRepo());

    await expect(
      service.createSeason(adminViewer, { name: "2026/27" })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    await expect(
      service.createSeason(adminViewer, {
        name: "2030/31",
        startDate: "2031-06-30",
        endDate: "2030-07-01",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("setzt eine neue Standard-Saison exklusiv und verhindert das Deaktivieren/Löschen der letzten aktiven Saison", async () => {
    const repo = createInMemorySeasonCatalogRepo([
      {
        id: "s-1",
        name: "2026/27",
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2027-06-30T23:59:59.000Z",
        sortOrder: 10,
        isDefault: true,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const service = new SeasonCatalogService(repo);

    // Letzte aktive Saison darf weder deaktiviert noch gelöscht werden
    await expect(
      service.updateSeason(adminViewer, "s-1", {
        isDefault: false,
        isActive: false,
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(service.deleteSeason(adminViewer, "s-1")).rejects.toMatchObject(
      { code: "VALIDATION_ERROR" }
    );

    // Zweite Saison als Standard anlegen -> s-1 verliert Standard-Flag
    const s2 = await service.createSeason(adminViewer, {
      name: "2027/28",
      isDefault: true,
      isActive: false, // wird automatisch aktiviert, da Standard
    });
    expect(s2.isDefault).toBe(true);
    expect(s2.isActive).toBe(true);

    const all = await service.listAllSeasons(adminViewer);
    expect(all.find((s) => s.id === "s-1")?.isDefault).toBe(false);

    // Jetzt darf s-1 gelöscht werden
    await service.deleteSeason(adminViewer, "s-1");
    expect(await service.listPublicSeasons()).toHaveLength(1);
  });
});

describe("OnboardingService mit Saison-Katalog", () => {
  function buildOnboardingMocks() {
    const createClubWithSeason = vi.fn(async (input) => ({
      club: {
        id: "club-new",
        name: input.name,
        shortName: input.shortName ?? null,
        slug: input.slug,
        city: input.city ?? null,
        logoUrl: null,
        createdAt: new Date().toISOString(),
      },
      season: {
        id: "season-club-1",
        clubId: "club-new",
        name: input.seasonName,
        startDate: input.seasonStartDate
          ? input.seasonStartDate.toISOString()
          : null,
        endDate: input.seasonEndDate ? input.seasonEndDate.toISOString() : null,
        isActive: true,
      },
    }));

    const clubRepo: ClubRepository = {
      findClubsForUser: vi.fn(async () => []),
      findByIdWithDetails: vi.fn(async () => null),
      findBySlug: vi.fn(async () => null),
      createClubWithSeason,
      createSeason: vi.fn(),
    };

    const teamRepo: TeamRepository = {
      findById: vi.fn(async () => null),
      findByClubId: vi.fn(async () => []),
      create: vi.fn(async (input) => ({
        id: "team-new",
        clubId: input.clubId,
        seasonId: input.seasonId,
        name: input.name,
        category: input.category,
        gender: input.gender,
        leagueId: input.leagueId ?? null,
        leagueName: input.leagueName ?? null,
      })),
      update: vi.fn(),
    };

    const memberRepo: MemberRepository = {
      findByTeamId: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      findByTeamAndUser: vi.fn(async () => null),
      create: vi.fn(async (_clubId, _teamId, input) => ({
        id: "member-new",
        clubId: "club-new",
        teamId: "team-new",
        userId: input.userId ?? null,
        role: input.role,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: null,
        jerseyNumber: null,
        primaryPosition: null,
        secondaryPosition: null,
        throwingHand: null,
        availabilityStatus: "FIT" as const,
        teamRoles: [],
        isMinor: false,
        passNumber: null,
        injuryNote: null,
        emergencyContact: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      update: vi.fn(),
      assignUser: vi.fn(),
      delete: vi.fn(),
    };

    return { clubRepo, teamRepo, memberRepo, createClubWithSeason };
  }

  it("übernimmt Name und Zeitraum der ausgewählten Katalog-Saison beim Onboarding", async () => {
    const { clubRepo, teamRepo, memberRepo, createClubWithSeason } =
      buildOnboardingMocks();
    const seasonCatalogRepo = createInMemorySeasonCatalogRepo();
    const onboarding = new OnboardingService(
      clubRepo,
      teamRepo,
      memberRepo,
      undefined,
      seasonCatalogRepo
    );

    const result = await onboarding.completeOnboarding(adminViewer, {
      clubName: "SG Nord",
      seasonId: "season_cat_2026_27",
      seasonName: "irgendwas-wird-überschrieben",
      teamName: "Herren 1",
      creatorFirstName: "Max",
      creatorLastName: "Mustermann",
      creatorRole: "CLUB_ADMIN",
    });

    expect(result.season.name).toBe("2026/27");
    expect(createClubWithSeason).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonName: "2026/27",
        seasonStartDate: new Date("2026-07-01T00:00:00.000Z"),
        seasonEndDate: new Date("2027-06-30T23:59:59.000Z"),
      })
    );
  });

  it("lehnt ungültige oder nicht im Katalog vorhandene Freitext-Saisons ab", async () => {
    const { clubRepo, teamRepo, memberRepo } = buildOnboardingMocks();
    const seasonCatalogRepo = createInMemorySeasonCatalogRepo();
    const onboarding = new OnboardingService(
      clubRepo,
      teamRepo,
      memberRepo,
      undefined,
      seasonCatalogRepo
    );

    await expect(
      onboarding.completeOnboarding(adminViewer, {
        clubName: "SG Nord",
        seasonId: "nicht-vorhanden",
        teamName: "Herren 1",
        creatorFirstName: "Max",
        creatorLastName: "Mustermann",
      })
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      onboarding.completeOnboarding(adminViewer, {
        clubName: "SG Nord",
        seasonName: "Freitext-Saison 99",
        teamName: "Herren 1",
        creatorFirstName: "Max",
        creatorLastName: "Mustermann",
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
