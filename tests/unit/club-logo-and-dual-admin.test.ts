import { describe, expect, it, vi } from "vitest";
import {
  ClubLogoRecord,
  ClubRepository,
  ClubWithDetails,
  MemberRepository,
  TeamRecord,
  TeamRepository,
} from "@/domain/adapters/repositories";
import { DomainError } from "@/domain/errors";
import {
  canManageClub,
  isAnyClubAdmin,
  isClubAdmin,
  ViewerContext,
} from "@/domain/policies/rbac";
import { ClubDTO, SeasonDTO } from "@/domain/schemas/club";
import { TeamMemberEntity } from "@/domain/schemas/member";
import { ClubService } from "@/domain/services/club-service";
import {
  detectImageMimeType,
  extractNuligaClubLogoSrc,
  MAX_CLUB_LOGO_BYTES,
  NuligaSessionFetchFn,
  resolveNuligaClubLogo,
  validateClubLogoBinary,
} from "@/domain/services/nuliga-club-logo";
import { OnboardingService } from "@/domain/services/onboarding-service";
import { RosterService } from "@/domain/services/roster-service";
import { deriveSelectableTeams } from "../../packages/shared/src/types/dto";

// Minimales gültiges PNG (>= 32 Bytes)
function makeFakePng(extraLength = 40): Uint8Array {
  const bytes = new Uint8Array(8 + extraLength);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}

function makeFakeJpeg(extraLength = 40): Uint8Array {
  const bytes = new Uint8Array(3 + extraLength);
  bytes.set([0xff, 0xd8, 0xff], 0);
  return bytes;
}

function makeViewer(
  overrides: Partial<ViewerContext> & {
    memberships: ViewerContext["memberships"];
  }
): ViewerContext {
  return {
    userId: overrides.userId ?? "user-1",
    email: overrides.email ?? "test@verein.de",
    name: overrides.name ?? "Max Mustermann",
    memberships: overrides.memberships,
    linkedChildMemberIds: overrides.linkedChildMemberIds ?? [],
    linkedChildTeamIds: overrides.linkedChildTeamIds ?? [],
  };
}

function createInMemoryClubFixtures() {
  const clubs = new Map<
    string,
    ClubDTO & { logoBinary?: ClubLogoRecord | null }
  >();
  const seasons: SeasonDTO[] = [];
  const teams = new Map<string, TeamRecord>();
  const members = new Map<string, TeamMemberEntity>();
  let seq = 1;

  const baseClub: ClubDTO = {
    id: "club-1",
    name: "TuS Jahn Hollenstedt",
    shortName: "TuS Jahn",
    slug: "tus-jahn-hollenstedt",
    city: "Hollenstedt",
    logoUrl: null,
    createdAt: new Date().toISOString(),
  };
  clubs.set(baseClub.id, { ...baseClub, logoBinary: null });

  const baseTeam: TeamRecord = {
    id: "team-1",
    clubId: "club-1",
    seasonId: "season-1",
    name: "Männliche D-Jugend",
    category: "D-Jugend",
    ageGroup: "YOUTH_D",
    gender: "MALE",
    usesResin: false,
    leagueId: null,
    leagueName: "Regionsoberliga MJD Nord",
    clubName: baseClub.name,
    seasonName: "2026/27",
  };
  teams.set(baseTeam.id, baseTeam);

  const clubRepo: ClubRepository = {
    async findClubsForUser() {
      return [...clubs.values()].map((c) => ({
        id: c.id,
        name: c.name,
        shortName: c.shortName,
        slug: c.slug,
        city: c.city,
        logoUrl: c.logoUrl,
        createdAt: c.createdAt,
      }));
    },
    async findByIdWithDetails(clubId): Promise<ClubWithDetails | null> {
      const c = clubs.get(clubId);
      if (!c) return null;
      return {
        club: {
          id: c.id,
          name: c.name,
          shortName: c.shortName,
          slug: c.slug,
          city: c.city,
          logoUrl: c.logoUrl,
          createdAt: c.createdAt,
        },
        seasons: seasons.filter((s) => s.clubId === clubId),
        teams: [...teams.values()]
          .filter((t) => t.clubId === clubId)
          .map((t) => ({ ...t, usesResin: t.usesResin ?? true })),
      };
    },
    async findBySlug(slug) {
      const found = [...clubs.values()].find((c) => c.slug === slug);
      return found ?? null;
    },
    async findLogoById(clubId) {
      return clubs.get(clubId)?.logoBinary ?? null;
    },
    async updateLogo(clubId, logo) {
      const existing = clubs.get(clubId);
      if (!existing) throw new Error("Club not found");
      if (logo) {
        existing.logoUrl = logo.logoUrl;
        existing.logoBinary = {
          data: logo.data,
          mimeType: logo.mimeType,
          updatedAt: new Date(),
        };
      } else {
        existing.logoUrl = null;
        existing.logoBinary = null;
      }
      return {
        id: existing.id,
        name: existing.name,
        shortName: existing.shortName,
        slug: existing.slug,
        city: existing.city,
        logoUrl: existing.logoUrl,
        createdAt: existing.createdAt,
      };
    },
    async createClubWithSeason(input) {
      const id = `club-${++seq}`;
      const club: ClubDTO = {
        id,
        name: input.name,
        shortName: input.shortName ?? null,
        slug: input.slug,
        city: input.city ?? null,
        logoUrl: null,
        createdAt: new Date().toISOString(),
      };
      clubs.set(id, { ...club, logoBinary: null });
      const season: SeasonDTO = {
        id: `season-${++seq}`,
        clubId: id,
        name: input.seasonName,
        startDate: input.seasonStartDate?.toISOString() ?? null,
        endDate: input.seasonEndDate?.toISOString() ?? null,
        isActive: true,
      };
      seasons.push(season);
      return { club, season };
    },
    async createSeason(input) {
      const season: SeasonDTO = {
        id: `season-${++seq}`,
        clubId: input.clubId,
        name: input.name,
        startDate: input.startDate?.toISOString() ?? null,
        endDate: input.endDate?.toISOString() ?? null,
        isActive: input.isActive,
      };
      seasons.push(season);
      return season;
    },
  };

  const teamRepo: TeamRepository = {
    async findById(teamId) {
      return teams.get(teamId) ?? null;
    },
    async findByClubId(clubId) {
      return [...teams.values()].filter((t) => t.clubId === clubId);
    },
    async create(input) {
      const id = `team-${++seq}`;
      const record: TeamRecord = {
        id,
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
      teams.set(id, record);
      return record;
    },
    async update(teamId, input) {
      const current = teams.get(teamId);
      if (!current) throw new Error("Team not found");
      const next = { ...current, ...input };
      teams.set(teamId, next);
      return next;
    },
  };

  const memberRepo: MemberRepository = {
    async findByTeamId(teamId) {
      return [...members.values()].filter((m) => m.teamId === teamId);
    },
    async findById(memberId) {
      return members.get(memberId) ?? null;
    },
    async findByTeamAndUser(teamId, userId) {
      return (
        [...members.values()].find(
          (m) => m.teamId === teamId && m.userId === userId
        ) ?? null
      );
    },
    async create(clubId, teamId, input) {
      const id = `member-${++seq}`;
      const entity: TeamMemberEntity = {
        id,
        clubId,
        teamId,
        userId: input.userId ?? null,
        role: input.role,
        isClubAdmin: Boolean(input.isClubAdmin || input.role === "CLUB_ADMIN"),
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
      members.set(id, entity);
      return entity;
    },
    async update(memberId, input) {
      const current = members.get(memberId);
      if (!current) throw new Error("Member not found");
      const next: TeamMemberEntity = {
        ...current,
        ...input,
        email: input.email === undefined ? current.email : input.email,
        phone: input.phone === undefined ? current.phone : input.phone,
        updatedAt: new Date(),
      };
      members.set(memberId, next);
      return next;
    },
    async assignUser(memberId, userId) {
      const current = members.get(memberId);
      if (!current) throw new Error("Member not found");
      const next = { ...current, userId };
      members.set(memberId, next);
      return next;
    },
    async delete(memberId) {
      members.delete(memberId);
    },
  };

  return { clubRepo, teamRepo, memberRepo, clubs, members };
}

describe("Vereinslogo: Magic-Byte-Validierung & nuLiga-Import", () => {
  it("erkennt PNG/JPEG zuverlässig und lehnt SVG/HTML/zu große Dateien ab", () => {
    const png = makeFakePng();
    const jpg = makeFakeJpeg();
    expect(detectImageMimeType(png)).toBe("image/png");
    expect(detectImageMimeType(jpg)).toBe("image/jpeg");
    expect(validateClubLogoBinary(png).mimeType).toBe("image/png");

    const svgBytes = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    );
    expect(detectImageMimeType(svgBytes)).toBeNull();
    expect(() => validateClubLogoBinary(svgBytes)).toThrow(DomainError);

    const tooLarge = makeFakePng(MAX_CLUB_LOGO_BYTES + 16);
    expect(() => validateClubLogoBinary(tooLarge)).toThrow(DomainError);
  });

  it("extrahiert den temporären nuLiga-Wappen-Pfad und leitet Session-Cookies weiter", async () => {
    const sampleInfoHtml = `
      <div>
        <p style="text-align:right;">
          <img height="100" alt="HL Buchholz 08 - Rosengarten" src="/cgi-bin/WebObjects/nuLigaHBDE.woa/wr?wodata=8533423557873584907" />
        </p>
      </div>
    `;
    expect(extractNuligaClubLogoSrc(sampleInfoHtml)).toBe(
      "/cgi-bin/WebObjects/nuLigaHBDE.woa/wr?wodata=8533423557873584907"
    );

    const pngBytes = makeFakePng(120);
    const seenCookies: Array<string | undefined> = [];

    const mockFetch: NuligaSessionFetchFn = async (url, options) => {
      seenCookies.push(options?.cookieHeader);

      if (url.includes("clubSearch") && url.includes("Buchholz")) {
        return {
          ok: true,
          status: 200,
          cookies: [],
          text: async () =>
            '<a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/clubInfoDisplay?club=131898">HL Buchholz 08 - Rosengarten</a>',
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      if (url.includes("clubSearch")) {
        return {
          ok: true,
          status: 200,
          cookies: [],
          text: async () => "<html>Keine Treffer</html>",
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      if (url.includes("clubInfoDisplay?club=131898")) {
        return {
          ok: true,
          status: 200,
          cookies: ["nusportingress=node-42-session"],
          text: async () => sampleInfoHtml,
          arrayBuffer: async () => new ArrayBuffer(0),
        };
      }
      if (url.includes("/wr?wodata=8533423557873584907")) {
        // Nur mit korrektem Session-Cookie wird das Bild geliefert (wie bei nuLiga)
        const payload =
          options?.cookieHeader === "nusportingress=node-42-session"
            ? pngBytes
            : new Uint8Array(0);
        const copy = new Uint8Array(payload.byteLength);
        copy.set(payload);
        return {
          ok: true,
          status: 200,
          cookies: [],
          text: async () => "",
          arrayBuffer: async () => copy.buffer,
        };
      }
      return {
        ok: false,
        status: 404,
        cookies: [],
        text: async () => "",
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    };

    const resolved = await resolveNuligaClubLogo(mockFetch, {
      clubName: "HL Buchholz 08-Rosengarten",
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.externalClubId).toBe("131898");
    expect(resolved?.matchedClubName).toBe("HL Buchholz 08 - Rosengarten");
    expect(resolved?.mimeType).toBe("image/png");
    expect(resolved?.data.byteLength).toBe(pngBytes.byteLength);
    expect(seenCookies.at(-1)).toBe("nusportingress=node-42-session");
  });
});

describe("RBAC: Nur Vereins-Admins ändern das Logo · Trainer + Admin in Personalunion", () => {
  it("verweigert reinem Trainer (ohne Admin-Flag) Upload, nuLiga-Import und Löschen", async () => {
    const { clubRepo, teamRepo } = createInMemoryClubFixtures();
    const fetchClubLogo = vi.fn(async () => ({
      data: makeFakePng(),
      mimeType: "image/png" as const,
      externalClubId: "32108",
      matchedClubName: "TuS Jahn Hollenstedt",
    }));
    const clubService = new ClubService(
      clubRepo,
      teamRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      fetchClubLogo
    );

    const coachOnlyViewer = makeViewer({
      userId: "user-coach",
      memberships: [
        {
          memberId: "m-coach",
          clubId: "club-1",
          teamId: "team-1",
          role: "COACH",
          isClubAdmin: false,
        },
      ],
    });

    expect(isClubAdmin(coachOnlyViewer, "club-1")).toBe(false);
    expect(canManageClub(coachOnlyViewer, "club-1")).toBe(false);

    await expect(
      clubService.uploadClubLogo(coachOnlyViewer, "club-1", makeFakePng())
    ).rejects.toMatchObject({ httpStatus: 403, code: "FORBIDDEN" });

    await expect(
      clubService.importClubLogoFromNuliga(coachOnlyViewer, "club-1")
    ).rejects.toMatchObject({ httpStatus: 403, code: "FORBIDDEN" });

    await expect(
      clubService.removeClubLogo(coachOnlyViewer, "club-1")
    ).rejects.toMatchObject({ httpStatus: 403, code: "FORBIDDEN" });

    expect(fetchClubLogo).not.toHaveBeenCalled();
  });

  it("erlaubt Trainer in Personalunion (role=COACH + isClubAdmin=true) Upload, nuLiga-Import und Entfernen", async () => {
    const { clubRepo, teamRepo } = createInMemoryClubFixtures();
    const fetchClubLogo = vi.fn(async () => ({
      data: makeFakePng(64),
      mimeType: "image/png" as const,
      externalClubId: "32108",
      matchedClubName: "TuS Jahn Hollenstedt",
    }));
    const clubService = new ClubService(
      clubRepo,
      teamRepo,
      undefined,
      undefined,
      undefined,
      undefined,
      fetchClubLogo
    );

    const coachAndAdminViewer = makeViewer({
      userId: "user-coach-admin",
      memberships: [
        {
          memberId: "m-coach-admin",
          clubId: "club-1",
          teamId: "team-1",
          role: "COACH",
          isClubAdmin: true,
        },
      ],
    });

    expect(isClubAdmin(coachAndAdminViewer, "club-1")).toBe(true);
    expect(isAnyClubAdmin(coachAndAdminViewer)).toBe(true);
    expect(canManageClub(coachAndAdminViewer, "club-1")).toBe(true);

    const uploaded = await clubService.uploadClubLogo(
      coachAndAdminViewer,
      "club-1",
      makeFakeJpeg(50)
    );
    expect(uploaded.logoUrl).toMatch(/^\/api\/v1\/clubs\/club-1\/logo\?v=\d+$/);

    const storedAfterUpload = await clubService.getClubLogoBinary("club-1");
    expect(storedAfterUpload?.mimeType).toBe("image/jpeg");

    const imported = await clubService.importClubLogoFromNuliga(
      coachAndAdminViewer,
      "club-1"
    );
    expect(imported.matchedClubName).toBe("TuS Jahn Hollenstedt");
    expect(imported.club.logoUrl).toMatch(
      /^\/api\/v1\/clubs\/club-1\/logo\?v=\d+$/
    );

    const storedAfterImport = await clubService.getClubLogoBinary("club-1");
    expect(storedAfterImport?.mimeType).toBe("image/png");

    const removed = await clubService.removeClubLogo(
      coachAndAdminViewer,
      "club-1"
    );
    expect(removed.logoUrl).toBeNull();
    expect(await clubService.getClubLogoBinary("club-1")).toBeNull();
  });

  it("verhindert Rechte-Eskalation durch Trainer im Kader, erlaubt Vereins-Admins aber Vergabe der Personalunion", async () => {
    const { teamRepo, memberRepo } = createInMemoryClubFixtures();
    const rosterService = new RosterService(teamRepo, memberRepo);

    const coachMember = await memberRepo.create("club-1", "team-1", {
      firstName: "Hans",
      lastName: "Trainer",
      role: "COACH",
      isClubAdmin: false,
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: false,
      phone: null,
      userId: "user-coach",
    });

    const coachOnlyViewer = makeViewer({
      userId: "user-coach",
      memberships: [
        {
          memberId: coachMember.id,
          clubId: "club-1",
          teamId: "team-1",
          role: "COACH",
          isClubAdmin: false,
        },
      ],
    });

    // Reiner Trainer darf weder neuen Admin anlegen noch sich selbst hochstufen
    await expect(
      rosterService.addMember(coachOnlyViewer, "team-1", {
        firstName: "Neu",
        lastName: "Admin",
        role: "COACH",
        isClubAdmin: true,
      })
    ).rejects.toMatchObject({ httpStatus: 403, code: "FORBIDDEN" });

    await expect(
      rosterService.updateMember(coachOnlyViewer, "team-1", coachMember.id, {
        isClubAdmin: true,
      })
    ).rejects.toMatchObject({ httpStatus: 403, code: "FORBIDDEN" });

    // Vereins-Admin darf Trainer zusätzlich zum Vereins-Admin machen (Personalunion)
    const adminViewer = makeViewer({
      userId: "user-admin",
      memberships: [
        {
          memberId: "m-admin",
          clubId: "club-1",
          teamId: "team-1",
          role: "CLUB_ADMIN",
          isClubAdmin: true,
        },
      ],
    });

    const promoted = await rosterService.updateMember(
      adminViewer,
      "team-1",
      coachMember.id,
      { role: "COACH", isClubAdmin: true }
    );
    expect(promoted.role).toBe("COACH");
    expect(promoted.isClubAdmin).toBe(true);

    // Und wieder entziehen, wobei die Trainer-Rolle erhalten bleibt
    const demoted = await rosterService.updateMember(
      adminViewer,
      "team-1",
      coachMember.id,
      { isClubAdmin: false }
    );
    expect(demoted.role).toBe("COACH");
    expect(demoted.isClubAdmin).toBe(false);
  });

  it("legt im Onboarding Trainer + Vereins-Admin in Personalunion an und importiert das nuLiga-Logo automatisch", async () => {
    const { clubRepo, teamRepo, memberRepo } = createInMemoryClubFixtures();
    const fetchClubLogo = vi.fn(async () => ({
      data: makeFakePng(80),
      mimeType: "image/png" as const,
      externalClubId: "32108",
      matchedClubName: "TuS Jahn Hollenstedt",
    }));

    const onboardingService = new OnboardingService(
      clubRepo,
      teamRepo,
      memberRepo,
      undefined,
      undefined,
      undefined,
      fetchClubLogo
    );

    const viewer = makeViewer({ userId: "user-founder", memberships: [] });
    const result = await onboardingService.completeOnboarding(viewer, {
      clubName: "TuS Jahn Hollenstedt",
      seasonName: "2026/27",
      teamName: "Männliche D-Jugend",
      creatorFirstName: "Max",
      creatorLastName: "Trainer",
      creatorRole: "COACH",
      creatorIsClubAdmin: true,
    });

    expect(result.member.role).toBe("COACH");
    expect(result.member.isClubAdmin).toBe(true);
    expect(result.club.logoUrl).toMatch(
      new RegExp(`^/api/v1/clubs/${result.club.id}/logo\\?v=\\d+$`)
    );
    expect(fetchClubLogo).toHaveBeenCalledTimes(1);
  });

  it("deriveSelectableTeams übernimmt Personalunion (COACH + isClubAdmin) für alle Vereinsteams", () => {
    const selectable = deriveSelectableTeams({
      user: { id: "u1", email: "coach@club.de", name: "Coach Admin" },
      memberships: [
        {
          memberId: "m1",
          role: "COACH",
          isClubAdmin: true,
          firstName: "Coach",
          lastName: "Admin",
          jerseyNumber: null,
          primaryPosition: null,
          availabilityStatus: "FIT",
          club: {
            id: "c1",
            name: "TuS Jahn Hollenstedt",
            shortName: "TuS Jahn",
            slug: "tus-jahn",
            logoUrl: "/api/v1/clubs/c1/logo?v=1",
          },
          team: {
            id: "t1",
            name: "mD-Jugend",
            category: "D-Jugend",
            ageGroup: "YOUTH_D",
            gender: "MALE",
            usesResin: false,
            leagueName: "ROL MJD",
            seasonName: "2026/27",
          },
        },
      ],
      adminClubTeams: [
        {
          id: "t2",
          name: "1. Herren",
          category: "Aktive",
          ageGroup: "ADULT",
          gender: "MALE",
          usesResin: true,
          leagueName: "Landesliga",
          seasonName: "2026/27",
          club: {
            id: "c1",
            name: "TuS Jahn Hollenstedt",
            shortName: "TuS Jahn",
            slug: "tus-jahn",
            logoUrl: "/api/v1/clubs/c1/logo?v=1",
          },
        },
      ],
      guardianLinks: [],
    });

    expect(selectable).toHaveLength(2);
    expect(selectable[0]).toMatchObject({
      teamId: "t1",
      role: "COACH",
      isClubAdmin: true,
    });
    expect(selectable[1]).toMatchObject({
      teamId: "t2",
      role: "CLUB_ADMIN",
      isClubAdmin: true,
    });
  });
});
