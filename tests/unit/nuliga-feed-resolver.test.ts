import { describe, expect, it } from "vitest";
import { resolveNuligaTeamFeed } from "@/domain/services/nuliga-feed-resolver";

const CLUB_SEARCH = `<a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/clubInfoDisplay?club=119239">mJSG Buxtehude/ Beckdorf</a>`;
const CLUB_TEAMS = `<tr><td>männliche Jugend D</td><td><a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HRLS+26%2F27&amp;group=489002">Regionsoberliga männliche Jugend D Nord</a></td></tr>`;
const GROUP_PAGE = `<a href="/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?teamtable=2268726&amp;championship=HRLS+26%2F27&amp;group=489002">mJSG Buxtehude/ Beckdorf (Bux)</a>`;
const TEAM_PAGE = `<a href="webcal://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/getTeamMeetingsWebcal?teamid=1762488&amp;token=V9eth1mK2z8%3D">iCal</a>`;

const TARGET = {
  clubName: "mJSG Buxtehude/Beckdorf",
  teamName: "mJSG Buxtehude/ Beckdorf (Bux)",
  groupName: "Regionsoberliga männliche Jugend D Nord",
  groupUrl:
    "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HRLS+26/27&group=489002",
};

describe("resolveNuligaTeamFeed", () => {
  it("löst den Webcal-Feed über Verein, Staffel und Mannschaftsseite auf", async () => {
    const pages: Record<string, string> = {};
    const fetchText = async (url: string) => {
      if (url.includes("clubSearch?")) return CLUB_SEARCH;
      if (url.includes("clubTeams?")) return CLUB_TEAMS;
      if (url.includes("teamPortrait?")) return TEAM_PAGE;
      if (url.includes("groupPage?")) return GROUP_PAGE;
      pages[url] = "unexpected";
      throw new Error(`Unerwarteter Abruf: ${url}`);
    };

    await expect(resolveNuligaTeamFeed(fetchText, TARGET)).resolves.toBe(
      "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/getTeamMeetingsWebcal?teamid=1762488&token=V9eth1mK2z8%3D"
    );
    expect(pages).toEqual({});
  });

  it("liefert null, wenn die Staffel im Verein nicht vorkommt", async () => {
    const fetchText = async (url: string) =>
      url.includes("clubSearch?") ? CLUB_SEARCH : CLUB_TEAMS;

    await expect(resolveNuligaTeamFeed(fetchText, TARGET)).resolves.toBeNull();
  });
});
