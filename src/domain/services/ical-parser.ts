import {
  LeagueProviderAdapter,
  NormalizedLeagueMatch,
} from "../adapters/league-provider";

export interface IcalParseOptions {
  teamNameMatch?: string | null;
}

/**
 * Unfolds RFC 5545 folded lines (CRLF + space/tab).
 */
function unfoldIcalLines(raw: string): string[] {
  return raw
    .replace(/\r\n[ \t]/g, "")
    .replace(/\n[ \t]/g, "")
    .split(/\r?\n/);
}

function unescapeIcalText(value: string): string {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcalDate(rawValue: string): Date | null {
  const val = rawValue.trim();
  // Format: YYYYMMDDTHHMMSSZ or YYYYMMDDTHHMMSS
  const match = val.match(
    /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = match[4] ? Number(match[4]) : 18;
  const minute = match[5] ? Number(match[5]) : 0;
  const second = match[6] ? Number(match[6]) : 0;
  const isUtc = match[7] === "Z";

  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

function parseMatchup(
  summary: string,
  teamNameMatch?: string | null
): { isHome: boolean; opponentName: string } {
  // Typische Handball-Formate: "TSV Musterstadt - SG Neustadt", "TSV Musterstadt : SG Neustadt", "TSV Musterstadt vs. SG Neustadt"
  const parts = summary
    .split(/\s+(?:-|:|vs\.?|gegen)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const home = parts[0];
    const away = parts[1];
    if (teamNameMatch) {
      const needle = teamNameMatch.trim().toLowerCase();
      if (away.toLowerCase().includes(needle) && !home.toLowerCase().includes(needle)) {
        return { isHome: false, opponentName: home };
      }
      if (home.toLowerCase().includes(needle)) {
        return { isHome: true, opponentName: away };
      }
    }
    return { isHome: true, opponentName: away };
  }

  return { isHome: true, opponentName: summary };
}

export class IcalLeagueProviderAdapter
  implements LeagueProviderAdapter<IcalParseOptions>
{
  readonly provider = "ICAL_URL" as const;

  parse(
    rawContent: string,
    options: IcalParseOptions = {}
  ): NormalizedLeagueMatch[] {
    const lines = unfoldIcalLines(rawContent);
    const matches: NormalizedLeagueMatch[] = [];

    let inEvent = false;
    let uid = "";
    let summary = "";
    let location: string | null = null;
    let dtStartRaw = "";
    let dtEndRaw = "";
    let status = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "BEGIN:VEVENT") {
        inEvent = true;
        uid = "";
        summary = "";
        location = null;
        dtStartRaw = "";
        dtEndRaw = "";
        status = "";
        continue;
      }

      if (trimmed === "END:VEVENT" && inEvent) {
        inEvent = false;
        const startAt = parseIcalDate(dtStartRaw);
        if (!startAt || !summary) continue;

        const endAt = dtEndRaw
          ? parseIcalDate(dtEndRaw)
          : new Date(startAt.getTime() + 105 * 60 * 1000);
        const externalId =
          uid || `ical-${startAt.toISOString()}-${summary.slice(0, 32)}`;
        const { isHome, opponentName } = parseMatchup(
          summary,
          options.teamNameMatch
        );

        matches.push({
          externalId,
          title: summary,
          opponentName,
          isHome,
          startAt,
          endAt,
          venueName: location,
          isCancelled: status.toUpperCase() === "CANCELLED",
        });
        continue;
      }

      if (!inEvent) continue;

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) continue;

      const keyPart = line.slice(0, colonIdx).toUpperCase();
      const propName = keyPart.split(";")[0];
      const value = line.slice(colonIdx + 1);

      if (propName === "UID") uid = value.trim();
      else if (propName === "SUMMARY") summary = unescapeIcalText(value);
      else if (propName === "LOCATION") {
        const loc = unescapeIcalText(value);
        location = loc || null;
      } else if (propName === "DTSTART") dtStartRaw = value.trim();
      else if (propName === "DTEND") dtEndRaw = value.trim();
      else if (propName === "STATUS") status = value.trim();
    }

    return matches;
  }
}
