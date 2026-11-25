import { describe, expect, it } from "vitest";
import {
  LeagueDirectoryGroupTeamRecord,
  LeagueDirectoryRepository,
} from "@/domain/adapters/league-directory-repository";
import {
  ExistingSyncedMatch,
  LeagueSyncRepository,
} from "@/domain/adapters/league-provider";
import { ScoutingRepository } from "@/domain/adapters/m4-repositories";
import {
  ClubRepository,
  MemberRepository,
  TeamRecord,
  TeamRepository,
} from "@/domain/adapters/repositories";
import { buildGermanLeaguesCatalog } from "@/domain/data/german-leagues";
import {
  buildHvnbDirectorySeed,
  HVNB_MJD_HOLLENSTEDT_ICAL_URL,
} from "@/domain/data/hvnb-directory-seed";
import { ViewerContext } from "@/domain/policies/rbac";
import {
  CreateLeagueSourceInput,
  LeagueImportSourceDTO,
  LeagueSyncChangeLogDTO,
} from "@/domain/schemas/league";
import { LeagueGroupDTO } from "@/domain/schemas/league-directory";
import { CreateOpponentInput, OpponentDTO } from "@/domain/schemas/scouting";
import {
  computeClubMatchScore,
  LeagueDirectoryService,
} from "@/domain/services/league-directory-service";
import { LeagueSyncService } from "@/domain/services/league-sync-service";
import { OnboardingService } from "@/domain/services/onboarding-service";

const SAMPLE_HVNB_ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:hvnb-match-001",
  "DTSTART;TZID=Europe/Berlin:20261213T100000",
  "DTEND;TZID=Europe/Berlin:20261213T113000",
  "SUMMARY:TuS Jahn Hollenstedt - JSG Fredenbeck/Stade/Harsefeld (S)",
  "DESCRIPTION:Regionsoberliga männliche Jugend D Nord\\nHeim: TuS Jahn Hollenstedt\\nGast: JSG Fredenbeck/Stade/Harsefeld (S)",
  "LOCATION:Hollenstedt, Max-Schmeling-Hallen (Halle 1) (603110)",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:hvnb-match-002",
  "DTSTART;TZID=Europe/Berlin:20261219T130000",
  "DTEND;TZID=Europe/Berlin:20261219T143000",
  "SUMMARY:mJSG Buxtehude/ Beckdorf (Bux) - TuS Jahn Hollenstedt",
  "DESCRIPTION:Regionsoberliga männliche Jugend D Nord\\nHeim: mJSG Buxtehude/ Beckdorf (Bux)\\nGast: TuS Jahn Hollenstedt",
  "LOCATION:Buxtehude, Halle Nord (608165)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function buildTestHarness(fetchTextImpl: (url: string) => Promise<string>) {
  const seedGroups = buildHvnbDirectorySeed();
  const groupDTOs: LeagueGroupDTO[] = seedGroups.map((g, gIdx) => ({
    id: `grp-${gIdx}`,
    code: g.code,
    federationCode: g.federationCode,
    regionCode: g.regionCode,
    regionName: g.regionName,
    seasonName: g.seasonName,
    leagueId: `league-${g.leagueCode}`,
    leagueDisplayName: g.name,
    ageGroup: g.ageGroup,
    gender: g.gender,
    name: g.name,
    shortName: g.shortName ?? null,
    externalProvider: g.externalProvider,
    externalGroupId: g.externalGroupId ?? null,
    externalUrl: g.externalUrl ?? null,
    teams: g.teams.map((t, tIdx) => ({
      id: `gt-${gIdx}-${tIdx}`,
      leagueGroupId: `grp-${gIdx}`,
      externalTeamId: t.externalTeamId,
      name: t.name,
      clubName: t.clubName,
      shortName: t.shortName ?? null,
      hasIcalFeed: Boolean(t.icalUrl),
      externalUrl: t.externalUrl ?? null,
    })),
  }));

  const icalByGroupTeamId = new Map<string, string | null>();
  seedGroups.forEach((g, gIdx) => {
    g.teams.forEach((t, tIdx) => {
      icalByGroupTeamId.set(`gt-${gIdx}-${tIdx}`, t.icalUrl ?? null);
    });
  });

  const teamsMap = new Map<string, TeamRecord>();
  const sources: LeagueImportSourceDTO[] = [];
  const syncedMatches: ExistingSyncedMatch[] = [];
  const changeLogs: LeagueSyncChangeLogDTO[] = [];
  const opponents: OpponentDTO[] = [];

  const directoryRepo: LeagueDirectoryRepository = {
    async findGroupsWithTeams(filter) {
      return groupDTOs.filter((g) => {
        if (g.federationCode !== filter.federationCode) return false;
        if (filter.seasonName && g.seasonName !== filter.seasonName) return false;
        if (filter.ageGroup && g.ageGroup !== filter.ageGroup) return false;
        if (filter.gender && g.gender !== filter.gender) return false;
        if (filter.leagueId && g.leagueId !== filter.leagueId) return false;
        if (filter.regionCode && g.regionCode !== filter.regionCode) return false;
        return true;
      });
    },
    async findGroupTeamById(id): Promise<LeagueDirectoryGroupTeamRecord | null> {
      for (const g of groupDTOs) {
        const found = g.teams.find((t) => t.id === id);
        if (found) {
          const { teams: groupTeams, ...groupMeta } = g;
          return {
            id: found.id,
            leagueGroupId: found.leagueGroupId,
            externalTeamId: found.externalTeamId,
            name: found.name,
            clubName: found.clubName,
            shortName: found.shortName,
            icalUrl: icalByGroupTeamId.get(found.id) ?? null,
            externalUrl: found.externalUrl,
            group: groupMeta,
            siblingTeams: groupTeams.map((s) => ({
              id: s.id,
              name: s.name,
              clubName: s.clubName,
            })),
          };
        }
      }
      return null;
    },
    async upsertDirectorySnapshot() {
      return { groupsUpserted: 0, teamsUpserted: 0 };
    },
    async updateGroupTeamIcalUrl(leagueGroupTeamId, icalUrl) {
      icalByGroupTeamId.set(leagueGroupTeamId, icalUrl);
    },
  };

  const teamRepo: TeamRepository = {
    async findById(id) {
      return teamsMap.get(id) ?? null;
    },
    async findByClubId(clubId) {
      return Array.from(teamsMap.values()).filter((t) => t.clubId === clubId);
    },
    async create(input) {
      const rec: TeamRecord = {
        id: `team-${teamsMap.size + 1}`,
        clubId: input.clubId,
        seasonId: input.seasonId,
        name: input.name,
        category: input.category,
        gender: input.gender,
        leagueId: input.leagueId ?? null,
        leagueName: input.leagueName ?? null,
        leagueGroupTeamId: input.leagueGroupTeamId ?? null,
      };
      teamsMap.set(rec.id, rec);
      return rec;
    },
    async update(teamId, input) {
      const existing = teamsMap.get(teamId)!;
      const updated: TeamRecord = {
        ...existing,
        ...input,
      };
      teamsMap.set(teamId, updated);
      return updated;
    },
  };

  const leagueSyncRepo: LeagueSyncRepository = {
    async listSourcesByTeam(teamId) {
      return sources.filter((s) => s.teamId === teamId);
    },
    async listEnabledIcalSources() {
      return sources.filter(
        (s) =>
          (s.provider === "ICAL_URL" || s.provider === "HVNB_NULIGA") &&
          s.isEnabled &&
          Boolean(s.sourceUrl)
      );
    },
    async findSourceById(sourceId) {
      return sources.find((s) => s.id === sourceId) ?? null;
    },
    async createSource(clubId, teamId, input: CreateLeagueSourceInput) {
      const src: LeagueImportSourceDTO = {
        id: `src-${sources.length + 1}`,
        clubId,
        teamId,
        leagueGroupTeamId: input.leagueGroupTeamId ?? null,
        provider: input.provider,
        name: input.name,
        sourceUrl: input.sourceUrl ?? null,
        teamNameMatch: input.teamNameMatch ?? null,
        isEnabled: input.isEnabled,
        syncIntervalMinutes: input.syncIntervalMinutes,
        lastSyncedAt: null,
        lastSyncStatus: "NEVER",
        lastSyncError: null,
        createdAt: new Date().toISOString(),
      };
      sources.push(src);
      return src;
    },
    async updateSourceSyncStatus(sourceId, status, errorMessage) {
      const src = sources.find((s) => s.id === sourceId);
      if (src) {
        src.lastSyncStatus = status;
        src.lastSyncError = errorMessage ?? null;
        src.lastSyncedAt = new Date().toISOString();
      }
    },
    async deleteSource(sourceId) {
      const idx = sources.findIndex((s) => s.id === sourceId);
      if (idx >= 0) sources.splice(idx, 1);
    },
    async findSyncedMatchesByTeam() {
      return syncedMatches;
    },
    async findOrCreateVenueByNamePreservingResin(_clubId, venueName) {
      return { id: `venue-${venueName}`, name: venueName };
    },
    async createSyncedMatchEvent(input) {
      const eventId = `ev-${syncedMatches.length + 1}`;
      syncedMatches.push({
        eventId,
        externalId: input.externalId,
        title: input.title,
        startAt: input.startAt,
        endAt: input.endAt,
        venueId: input.venueId,
        venueName: input.venueId,
        isCancelled: input.isCancelled,
        opponentName: input.opponentName,
        isHome: input.isHome,
      });
      return { eventId };
    },
    async updateSyncedMatchSchedulePreservingLocal() {},
    async createChangeLog(input) {
      const log: LeagueSyncChangeLogDTO = {
        id: `log-${changeLogs.length + 1}`,
        sourceId: input.sourceId,
        teamId: input.teamId,
        eventId: input.eventId,
        externalId: input.externalId,
        changeType: input.changeType,
        summary: input.summary,
        oldStartAt: input.oldStartAt?.toISOString() ?? null,
        newStartAt: input.newStartAt?.toISOString() ?? null,
        oldVenueName: input.oldVenueName ?? null,
        newVenueName: input.newVenueName ?? null,
        detectedAt: new Date().toISOString(),
      };
      changeLogs.push(log);
      return log;
    },
    async listChangeLogsByTeam(teamId) {
      return changeLogs.filter((l) => l.teamId === teamId);
    },
  };

  const scoutingRepo = {
    async listOpponentsByTeam(teamId: string) {
      return opponents.filter((o) => o.teamId === teamId);
    },
    async createOpponent(
      clubId: string,
      teamId: string,
      input: CreateOpponentInput
    ): Promise<OpponentDTO> {
      const opp: OpponentDTO = {
        id: `opp-${opponents.length + 1}`,
        clubId,
        teamId,
        name: input.name,
        leagueName: input.leagueName ?? null,
        defenseSystems: input.defenseSystems ?? [],
        attackSystems: input.attackSystems ?? [],
        transitionNotes: input.transitionNotes ?? null,
        strengths: input.strengths ?? null,
        weaknesses: input.weaknesses ?? null,
        generalNotes: input.generalNotes ?? null,
        keyPlayers: [],
        scoutingNotes: [],
        updatedAt: new Date().toISOString(),
      };
      opponents.push(opp);
      return opp;
    },
  } as unknown as ScoutingRepository;

  const leagueSyncService = new LeagueSyncService(
    teamRepo,
    leagueSyncRepo,
    fetchTextImpl
  );
  const directoryService = new LeagueDirectoryService(
    directoryRepo,
    teamRepo,
    leagueSyncRepo,
    leagueSyncService,
    scoutingRepo
  );

  return {
    teamsMap,
    sources,
    syncedMatches,
    opponents,
    teamRepo,
    directoryService,
    hollenstedtMjdGroupTeamId: "gt-0-0",
  };
}

describe("HVNB-Verzeichnis, Auto-Suggest & direkte Mannschafts-Zuordnung", () => {
  it("Seed-Verzeichnis referenziert ausschließlich gültige HVNB-Ligen aus dem DE-Katalog", () => {
    const germanLeagueCodes = new Set(
      buildGermanLeaguesCatalog().map((l) => l.code)
    );
    const hvnbGroups = buildHvnbDirectorySeed();
    expect(hvnbGroups.length).toBeGreaterThanOrEqual(5);

    const groupCodes = new Set<string>();
    for (const g of hvnbGroups) {
      expect(g.federationCode).toBe("HVNB");
      expect(germanLeagueCodes.has(g.leagueCode)).toBe(true);
      expect(groupCodes.has(g.code)).toBe(false);
      groupCodes.add(g.code);
      expect(g.teams.length).toBeGreaterThanOrEqual(4);
    }

    const mjdNord = hvnbGroups.find(
      (g) => g.code === "HVNB-2627-HRLU-MJD-ROL-NORD"
    );
    expect(mjdNord).toBeDefined();
    expect(
      mjdNord?.teams.find((t) => t.name === "TuS Jahn Hollenstedt")?.icalUrl
    ).toBe(HVNB_MJD_HOLLENSTEDT_ICAL_URL);
  });

  it("computeClubMatchScore & search liefern präzise HVNB-Auto-Suggest-Treffer", async () => {
    expect(
      computeClubMatchScore(
        "TuS Jahn Hollenstedt",
        "TuS Jahn Hollenstedt",
        "TuS Jahn Hollenstedt"
      ).score
    ).toBe(100);
    expect(
      computeClubMatchScore(
        "Hollenstedt",
        "TuS Jahn Hollenstedt",
        "TuS Jahn Hollenstedt"
      ).score
    ).toBeGreaterThanOrEqual(80);

    const { directoryService } = buildTestHarness(async () => SAMPLE_HVNB_ICS);
    const res = await directoryService.search({
      federationCode: "HVNB",
      ageGroup: "YOUTH_D",
      gender: "MALE",
      clubName: "Jahn Hollenstedt",
    });

    expect(res.suggestions.length).toBeGreaterThan(0);
    expect(res.suggestions[0].team.name).toBe("TuS Jahn Hollenstedt");
    expect(res.suggestions[0].team.hasIcalFeed).toBe(true);
    expect(res.suggestions[0].opponentCount).toBe(7);
  });

  it("verknüpft eine Mannschaft mit HVNB, importiert Spielplan automatisch und legt Staffel-Gegner idempotent an", async () => {
    const harness = buildTestHarness(async () => SAMPLE_HVNB_ICS);
    const team = await harness.teamRepo.create({
      clubId: "club-1",
      seasonId: "season-1",
      name: "mD-Jugend",
      category: "mD-Jugend",
      gender: "MALE",
    });

    const coachViewer: ViewerContext = {
      userId: "user-coach",
      email: "coach@hollenstedt.de",
      name: "Trainer",
      memberships: [
        {
          memberId: "mem-1",
          clubId: "club-1",
          teamId: team.id,
          role: "COACH",
        },
      ],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    const result = await harness.directoryService.linkTeamToDirectoryTeam(
      coachViewer,
      team.id,
      {
        leagueGroupTeamId: harness.hollenstedtMjdGroupTeamId,
        autoImportSchedule: true,
        seedGroupOpponents: true,
      }
    );

    expect(result.officialTeamName).toBe("TuS Jahn Hollenstedt");
    expect(result.hasIcalFeed).toBe(true);
    expect(result.syncWarning).toBeNull();
    expect(result.syncSummary?.createdCount).toBe(2);
    expect(result.seededOpponentsCount).toBe(7);

    // Heim- und Auswärtsspiel korrekt erkannt
    const homeMatch = harness.syncedMatches.find(
      (m) => m.externalId === "hvnb-match-001"
    );
    const awayMatch = harness.syncedMatches.find(
      (m) => m.externalId === "hvnb-match-002"
    );
    expect(homeMatch?.isHome).toBe(true);
    expect(homeMatch?.opponentName).toBe("JSG Fredenbeck/Stade/Harsefeld (S)");
    expect(awayMatch?.isHome).toBe(false);
    expect(awayMatch?.opponentName).toBe("mJSG Buxtehude/ Beckdorf (Bux)");

    // Eigene Mannschaft wurde NICHT als Gegner angelegt
    expect(
      harness.opponents.some((o) => o.name === "TuS Jahn Hollenstedt")
    ).toBe(false);

    // Erneute Verknüpfung ist idempotent (keine doppelten Gegner)
    const second = await harness.directoryService.linkTeamToDirectoryTeam(
      coachViewer,
      team.id,
      {
        leagueGroupTeamId: harness.hollenstedtMjdGroupTeamId,
        autoImportSchedule: true,
        seedGroupOpponents: true,
      }
    );
    expect(second.seededOpponentsCount).toBe(0);
    expect(harness.opponents.length).toBe(7);
  });

  it("bleibt fehlertolerant, wenn der externe iCal-Feed beim Verknüpfen nicht erreichbar ist", async () => {
    const harness = buildTestHarness(async () => {
      throw new Error("HTTP 503 Service Unavailable");
    });

    const clubRepo = {
      async findBySlug() {
        return null;
      },
      async createClubWithSeason(input: {
        name: string;
        slug: string;
        seasonName: string;
      }) {
        return {
          club: {
            id: "club-ob",
            name: input.name,
            shortName: null,
            slug: input.slug,
            city: null,
            logoUrl: null,
            createdAt: new Date().toISOString(),
          },
          season: {
            id: "season-ob",
            clubId: "club-ob",
            name: input.seasonName,
            startDate: null,
            endDate: null,
            isActive: true,
          },
        };
      },
    } as unknown as ClubRepository;

    const memberRepo = {
      async create() {
        return { id: "mem-ob" };
      },
    } as unknown as MemberRepository;

    const onboarding = new OnboardingService(
      clubRepo,
      harness.teamRepo,
      memberRepo,
      undefined,
      undefined,
      harness.directoryService
    );

    const viewer: ViewerContext = {
      userId: "user-new",
      email: "neu@hollenstedt.de",
      name: "Max",
      memberships: [],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    const res = await onboarding.completeOnboarding(viewer, {
      clubName: "TuS Jahn Hollenstedt",
      seasonName: "2026/27",
      teamName: "mD-Jugend",
      category: "mD-Jugend",
      gender: "MALE",
      leagueGroupTeamId: harness.hollenstedtMjdGroupTeamId,
      autoImportSchedule: true,
      seedGroupOpponents: true,
      creatorFirstName: "Max",
      creatorLastName: "Mustermann",
      creatorRole: "CLUB_ADMIN",
    });

    expect(res.team.id).toBeTruthy();
    expect(res.leagueLink).not.toBeNull();
    expect(res.leagueLink?.syncSummary).toBeNull();
    expect(res.leagueLink?.syncWarning).toContain("HTTP 503");
    expect(res.leagueLink?.seededOpponentsCount).toBe(7);
  });

  it("verweigert Spielern das Ändern oder Lösen der HVNB-Verknüpfung (RBAC)", async () => {
    const harness = buildTestHarness(async () => SAMPLE_HVNB_ICS);
    const team = await harness.teamRepo.create({
      clubId: "club-1",
      seasonId: "season-1",
      name: "mD-Jugend",
      category: "mD-Jugend",
      gender: "MALE",
    });

    const playerViewer: ViewerContext = {
      userId: "user-player",
      email: "player@hollenstedt.de",
      name: "Spieler",
      memberships: [
        {
          memberId: "mem-p",
          clubId: "club-1",
          teamId: team.id,
          role: "PLAYER",
        },
      ],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    await expect(
      harness.directoryService.linkTeamToDirectoryTeam(playerViewer, team.id, {
        leagueGroupTeamId: harness.hollenstedtMjdGroupTeamId,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      harness.directoryService.unlinkTeamFromDirectory(playerViewer, team.id)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
