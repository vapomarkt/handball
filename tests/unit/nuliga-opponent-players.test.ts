import { describe, expect, it } from "vitest";
import type { LeagueDirectoryRepository } from "@/domain/adapters/league-directory-repository";
import type { ScoutingRepository } from "@/domain/adapters/m4-repositories";
import type { TeamRepository } from "@/domain/adapters/repositories";
import type { ViewerContext } from "@/domain/policies/rbac";
import {
  DEFAULT_SHOT_ZONES,
  type OpponentDTO,
  type OpponentPlayerDTO,
} from "@/domain/schemas/scouting";
import {
  fetchNuligaOpponentPlayers,
  formatPlayerDisplayName,
  isAllowedNuligaUrl,
  isAnonymizedPlayerName,
  normalizePlayerNameKey,
  parseMeetingReportTeamRosterHtml,
  parsePlayerGoalsHtml,
  parseSevenMeterGoalsHtml,
  teamNamesMatch,
} from "@/domain/services/nuliga-opponent-players";
import { ScoutingService } from "@/domain/services/scouting-service";

const GOALS_HTML = `
<table class="result-set" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <th>Rang</th><th>Spieler</th><th>Verein</th><th>Tore</th><th>Spiele</th><th>&empty; pro Spiel</th>
  </tr>
  <tr>
    <td>1.</td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/playerPortrait?season=2025%2F26&amp;person=1001">Dreyer, Noah</a></td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/clubInfoDisplay?club=10">SG Achim/Baden</a></td>
    <td>146</td><td>25</td><td>5,84</td>
  </tr>
  <tr>
    <td>2.</td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/playerPortrait?season=2025%2F26&amp;person=1002">Podien, Kevin</a></td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/clubInfoDisplay?club=10">SG Achim/Baden</a></td>
    <td>64</td><td>25</td><td>2,56</td>
  </tr>
  <tr>
    <td>3.</td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/playerPortrait?season=2025%2F26&amp;person=9999">Giese, Lasse</a></td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/clubInfoDisplay?club=20">MTV Vorsfelde</a></td>
    <td>236</td><td>26</td><td>9,08</td>
  </tr>
</table>
`;

const SEVEN_METER_HTML = `
<table class="result-set" cellspacing="0" cellpadding="0" border="0">
  <tr>
    <th>Rang</th><th>Spieler</th><th>Verein</th><th>7m-Tore</th><th>7m-Versuche</th><th>Quote</th><th>&empty;</th>
  </tr>
  <tr>
    <td>1.</td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/playerPortrait?season=2025%2F26&amp;person=1001">Dreyer, Noah</a></td>
    <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/clubInfoDisplay?club=10">SG Achim/Baden</a></td>
    <td>24</td><td>28</td><td>85,71%</td><td>0,96</td>
  </tr>
</table>
`;

const TEAM_PORTRAIT_HTML = `
<html><body>
  <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupMeetingReport?meeting=7001&amp;championship=HVNB+25%2F26&amp;group=432326">Spielbericht 1</a>
</body></html>
`;

const MEETING_REPORT_HTML = `
<h2>SG Achim/Baden</h2>
<table class = "result-set" cellspacing = "0" cellpadding = "0" border = "0">
  <thead>
    <tr><th>Trikot</th><th>Name, Vorname</th><th>Geb</th><th>Pass</th><th>Tore</th><th>7M</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>34</td>
      <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/playerPortrait?person=1001">Dreyer, Noah</a></td>
      <td>-</td><td>-</td><td>6</td><td>2/2</td>
    </tr>
    <tr>
      <td>13</td>
      <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/playerPortrait?person=1002">Podien, Kevin</a></td>
      <td>-</td><td>-</td><td>4</td><td>1/3</td>
    </tr>
    <tr>
      <td>12</td>
      <td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/playerPortrait?person=1003">Bohling, Sebastian</a></td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
    <tr>
      <td>A</td>
      <td>Fechner, Björn</td>
      <td>-</td><td>-</td><td></td><td></td>
    </tr>
  </tbody>
</table>
`;

describe("nuLiga Gegner-Spieler-Parser", () => {
  it("formatiert und normalisiert Spielernamen sowie Vereinsnamen", () => {
    expect(formatPlayerDisplayName("Dreyer, Noah")).toBe("Noah Dreyer");
    expect(formatPlayerDisplayName("Noah Dreyer")).toBe("Noah Dreyer");
    expect(normalizePlayerNameKey("Dreyer, Noah")).toBe(
      normalizePlayerNameKey("Noah Dreyer")
    );
    expect(isAnonymizedPlayerName("N.N.")).toBe(true);
    expect(isAnonymizedPlayerName("-")).toBe(true);
    expect(isAnonymizedPlayerName("Noah Dreyer")).toBe(false);
    expect(teamNamesMatch("SG Achim/Baden", "SG Achim/Baden II")).toBe(true);
    expect(isAllowedNuligaUrl("https://hvnb-handball.liga.nu/foo")).toBe(true);
    expect(isAllowedNuligaUrl("https://evil.example.com/foo")).toBe(false);
  });

  it("parst Torschützenliste, 7m-Liste und Spielbericht (ohne Offizielle A-D)", () => {
    const goals = parsePlayerGoalsHtml(GOALS_HTML);
    expect(goals.rows).toHaveLength(3);
    expect(goals.rows[0]).toMatchObject({
      personId: "1001",
      rawName: "Dreyer, Noah",
      clubName: "SG Achim/Baden",
      goals: 146,
      games: 25,
      goalsPerGame: 5.84,
    });

    const sevenM = parseSevenMeterGoalsHtml(SEVEN_METER_HTML);
    expect(sevenM.rows).toHaveLength(1);
    expect(sevenM.rows[0]).toMatchObject({
      personId: "1001",
      sevenMeterGoals: 24,
      sevenMeterAttempts: 28,
    });

    const report = parseMeetingReportTeamRosterHtml(
      MEETING_REPORT_HTML,
      "SG Achim/Baden"
    );
    expect(report.matchedSection).toBe(true);
    expect(report.players).toHaveLength(3); // Offizieller "A" wird ignoriert
    expect(report.players.map((p) => p.jerseyNumber)).toEqual([34, 13, 12]);
  });

  it("führt Statistiken und Spielberichte für einen Gegner zusammen", async () => {
    const fetchText = async (url: string) => {
      if (url.includes("displayType=playerGoals")) return GOALS_HTML;
      if (url.includes("displayType=playerSevenMeterGoals"))
        return SEVEN_METER_HTML;
      if (url.includes("teamPortrait")) return TEAM_PORTRAIT_HTML;
      if (url.includes("groupMeetingReport")) return MEETING_REPORT_HTML;
      throw new Error(`Unexpected URL: ${url}`);
    };

    const result = await fetchNuligaOpponentPlayers(fetchText, {
      opponentName: "SG Achim/Baden",
      teamUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2090180&championship=HVNB+25%2F26&group=432326",
    });

    expect(result.statisticsAvailable).toBe(true);
    expect(result.reportsAnalyzed).toBe(1);
    expect(result.players).toHaveLength(3); // MTV Vorsfelde wurde herausgefiltert

    expect(result.players[0]).toMatchObject({
      externalPlayerId: "1001",
      name: "Noah Dreyer",
      jerseyNumber: 34,
      goalsTotal: 146,
      gamesPlayed: 25,
      sevenMeterGoals: 24,
      sevenMeterAttempts: 28,
      isSevenMeterShooter: true,
      suggestedThreatLevel: "HIGH",
    });

    expect(result.players[2]).toMatchObject({
      externalPlayerId: "1003",
      name: "Sebastian Bohling",
      jerseyNumber: 12,
      goalsTotal: 0,
      suggestedThreatLevel: "LOW",
    });
  });

  it("meldet Datenschutz-Hinweis bei anonymisierten Jugend-Spielberichten", async () => {
    const anonymizedReport = `
      <h2>JSG Jugend</h2>
      <table class="result-set">
        <tbody>
          <tr><td>7</td><td>N.N.</td><td>-</td><td>-</td><td>3</td><td></td></tr>
          <tr><td>9</td><td>-</td><td>-</td><td>-</td><td>2</td><td></td></tr>
        </tbody>
      </table>
    `;
    const fetchText = async (url: string) => {
      if (url.includes("teamPortrait")) {
        return `<a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupMeetingReport?meeting=1">R1</a>`;
      }
      if (url.includes("groupMeetingReport")) return anonymizedReport;
      return `<table class="result-set"></table>`;
    };

    const result = await fetchNuligaOpponentPlayers(fetchText, {
      opponentName: "JSG Jugend",
      teamUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=1&championship=HVNB+25%2F26&group=1",
    });

    expect(result.players).toHaveLength(0);
    expect(result.anonymizedDetected).toBe(true);
    expect(result.warning).toContain("Datenschutzgründen");
  });
});

describe("ScoutingService nuLiga-Vorschau & Import", () => {
  const coachViewer: ViewerContext = {
    userId: "u-coach",
    email: "coach@example.com",
    name: "Coach",
    memberships: [{ memberId: "m-coach", clubId: "c1", teamId: "t1", role: "COACH" }],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };
  const playerViewer: ViewerContext = {
    userId: "u-player",
    email: "player@example.com",
    name: "Player",
    memberships: [{ memberId: "m-player", clubId: "c1", teamId: "t1", role: "PLAYER" }],
    linkedChildMemberIds: [],
    linkedChildTeamIds: [],
  };

  function createHarness() {
    const players: OpponentPlayerDTO[] = [
      {
        id: "kp-existing",
        opponentId: "opp-1",
        name: "Noah Dreyer",
        externalPlayerId: null,
        jerseyNumber: null,
        position: "RL",
        throwingHand: "RIGHT",
        shotZones: { ...DEFAULT_SHOT_ZONES, topRight: 80 },
        feintPreference: "Wackler nach rechts",
        isSevenMeterShooter: false,
        threatLevel: "MEDIUM",
        notes: "Immer früh rausgehen",
        goalsTotal: null,
        gamesPlayed: null,
        sevenMeterGoals: null,
        sevenMeterAttempts: null,
        statsUpdatedAt: null,
      },
    ];

    const opponent: OpponentDTO = {
      id: "opp-1",
      clubId: "c1",
      teamId: "t1",
      name: "SG Achim/Baden",
      leagueName: "Regionalliga M",
      externalUrl: null,
      defenseSystems: ["6:0 kompakt"],
      attackSystems: [],
      transitionNotes: null,
      strengths: null,
      weaknesses: null,
      generalNotes: null,
      keyPlayers: players,
      scoutingNotes: [],
      updatedAt: new Date().toISOString(),
    };

    const teamRepo = {
      findById: async () => ({
        id: "t1",
        clubId: "c1",
        seasonId: "s1",
        name: "Herren 1",
        category: "Aktive",
        ageGroup: "ADULT",
        gender: "MALE",
        usesResin: true,
        leagueId: null,
        leagueName: "Regionalliga M",
        leagueGroupTeamId: "lgt-own",
      }),
    } as unknown as TeamRepository;

    const leagueDirectory = {
      findGroupTeamById: async () => ({
        id: "lgt-own",
        leagueGroupId: "lg-1",
        externalTeamId: "999",
        name: "Herren 1",
        clubName: "Eigener Verein",
        shortName: null,
        icalUrl: null,
        externalUrl: null,
        group: {
          id: "lg-1",
          code: "HVNB-1",
          federationCode: "HVNB",
          regionCode: "HVNB",
          regionName: "HVNB",
          seasonName: "2025/26",
          leagueId: null,
          leagueDisplayName: null,
          ageGroup: "ADULT",
          gender: "MALE",
          name: "Regionalliga M",
          shortName: null,
          externalProvider: "HVNB_NULIGA",
          externalGroupId: "432326",
          externalUrl:
            "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HVNB+25%2F26&group=432326",
        },
        siblingTeams: [
          {
            id: "lgt-opp",
            name: "SG Achim/Baden",
            clubName: "SG Achim/Baden",
            externalUrl:
              "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2090180&championship=HVNB+25%2F26&group=432326",
          },
        ],
      }),
    } as unknown as LeagueDirectoryRepository;

    const scoutingRepo = {
      findOpponentById: async (id: string) =>
        id === opponent.id ? { ...opponent, keyPlayers: [...players] } : null,
      updateOpponent: async (_id: string, input: { externalUrl?: string | null }) => {
        if (input.externalUrl !== undefined) {
          opponent.externalUrl = input.externalUrl;
        }
        return opponent;
      },
      addOpponentPlayer: async (
        opponentId: string,
        input: Parameters<ScoutingRepository["addOpponentPlayer"]>[1]
      ): Promise<OpponentPlayerDTO> => {
        const created: OpponentPlayerDTO = {
          id: `kp-${players.length + 1}`,
          opponentId,
          name: input.name,
          externalPlayerId: input.externalPlayerId ?? null,
          jerseyNumber: input.jerseyNumber ?? null,
          position: input.position ?? null,
          throwingHand: input.throwingHand ?? null,
          shotZones: input.shotZones,
          feintPreference: input.feintPreference ?? null,
          isSevenMeterShooter: input.isSevenMeterShooter,
          threatLevel: input.threatLevel,
          notes: input.notes ?? null,
          goalsTotal: input.goalsTotal ?? null,
          gamesPlayed: input.gamesPlayed ?? null,
          sevenMeterGoals: input.sevenMeterGoals ?? null,
          sevenMeterAttempts: input.sevenMeterAttempts ?? null,
          statsUpdatedAt: input.statsUpdatedAt ?? null,
        };
        players.push(created);
        return created;
      },
      updateOpponentPlayer: async (
        playerId: string,
        input: Parameters<ScoutingRepository["updateOpponentPlayer"]>[1]
      ): Promise<OpponentPlayerDTO> => {
        const idx = players.findIndex((p) => p.id === playerId);
        const cur = players[idx];
        const updated: OpponentPlayerDTO = {
          ...cur,
          ...(input.externalPlayerId !== undefined
            ? { externalPlayerId: input.externalPlayerId }
            : {}),
          ...(input.jerseyNumber !== undefined
            ? { jerseyNumber: input.jerseyNumber }
            : {}),
          ...(input.isSevenMeterShooter !== undefined
            ? { isSevenMeterShooter: input.isSevenMeterShooter }
            : {}),
          ...(input.threatLevel !== undefined
            ? { threatLevel: input.threatLevel }
            : {}),
          ...(input.goalsTotal !== undefined ? { goalsTotal: input.goalsTotal } : {}),
          ...(input.gamesPlayed !== undefined
            ? { gamesPlayed: input.gamesPlayed }
            : {}),
          ...(input.sevenMeterGoals !== undefined
            ? { sevenMeterGoals: input.sevenMeterGoals }
            : {}),
          ...(input.sevenMeterAttempts !== undefined
            ? { sevenMeterAttempts: input.sevenMeterAttempts }
            : {}),
          ...(input.statsUpdatedAt !== undefined
            ? { statsUpdatedAt: input.statsUpdatedAt }
            : {}),
        };
        players[idx] = updated;
        return updated;
      },
    } as unknown as ScoutingRepository;

    const fetchText = async (url: string) => {
      if (url.includes("displayType=playerGoals")) return GOALS_HTML;
      if (url.includes("displayType=playerSevenMeterGoals"))
        return SEVEN_METER_HTML;
      if (url.includes("teamPortrait")) return TEAM_PORTRAIT_HTML;
      if (url.includes("groupMeetingReport")) return MEETING_REPORT_HTML;
      throw new Error(`Unexpected URL: ${url}`);
    };

    const service = new ScoutingService(
      teamRepo,
      scoutingRepo,
      leagueDirectory,
      fetchText
    );
    return { service, players, opponent };
  }

  it("löst Gegner-Spieler automatisch aus verknüpfter Staffel auf und erkennt vorhandene Einträge", async () => {
    const { service } = createHarness();
    const preview = await service.previewNuligaOpponentPlayers(
      coachViewer,
      "t1",
      "opp-1"
    );
    expect(preview.players).toHaveLength(3);
    expect(preview.players[0]).toMatchObject({
      name: "Noah Dreyer",
      alreadyImported: true,
      existingPlayerId: "kp-existing",
    });
    expect(preview.players[1]).toMatchObject({
      name: "Kevin Podien",
      alreadyImported: false,
    });
  });

  it("aktualisiert beim Import nuLiga-Stats und bewahrt manuelle Scouting-Felder", async () => {
    const { service, players } = createHarness();
    const res = await service.importNuligaOpponentPlayers(
      coachViewer,
      "t1",
      "opp-1",
      {
        sourceUrl:
          "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2090180&championship=HVNB+25%2F26&group=432326",
        players: [
          {
            externalPlayerId: "1001",
            name: "Noah Dreyer",
            jerseyNumber: 34,
            isSevenMeterShooter: true,
            threatLevel: "HIGH",
            goalsTotal: 146,
            gamesPlayed: 25,
            sevenMeterGoals: 24,
            sevenMeterAttempts: 28,
          },
          {
            externalPlayerId: "1002",
            name: "Kevin Podien",
            jerseyNumber: 13,
            isSevenMeterShooter: false,
            threatLevel: "MEDIUM",
            goalsTotal: 64,
            gamesPlayed: 25,
            sevenMeterGoals: null,
            sevenMeterAttempts: null,
          },
        ],
      }
    );

    expect(res.updatedCount).toBe(1);
    expect(res.createdCount).toBe(1);
    expect(players).toHaveLength(2);

    // Manuelle Felder von Noah Dreyer müssen erhalten bleiben!
    expect(players[0]).toMatchObject({
      id: "kp-existing",
      jerseyNumber: 34,
      position: "RL",
      throwingHand: "RIGHT",
      feintPreference: "Wackler nach rechts",
      notes: "Immer früh rausgehen",
      isSevenMeterShooter: true,
      goalsTotal: 146,
      gamesPlayed: 25,
      sevenMeterGoals: 24,
      sevenMeterAttempts: 28,
    });
    expect(players[0].shotZones.topRight).toBe(80);
  });

  it("verweigert Spielern ohne Staff-Rolle den nuLiga-Abruf", async () => {
    const { service } = createHarness();
    await expect(
      service.previewNuligaOpponentPlayers(playerViewer, "t1", "opp-1")
    ).rejects.toThrow(/Nur Trainer/);
  });
});
