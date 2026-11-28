import { describe, expect, it } from "vitest";
import { Handball360Client } from "@/domain/adapters/handball360-client";
import {
  Handball360ProviderAdapter,
  normalizeHandball360LineupPlayer,
  normalizeHandball360Matches,
  normalizeHandball360SearchResults,
} from "@/domain/services/handball360-provider-adapter";
import { computeLeagueMergePlan } from "@/domain/services/league-merge";

describe("Handball360 / handball.net Adapter & Normalisierung", () => {
  it("normalisiert Vereinssuche-Ergebnisse inklusive Staffel-Gegnern in DirectoryGroupSeed", () => {
    const groups = normalizeHandball360SearchResults(
      [
        {
          clubId: "h360-club-101",
          clubName: "THW Kiel",
          federationCode: "HVSH",
          teams: [
            {
              teamId: "h360-team-501",
              teamName: "THW Kiel U19",
              tournamentId: "h360-tourn-88",
              tournamentName: "JBLH männliche A-Jugend Nord",
              regionCode: "NORD",
              regionName: "Staffel Nord",
              seasonName: "2026/27",
              siblingTeams: [
                {
                  teamId: "h360-team-502",
                  teamName: "SG Flensburg-Handewitt U19",
                  clubId: "h360-club-102",
                  clubName: "SG Flensburg-Handewitt",
                },
              ],
            },
          ],
        },
      ],
      { countryCode: "DE" }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      code: "DE-HVSH-H360-h360-tourn-88",
      countryCode: "DE",
      federationCode: "HVSH",
      ageGroup: "YOUTH_A",
      gender: "MALE",
      externalProvider: "HANDBALL360",
    });
    expect(groups[0].teams).toHaveLength(2);
    expect(groups[0].teams[0].externalClubId).toBe("h360-club-101");
  });

  it("normalisiert Spielpläne inkl. Halbzeit-/Endstand, Absagen und TBD-Uhrzeiten", () => {
    const { matches, officialResults } = normalizeHandball360Matches(
      [
        {
          matchId: "m-1",
          matchNumber: "401",
          startsAt: "2026-11-21T16:15:00Z",
          homeTeamId: "t-1",
          homeTeamName: "THW Kiel U19",
          awayTeamId: "t-2",
          awayTeamName: "SG Flensburg-Handewitt U19",
          venueName: "Hein-Dahlinger-Halle",
          venueAddress: "Geschwister-Scholl-Str. 9, Kiel",
          status: "FINISHED",
          homeScoreFull: 33,
          awayScoreFull: 30,
          homeScoreHalf: 17,
          awayScoreHalf: 14,
        },
        {
          matchId: "m-2",
          startsAt: "2027-01-17",
          timeTbd: true,
          homeTeamId: "t-3",
          homeTeamName: "TSV Burgdorf U19",
          awayTeamId: "t-1",
          awayTeamName: "THW Kiel U19",
          status: "CANCELLED",
        },
      ],
      { teamExternalId: "t-1", teamNameMatch: "THW Kiel U19" }
    );

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      externalId: "h360-m-1",
      isHome: true,
      opponentName: "SG Flensburg-Handewitt U19",
      venueName: "Hein-Dahlinger-Halle (Geschwister-Scholl-Str. 9, Kiel)",
      homeScoreFull: 33,
      awayScoreFull: 30,
      homeScoreHalf: 17,
      awayScoreHalf: 14,
      isCancelled: false,
    });
    expect(officialResults).toHaveLength(1);

    expect(matches[1]).toMatchObject({
      externalId: "h360-m-2",
      isHome: false,
      opponentName: "TSV Burgdorf U19",
      isCancelled: true,
      endAt: null,
    });
  });

  it("kennzeichnet anonymisierte Spieler aus Handball360-Aufstellungen sauber als 'Nr. X'", () => {
    expect(
      normalizeHandball360LineupPlayer({
        displayName: "",
        anonymized: true,
        jerseyNumber: 7,
        goals: 4,
        sevenMeterGoals: 1,
        sevenMeterAttempts: 2,
      })
    ).toEqual({
      externalPlayerId: null,
      name: "Nr. 7",
      jerseyNumber: 7,
      goals: 4,
      sevenMeterGoals: 1,
      sevenMeterAttempts: 2,
      isAnonymized: true,
    });

    expect(
      normalizeHandball360LineupPlayer({
        playerId: "p-42",
        displayName: "Max Mustermann",
        jerseyNumber: 11,
        goals: 6,
      })
    ).toMatchObject({
      externalPlayerId: "p-42",
      name: "Max Mustermann",
      isAnonymized: false,
    });
  });

  it("gibt eine verständliche Validierungsmeldung aus, wenn HANDBALL360_API_BASE_URL noch nicht gesetzt ist", async () => {
    const unconfiguredClient: Handball360Client = {
      isConfigured: () => false,
      searchClubsAndTeams: async () => [],
      fetchTeamSchedule: async () => [],
    };
    const adapter = new Handball360ProviderAdapter(unconfiguredClient);

    expect(
      await adapter.searchDirectoryLive({
        countryCode: "DE",
        clubName: "THW Kiel",
      })
    ).toEqual([]);

    await expect(
      adapter.fetchScheduleAndResults({
        source: {
          id: "src-1",
          clubId: "club-1",
          teamId: "team-1",
          provider: "HANDBALL360",
          name: "JBLH Nord",
          sourceUrl: null,
          teamNameMatch: "THW Kiel U19",
          providerConfig: { handball360TeamId: "t-1" },
          isEnabled: true,
          syncIntervalMinutes: 60,
          lastSyncedAt: null,
          lastSyncStatus: "NEVER",
          lastSyncError: null,
          createdAt: new Date().toISOString(),
        },
      })
    ).rejects.toThrow(/HANDBALL360_API_BASE_URL/);
  });

  it("schützt bestehende lokale Spiele und Spielstände bei späterer Umstellung von nuLiga auf Handball360", () => {
    const existing = [
      {
        eventId: "ev-1",
        externalId: "h360-m-1",
        title: "THW Kiel U19 – SG Flensburg-Handewitt U19",
        startAt: new Date("2026-11-21T16:15:00.000Z"),
        endAt: new Date("2026-11-21T17:45:00.000Z"),
        venueId: "v-1",
        venueName: "Hein-Dahlinger-Halle",
        isCancelled: false,
        opponentName: "SG Flensburg-Handewitt U19",
        isHome: true,
        homeScoreFull: 33,
        awayScoreFull: 31,
        scoreManuallyEdited: true,
      },
    ];

    const { matches } = normalizeHandball360Matches(
      [
        {
          matchId: "m-1",
          startsAt: "2026-11-21T16:15:00.000Z",
          homeTeamId: "t-1",
          homeTeamName: "THW Kiel U19",
          awayTeamId: "t-2",
          awayTeamName: "SG Flensburg-Handewitt U19",
          venueName: "Hein-Dahlinger-Halle",
          status: "FINISHED",
          homeScoreFull: 33,
          awayScoreFull: 30,
          homeScoreHalf: 17,
          awayScoreHalf: 14,
        },
      ],
      { teamExternalId: "t-1" }
    );

    const plan = computeLeagueMergePlan(existing, matches);
    expect(plan).toHaveLength(1);
    expect(plan[0].kind).toBe("UPDATE");
    // Manuell gepflegtes Ergebnis bleibt geschützt, Abweichung wird sauber markiert
    expect(plan[0].scoreSyncUpdate?.applyToDisplayed).toBe(false);
    expect(plan[0].scoreSyncUpdate?.discrepancyDetected).toBe(true);
    expect(plan[0].scoreSyncUpdate?.officialScores.awayScoreFull).toBe(30);
  });
});
