/**
 * Zentrale, frameworkfreie Datums- und Zeit-Helfer für die deutsche Sprachversion.
 *
 * Garantiert überall (Web, API/Domain, Mobile) einheitlich:
 * - Datum: TT.MM.JJJJ (immer zweistelliger Tag & Monat, vierstelliges Jahr)
 * - Zeit: 24-Stunden-Format HH:MM (00:00–23:59, niemals AM/PM oder 24:xx)
 */

export const GERMAN_LOCALE = "de-DE" as const;
export const GERMAN_TIME_ZONE = "Europe/Berlin" as const;

export type DateInput = Date | string | number | null | undefined;

export interface GermanDateFormatOptions {
  includeWeekday?: boolean;
  timeZone?: string;
}

export interface GermanTimeFormatOptions {
  includeUhr?: boolean;
  timeZone?: string;
}

export interface GermanDateTimeFormatOptions {
  includeWeekday?: boolean;
  includeUhr?: boolean;
  timeZone?: string;
}

const WEEKDAY_SHORT_DE = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function extractParts(
  date: Date,
  options: Intl.DateTimeFormatOptions
): Record<string, string> | null {
  try {
    const formatter = new Intl.DateTimeFormat(GERMAN_LOCALE, options);
    if (typeof formatter.formatToParts !== "function") return null;
    const parts = formatter.formatToParts(date);
    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        map[part.type] = part.value;
      }
    }
    return map;
  } catch {
    return null;
  }
}

function normalizeWeekdayShort(raw: string): string {
  const cleaned = raw.trim().replace(/\.$/, "");
  return cleaned ? `${cleaned}.` : "";
}

function normalizeHour24(raw: string): string {
  const num = Number.parseInt(raw, 10);
  if (!Number.isFinite(num)) return "00";
  // Einige ältere ICU-Builds formatieren Mitternacht als "24"
  return pad2(num === 24 ? 0 : Math.max(0, Math.min(23, num)));
}

/**
 * Formatiert einen Zeitstempel strikt als deutsches Datum `TT.MM.JJJJ`
 * (optional mit kurzem Wochentag, z. B. `Sa., 28.11.2026`).
 */
export function formatGermanDate(
  value: DateInput,
  options: GermanDateFormatOptions = {}
): string {
  const date = toValidDate(value);
  if (!date) return "";

  const parts = extractParts(date, {
    ...(options.includeWeekday ? { weekday: "short" } : {}),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });

  if (parts?.day && parts?.month && parts?.year) {
    const dateStr = `${parts.day.padStart(2, "0")}.${parts.month.padStart(2, "0")}.${parts.year}`;
    if (options.includeWeekday && parts.weekday) {
      return `${normalizeWeekdayShort(parts.weekday)}, ${dateStr}`;
    }
    return dateStr;
  }

  // Fallback ohne Intl.formatToParts
  const dateStr = `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
  if (options.includeWeekday) {
    return `${WEEKDAY_SHORT_DE[date.getDay()]}, ${dateStr}`;
  }
  return dateStr;
}

/**
 * Formatiert reine Kalendertage (`YYYY-MM-DD` oder UTC-Mitternacht `YYYY-MM-DDT00:00:00.000Z`,
 * z. B. Saison-Start/Ende) zeitzonenstabil als `TT.MM.JJJJ`.
 */
export function formatGermanCalendarDate(value: DateInput): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
    if (isoMatch) {
      return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;
    }
  }
  return formatGermanDate(value, { timeZone: "UTC" });
}

/**
 * Formatiert eine Uhrzeit strikt im deutschen 24-Stunden-Format `HH:MM` (00:00–23:59),
 * optional mit Suffix ` Uhr`.
 */
export function formatGermanTime(
  value: DateInput,
  options: GermanTimeFormatOptions = {}
): string {
  const date = toValidDate(value);
  if (!date) return "";

  const parts = extractParts(date, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  });

  let timeStr: string;
  if (parts?.hour && parts?.minute) {
    timeStr = `${normalizeHour24(parts.hour)}:${parts.minute.padStart(2, "0")}`;
  } else {
    timeStr = `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  return options.includeUhr ? `${timeStr} Uhr` : timeStr;
}

/**
 * Formatiert Datum und Uhrzeit einheitlich als `TT.MM.JJJJ, HH:MM`
 * (optional mit Wochentag und/oder ` Uhr`, z. B. `Sa., 28.11.2026, 19:30 Uhr`).
 */
export function formatGermanDateTime(
  value: DateInput,
  options: GermanDateTimeFormatOptions = {}
): string {
  const date = toValidDate(value);
  if (!date) return "";

  const dateStr = formatGermanDate(date, {
    includeWeekday: options.includeWeekday,
    timeZone: options.timeZone,
  });
  const timeStr = formatGermanTime(date, {
    includeUhr: options.includeUhr,
    timeZone: options.timeZone,
  });

  if (!dateStr || !timeStr) return "";
  return `${dateStr}, ${timeStr}`;
}

/**
 * Prüft, ob Jahr/Monat/Tag ein real existierendes Kalenderdatum bilden (inkl. Schaltjahre).
 */
export function isValidCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Wandelt ein ISO-Datum (`YYYY-MM-DD` oder ISO-Timestamp) in `TT.MM.JJJJ` um.
 */
export function isoDateToGermanDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidCalendarDate(year, month, day)) return "";
  return `${pad2(day)}.${pad2(month)}.${year}`;
}

/**
 * Parst ein deutsches Datum (`TT.MM.JJJJ`, `T.M.JJJJ`, `TTMMJJJJ`) oder ein
 * ISO-Datum (`YYYY-MM-DD`) strikt in normalisiertes `YYYY-MM-DD`.
 * Gibt bei ungültigem Datum `null` zurück.
 */
export function parseGermanDateToIso(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Deutsches Format TT.MM.JJJJ oder T.M.JJJJ
  const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deMatch) {
    const day = Number(deMatch[1]);
    const month = Number(deMatch[2]);
    const year = Number(deMatch[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // 2. Kompakte Ziffernfolge TTMMJJJJ (z. B. 28112026)
  const compactMatch = trimmed.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compactMatch) {
    const day = Number(compactMatch[1]);
    const month = Number(compactMatch[2]);
    const year = Number(compactMatch[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  // 3. ISO-Datum YYYY-MM-DD (Rückwärtskompatibilität für APIs/Tests)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidCalendarDate(year, month, day)) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  return null;
}

/**
 * Parst eine 24-Stunden-Uhrzeit (`HH:MM`, `H:MM`, `HHMM`, optional mit ` Uhr`)
 * strikt in normalisiertes `HH:MM` (00:00–23:59).
 * Lehnt 12-Stunden-Angaben (AM/PM) sowie ungültige Uhrzeiten ab.
 */
export function parseGermanTimeTo24h(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // AM/PM explizit ablehnen
  if (/\b(?:am|pm)\b/i.test(trimmed)) return null;

  const cleaned = trimmed.replace(/\s*uhr$/i, "").trim();

  // HH:MM oder H:MM
  const colonMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (colonMatch) {
    const hour = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return `${pad2(hour)}:${pad2(minute)}`;
  }

  // Kompakte Ziffernfolge HHMM oder HMM (z. B. 1930 oder 930)
  const compactMatch = cleaned.match(/^(\d{3,4})$/);
  if (compactMatch) {
    const digits = compactMatch[1].padStart(4, "0");
    const hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2, 4));
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return `${pad2(hour)}:${pad2(minute)}`;
  }

  return null;
}

/**
 * Gibt das lokale Kalenderdatum eines `Date`-Objekts als `YYYY-MM-DD` zurück
 * (ohne UTC-Mitternachtsverschiebung).
 */
export function toLocalIsoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Formatiert eine Fahrgemeinschafts-Abfahrtszeit robust:
 * - ISO-Zeitstempel -> `Sa., 28.11.2026, 16:15 Uhr`
 * - 24h-Uhrzeit (`16:15` oder `16:15 Uhr`) -> `16:15 Uhr`
 * - Freitext -> unverändert getrimmt (niemals `Invalid Date`)
 */
export function formatDepartureTime(
  value: string | null | undefined,
  options: { timeZone?: string } = {}
): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const formatted = formatGermanDateTime(trimmed, {
      includeWeekday: true,
      includeUhr: true,
      timeZone: options.timeZone,
    });
    if (formatted) return formatted;
  }

  const parsedTime = parseGermanTimeTo24h(trimmed);
  if (parsedTime) {
    return `${parsedTime} Uhr`;
  }

  return trimmed;
}
