import { describe, expect, it } from "vitest";
import {
  buildLeagueCode,
  isImportableGroupName,
  parseAgeGroupAndGender,
  parseGroupPage,
} from "@/infrastructure/leagues/hvnb-live-crawler";

describe("HVNB-Live-Crawler", () => {
  it("leitet Altersklasse und Geschlecht aus Staffelnamen ab", () => {
    expect(parseAgeGroupAndGender("Regionsoberliga männliche Jugend D Nord")).toEqual({
      ageGroup: "YOUTH_D",
      gender: "MALE",
    });
    expect(parseAgeGroupAndGender("Oberliga Frauen Nord")).toEqual({
      ageGroup: "ADULT",
      gender: "FEMALE",
    });
    expect(parseAgeGroupAndGender("Anfänger gJE R 1 G 1")).toEqual({
      ageGroup: "YOUTH_E",
      gender: "MIXED",
    });
    expect(parseAgeGroupAndGender("Minis")).toEqual({
      ageGroup: "YOUTH_F_MINI",
      gender: "MIXED",
    });
    expect(parseAgeGroupAndGender("Landesliga Männer")).toEqual({
      ageGroup: "ADULT",
      gender: "MALE",
    });
    expect(parseAgeGroupAndGender("Solarservice Norddeutschland Regionalliga F")).toEqual({
      ageGroup: "ADULT",
      gender: "FEMALE",
    });
  });

  it("filtert Sammel- und Verwaltungsseiten aus", () => {
    expect(isImportableGroupName(".")).toBe(false);
    expect(isImportableGroupName("Nachmeldungen MJD")).toBe(false);
    expect(isImportableGroupName("Final4 MJB")).toBe(false);
    expect(isImportableGroupName("BS-PE")).toBe(false);
    expect(isImportableGroupName("Regionsliga Männer Nord")).toBe(true);
    expect(isImportableGroupName("Anfänger MJF")).toBe(true);
    expect(isImportableGroupName("Inklusionsliga")).toBe(true);
  });

  it("bildet Liga-Codes nur für Katalog-Ebenen", () => {
    expect(buildLeagueCode("YOUTH_D", "MALE", "Regionsoberliga männliche Jugend D Nord")).toBe(
      "DE-HVNB-YOUTH_D-MALE-ROL"
    );
    expect(buildLeagueCode("YOUTH_D", "MALE", "Vorrunde männliche Jugend D Gruppe 8")).toBeNull();
  });

  it("liest Mannschaften samt Portrait-URL aus einer Staffelseite", () => {
    const html = `
      <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2268726&amp;championship=HRLS+26%2F27&amp;group=489002">mJSG Buxtehude/ Beckdorf (Bux)</a>
      <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2268726&amp;championship=HRLS+26%2F27&amp;group=489002">mJSG Buxtehude/ Beckdorf (Bux)</a>
      <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2268727&amp;championship=HRLS+26%2F27&amp;group=489002">TuS Jahn Hollenstedt</a>
      <a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?group=489002">Zur Staffel</a>`;

    const teams = parseGroupPage(html);
    expect(teams).toHaveLength(2);
    expect(teams[0]).toMatchObject({
      externalTeamId: "2268726",
      name: "mJSG Buxtehude/ Beckdorf (Bux)",
    });
    expect(teams[0].externalUrl).toContain("teamPortrait?teamtable=2268726");
    expect(teams[0].externalUrl.startsWith("https://hvnb-handball.liga.nu/")).toBe(true);
  });
});
