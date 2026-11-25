import { describe, expect, it, vi } from "vitest";
import {
  LeagueCatalogFilter,
  LeagueCatalogRepository,
} from "@/domain/adapters/league-catalog-repository";
import {
  ClubRepository,
  MemberRepository,
  TeamRepository,
} from "@/domain/adapters/repositories";
import {
  buildGermanLeaguesCatalog,
  GERMAN_AGE_GROUPS,
  GERMAN_FEDERATIONS,
  suggestTeamName,
} from "@/domain/data/german-leagues";
import { DomainError } from "@/domain/errors";
import { ViewerContext } from "@/domain/policies/rbac";
import { LeagueDTO } from "@/domain/schemas/league-catalog";
import { LeagueCatalogService } from "@/domain/services/league-catalog-service";
import { OnboardingService } from "@/domain/services/onboarding-service";

function createInMemoryLeagueCatalogRepo(): LeagueCatalogRepository {
  const leagues: LeagueDTO[] = buildGermanLeaguesCatalog().map((entry, idx) => ({
    id: `league-${idx + 1}`,
    ...entry,
  }));

  return {
    async findById(id: string) {
      return leagues.find((l) => l.id === id) ?? null;
    },
    async findByCode(code: string) {
      return leagues.find((l) => l.code === code) ?? null;
    },
    async findMany(filter: LeagueCatalogFilter) {
      return leagues.filter((l) => {
        if (l.countryCode !== filter.countryCode) return false;
        if (filter.ageGroup && l.ageGroup !== filter.ageGroup) return false;
        if (filter.gender && l.gender !== filter.gender) return false;
        if (filter.federationCode && l.federationCode !== filter.federationCode) {
          return false;
        }
        return true;
      });
    },
  };
}

describe("Deutscher Handball-Liga-Katalog", () => {
  it("erzeugt eindeutige Codes und deckt alle Verbände sowie Altersklassen ab", () => {
    const entries = buildGermanLeaguesCatalog();
    expect(entries.length).toBeGreaterThan(500);

    const codes = new Set(entries.map((e) => e.code));
    expect(codes.size).toBe(entries.length);

    const coveredFederations = new Set(entries.map((e) => e.federationCode));
    for (const fed of GERMAN_FEDERATIONS) {
      expect(
        coveredFederations.has(fed.code),
        `Verband ${fed.code} fehlt im Liga-Katalog`
      ).toBe(true);
    }

    const coveredAgeGroups = new Set(entries.map((e) => e.ageGroup));
    for (const age of GERMAN_AGE_GROUPS) {
      expect(
        coveredAgeGroups.has(age.value),
        `Altersklasse ${age.value} fehlt im Liga-Katalog`
      ).toBe(true);
    }
  });

  it("hält jede Einzel-Auswahlliste pro Verband, Altersklasse & Geschlecht kompakt (max. 10 Ligen)", () => {
    const entries = buildGermanLeaguesCatalog();
    const bucketCounts = new Map<string, number>();

    for (const e of entries) {
      const key = `${e.federationCode}:${e.ageGroup}:${e.gender}`;
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }

    for (const [key, count] of bucketCounts.entries()) {
      expect(count, `Zu viele Einträge in Bucket ${key}`).toBeLessThanOrEqual(10);
      expect(count, `Leerer Bucket ${key}`).toBeGreaterThan(0);
    }
  });

  it("schlägt passende Mannschaftsnamen pro Altersklasse und Geschlecht vor", () => {
    expect(suggestTeamName("ADULT", "MALE")).toBe("Herren 1");
    expect(suggestTeamName("ADULT", "FEMALE")).toBe("Damen 1");
    expect(suggestTeamName("YOUTH_D", "MALE")).toBe("mD-Jugend");
    expect(suggestTeamName("YOUTH_B", "FEMALE")).toBe("wB-Jugend");
    expect(suggestTeamName("YOUTH_F_MINI", "MIXED")).toBe("Minis");
  });
});

describe("LeagueCatalogService", () => {
  it("listet DHB-Bundesebene zuerst bei Aktiven und blendet sie bei D-Jugend aus", async () => {
    const service = new LeagueCatalogService(createInMemoryLeagueCatalogRepo());

    const adultMale = await service.listLeagues({
      countryCode: "DE",
      ageGroup: "ADULT",
      gender: "MALE",
    });
    expect(adultMale.federations[0]?.code).toBe("DHB");
    expect(adultMale.federations[0]?.isNational).toBe(true);

    const youthDMale = await service.listLeagues({
      countryCode: "DE",
      ageGroup: "YOUTH_D",
      gender: "MALE",
    });
    expect(youthDMale.federations.some((f) => f.code === "DHB")).toBe(false);
    expect(youthDMale.federations.some((f) => f.code === "HVNB")).toBe(true);
  });

  it("filtert nach Verband und sortiert Spielklassen nach Spielklassen-Ebene (tier)", async () => {
    const service = new LeagueCatalogService(createInMemoryLeagueCatalogRepo());

    const hvnbAdult = await service.listLeagues({
      countryCode: "DE",
      ageGroup: "ADULT",
      gender: "MALE",
      federationCode: "HVNB",
    });

    expect(hvnbAdult.leagues.length).toBeGreaterThanOrEqual(5);
    expect(hvnbAdult.leagues[0]?.name).toBe("Regionalliga Niedersachsen");
    for (let i = 1; i < hvnbAdult.leagues.length; i++) {
      expect(hvnbAdult.leagues[i]!.tier).toBeGreaterThanOrEqual(
        hvnbAdult.leagues[i - 1]!.tier
      );
    }
  });
});

describe("OnboardingService mit Liga-Katalog", () => {
  const viewer: ViewerContext = {
    userId: "user-1",
    email: "coach@example.de",
    name: "Max Mustermann",
    memberships: [],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  function createMockRepos() {
    const clubs: ClubRepository = {
      findClubsForUser: vi.fn(),
      findByIdWithDetails: vi.fn(),
      findBySlug: vi.fn().mockResolvedValue(null),
      createClubWithSeason: vi.fn().mockResolvedValue({
        club: {
          id: "club-1",
          name: "SG Handball Nord",
          shortName: null,
          slug: "sg-handball-nord",
          city: "Hannover",
          logoUrl: null,
          createdAt: new Date().toISOString(),
        },
        season: {
          id: "season-1",
          clubId: "club-1",
          name: "2026/27",
          startDate: null,
          endDate: null,
          isActive: true,
        },
      }),
      createSeason: vi.fn(),
    };

    const teams: TeamRepository = {
      findById: vi.fn(),
      findByClubId: vi.fn(),
      create: vi.fn().mockImplementation(async (input) => ({
        id: "team-1",
        ...input,
      })),
      update: vi.fn(),
    };

    const members: MemberRepository = {
      findByTeamId: vi.fn(),
      findById: vi.fn(),
      findByTeamAndUser: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "member-1" }),
      update: vi.fn(),
      assignUser: vi.fn(),
      delete: vi.fn(),
    };

    return { clubs, teams, members };
  }

  it("löst eine gewählte leagueId auf und speichert leagueId + displayName am Team", async () => {
    const { clubs, teams, members } = createMockRepos();
    const leagueRepo = createInMemoryLeagueCatalogRepo();
    const rol = await leagueRepo.findByCode("DE-HVNB-YOUTH_D-MALE-ROL");
    expect(rol).not.toBeNull();

    const onboarding = new OnboardingService(clubs, teams, members, leagueRepo);
    const result = await onboarding.completeOnboarding(viewer, {
      clubName: "SG Handball Nord",
      city: "Hannover",
      seasonName: "2026/27",
      teamName: "mD-Jugend",
      category: "Jugend",
      gender: "MALE",
      leagueId: rol!.id,
      creatorFirstName: "Max",
      creatorLastName: "Mustermann",
      creatorRole: "CLUB_ADMIN",
    });

    expect(result.team.leagueId).toBe(rol!.id);
    expect(result.team.leagueName).toBe(rol!.displayName);
  });

  it("lehnt eine unbekannte leagueId mit VALIDATION_ERROR ab", async () => {
    const { clubs, teams, members } = createMockRepos();
    const leagueRepo = createInMemoryLeagueCatalogRepo();
    const onboarding = new OnboardingService(clubs, teams, members, leagueRepo);

    await expect(
      onboarding.completeOnboarding(viewer, {
        clubName: "SG Handball Nord",
        seasonName: "2026/27",
        teamName: "Herren 1",
        category: "Aktive",
        gender: "MALE",
        leagueId: "nicht-vorhandene-liga-id",
        creatorFirstName: "Max",
        creatorLastName: "Mustermann",
        creatorRole: "COACH",
      })
    ).rejects.toThrow(DomainError);
  });
});
