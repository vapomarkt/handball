import { describe, expect, it } from "vitest";
import {
  LeagueDirectoryGroupTeamRecord,
  LeagueDirectoryRepository,
} from "@/domain/adapters/league-directory-repository";
import {
  ExistingSyncedMatch,
  ExistingUnscoredMatch,
  LeagueSyncRepository,
  MatchScoresSnapshot,
} from "@/domain/adapters/league-provider";
import { TeamRecord, TeamRepository } from "@/domain/adapters/repositories";
import {
  formatMatchScore,
  getMatchOutcome,
  MATCH_OUTCOME_LABELS,
} from "@/domain/schemas/event";
import {
  LeagueImportSourceDTO,
  LeagueSyncChangeLogDTO,
} from "@/domain/schemas/league";
import { CsvLeagueProviderAdapter } from "@/domain/services/csv-parser";
import { IcalLeagueProviderAdapter } from "@/domain/services/ical-parser";
import { computeLeagueMergePlan } from "@/domain/services/league-merge";
import { LeagueSyncService } from "@/domain/services/league-sync-service";
import {
  deriveNuligaGroupMeetingsUrl,
  fetchNuligaMatchResults,
  findMatchingNuligaResult,
  parseNuligaMatchResultsHtml,
  toBerlinDateKey,
} from "@/domain/services/nuliga-match-results";

const NULIGA_TEAM_PORTRAIT_HTML = `
<table class="result-set">
  <tr>
    <th>Tag</th><th>Datum</th><th>Zeit</th><th>Ort</th><th>Nr.</th>
    <th>Heimmannschaft</th><th>Gastmannschaft</th><th>&nbsp;</th><th>&nbsp;</th>
  </tr>
  <tr>
    <td>Sa</td><td>31.10.2026</td><td>13:00 &nbsp;</td><td>603110</td><td>4</td>
    <td>TuS Jahn Hollenstedt</td><td>SG Luhdorf/Scharmbeck &nbsp;</td>
    <td><a href="/wa/groupMeetingReport?meeting=8483685"><span alt="9:17 zur Halbzeit" title="9:17 zur Halbzeit">22:26</span></a></td>
    <td></td>
  </tr>
  <tr>
    <td>So</td><td>22.11.2026</td><td>11:15 &nbsp;</td><td>603134</td><td>15</td>
    <td>HL Buchholz 08 - Rosengarten gem.</td><td>TuS Jahn Hollenstedt &nbsp;</td>
    <td><a href="/wa/groupMeetingReport?meeting=8483692"><span alt="8:12 zur Halbzeit" title="8:12 zur Halbzeit">17:23</span></a></td>
    <td></td>
  </tr>
  <tr>
    <td>Sa</td><td>05.12.2026</td><td>14:00 &nbsp;</td><td>603134</td><td>20</td>
    <td>HL Buchholz 08 - Rosengarten II</td><td>TuS Jahn Hollenstedt &nbsp;</td>
    <td>&nbsp;</td>
    <td></td>
  </tr>
</table>
`;

const NULIGA_GROUP_PAGE_HTML = `
<table class="result-set">
  <tr>
    <th>Tag</th><th>Datum</th><th>Zeit</th><th>Ort</th><th>Nr.</th>
    <th>Heimmannschaft</th><th>Gastmannschaft</th><th>&nbsp;</th>
  </tr>
  <tr>
    <td>So</td><td>01.11.2026</td><td>12:00</td><td>603136</td><td>2</td>
    <td>HL Buchholz 08 - Rosengarten II</td><td>HL Buchholz 08 - Rosengarten gem.</td>
    <td><span title="10:18 zur Halbzeit">20:37</span></td>
  </tr>
  <tr>
    <td>&nbsp;</td><td>&nbsp;</td><td>13:00</td><td>608165</td><td>1</td>
    <td>mJSG Buxtehude/ Beckdorf (Bux)</td><td>TSV Bremervörde</td>
    <td>30:24</td>
  </tr>
  <tr>
    <td>&nbsp;</td><td>&nbsp;</td><td>15:00</td><td>603110</td><td>9</td>
    <td>TuS Jahn Hollenstedt</td><td>VfL Horneburg</td>
    <td>abgesagt</td>
  </tr>
</table>
`;

describe("Match-Outcome & Score-Helfer", () => {
  it("ermittelt Gewonnen, Verloren und Unentschieden korrekt für Heim- und Auswärtsspiele", () => {
    expect(
      getMatchOutcome({ isHome: true, homeScoreFull: 28, awayScoreFull: 24 })
    ).toBe("WIN");
    expect(
      getMatchOutcome({ isHome: true, homeScoreFull: 22, awayScoreFull: 26 })
    ).toBe("LOSS");
    expect(
      getMatchOutcome({ isHome: true, homeScoreFull: 25, awayScoreFull: 25 })
    ).toBe("DRAW");

    // Auswärtssieg (17:23 für Gast)
    expect(
      getMatchOutcome({ isHome: false, homeScoreFull: 17, awayScoreFull: 23 })
    ).toBe("WIN");
    // Auswärtsniederlage (39:32 für Heim)
    expect(
      getMatchOutcome({ isHome: false, homeScoreFull: 39, awayScoreFull: 32 })
    ).toBe("LOSS");
    expect(
      getMatchOutcome({ isHome: false, homeScoreFull: 20, awayScoreFull: 20 })
    ).toBe("DRAW");
    expect(
      getMatchOutcome({ isHome: true, homeScoreFull: null, awayScoreFull: null })
    ).toBeNull();

    expect(MATCH_OUTCOME_LABELS).toEqual({
      WIN: "Gewonnen",
      LOSS: "Verloren",
      DRAW: "Unentschieden",
    });
  });

  it("formatiert Endstand mit und ohne Halbzeitstand", () => {
    expect(
      formatMatchScore({
        homeScoreFull: 17,
        awayScoreFull: 23,
        homeScoreHalf: 8,
        awayScoreHalf: 12,
      })
    ).toBe("17:23 (8:12)");
    expect(
      formatMatchScore({
        homeScoreFull: 30,
        awayScoreFull: 24,
        homeScoreHalf: null,
        awayScoreHalf: null,
      })
    ).toBe("30:24");
    expect(
      formatMatchScore({ homeScoreFull: null, awayScoreFull: null })
    ).toBeNull();
  });
});

describe("nuLiga Ergebnis-Parser & Abruf", () => {
  it("parst Endstände und Halbzeit-Tooltips aus nuLiga teamPortrait HTML und ignoriert offene Spiele", () => {
    const parsed = parseNuligaMatchResultsHtml(NULIGA_TEAM_PORTRAIT_HTML);
    expect(parsed.hasScheduleTable).toBe(true);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[0]).toMatchObject({
      dateKey: "2026-10-31",
      timeText: "13:00",
      matchNumber: "4",
      homeTeam: "TuS Jahn Hollenstedt",
      awayTeam: "SG Luhdorf/Scharmbeck",
      homeScoreFull: 22,
      awayScoreFull: 26,
      homeScoreHalf: 9,
      awayScoreHalf: 17,
    });
    expect(parsed.results[1]).toMatchObject({
      dateKey: "2026-11-22",
      matchNumber: "15",
      homeTeam: "HL Buchholz 08 - Rosengarten gem.",
      awayTeam: "TuS Jahn Hollenstedt",
      homeScoreFull: 17,
      awayScoreFull: 23,
      homeScoreHalf: 8,
      awayScoreHalf: 12,
    });
  });

  it("übernimmt das Datum bei mehrzeiligen Spieltagen in groupPage HTML und ignoriert abgesagte Partien", () => {
    const parsed = parseNuligaMatchResultsHtml(NULIGA_GROUP_PAGE_HTML);
    expect(parsed.hasScheduleTable).toBe(true);
    expect(parsed.results).toHaveLength(2);
    expect(parsed.results[1]).toMatchObject({
      dateKey: "2026-11-01",
      matchNumber: "1",
      homeTeam: "mJSG Buxtehude/ Beckdorf (Bux)",
      awayTeam: "TSV Bremervörde",
      homeScoreFull: 30,
      awayScoreFull: 24,
      homeScoreHalf: null,
      awayScoreHalf: null,
    });
  });

  it("leitet Gesamt-Spielplan-URLs ab und nutzt Fallback auf groupPage wenn teamUrl ohne teamtable ist", async () => {
    const derived = deriveNuligaGroupMeetingsUrl(
      "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HRLS+26%2F27&group=489002"
    );
    expect(derived).toContain("displayTyp=gesamt");
    expect(derived).toContain("displayDetail=meetings");

    const visited: string[] = [];
    const results = await fetchNuligaMatchResults(
      async (url) => {
        visited.push(url);
        return NULIGA_TEAM_PORTRAIT_HTML;
      },
      {
        // Legacy-URL ohne teamtable= wird übersprungen -> fällt sauber auf groupPage zurück
        teamUrl:
          "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?team=1762852",
        groupUrl:
          "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HRLS+26%2F27&group=489002",
      }
    );

    expect(visited).toHaveLength(1);
    expect(visited[0]).toContain("displayTyp=gesamt");
    expect(results).toHaveLength(2);

    // SSRF-Schutz: fremde Hosts werden nie abgerufen
    const evilVisited: string[] = [];
    const blocked = await fetchNuligaMatchResults(
      async (url) => {
        evilVisited.push(url);
        return NULIGA_TEAM_PORTRAIT_HTML;
      },
      { teamUrl: "https://evil.example.com/teamPortrait?teamtable=1" }
    );
    expect(evilVisited).toHaveLength(0);
    expect(blocked).toHaveLength(0);
  });

  it("ordnet Ergebnisse über Europe/Berlin-Datum und Heim/Auswärts-Paarung eindeutig zu", () => {
    const { results } = parseNuligaMatchResultsHtml(NULIGA_TEAM_PORTRAIT_HTML);
    // 2026-11-22 10:15 UTC === 11:15 CET am 22.11.2026
    const startAt = new Date("2026-11-22T10:15:00.000Z");
    expect(toBerlinDateKey(startAt)).toBe("2026-11-22");

    const found = findMatchingNuligaResult(results, {
      startAt,
      isHome: false,
      opponentName: "HL Buchholz 08 - Rosengarten gem.",
      teamNameMatch: "TuS Jahn Hollenstedt",
    });
    expect(found).toMatchObject({ homeScoreFull: 17, awayScoreFull: 23 });

    // Rückspiel mit vertauschtem Heimrecht darf nicht fälschlich zugeordnet werden
    const wrongSide = findMatchingNuligaResult(results, {
      startAt,
      isHome: true,
      opponentName: "HL Buchholz 08 - Rosengarten gem.",
      teamNameMatch: "TuS Jahn Hollenstedt",
    });
    expect(wrongSide).toBeNull();
  });
});

describe("Automatisches Nachtragen von Ergebnissen im Liga-Sync", () => {
  it("parst optionale Ergebnisse aus CSV und iCal DESCRIPTION", () => {
    const csv = [
      "Datum;Uhrzeit;Heim;Gast;Halle;Ergebnis",
      "31.10.2026;13:00;TuS Jahn Hollenstedt;SG Luhdorf/Scharmbeck;Hollenstedt;22:26 (9:17)",
      "05.12.2026;14:00;HL Buchholz II;TuS Jahn Hollenstedt;Klecken;",
    ].join("\n");

    const csvAdapter = new CsvLeagueProviderAdapter();
    const csvMatches = csvAdapter.parse(csv, {
      teamNameMatch: "TuS Jahn Hollenstedt",
      mapping: {
        delimiter: ";",
        dateColumn: "Datum",
        timeColumn: "Uhrzeit",
        homeTeamColumn: "Heim",
        awayTeamColumn: "Gast",
        venueColumn: "Halle",
      },
    });

    expect(csvMatches[0]).toMatchObject({
      homeScoreFull: 22,
      awayScoreFull: 26,
      homeScoreHalf: 9,
      awayScoreHalf: 17,
    });
    expect(csvMatches[1].homeScoreFull).toBeNull();

    const icalAdapter = new IcalLeagueProviderAdapter();
    const icalMatches = icalAdapter.parse(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "BEGIN:VEVENT",
        "UID:m-4",
        "DTSTART;TZID=Europe/Berlin:20261031T130000",
        "SUMMARY:TuS Jahn Hollenstedt vs SG Luhdorf/Scharmbeck (4)",
        "DESCRIPTION:Regionsoberliga MJD Nord\\nBegegnungs-Nr: 4\\nHeim: TuS Jahn Hollenstedt\\nGast: SG Luhdorf/Scharmbeck\\nErgebnis: 22:26 (9:17)",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
      { teamNameMatch: "TuS Jahn Hollenstedt" }
    );
    expect(icalMatches[0]).toMatchObject({
      matchNumber: "4",
      leagueGroupName: "Regionsoberliga MJD Nord",
      homeScoreFull: 22,
      awayScoreFull: 26,
      homeScoreHalf: 9,
      awayScoreHalf: 17,
    });
  });

  it("trägt fehlende Ergebnisse im Merge-Plan nach, überschreibt aber niemals manuell erfasste Endstände", () => {
    const existing: ExistingSyncedMatch[] = [
      {
        eventId: "ev-unscored",
        externalId: "uid-1",
        title: "TuS Jahn Hollenstedt vs. SG Luhdorf/Scharmbeck",
        startAt: new Date("2026-10-31T12:00:00.000Z"),
        endAt: new Date("2026-10-31T13:00:00.000Z"),
        venueId: "v-1",
        venueName: "Hollenstedt",
        isCancelled: false,
        opponentName: "SG Luhdorf/Scharmbeck",
        isHome: true,
        homeScoreFull: null,
        awayScoreFull: null,
        homeScoreHalf: null,
        awayScoreHalf: null,
      },
      {
        eventId: "ev-manual",
        externalId: "uid-2",
        title: "HL Buchholz vs. TuS Jahn Hollenstedt",
        startAt: new Date("2026-11-22T10:15:00.000Z"),
        endAt: new Date("2026-11-22T11:15:00.000Z"),
        venueId: "v-2",
        venueName: "Klecken",
        isCancelled: false,
        opponentName: "HL Buchholz",
        isHome: false,
        homeScoreFull: 18,
        awayScoreFull: 24,
        homeScoreHalf: 9,
        awayScoreHalf: 13,
      },
    ];

    const plan = computeLeagueMergePlan(existing, [
      {
        externalId: "uid-1",
        title: "TuS Jahn Hollenstedt vs. SG Luhdorf/Scharmbeck",
        opponentName: "SG Luhdorf/Scharmbeck",
        isHome: true,
        startAt: new Date("2026-10-31T12:00:00.000Z"),
        endAt: new Date("2026-10-31T13:00:00.000Z"),
        venueName: "Hollenstedt",
        isCancelled: false,
        homeScoreFull: 22,
        awayScoreFull: 26,
        homeScoreHalf: 9,
        awayScoreHalf: 17,
      },
      {
        externalId: "uid-2",
        title: "HL Buchholz vs. TuS Jahn Hollenstedt",
        opponentName: "HL Buchholz",
        isHome: false,
        startAt: new Date("2026-11-22T10:15:00.000Z"),
        endAt: new Date("2026-11-22T11:15:00.000Z"),
        venueName: "Klecken",
        isCancelled: false,
        homeScoreFull: 17,
        awayScoreFull: 23,
        homeScoreHalf: 8,
        awayScoreHalf: 12,
      },
    ]);

    expect(plan[0].kind).toBe("UPDATE");
    expect(plan[0].backfillScores).toEqual({
      homeScoreFull: 22,
      awayScoreFull: 26,
      homeScoreHalf: 9,
      awayScoreHalf: 17,
    });
    expect(plan[0].summary).toContain("Ergebnis nachgetragen");
    expect(plan[0].summary).toContain("22:26 (HZ 9:17)");

    // Bereits manuell erfasstes Ergebnis bleibt 100% geschützt
    expect(plan[1].kind).toBe("UNCHANGED");
  });

  it("reichert im LeagueSyncService iCal-Spiele mit nuLiga-Ergebnissen an und trägt auch nicht mehr im Feed enthaltene Altdaten nach", async () => {
    const team: TeamRecord = {
      id: "team-1",
      clubId: "club-1",
      seasonId: "s-1",
      name: "mD-Jugend",
      category: "Jugend",
      gender: "MALE",
      leagueName: "Regionsoberliga MJD Nord",
      leagueGroupTeamId: "gt-1",
    };

    const source: LeagueImportSourceDTO = {
      id: "src-1",
      clubId: "club-1",
      teamId: "team-1",
      leagueGroupTeamId: "gt-1",
      provider: "HVNB_NULIGA",
      name: "ROL MJD Nord (HVNB)",
      sourceUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/getTeamMeetingsWebcal?teamid=1762852&token=abc",
      teamNameMatch: "TuS Jahn Hollenstedt",
      isEnabled: true,
      syncIntervalMinutes: 60,
      lastSyncedAt: null,
      lastSyncStatus: "NEVER",
      lastSyncError: null,
      createdAt: new Date().toISOString(),
    };

    const syncedExisting: ExistingSyncedMatch[] = [
      {
        eventId: "ev-in-feed",
        externalId: "uid-match-4",
        title: "TuS Jahn Hollenstedt vs. SG Luhdorf/Scharmbeck",
        startAt: new Date("2026-10-31T12:00:00.000Z"),
        endAt: new Date("2026-10-31T13:00:00.000Z"),
        venueId: "v-1",
        venueName: "Hollenstedt, SH (603110)",
        isCancelled: false,
        opponentName: "SG Luhdorf/Scharmbeck",
        isHome: true,
        homeScoreFull: null,
        awayScoreFull: null,
      },
    ];

    // Ein weiteres vergangenes Spiel existiert in der DB, wurde aber nicht mehr im iCal-Feed geliefert
    const unscoredPastInDb: ExistingUnscoredMatch[] = [
      {
        eventId: "ev-past-only-db",
        externalId: null,
        title: "HL Buchholz 08 - Rosengarten gem. vs. TuS Jahn Hollenstedt",
        startAt: new Date("2026-11-22T10:15:00.000Z"),
        opponentName: "HL Buchholz 08 - Rosengarten gem.",
        isHome: false,
        homeScoreFull: null,
        awayScoreFull: null,
        homeScoreHalf: null,
        awayScoreHalf: null,
      },
    ];

    const updatedScores = new Map<string, MatchScoresSnapshot>();

    const syncRepo: LeagueSyncRepository = {
      listSourcesByTeam: async () => [source],
      listEnabledIcalSources: async () => [source],
      findSourceById: async () => source,
      createSource: async () => source,
      updateSourceSyncStatus: async () => {},
      deleteSource: async () => {},
      findSyncedMatchesByTeam: async () => syncedExisting,
      findPastMatchesWithoutScoresByTeam: async () => unscoredPastInDb,
      backfillMatchScores: async (eventId, scores) => {
        updatedScores.set(eventId, scores);
      },
      findOrCreateVenueByNamePreservingResin: async () => ({
        id: "v-1",
        name: "Hollenstedt, SH (603110)",
      }),
      createSyncedMatchEvent: async () => ({ eventId: "ev-created" }),
      updateSyncedMatchSchedulePreservingLocal: async (input) => {
        if (input.backfillScores) {
          updatedScores.set(input.eventId, input.backfillScores);
        }
      },
      createChangeLog: async (input) =>
        ({
          id: `log-${Math.random()}`,
          sourceId: input.sourceId,
          teamId: input.teamId,
          eventId: input.eventId,
          externalId: input.externalId,
          changeType: input.changeType,
          summary: input.summary,
          oldStartAt: null,
          newStartAt: null,
          oldVenueName: null,
          newVenueName: null,
          detectedAt: new Date().toISOString(),
        }) as LeagueSyncChangeLogDTO,
      listChangeLogsByTeam: async () => [],
    };

    const directoryRepo: LeagueDirectoryRepository = {
      findGroupsWithTeams: async () => [],
      findGroupTeamById: async (): Promise<LeagueDirectoryGroupTeamRecord> => ({
        id: "gt-1",
        leagueGroupId: "grp-1",
        externalTeamId: "2268730",
        name: "TuS Jahn Hollenstedt",
        clubName: "TuS Jahn Hollenstedt",
        shortName: "TuS Jahn",
        icalUrl: source.sourceUrl,
        externalUrl:
          "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2268730&championship=HRLS+26%2F27&group=489002",
        group: {
          id: "grp-1",
          code: "HVNB-2627-HRLS-489002",
          federationCode: "HVNB",
          regionCode: "HRLS",
          regionName: "HR Lüneburg-Stade",
          seasonName: "2026/27",
          leagueId: null,
          leagueDisplayName: null,
          ageGroup: "YOUTH_D",
          gender: "MALE",
          name: "Regionsoberliga männliche Jugend D Nord",
          shortName: "ROL MJD Nord",
          externalProvider: "HVNB_NULIGA",
          externalGroupId: "489002",
          externalUrl:
            "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HRLS+26%2F27&group=489002",
        },
        siblingTeams: [],
      }),
      upsertDirectorySnapshot: async () => ({
        groupsUpserted: 0,
        teamsUpserted: 0,
      }),
      updateGroupTeamIcalUrl: async () => {},
    };

    const teamRepo: TeamRepository = {
      findById: async () => team,
      findByClubId: async () => [team],
      create: async () => team,
      update: async () => team,
    };

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:uid-match-4",
      "DTSTART;TZID=Europe/Berlin:20261031T130000",
      "DTEND;TZID=Europe/Berlin:20261031T140000",
      "SUMMARY:Regionsoberliga MJD Nord TuS Jahn Hollenstedt vs SG Luhdorf/Scharmbeck (4)",
      "DESCRIPTION:Regionsoberliga männliche Jugend D Nord\\nBegegnungs-Nr: 4\\nHeim: TuS Jahn Hollenstedt\\nGast: SG Luhdorf/Scharmbeck",
      "LOCATION:Hollenstedt\\, SH (603110)",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const fetchText = async (url: string) => {
      if (url.includes("getTeamMeetingsWebcal")) return ics;
      if (url.includes("teamPortrait")) return NULIGA_TEAM_PORTRAIT_HTML;
      throw new Error(`Unexpected URL: ${url}`);
    };

    const service = new LeagueSyncService(
      teamRepo,
      syncRepo,
      fetchText,
      directoryRepo
    );
    const summary = await service.syncSourceById("src-1");

    expect(summary.updatedCount).toBe(2);
    expect(summary.resultsUpdatedCount).toBe(2);
    expect(updatedScores.get("ev-in-feed")).toEqual({
      homeScoreFull: 22,
      awayScoreFull: 26,
      homeScoreHalf: 9,
      awayScoreHalf: 17,
    });
    expect(updatedScores.get("ev-past-only-db")).toEqual({
      homeScoreFull: 17,
      awayScoreFull: 23,
      homeScoreHalf: 8,
      awayScoreHalf: 12,
    });
  });
});
