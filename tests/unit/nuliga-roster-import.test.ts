import { describe, expect, it } from "vitest";
import type { LeagueDirectoryRepository } from "@/domain/adapters/league-directory-repository";
import type {
  ClubRepository,
  GuardianRepository,
  InviteRepository,
  MemberRepository,
  TeamRecord,
  TeamRepository,
} from "@/domain/adapters/repositories";
import type { SeasonCatalogRepository } from "@/domain/adapters/season-catalog-repository";
import type { ViewerContext } from "@/domain/policies/rbac";
import type { TeamInviteEntity } from "@/domain/schemas/invite";
import type { TeamMemberEntity } from "@/domain/schemas/member";
import { ClubService } from "@/domain/services/club-service";
import { InviteService } from "@/domain/services/invite-service";
import {
  fetchNuligaTeamRoster,
  parseMeetingReportTeamRosterHtml,
  splitNuligaPersonName,
} from "@/domain/services/nuliga-opponent-players";
import { RosterService } from "@/domain/services/roster-service";

const REPORT_1_HTML = `
<h2>TuS Jahn Hollenstedt</h2>
<table class="result-set">
  <thead>
    <tr><th>Trikot</th><th>Name, Vorname</th><th>Geb</th><th>Pass</th><th>Tore</th><th>7M</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>14</td>
      <td><a href="/wa/playerPortrait?person=101">Dreyer, Noah</a></td>
      <td>-</td><td>-</td><td>7</td><td>2/2</td>
    </tr>
    <tr>
      <td>9</td>
      <td><a href="/wa/playerPortrait?person=102">van der Berg, Jan Luca</a></td>
      <td>-</td><td>-</td><td>3</td><td></td>
    </tr>
    <tr>
      <td>1</td>
      <td><a href="/wa/playerPortrait?person=103">Meyer, Timo</a></td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
    <tr>
      <td>A</td>
      <td>Fechner, Björn</td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
    <tr>
      <td>B</td>
      <td>Schulz, Arne</td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
    <tr>
      <td>C</td>
      <td>Dreyer, Noah</td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
  </tbody>
</table>
`;

const REPORT_2_HTML = `
<h2>TuS Jahn Hollenstedt</h2>
<table class="result-set">
  <thead>
    <tr><th>Trikot</th><th>Name, Vorname</th><th>Geb</th><th>Pass</th><th>Tore</th><th>7M</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>14</td>
      <td><a href="/wa/playerPortrait?person=101">Dreyer, Noah</a></td>
      <td>-</td><td>-</td><td>5</td><td>1/1</td>
    </tr>
    <tr>
      <td>9</td>
      <td><a href="/wa/playerPortrait?person=102">van der Berg, Jan Luca</a></td>
      <td>-</td><td>-</td><td>4</td><td></td>
    </tr>
    <tr>
      <td>22</td>
      <td><a href="/wa/playerPortrait?person=104">Aushilfe, Lukas</a></td>
      <td>-</td><td>-</td><td>1</td><td></td>
    </tr>
    <tr>
      <td>A</td>
      <td>Fechner, Björn</td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
    <tr>
      <td>C</td>
      <td>Behrens, Katja</td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
  </tbody>
</table>
`;

const PORTRAIT_HTML = `
<html><body>
  <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupMeetingReport?meeting=8001&amp;championship=HVNB+26%2F27&amp;group=450001">Bericht 1</a>
  <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupMeetingReport?meeting=8002&amp;championship=HVNB+26%2F27&amp;group=450001">Bericht 2</a>
</body></html>
`;

const ANONYMIZED_REPORT_HTML = `
<h2>TuS Jahn Hollenstedt</h2>
<table class="result-set">
  <thead>
    <tr><th>Trikot</th><th>Name, Vorname</th><th>Geb</th><th>Pass</th><th>Tore</th><th>7M</th></tr>
  </thead>
  <tbody>
    <tr><td>7</td><td>N.N.</td><td>-</td><td>-</td><td>3</td><td></td></tr>
    <tr><td>A</td><td>-</td><td>-</td><td>-</td><td></td><td></td></tr>
  </tbody>
</table>
`;

function createInMemoryMemberRepo(initial: TeamMemberEntity[] = []) {
  const store = [...initial];
  let seq = 1;
  const repo: MemberRepository = {
    async findByTeamId(teamId) {
      return store.filter((m) => m.teamId === teamId);
    },
    async findById(memberId) {
      return store.find((m) => m.id === memberId) ?? null;
    },
    async findByTeamAndUser(teamId, userId) {
      return (
        store.find((m) => m.teamId === teamId && m.userId === userId) ?? null
      );
    },
    async create(clubId, teamId, input) {
      const now = new Date();
      const created: TeamMemberEntity = {
        id: `mem-${seq++}`,
        clubId,
        teamId,
        userId: input.userId ?? null,
        role: input.role ?? "PLAYER",
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        jerseyNumber: input.jerseyNumber ?? null,
        primaryPosition: input.primaryPosition ?? null,
        secondaryPosition: input.secondaryPosition ?? null,
        throwingHand: input.throwingHand ?? null,
        availabilityStatus: input.availabilityStatus ?? "FIT",
        teamRoles: input.teamRoles ?? [],
        isMinor: input.isMinor ?? false,
        passNumber: input.passNumber ?? null,
        injuryNote: input.injuryNote ?? null,
        emergencyContact: input.emergencyContact ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.push(created);
      return created;
    },
    async update(memberId, input) {
      const idx = store.findIndex((m) => m.id === memberId);
      if (idx === -1) throw new Error("not found");
      store[idx] = {
        ...store[idx],
        ...input,
        phone: input.phone !== undefined ? input.phone : store[idx].phone,
        updatedAt: new Date(),
      };
      return store[idx];
    },
    async assignUser(memberId, userId) {
      const idx = store.findIndex((m) => m.id === memberId);
      if (idx === -1) throw new Error("not found");
      store[idx] = {
        ...store[idx],
        userId,
        updatedAt: new Date(),
      };
      return store[idx];
    },
    async delete(memberId) {
      const idx = store.findIndex((m) => m.id === memberId);
      if (idx !== -1) store.splice(idx, 1);
    },
  };
  return { repo, store };
}

describe("nuLiga Kader-Import (Spieler & optionale Offizielle A–D)", () => {
  it("zerlegt nuLiga-Namen inklusive Doppelnamen sauber in Vor- und Nachname", () => {
    expect(splitNuligaPersonName("Dreyer, Noah")).toEqual({
      firstName: "Noah",
      lastName: "Dreyer",
      displayName: "Noah Dreyer",
    });
    expect(splitNuligaPersonName("van der Berg, Jan Luca")).toEqual({
      firstName: "Jan Luca",
      lastName: "van der Berg",
      displayName: "Jan Luca van der Berg",
    });
    expect(splitNuligaPersonName("Noah Dreyer")).toEqual({
      firstName: "Noah",
      lastName: "Dreyer",
      displayName: "Noah Dreyer",
    });
  });

  it("extrahiert Spieler und Offizielle (A–D) getrennt aus einem Spielbericht", () => {
    const parsed = parseMeetingReportTeamRosterHtml(
      REPORT_1_HTML,
      "TuS Jahn Hollenstedt"
    );
    expect(parsed.matchedSection).toBe(true);
    expect(parsed.players).toHaveLength(3);
    expect(parsed.officials).toHaveLength(3);
    expect(parsed.officials.map((o) => o.officialCode)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("aggregiert Einsätze, Trikotnummern & Offizielle über mehrere Berichte und dedupliziert Spielertrainer", async () => {
    const fetchText = async (url: string) => {
      if (url.includes("teamPortrait")) return PORTRAIT_HTML;
      if (url.includes("meeting=8001")) return REPORT_1_HTML;
      if (url.includes("meeting=8002")) return REPORT_2_HTML;
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await fetchNuligaTeamRoster(fetchText, {
      teamName: "Herren 1",
      officialTeamName: "TuS Jahn Hollenstedt",
      teamUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=99&championship=HVNB+26%2F27&group=450001",
    });

    expect(result.reportsAnalyzed).toBe(2);
    expect(result.players.map((p) => p.displayName)).toEqual([
      "Jan Luca van der Berg",
      "Noah Dreyer",
      "Timo Meyer",
      "Lukas Aushilfe",
    ]);
    expect(result.players[0]).toMatchObject({
      firstName: "Jan Luca",
      lastName: "van der Berg",
      jerseyNumber: 9,
      appearances: 2,
    });
    expect(result.players[3]).toMatchObject({
      displayName: "Lukas Aushilfe",
      appearances: 1,
    });

    // Noah Dreyer stand auch als Offizieller C auf dem Bogen, darf aber nicht doppelt in officials landen!
    expect(result.officials.map((o) => o.displayName)).toEqual([
      "Björn Fechner",
      "Arne Schulz",
      "Katja Behrens",
    ]);
    expect(result.officials[0]).toMatchObject({
      officialCode: "A",
      suggestedRole: "COACH",
      appearances: 2,
    });
    expect(result.officials[1]).toMatchObject({
      officialCode: "B",
      suggestedRole: "ASSISTANT_COACH",
      appearances: 1,
    });
    expect(result.officials[2]).toMatchObject({
      officialCode: "C",
      suggestedRole: "TEAM_MANAGER",
      appearances: 1,
    });
  });

  it("unterstützt direkte Spielbericht-URLs und erkennt anonymisierte Jugendstaffeln", async () => {
    const result = await fetchNuligaTeamRoster(
      async () => ANONYMIZED_REPORT_HTML,
      {
        teamName: "mD-Jugend",
        clubName: "TuS Jahn Hollenstedt",
        directReportUrl:
          "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupMeetingReport?meeting=9001",
      }
    );
    expect(result.reportsAnalyzed).toBe(1);
    expect(result.players).toHaveLength(0);
    expect(result.officials).toHaveLength(0);
    expect(result.anonymizedDetected).toBe(true);
    expect(result.warning).toContain("Datenschutzgründen");
  });

  it("importiert Spieler + optionale Offizielle über RosterService mit Jugend-Default & Duplikat-Schutz", async () => {
    const team: TeamRecord = {
      id: "team-youth",
      clubId: "club-1",
      seasonId: "season-1",
      name: "mC-Jugend",
      category: "Jugend",
      ageGroup: "YOUTH_C",
      gender: "MALE",
      usesResin: false,
      leagueName: "Regionsoberliga",
      leagueGroupTeamId: "lgt-1",
      clubName: "TuS Jahn Hollenstedt",
    };

    const existingCoach: TeamMemberEntity = {
      id: "mem-existing-coach",
      clubId: "club-1",
      teamId: "team-youth",
      userId: "user-coach",
      role: "COACH",
      firstName: "Björn",
      lastName: "Fechner",
      email: "coach@example.de",
      phone: null,
      jerseyNumber: null,
      primaryPosition: null,
      secondaryPosition: null,
      throwingHand: null,
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: false,
      passNumber: null,
      injuryNote: null,
      emergencyContact: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const existingPlayerWithoutJersey: TeamMemberEntity = {
      ...existingCoach,
      id: "mem-existing-noah",
      userId: null,
      role: "PLAYER",
      firstName: "Noah",
      lastName: "Dreyer",
      email: null,
      isMinor: true,
    };

    const { repo: memberRepo, store } = createInMemoryMemberRepo([
      existingCoach,
      existingPlayerWithoutJersey,
    ]);

    const teamRepo: TeamRepository = {
      async findById(id) {
        return id === team.id ? team : null;
      },
      async findByClubId() {
        return [team];
      },
      async create() {
        throw new Error("not used");
      },
      async update() {
        throw new Error("not used");
      },
    };

    const leagueDirectory = {
      async findGroupTeamById() {
        return {
          id: "lgt-1",
          name: "TuS Jahn Hollenstedt",
          clubName: "TuS Jahn Hollenstedt",
          shortName: null,
          externalTeamId: null,
          externalUrl:
            "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=99",
          icalUrl: null,
          group: {
            id: "lg-1",
            federationCode: "HVNB",
            regionCode: "HRSON",
            regionName: "Südost",
            seasonName: "2026/27",
            leagueId: null,
            name: "Regionsoberliga mJC",
            shortName: null,
            ageGroup: "YOUTH_C" as const,
            gender: "MALE" as const,
            externalGroupId: "450001",
            externalUrl:
              "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HVNB+26%2F27&group=450001",
          },
          siblingTeams: [],
        };
      },
    } as unknown as LeagueDirectoryRepository;

    const fetchText = async (url: string) => {
      if (url.includes("teamPortrait")) return PORTRAIT_HTML;
      if (url.includes("meeting=8001")) return REPORT_1_HTML;
      if (url.includes("meeting=8002")) return REPORT_2_HTML;
      throw new Error(`Unexpected URL: ${url}`);
    };

    const viewer: ViewerContext = {
      userId: "user-coach",
      email: "coach@example.de",
      name: "Björn Fechner",
      memberships: [
        {
          memberId: "mem-existing-coach",
          clubId: "club-1",
          teamId: "team-youth",
          role: "COACH",
        },
      ],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    const rosterService = new RosterService(
      teamRepo,
      memberRepo,
      leagueDirectory,
      undefined,
      fetchText
    );

    const preview = await rosterService.previewNuligaRoster(
      viewer,
      "team-youth"
    );
    expect(preview.defaultIsMinor).toBe(true);
    expect(preview.players.find((p) => p.displayName === "Noah Dreyer")).toMatchObject({
      alreadyInRoster: true,
      existingMemberId: "mem-existing-noah",
      existingMemberJerseyNumber: null,
    });
    expect(preview.officials.find((o) => o.displayName === "Björn Fechner")).toMatchObject({
      alreadyInRoster: true,
    });

    const imported = await rosterService.importNuligaRoster(
      viewer,
      "team-youth",
      {
        members: [
          {
            firstName: "Noah",
            lastName: "Dreyer",
            role: "PLAYER",
            jerseyNumber: 14,
          },
          {
            firstName: "Jan Luca",
            lastName: "van der Berg",
            role: "PLAYER",
            jerseyNumber: 9,
          },
          {
            firstName: "Arne",
            lastName: "Schulz",
            role: "ASSISTANT_COACH",
          },
          {
            firstName: "Björn",
            lastName: "Fechner",
            role: "COACH",
          },
        ],
      }
    );

    expect(imported.createdCount).toBe(2);
    expect(imported.updatedCount).toBe(1); // Noahs fehlende Trikotnummer #14 ergänzt
    expect(imported.skippedCount).toBe(1); // Björn Fechner bereits vorhanden

    const createdPlayer = store.find((m) => m.firstName === "Jan Luca");
    expect(createdPlayer).toMatchObject({
      role: "PLAYER",
      jerseyNumber: 9,
      isMinor: true,
      userId: null,
    });

    const createdOfficial = store.find((m) => m.firstName === "Arne");
    expect(createdOfficial).toMatchObject({
      role: "ASSISTANT_COACH",
      jerseyNumber: null,
      isMinor: false, // Offizielle bleiben auch im Jugendteam volljährig
      userId: null,
    });

    const updatedNoah = store.find((m) => m.id === "mem-existing-noah");
    expect(updatedNoah?.jerseyNumber).toBe(14);
  });
});

describe("TEAM_JOIN Auto-Matching für vorangelegte Kader-Profile", () => {
  it("verknüpft beim Gruppenlink-Beitritt automatisch ein eindeutiges vorangelegtes Profil statt ein Duplikat zu erzeugen", async () => {
    const importedPlayer: TeamMemberEntity = {
      id: "mem-imported-14",
      clubId: "club-1",
      teamId: "team-1",
      userId: null,
      role: "PLAYER",
      firstName: "Noah",
      lastName: "Dreyer",
      email: null,
      phone: null,
      jerseyNumber: 14,
      primaryPosition: null,
      secondaryPosition: null,
      throwingHand: null,
      availabilityStatus: "FIT",
      teamRoles: [],
      isMinor: false,
      passNumber: null,
      injuryNote: null,
      emergencyContact: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { repo: memberRepo, store } = createInMemoryMemberRepo([
      importedPlayer,
    ]);

    const invite: TeamInviteEntity = {
      id: "inv-1",
      clubId: "club-1",
      teamId: "team-1",
      token: "TEAMTOKEN123",
      shortCode: "ABC123",
      type: "TEAM_JOIN",
      role: "PLAYER",
      targetMemberId: null,
      createdByUserId: "coach-1",
      maxUses: 30,
      usedCount: 0,
      expiresAt: new Date(Date.now() + 86_400_000),
      revokedAt: null,
      createdAt: new Date(),
    };

    const inviteRepo: InviteRepository = {
      async findByTeamId() {
        return [];
      },
      async findById() {
        return invite;
      },
      async findByTokenWithContext() {
        return {
          invite,
          clubName: "TuS Jahn Hollenstedt",
          teamName: "Herren 1",
          seasonName: "2026/27",
          targetMember: null,
        };
      },
      async create() {
        return invite;
      },
      async incrementUsedCount() {
        invite.usedCount += 1;
      },
      async revoke() {},
    };

    const teamRepo = {} as TeamRepository;
    const guardianRepo = {} as GuardianRepository;
    const inviteService = new InviteService(
      teamRepo,
      memberRepo,
      inviteRepo,
      guardianRepo
    );

    const joiningPlayer: ViewerContext = {
      userId: "user-noah",
      email: "noah@example.de",
      name: "Noah Dreyer",
      memberships: [],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    const result = await inviteService.claimInvite(
      joiningPlayer,
      "TEAMTOKEN123",
      { firstName: "Noah", lastName: "Dreyer" }
    );

    expect(result.memberId).toBe("mem-imported-14");
    expect(result.claimedExistingProfile).toBe(true);
    expect(result.jerseyNumber).toBe(14);
    expect(store).toHaveLength(1);
    expect(store[0].userId).toBe("user-noah");
    expect(store[0].email).toBe("noah@example.de");
  });
});

describe("ClubService.createTeam für weitere Mannschaften", () => {
  it("löst Saison über seasonCatalogId auf, verhindert Namens-Duplikate und trägt nicht-Admin-Trainer als COACH ein", async () => {
    const clubSeasons: Array<{
      id: string;
      clubId: string;
      name: string;
      startDate: string | null;
      endDate: string | null;
      isActive: boolean;
    }> = [
      {
        id: "club-season-1",
        clubId: "club-1",
        name: "2025/26",
        startDate: null,
        endDate: null,
        isActive: true,
      },
    ];
    const clubTeams: TeamRecord[] = [];

    const clubRepo: ClubRepository = {
      async findClubsForUser() {
        return [];
      },
      async findByIdWithDetails(clubId) {
        return {
          club: {
            id: clubId,
            name: "TuS Jahn Hollenstedt",
            shortName: null,
            slug: "tus-jahn",
            city: "Hollenstedt",
            logoUrl: null,
            createdAt: new Date().toISOString(),
          },
          seasons: [...clubSeasons],
          teams: [],
        };
      },
      async findBySlug() {
        return null;
      },
      async createClubWithSeason() {
        throw new Error("not used");
      },
      async createSeason(input) {
        const created = {
          id: `club-season-${clubSeasons.length + 1}`,
          clubId: input.clubId,
          name: input.name,
          startDate: input.startDate?.toISOString() ?? null,
          endDate: input.endDate?.toISOString() ?? null,
          isActive: input.isActive,
        };
        clubSeasons.push(created);
        return created;
      },
    };

    const teamRepo: TeamRepository = {
      async findById(id) {
        return clubTeams.find((t) => t.id === id) ?? null;
      },
      async findByClubId(clubId) {
        return clubTeams.filter((t) => t.clubId === clubId);
      },
      async create(input) {
        const created: TeamRecord = {
          id: `team-${clubTeams.length + 1}`,
          clubId: input.clubId,
          seasonId: input.seasonId,
          name: input.name,
          category: input.category,
          ageGroup: input.ageGroup ?? null,
          gender: input.gender,
          usesResin: input.usesResin ?? true,
          leagueId: input.leagueId ?? null,
          leagueName: input.leagueName ?? null,
        };
        clubTeams.push(created);
        return created;
      },
      async update() {
        throw new Error("not used");
      },
    };

    const seasonCatalog = {
      async findById(id: string) {
        if (id !== "cat-2627") return null;
        return {
          id: "cat-2627",
          name: "2026/27",
          startDate: "2026-07-01T00:00:00.000Z",
          endDate: "2027-06-30T00:00:00.000Z",
          isActive: true,
          isDefault: true,
          sortOrder: 10,
        };
      },
    } as unknown as SeasonCatalogRepository;

    const { repo: memberRepo, store: memberStore } = createInMemoryMemberRepo();
    const clubService = new ClubService(
      clubRepo,
      teamRepo,
      undefined,
      undefined,
      memberRepo,
      seasonCatalog
    );

    const coachViewer: ViewerContext = {
      userId: "user-coach",
      email: "trainer@example.de",
      name: "Max Trainer",
      memberships: [
        {
          memberId: "m-1",
          clubId: "club-1",
          teamId: "existing-team",
          role: "COACH",
        },
      ],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    const created = await clubService.createTeam(coachViewer, "club-1", {
      name: "Herren 2",
      seasonCatalogId: "cat-2627",
      category: "Aktive",
      ageGroup: "ADULT",
      gender: "MALE",
    });

    expect(created.name).toBe("Herren 2");
    expect(clubSeasons.some((s) => s.name === "2026/27")).toBe(true);
    expect(memberStore).toHaveLength(1);
    expect(memberStore[0]).toMatchObject({
      teamId: created.id,
      userId: "user-coach",
      role: "COACH",
      firstName: "Max",
      lastName: "Trainer",
    });

    await expect(
      clubService.createTeam(coachViewer, "club-1", {
        name: "Herren 2",
        seasonCatalogId: "cat-2627",
        category: "Aktive",
        ageGroup: "ADULT",
        gender: "MALE",
      })
    ).rejects.toThrow("existiert in dieser Saison bereits");
  });
});
