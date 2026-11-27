import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
  type PhoneNumber,
} from "libphonenumber-js/max";
import { z } from "zod";

export const DEFAULT_PHONE_COUNTRY: CountryCode = "DE";

/** DACH-Länder werden in der Länderliste ganz oben angepinnt (Deutschland als Default zuerst). */
export const PINNED_PHONE_COUNTRIES: readonly CountryCode[] = [
  "DE",
  "AT",
  "CH",
];

/**
 * Länder, bei denen eine führende "0" Bestandteil der regulären nationalen Rufnummer
 * im E.164-Format ist (z. B. italienische Festnetznummern: +39 06 1234 5678).
 * In allen anderen Ländern wird eine führende "0" als nationale Verkehrsausscheidungsziffer
 * bzw. Tippfehler vor der Vorwahl automatisch bereinigt.
 */
const LEADING_ZERO_REQUIRED_COUNTRIES = new Set<CountryCode>([
  "BF",
  "BJ",
  "CG",
  "CI",
  "GA",
  "GN",
  "IT",
  "ML",
  "MR",
  "NE",
  "SM",
  "SN",
  "TG",
  "VA",
]);

/** Gebräuchliche Suchbegriffe (Deutsch/Englisch/Umgangssprache) für die Ländersuche. */
const COUNTRY_SEARCH_ALIASES: Partial<Record<CountryCode, string>> = {
  DE: "Germany Bundesrepublik",
  AT: "Austria Oesterreich",
  CH: "Switzerland Suisse Svizzera",
  US: "USA Amerika America United States",
  GB: "UK Grossbritannien Großbritannien England Scotland Wales United Kingdom",
  NL: "Holland Netherlands",
  FR: "France",
  IT: "Italy",
  ES: "Spain",
  PL: "Poland",
  DK: "Denmark",
  CZ: "Czechia Tschechische Republik",
  TR: "Turkey Tuerkei",
  HR: "Croatia",
  SE: "Sweden",
  NO: "Norway",
  BE: "Belgium",
  LU: "Luxembourg",
  GR: "Greece",
  PT: "Portugal",
  UA: "Ukraine",
  AU: "Australia",
  CA: "Canada",
  JP: "Japan",
};

export interface PhoneCountryOption {
  code: CountryCode;
  callingCode: string;
  dialCode: string;
  name: string;
  flag: string;
  pinned: boolean;
  /** Vorbereiteter, normalisierter Suchstring (Kleinschreibung ohne Diakritika). */
  searchText: string;
}

export function countryCodeToFlag(code: CountryCode): string {
  const upper = code.toUpperCase();
  if (upper.length !== 2) return "";
  return String.fromCodePoint(
    0x1f1e6 + upper.charCodeAt(0) - 65,
    0x1f1e6 + upper.charCodeAt(1) - 65
  );
}

function normalizeSearchToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const countryOptionsCache = new Map<string, PhoneCountryOption[]>();

/**
 * Liefert die vollständige Liste aller unterstützten Länder inkl. Landesvorwahl,
 * Flagge und lokalisiertem Namen (Standard: Deutsch).
 * DACH (DE, AT, CH) steht immer ganz oben, gefolgt von allen übrigen Ländern A–Z.
 */
export function getPhoneCountryOptions(locale = "de"): PhoneCountryOption[] {
  const cached = countryOptionsCache.get(locale);
  if (cached) return cached;

  let displayNames: Intl.DisplayNames | null = null;
  try {
    displayNames = new Intl.DisplayNames([locale], { type: "region" });
  } catch {
    displayNames = null;
  }

  const pinnedOrder = new Map<CountryCode, number>(
    PINNED_PHONE_COUNTRIES.map((code, idx) => [code, idx])
  );

  const options: PhoneCountryOption[] = getCountries().map((code) => {
    const callingCode = getCountryCallingCode(code);
    const dialCode = `+${callingCode}`;
    const name = displayNames?.of(code) ?? code;
    const aliases = COUNTRY_SEARCH_ALIASES[code] ?? "";
    const pinned = pinnedOrder.has(code);

    return {
      code,
      callingCode,
      dialCode,
      name,
      flag: countryCodeToFlag(code),
      pinned,
      searchText: normalizeSearchToken(
        `${name} ${code} ${dialCode} ${callingCode} ${aliases}`
      ),
    };
  });

  options.sort((a, b) => {
    const aPinned = pinnedOrder.get(a.code);
    const bPinned = pinnedOrder.get(b.code);
    if (aPinned !== undefined && bPinned !== undefined) {
      return aPinned - bPinned;
    }
    if (aPinned !== undefined) return -1;
    if (bPinned !== undefined) return 1;
    return a.name.localeCompare(b.name, locale);
  });

  countryOptionsCache.set(locale, options);
  return options;
}

export function filterPhoneCountryOptions(
  options: PhoneCountryOption[],
  query: string
): PhoneCountryOption[] {
  const q = normalizeSearchToken(query);
  if (!q) return options;
  const digitsOnly = q.replace(/^\+/, "");
  return options.filter(
    (opt) =>
      opt.searchText.includes(q) ||
      (digitsOnly.length > 0 && opt.callingCode.startsWith(digitsOnly))
  );
}

/**
 * Gibt an, ob eine einzelne führende "0" vor der Vorwahl in diesem Land
 * eine nationale Verkehrsausscheidungsziffer ist und automatisch entfernt werden soll.
 */
export function countryStripsLeadingZero(country: CountryCode): boolean {
  return !LEADING_ZERO_REQUIRED_COUNTRIES.has(country);
}

/**
 * Entfernt bei Bedarf eine einzelne führende "0" (oder "(0)") im nationalen Eingabefeld,
 * lässt jedoch "00..." (internationale Vorwahl) und Länder wie Italien (+39) unberührt.
 */
export function stripLeadingTrunkZero(
  value: string,
  country: CountryCode
): string {
  if (!countryStripsLeadingZero(country)) {
    return value;
  }

  // "(0) 170 ..." -> "170 ..."
  const withoutParenZero = value.replace(/^\s*\(\s*0+\s*\)\s*/, "");
  if (withoutParenZero !== value) {
    return withoutParenZero;
  }

  // Einzelne führende "0" gefolgt von Ziffer 1-9 (oder Trennzeichen + Ziffer 1-9) entfernen,
  // aber "00..." für internationale Eingaben (z. B. 0043...) erhalten.
  if (/^\s*0(?!0)[\s\-/]*[1-9]/.test(value)) {
    return value.replace(/^\s*0[\s\-/]*/, "");
  }

  return value;
}

/**
 * Bereinigt typische Schreibweisen wie "+49 (0) 170 / 123-456" oder "0043 664 1234567"
 * vor dem Parsen mit libphonenumber-js.
 */
function preprocessRawPhone(raw: string): string {
  let cleaned = raw.trim();
  // "(0)" nach Landesvorwahl entfernen, z. B. "+49 (0) 170 ..." -> "+49 170 ..."
  cleaned = cleaned.replace(/^(\+|00)(\d{1,3})\s*\(\s*0+\s*\)\s*/, "$1$2 ");
  // Führendes "00" als internationales "+" interpretieren
  if (cleaned.startsWith("00") && cleaned.length > 4) {
    cleaned = `+${cleaned.slice(2)}`;
  }
  return cleaned;
}

function parseFlexiblePhone(
  raw: string,
  defaultCountry: CountryCode
): PhoneNumber | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const cleaned = preprocessRawPhone(trimmed);
  const direct = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (direct?.isValid()) {
    return direct;
  }

  // Fallback: Falls das Feld mit führender 0 im nationalen Kontext übergeben wurde
  // (z. B. "0170 1234567" oder "(0) 170 1234567"), ohne führende 0 erneut prüfen.
  if (!cleaned.startsWith("+") && countryStripsLeadingZero(defaultCountry)) {
    const stripped = stripLeadingTrunkZero(cleaned, defaultCountry);
    if (stripped !== cleaned) {
      const retry = parsePhoneNumberFromString(stripped, defaultCountry);
      if (retry?.isValid()) {
        return retry;
      }
    }
  }

  return direct;
}

/**
 * Formatiert den nationalen Teil einer geparsten Nummer für das Eingabefeld
 * neben dem Landesvorwahl-Prefix (z. B. "170 1234567" für +49 170 1234567).
 */
export function formatNationalForPrefix(parsed: PhoneNumber): string {
  const prefix = `+${parsed.countryCallingCode}`;
  const formattedIntl = new AsYouType().input(parsed.number);
  if (formattedIntl.startsWith(prefix)) {
    return formattedIntl.slice(prefix.length).trimStart();
  }
  return parsed.nationalNumber;
}

export type NormalizePhoneResult =
  | { ok: true; e164: string | null; country?: CountryCode }
  | { ok: false; error: string };

export const INVALID_PHONE_MESSAGE =
  "Bitte gib eine gültige Telefonnummer ein (z. B. +49 170 1234567).";

/**
 * Validiert und normalisiert eine Telefonnummer ins einheitliche E.164-Format
 * (z. B. "+491701234567"). Leere Eingaben liefern `e164: null`.
 */
export function normalizePhoneNumber(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): NormalizePhoneResult {
  if (raw === null || raw === undefined) {
    return { ok: true, e164: null };
  }

  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: true, e164: null };
  }

  if (trimmed.length > 40) {
    return { ok: false, error: INVALID_PHONE_MESSAGE };
  }

  const parsed = parseFlexiblePhone(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return { ok: false, error: INVALID_PHONE_MESSAGE };
  }

  return {
    ok: true,
    e164: parsed.number,
    country: parsed.country ?? defaultCountry,
  };
}

export interface ParsedPhoneForInput {
  country: CountryCode;
  nationalDisplay: string;
  e164: string | null;
  isValid: boolean;
}

/**
 * Zerlegt einen beliebigen gespeicherten oder eingefügten Telefonnummern-String
 * in Landescode (Default: DE) + lesbaren nationalen Teil für die `PhoneInput`-Komponente.
 */
export function parsePhoneForInput(
  raw: string | null | undefined,
  fallbackCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): ParsedPhoneForInput {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return {
      country: fallbackCountry,
      nationalDisplay: "",
      e164: null,
      isValid: true,
    };
  }

  const parsed = parseFlexiblePhone(trimmed, fallbackCountry);
  if (parsed && parsed.isValid()) {
    const resolvedCountry = parsed.country ?? fallbackCountry;
    return {
      country: resolvedCountry,
      nationalDisplay: formatNationalForPrefix(parsed),
      e164: parsed.number,
      isValid: true,
    };
  }

  // Fallback für unvollständige/Altbestands-Eingaben:
  // Falls eine erkennbare Landesvorwahl vorhanden ist, trotzdem Land übernehmen.
  if (parsed?.country && trimmed.startsWith("+")) {
    return {
      country: parsed.country,
      nationalDisplay: parsed.nationalNumber,
      e164: null,
      isValid: false,
    };
  }

  return {
    country: fallbackCountry,
    nationalDisplay: stripLeadingTrunkZero(trimmed, fallbackCountry),
    e164: null,
    isValid: false,
  };
}

/**
 * Formatiert eine gespeicherte Telefonnummer einheitlich im internationalen Format
 * für die Anzeige (z. B. "+49 170 1234567", "+1 202 555 0199").
 * Ungültige Altbestands-Werte werden unverändert zurückgegeben.
 */
export function formatPhoneNumber(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";

  const parsed = parseFlexiblePhone(trimmed, defaultCountry);
  if (parsed && parsed.isValid()) {
    return parsed.formatInternational();
  }
  return trimmed;
}

/**
 * Erzeugt einen `tel:`-Link (z. B. "tel:+491701234567") für klickbare Telefonnummern.
 */
export function toTelHref(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_PHONE_COUNTRY
): string | null {
  const res = normalizePhoneNumber(raw, defaultCountry);
  if (res.ok && res.e164) {
    return `tel:${res.e164}`;
  }
  return null;
}

/**
 * Gemeinsames Zod-Schema für optionale Telefonnummern in allen Domain-Schemas:
 * - Leere Strings / null -> null
 * - undefined -> undefined (für partielle PATCH-Updates)
 * - Gültige Nummern (national mit/ohne führende 0 oder international) -> E.164 (z. B. "+491701234567")
 * - Ungültige Nummern -> klare deutsche Validierungsfehlermeldung
 */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(40, INVALID_PHONE_MESSAGE)
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;

    const normalized = normalizePhoneNumber(value, DEFAULT_PHONE_COUNTRY);
    if (!normalized.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: normalized.error,
      });
      return z.NEVER;
    }

    return normalized.e164;
  });

export type { CountryCode };
