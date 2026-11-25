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
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function normalizeSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractTzid(keyPart: string): string | null {
  const match = keyPart.match(/TZID=([^;:]+)/i);
  return match ? match[1].trim() : null;
}

/**
 * Converts a wall-clock date/time in an IANA timezone (e.g. Europe/Berlin) to a UTC Date.
 */
function zonedWallClockToUtc(
  year: number,
  monthZeroBased: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string
): Date {
  const utcGuessMs = Date.UTC(year, monthZeroBased, day, hour, minute, second);
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(new Date(utcGuessMs));
    const get = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value ?? 0);
    const tzYear = get("year");
    const tzMonth = get("month") - 1;
    const tzDay = get("day");
    const tzHour = get("hour") === 24 ? 0 : get("hour");
    const tzMinute = get("minute");
    const tzSecond = get("second");
    const asUtcMs = Date.UTC(tzYear, tzMonth, tzDay, tzHour, tzMinute, tzSecond);
    const offsetMs = asUtcMs - utcGuessMs;
    return new Date(utcGuessMs - offsetMs);
  } catch {
    return new Date(utcGuessMs);
  }
}

function parseIcalDate(rawValue: string, tzid?: string | null): Date | null {
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

  if (isUtc || !tzid) {
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }
  return zonedWallClockToUtc(year, month, day, hour, minute, second, tzid);
}

/**
 * Extracts structured Heim / Gast fields from nuLiga iCal DESCRIPTION blocks, e.g.:
 *   Regionsoberliga männliche Jugend D Nord
 *   Begegnungs-Nr: 20
 *   Heim: HL Buchholz 08 - Rosengarten II
 *   Gast: TuS Jahn Hollenstedt
 */
function parseTeamsFromDescription(
  description: string | null
): { home: string; away: string } | null {
  if (!description) return null;
  const homeMatch = description.match(/(?:^|\n)Heim:\s*(.+)/i);
  const awayMatch = description.match(/(?:^|\n)Gast:\s*(.+)/i);
  if (homeMatch && awayMatch) {
    const home = homeMatch[1].trim();
    const away = awayMatch[1].trim();
    if (home && away) {
      return { home, away };
    }
  }
  return null;
}

function resolveHomeAway(
  home: string,
  away: string,
  teamNameMatch?: string | null
): { isHome: boolean; opponentName: string } {
  if (teamNameMatch) {
    const needle = teamNameMatch.trim().toLowerCase();
    if (
      away.toLowerCase().includes(needle) &&
      !home.toLowerCase().includes(needle)
    ) {
      return { isHome: false, opponentName: home };
    }
    if (home.toLowerCase().includes(needle)) {
      return { isHome: true, opponentName: away };
    }
  }
  return { isHome: true, opponentName: away };
}

function parseMatchup(
  summary: string,
  description: string | null,
  teamNameMatch?: string | null
): { isHome: boolean; opponentName: string; cleanTitle: string } {
  const fromDesc = parseTeamsFromDescription(description);
  if (fromDesc) {
    const resolved = resolveHomeAway(fromDesc.home, fromDesc.away, teamNameMatch);
    return {
      ...resolved,
      cleanTitle: `${fromDesc.home} vs. ${fromDesc.away}`,
    };
  }

  // Erst explizite "vs." / "vs" / "gegen"-Trenner bevorzugen (damit Bindestriche in
  // Vereinsnamen wie "HL Buchholz 08 - Rosengarten" nicht falsch getrennt werden).
  const vsParts = summary
    .replace(/\s*\(\d+\)\s*$/, "")
    .split(/\s+(?:vs\.?|gegen)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (vsParts.length >= 2) {
    const home = vsParts[0];
    const away = vsParts[1];
    return {
      ...resolveHomeAway(home, away, teamNameMatch),
      cleanTitle: summary,
    };
  }

  // Fallback: "TuS Jahn Hollenstedt - SG Luhdorf" oder "Team A : Team B"
  const parts = summary
    .split(/\s+(?:-|:)\s+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    const home = parts[0];
    const away = parts[1];
    return {
      ...resolveHomeAway(home, away, teamNameMatch),
      cleanTitle: summary,
    };
  }

  return { isHome: true, opponentName: summary, cleanTitle: summary };
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
    let description: string | null = null;
    let location: string | null = null;
    let dtStartRaw = "";
    let dtStartTzid: string | null = null;
    let dtEndRaw = "";
    let dtEndTzid: string | null = null;
    let status = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "BEGIN:VEVENT") {
        inEvent = true;
        uid = "";
        summary = "";
        description = null;
        location = null;
        dtStartRaw = "";
        dtStartTzid = null;
        dtEndRaw = "";
        dtEndTzid = null;
        status = "";
        continue;
      }

      if (trimmed === "END:VEVENT" && inEvent) {
        inEvent = false;
        const startAt = parseIcalDate(dtStartRaw, dtStartTzid);
        if (!startAt || !summary) continue;

        const endAt = dtEndRaw
          ? parseIcalDate(dtEndRaw, dtEndTzid)
          : new Date(startAt.getTime() + 105 * 60 * 1000);
        const externalId =
          uid || `ical-${startAt.toISOString()}-${summary.slice(0, 32)}`;
        const { isHome, opponentName, cleanTitle } = parseMatchup(
          summary,
          description,
          options.teamNameMatch
        );

        matches.push({
          externalId,
          title: cleanTitle,
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

      const keyPart = line.slice(0, colonIdx);
      const propName = keyPart.split(";")[0].toUpperCase();
      const value = line.slice(colonIdx + 1);

      if (propName === "UID") uid = value.trim();
      else if (propName === "SUMMARY")
        summary = normalizeSingleLine(unescapeIcalText(value));
      else if (propName === "DESCRIPTION") {
        const desc = unescapeIcalText(value);
        description = desc || null;
      } else if (propName === "LOCATION") {
        const rawLoc = normalizeSingleLine(unescapeIcalText(value));
        const nuligaHallMatch = rawLoc.match(/^(.+?\(\d{6}\)):\s*.+$/);
        location = (nuligaHallMatch ? nuligaHallMatch[1].trim() : rawLoc) || null;
      } else if (propName === "DTSTART") {
        dtStartRaw = value.trim();
        dtStartTzid = extractTzid(keyPart);
      } else if (propName === "DTEND") {
        dtEndRaw = value.trim();
        dtEndTzid = extractTzid(keyPart);
      } else if (propName === "STATUS") status = value.trim();
    }

    return matches;
  }
}
