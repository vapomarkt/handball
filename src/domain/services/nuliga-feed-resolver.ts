import { FetchTextFn } from "../adapters/league-provider";
import {
  getFederationConfig,
  resolveFederationByNuligaHost,
} from "../data/federation-registry";

export interface NuligaFeedTarget {
  clubName: string;
  teamName: string;
  groupName: string;
  /** Optionales Verbandskürzel (z. B. "HVNB", "BHV", "HHV", "OEHB"). */
  federationCode?: string | null;
  /** Staffelseite aus dem Verzeichnis (liefert Host und WebObjects-Pfad). */
  groupUrl: string | null;
  /** Mannschaftsseite aus dem Verzeichnis – spart die Suche, wenn vorhanden. */
  teamUrl?: string | null;
}

interface Link {
  href: string;
  text: string;
}

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

function findLinks(html: string, needle: string): Link[] {
  const links: Link[] = [];
  const pattern = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    if (!match[1].includes(needle)) continue;
    links.push({
      href: decodeHtml(match[1]),
      text: decodeHtml(match[2].replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim(),
    });
  }
  return links;
}

function pickByName(links: Link[], name: string): Link | null {
  const wanted = normalize(name);
  if (!wanted) return null;
  return (
    links.find((link) => normalize(link.text) === wanted) ??
    links.find((link) => {
      const text = normalize(link.text);
      return text.length > 0 && (text.includes(wanted) || wanted.includes(text));
    }) ??
    null
  );
}

/** Staffellink aus der Mannschaftsliste eines Vereins (Zeile: Mannschaft | Liga). */
function pickGroupLink(html: string, target: NuligaFeedTarget): Link | null {
  const rows = html.split(/<tr\b[^>]*>/i).slice(1);
  for (const row of rows) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => m[1]
    );
    if (cells.length < 2) continue;
    const groupLink = findLinks(cells[1], "groupPage")[0];
    if (!groupLink) continue;
    if (normalize(groupLink.text) === normalize(target.groupName)) {
      return groupLink;
    }
  }
  return null;
}

function extractFeedUrl(html: string): string | null {
  const feed = html.match(
    /(?:webcal|https?):\/\/[^"'\s]*getTeamMeetingsWebcal[^"'\s]*/i
  )?.[0];
  if (!feed) return null;
  return decodeHtml(feed).replace(/^webcal:\/\//i, "https://");
}

function resolveClubSearchFederationParam(
  url: URL,
  federationCode?: string | null
): string {
  const byCode = getFederationConfig(federationCode)?.nuliga?.federationParam;
  if (byCode) return byCode;

  const byHost = resolveFederationByNuligaHost(url.hostname)?.nuliga?.federationParam;
  if (byHost) return byHost;

  const prefix = url.hostname.split("-")[0]?.toUpperCase();
  return prefix && prefix.length >= 2 ? prefix : "HVNB";
}

/**
 * Ermittelt den offiziellen nuLiga-Spielplan-Feed einer Mannschaft, wenn im
 * Verzeichnis noch keine Feed-URL hinterlegt ist:
 * Mannschaftsseite (falls bekannt) → sonst Verein suchen → Mannschaften des
 * Vereins → Staffelseite → Mannschaftsseite → Webcal-Link.
 * Best effort: liefert null, sobald ein Schritt nicht eindeutig auflösbar ist.
 */
export async function resolveNuligaTeamFeed(
  fetchText: FetchTextFn,
  target: NuligaFeedTarget
): Promise<string | null> {
  if (target.teamUrl) {
    const feed = extractFeedUrl(await fetchText(target.teamUrl));
    if (feed) return feed;
  }

  if (!target.groupUrl) return null;

  const url = new URL(target.groupUrl);
  if (!/(^|\.)liga\.nu$/i.test(url.hostname)) return null;
  const base = new URL(".", url);
  const federationParam = resolveClubSearchFederationParam(
    url,
    target.federationCode
  );

  const searchTerm = (target.clubName.split("/")[0] ?? "")
    .replace(/\([^)]*\)/g, "")
    .trim();
  const searchUrl = (term: string) =>
    new URL(
      `clubSearch?federation=${encodeURIComponent(federationParam)}&searchFor=${encodeURIComponent(term)}`,
      base
    ).toString();

  const clubLink =
    pickByName(
      findLinks(await fetchText(searchUrl(searchTerm)), "clubInfoDisplay"),
      target.clubName
    ) ??
    pickByName(
      findLinks(await fetchText(searchUrl(target.clubName)), "clubInfoDisplay"),
      target.clubName
    );
  const clubId = clubLink?.href.match(/club=(\d+)/)?.[1];
  if (!clubId) return null;

  const teamsPage = await fetchText(
    new URL(`clubTeams?club=${clubId}`, base).toString()
  );
  const groupLink = pickGroupLink(teamsPage, target);
  if (!groupLink) return null;

  const groupPage = await fetchText(new URL(groupLink.href, base).toString());
  const teamLink = pickByName(findLinks(groupPage, "teamPortrait"), target.teamName);
  if (!teamLink) return null;

  const teamPage = await fetchText(new URL(teamLink.href, base).toString());
  return extractFeedUrl(teamPage);
}
