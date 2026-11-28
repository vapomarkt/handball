import { describe, expect, it } from "vitest";
import {
  ExternalLeagueDataProvider,
  LeagueProviderRegistry,
} from "@/domain/adapters/league-data-provider";
import {
  ExistingSyncedMatch,
  LeagueSyncRepository,
} from "@/domain/adapters/league-provider";
import { TeamRecord, TeamRepository } from "@/domain/adapters/repositories";
import { buildAustrianLeaguesCatalog } from "@/domain/data/austrian-leagues";
import {
  FEDERATION_REGISTRY,
  formatNuligaSeasonSlug,
  getFederationConfig,
  getHandball360Federations,
  getNuligaFederations,
  getNuligaWebObjectsBaseUrl,
  isDirectoryLinkingSupported,
  renderChampionshipName,
  resolveFederationByNuligaHost,
  SUPPORTED_COUNTRIES,
} from "@/domain/data/federation-registry";
import { GERMAN_FEDERATIONS } from "@/domain/data/german-leagues";
import {
  CreateLeagueSourceInput,
  LeagueImportSourceDTO,
  LeagueSyncChangeLogDTO,
} from "@/domain/schemas/league";
import { LeagueSyncService } from "@/domain/services/league-sync-service";
import { resolveNuligaClubLogo } from "@/domain/services/nuliga-club-logo";
import { resolveNuligaTeamFeed } from "@/domain/services/nuliga-feed-resolver";
import { NuligaProviderAdapter } from "@/domain/services/nuliga-provider-adapter";
import { parseNuligaScheduleHtml } from "@/domain/services/nuliga-schedule-parser";
import { shouldTriggerDeactivationSafetyGuard } from "@/infrastructure/leagues/directory-importer";
import {
  buildFederationLeagueCode,
  buildGroupCode,
  crawlNuligaFederation,
  parseAgeGroupAndGender,
  parseSubChampionshipLinks,
} from "@/infrastructure/leagues/nuliga-live-crawler";

describe("FederationRegistry & Europa-Vorbereitung", () => {
  it("deckt alle deutschen Verbände aus GERMAN_FEDERATIONS sowie Österreich (ÖHB) vollständig ab", () => {
    const registryCodes = new Set(
      FEDERATION_REGISTRY.map((f) => f.federationCode)
    );

    for (const fed of GERMAN_FEDERATIONS) {
      expect(
        registryCodes.has(fed.code),
        `Verband ${fed.code} fehlt in FEDERATION_REGISTRY`
      ).toBe(true);
    }

    const oehb = getFederationConfig("OEHB");
    expect(oehb).not.toBeNull();
    expect(oehb?.countryCode).toBe("AT");
    expect(oehb?.timezone).toBe("Europe/Vienna");
    expect(oehb?.nuliga?.webObjectsApp).toBe("nuLigaHBAT.woa");
    expect(oehb?.nuliga?.federationParam).toBe("ÖHB");

    const countryCodes = SUPPORTED_COUNTRIES.map((c) => c.code);
    expect(countryCodes).toContain("DE");
    expect(countryCodes).toContain("AT");
  });

  it("trennt nuLiga- und Handball360-Verbände sauber und hält HBW vorerst auf MANUAL_ONLY", () => {
    const nuligaDe = getNuligaFederations("DE").map((f) => f.federationCode);
    expect(nuligaDe).toContain("HVNB");
    expect(nuligaDe).toContain("BHV");
    expect(nuligaDe).toContain("HHV");
    expect(nuligaDe).toContain("HVS");
    expect(nuligaDe).toContain("THV");

    const h360Live = getHandball360Federations(true).map(
      (f) => f.federationCode
    );
    expect(h360Live).toContain("DHB");
    expect(h360Live).toContain("HVSH");
    expect(h360Live).toContain("HNR");

    const hbw = getFederationConfig("HBW");
    expect(hbw?.primaryProvider).toBe("MANUAL_ONLY");
    expect(hbw?.plannedMigration?.targetProvider).toBe("HANDBALL360");
    expect(isDirectoryLinkingSupported("HBW")).toBe(false);
    expect(isDirectoryLinkingSupported("BHV")).toBe(true);
    expect(isDirectoryLinkingSupported("OEHB")).toBe(true);
  });

  it("formatiert nuLiga-Saisonslugs und löst Basis-URLs / Hosts korrekt auf", () => {
    expect(formatNuligaSeasonSlug("2026/27", "YY/YY")).toBe("26/27");
    expect(formatNuligaSeasonSlug("2026/27", "YYYY/YY")).toBe("2026/27");
    expect(renderChampionshipName("THV {season}", "2026/27", "YYYY/YY")).toBe(
      "THV 2026/27"
    );
    expect(renderChampionshipName("ÖHB {season}", "2026/27", "YY/YY")).toBe(
      "ÖHB 26/27"
    );

    expect(getNuligaWebObjectsBaseUrl("BHV")).toBe(
      "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/"
    );
    expect(getNuligaWebObjectsBaseUrl("OEHB")).toBe(
      "https://oehb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBAT.woa/wa/"
    );
    expect(
      resolveFederationByNuligaHost("hhv-handball.liga.nu")?.federationCode
    ).toBe("HHV");
  });

  it("erzeugt einen eindeutigen Liga-Katalog für Österreich (ÖHB)", () => {
    const atLeagues = buildAustrianLeaguesCatalog();
    expect(atLeagues.length).toBeGreaterThanOrEqual(20);
    const codes = new Set(atLeagues.map((l) => l.code));
    expect(codes.size).toBe(atLeagues.length);
    expect(codes.has("AT-OEHB-ADULT-MALE-HLA1")).toBe(true);
    expect(codes.has("AT-OEHB-ADULT-FEMALE-WHA1")).toBe(true);
  });
});

describe("Multi-Verbands nuLiga-Crawler (DE + AT)", () => {
  it("erkennt Unterregionen aus 'Untergeordnete Spielklassen' und ignoriert Pokal/Quali", () => {
    const html = `
      <div>
        <h3>Untergeordnete Spielklassen</h3>
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=BHV+Oberbayern+26%2F27">Oberbayern</a>
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=BHV+Mittelfranken+26%2F27">Mittelfranken</a>
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=BHV+Pokal+26%2F27">Pokalmeisterschaft</a>
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=BHV+Quali+26%2F27">Jugend-Quali</a>
      </div>
      <table><tr><td>Ende</td></tr></table>
    `;

    const subs = parseSubChampionshipLinks(html, "BHV 26/27");
    expect(subs).toHaveLength(2);
    expect(subs[0]).toEqual({
      code: "OBERBAYERN",
      championship: "BHV Oberbayern 26/27",
      regionName: "Oberbayern",
    });
    expect(subs[1]).toEqual({
      code: "MITTELFRANKEN",
      championship: "BHV Mittelfranken 26/27",
      regionName: "Mittelfranken",
    });
  });

  it("erkennt Altersklassen & Liga-Codes für DE und AT (inkl. U-Klassen & HLA/WHA)", () => {
    expect(parseAgeGroupAndGender("WHA MEISTERLIGA U18")).toEqual({
      ageGroup: "YOUTH_A",
      gender: "FEMALE",
    });
    expect(parseAgeGroupAndGender("MJU12 Steiermark")).toEqual({
      ageGroup: "YOUTH_D",
      gender: "MALE",
    });
    expect(parseAgeGroupAndGender("HLA MEISTERLIGA")).toEqual({
      ageGroup: "ADULT",
      gender: "MALE",
    });

    expect(
      buildFederationLeagueCode("DE", "BHV", "ADULT", "MALE", "Bezirksoberliga Männer")
    ).toBe("DE-BHV-ADULT-MALE-BOL");
    expect(
      buildFederationLeagueCode("AT", "OEHB", "ADULT", "MALE", "MEHRLEBEN HLA MEISTERLIGA")
    ).toBe("AT-OEHB-ADULT-MALE-HLA1");
    expect(buildGroupCode("DE", "HVNB", "2026/27", "HRLS", "489002")).toBe(
      "HVNB-2627-HRLS-489002"
    );
    expect(buildGroupCode("DE", "BHV", "2026/27", "OBERBAYERN", "12345")).toBe(
      "DE-BHV-2627-OBERBAYERN-12345"
    );
  });

  it("crawlt BHV und ÖHB inklusive automatischer Unterregionen-Discovery", async () => {
    const pages: Record<string, string> = {
      "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=BHV%2026%2F27": `
        <div>Untergeordnete Spielklassen
          <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=BHV+Oberbayern+26%2F27">Oberbayern</a>
        </div>
        <table><tr><td>
          <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=BHV+26%2F27&amp;group=7001">Regionalliga Männer</a>
        </td></tr></table>
      `,
      "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=BHV%2026%2F27&group=7001": `
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=9001&amp;championship=BHV+26%2F27&amp;group=7001">TSV Allach 09</a>
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=9002&amp;championship=BHV+26%2F27&amp;group=7001">HT München</a>
      `,
      "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=BHV%20Oberbayern%2026%2F27": `
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=BHV+Oberbayern+26%2F27&amp;group=7002">Bezirksoberliga Frauen</a>
      `,
      "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=BHV%20Oberbayern%2026%2F27&group=7002": `
        <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=9010&amp;championship=BHV+Oberbayern+26%2F27&amp;group=7002">TSV Ismaning II</a>
      `,
    };

    const result = await crawlNuligaFederation({
      federationCode: "BHV",
      seasonName: "2026/27",
      delayMs: 0,
      fetchText: async (url) => {
        const html = pages[url];
        if (!html) throw new Error(`404: ${url}`);
        return html;
      },
    });

    expect(result.failures).toHaveLength(0);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].code).toBe("DE-BHV-2627-BHV-7001");
    expect(result.groups[0].countryCode).toBe("DE");
    expect(result.groups[0].teams).toHaveLength(2);
    expect(result.groups[1].regionCode).toBe("OBERBAYERN");
    expect(result.groups[1].gender).toBe("FEMALE");
  });

  it("löst Feed- und Logo-URLs dynamisch für Nicht-HVNB-Verbände (z. B. BHV & ÖHB) auf", async () => {
    const requestedUrls: string[] = [];
    const feed = await resolveNuligaTeamFeed(
      async (url) => {
        requestedUrls.push(url);
        if (url.includes("clubSearch")) {
          return `<a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/clubInfoDisplay?club=555">HT München</a>`;
        }
        if (url.includes("clubTeams")) {
          return `<table><tr><td>Herren</td><td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=BHV+26%2F27&amp;group=7001">Regionalliga Männer</a></td></tr></table>`;
        }
        if (url.includes("groupPage")) {
          return `<a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=9002">HT München</a>`;
        }
        return `<a href="webcal://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/getTeamMeetingsWebcal?team=9002">Kalender</a>`;
      },
      {
        clubName: "HT München",
        teamName: "HT München",
        groupName: "Regionalliga Männer",
        federationCode: "BHV",
        groupUrl:
          "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=BHV+26%2F27&group=7001",
      }
    );

    expect(feed).toBe(
      "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/getTeamMeetingsWebcal?team=9002"
    );
    expect(requestedUrls[0]).toContain("federation=BHV");

    // Logo-Auflösung für Österreich (ÖHB) verwendet nuLigaHBAT.woa und federation=%C3%96HB
    const logoRequestedUrls: string[] = [];
    await resolveNuligaClubLogo(
      async (url) => {
        logoRequestedUrls.push(url);
        return {
          ok: true,
          status: 200,
          text: async () => "<html>Keine Treffer</html>",
          arrayBuffer: async () => new ArrayBuffer(0),
          cookies: [],
        };
      },
      { clubName: "HIB Handball Graz", federationCode: "OEHB" }
    );
    expect(logoRequestedUrls[0]).toContain("oehb-handball.liga.nu");
    expect(logoRequestedUrls[0]).toContain("nuLigaHBAT.woa");
    expect(logoRequestedUrls[0]).toContain("federation=%C3%96HB");
  });
});

describe("nuLiga HTML-Spielplan-Fallback, Safety-Guard & Multi-Provider-Sync", () => {
  it("parst vergangene und kommende Spiele inklusive Halbzeitstand und Halle aus nuLiga-HTML", () => {
    const html = `
      <table class="result-set">
        <tr>
          <th>Datum</th><th>Zeit</th><th>Nr.</th><th>Halle</th><th>Heimmannschaft</th><th>Gastmannschaft</th><th>Tore</th>
        </tr>
        <tr>
          <td>Sa. 14.11.2026</td>
          <td>16:00</td>
          <td>1042</td>
          <td><span title="Sporthalle Allach, München">102</span></td>
          <td>TSV Allach 09</td>
          <td>HT München</td>
          <td><span title="14:12 zur Halbzeit">29:26</span></td>
        </tr>
        <tr>
          <td>Sa. 05.12.2026</td>
          <td>18:30</td>
          <td>1099</td>
          <td><span title="Hachinga Halle">205</span></td>
          <td>HT München</td>
          <td>HC Erlangen II</td>
          <td></td>
        </tr>
      </table>
    `;

    const matches = parseNuligaScheduleHtml(html, {
      teamNameMatch: "HT München",
      leagueGroupName: "Regionalliga Männer",
      timeZone: "Europe/Berlin",
    });

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      externalId: "nuliga-html-nr-1042",
      isHome: false,
      opponentName: "TSV Allach 09",
      venueName: "Sporthalle Allach, München",
      homeScoreFull: 29,
      awayScoreFull: 26,
      homeScoreHalf: 14,
      awayScoreHalf: 12,
      isCancelled: false,
    });
    expect(matches[1]).toMatchObject({
      externalId: "nuliga-html-nr-1099",
      isHome: true,
      opponentName: "HC Erlangen II",
      venueName: "Hachinga Halle",
      homeScoreFull: null,
      awayScoreFull: null,
    });
  });

  it("NuligaProviderAdapter nutzt HTML-Fallback wenn kein iCal-Feed hinterlegt ist", async () => {
    const html = `
      <table class="result-set">
        <tr><th>Datum</th><th>Zeit</th><th>Nr.</th><th>Halle</th><th>Heimmannschaft</th><th>Gastmannschaft</th><th>Tore</th></tr>
        <tr><td>So. 22.11.2026</td><td>15:00</td><td>201</td><td>Sporthalle Nord</td><td>HT München</td><td>TSV Friedberg</td><td>28:24 (15:11)</td></tr>
      </table>
    `;
    const adapter = new NuligaProviderAdapter(async () => html);
    const fetched = await adapter.fetchScheduleAndResults({
      source: {
        id: "src-1",
        clubId: "club-1",
        teamId: "team-1",
        leagueGroupTeamId: "gt-1",
        provider: "NULIGA",
        name: "Regionalliga Männer (BHV)",
        sourceUrl: null,
        teamNameMatch: "HT München",
        isEnabled: true,
        syncIntervalMinutes: 60,
        lastSyncedAt: null,
        lastSyncStatus: "NEVER",
        lastSyncError: null,
        createdAt: new Date().toISOString(),
      },
      groupTeam: {
        id: "gt-1",
        leagueGroupId: "grp-1",
        externalTeamId: "9002",
        name: "HT München",
        clubName: "HT München",
        shortName: null,
        icalUrl: null,
        externalUrl:
          "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=9002",
        group: {
          id: "grp-1",
          code: "DE-BHV-2627-BHV-7001",
          countryCode: "DE",
          federationCode: "BHV",
          regionCode: "BHV",
          regionName: "BHV Verbandsebene",
          seasonName: "2026/27",
          leagueId: null,
          leagueDisplayName: null,
          ageGroup: "ADULT",
          gender: "MALE",
          name: "Regionalliga Männer",
          shortName: null,
          externalProvider: "NULIGA",
          externalGroupId: "7001",
          externalUrl:
            "https://bhv-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=BHV+26%2F27&group=7001",
        },
        siblingTeams: [],
      },
    });

    expect(fetched.matches).toHaveLength(1);
    expect(fetched.matches[0].homeScoreFull).toBe(28);
    expect(fetched.matches[0].homeScoreHalf).toBe(15);
  });

  it("Safety-Guard verhindert Massen-Deaktivierung bei kaputtem Crawl (< 50 % Bestand)", () => {
    expect(
      shouldTriggerDeactivationSafetyGuard({
        existingActiveGroups: 120,
        crawledGroups: 12,
      })
    ).toBe(true);

    expect(
      shouldTriggerDeactivationSafetyGuard({
        existingActiveGroups: 120,
        crawledGroups: 110,
      })
    ).toBe(false);

    // Erst-Import (noch keine 10 Gruppen in DB) darf nie blockiert werden
    expect(
      shouldTriggerDeactivationSafetyGuard({
        existingActiveGroups: 0,
        crawledGroups: 0,
      })
    ).toBe(false);
  });

  it("LeagueSyncService delegiert HANDBALL360-Quellen direkt an den registrierten Adapter ohne iCal-URL", async () => {
    const fakeH360Adapter: ExternalLeagueDataProvider = {
      provider: "HANDBALL360",
      capabilities: {
        directoryCrawl: false,
        liveSearch: true,
        directScheduleSync: true,
        matchResults: true,
        rosterImport: true,
        opponentStats: true,
        clubLogo: true,
      },
      async fetchScheduleAndResults() {
        return {
          matches: [
            {
              externalId: "h360-match-999",
              title: "THW Kiel U19 – SG Flensburg-Handewitt U19",
              opponentName: "SG Flensburg-Handewitt U19",
              isHome: true,
              startAt: new Date("2026-12-12T15:00:00.000Z"),
              endAt: new Date("2026-12-12T16:30:00.000Z"),
              venueName: "Hein-Dahlinger-Halle",
              isCancelled: false,
              homeScoreFull: 31,
              awayScoreFull: 29,
              homeScoreHalf: 16,
              awayScoreHalf: 14,
            },
          ],
          officialResults: [],
        };
      },
    };

    const registry = new LeagueProviderRegistry();
    registry.register(fakeH360Adapter);

    const createdEvents: ExistingSyncedMatch[] = [];
    const logs: LeagueSyncChangeLogDTO[] = [];
    const source: LeagueImportSourceDTO = {
      id: "src-h360",
      clubId: "club-1",
      teamId: "team-1",
      leagueGroupTeamId: null,
      provider: "HANDBALL360",
      name: "JBLH Nord (DHB)",
      sourceUrl: null,
      teamNameMatch: "THW Kiel U19",
      providerConfig: { teamExternalId: "h360-team-42" },
      isEnabled: true,
      syncIntervalMinutes: 60,
      lastSyncedAt: null,
      lastSyncStatus: "NEVER",
      lastSyncError: null,
      createdAt: new Date().toISOString(),
    };

    const teamRepo: TeamRepository = {
      async findById(): Promise<TeamRecord | null> {
        return {
          id: "team-1",
          clubId: "club-1",
          seasonId: "season-1",
          name: "mA-Jugend",
          category: "mA-Jugend",
          gender: "MALE",
          leagueId: null,
          leagueName: null,
          leagueGroupTeamId: null,
        };
      },
      async findByClubId() {
        return [];
      },
      async create() {
        throw new Error("not used");
      },
      async update() {
        throw new Error("not used");
      },
    };

    const syncRepo: LeagueSyncRepository = {
      async listSourcesByTeam() {
        return [source];
      },
      async listEnabledIcalSources() {
        return [source];
      },
      async findSourceById() {
        return source;
      },
      async createSource(_c, _t, input: CreateLeagueSourceInput) {
        return { ...source, ...input, sourceUrl: input.sourceUrl ?? null };
      },
      async updateSourceSyncStatus(_id, status, errorMessage) {
        source.lastSyncStatus = status;
        source.lastSyncError = errorMessage ?? null;
      },
      async deleteSource() {},
      async findSyncedMatchesByTeam() {
        return createdEvents;
      },
      async findOrCreateVenueByNamePreservingResin(_c, name) {
        return { id: `v-${name}`, name };
      },
      async createSyncedMatchEvent(input) {
        const eventId = `ev-${createdEvents.length + 1}`;
        createdEvents.push({
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
          homeScoreFull: input.homeScoreFull,
          awayScoreFull: input.awayScoreFull,
        });
        return { eventId };
      },
      async updateSyncedMatchSchedulePreservingLocal() {},
      async createChangeLog(input) {
        const log: LeagueSyncChangeLogDTO = {
          id: `log-${logs.length + 1}`,
          sourceId: input.sourceId,
          teamId: input.teamId,
          eventId: input.eventId,
          externalId: input.externalId,
          changeType: input.changeType,
          summary: input.summary,
          oldStartAt: null,
          newStartAt: input.newStartAt?.toISOString() ?? null,
          oldVenueName: null,
          newVenueName: input.newVenueName ?? null,
          detectedAt: new Date().toISOString(),
        };
        logs.push(log);
        return log;
      },
      async listChangeLogsByTeam() {
        return logs;
      },
    };

    const service = new LeagueSyncService(
      teamRepo,
      syncRepo,
      async () => {
        throw new Error("should not fetch iCal directly for HANDBALL360");
      },
      undefined,
      registry
    );

    const summary = await service.syncSourceById("src-h360");
    expect(summary.createdCount).toBe(1);
    expect(summary.resultsUpdatedCount).toBe(1);
    expect(source.lastSyncStatus).toBe("SUCCESS");
    expect(createdEvents[0].externalId).toBe("h360-match-999");
    expect(createdEvents[0].homeScoreFull).toBe(31);
  });
});
