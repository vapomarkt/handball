import { DomainError } from "../errors";

export const MAX_CLUB_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
export const MIN_CLUB_LOGO_BYTES = 32;

export const ALLOWED_CLUB_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedClubLogoMimeType =
  (typeof ALLOWED_CLUB_LOGO_MIME_TYPES)[number];

export interface ValidatedClubLogo {
  data: Uint8Array;
  mimeType: AllowedClubLogoMimeType;
}

export interface NuligaClubLogoResult extends ValidatedClubLogo {
  externalClubId: string;
  matchedClubName: string;
}

export interface NuligaClubLogoTarget {
  clubName: string;
  /** Optionale Staffelseite oder Teamseite aus nuLiga (liefert Host & WebObjects-Pfad). */
  sourceUrl?: string | null;
  federationCode?: string;
}

export interface NuligaSessionResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Bereits extrahierte `name=value` Cookie-Paare aus `Set-Cookie`. */
  cookies: string[];
}

export type NuligaSessionFetchFn = (
  url: string,
  options?: { cookieHeader?: string; accept?: string }
) => Promise<NuligaSessionResponse>;

export type NuligaClubLogoFetcher = (
  target: NuligaClubLogoTarget
) => Promise<NuligaClubLogoResult | null>;

const DEFAULT_HVNB_NULIGA_BASE =
  "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/";

/**
 * Erkennt das Bildformat ausschließlich anhand der Magic Bytes
 * (verhindert XSS durch SVG/HTML und ungültige Uploads).
 */
export function detectImageMimeType(
  bytes: Uint8Array
): AllowedClubLogoMimeType | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  // GIF87a / GIF89a
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return "image/gif";
  }

  return null;
}

export function validateClubLogoBinary(bytes: Uint8Array): ValidatedClubLogo {
  if (bytes.length < MIN_CLUB_LOGO_BYTES) {
    throw DomainError.validation("Die hochgeladene Datei ist leer oder ungültig.", {
      file: ["Bitte wähle eine gültige Bilddatei (PNG, JPG, WebP oder GIF)."],
    });
  }

  if (bytes.length > MAX_CLUB_LOGO_BYTES) {
    throw DomainError.validation(
      "Das Vereinslogo darf maximal 2 MB groß sein.",
      {
        file: ["Bitte wähle ein Bild mit maximal 2 MB Dateigröße."],
      }
    );
  }

  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) {
    throw DomainError.validation(
      "Nicht unterstütztes Bildformat. Erlaubt sind PNG, JPG, WebP und GIF.",
      {
        file: ["Bitte lade eine PNG-, JPG-, WebP- oder GIF-Datei hoch."],
      }
    );
  }

  return { data: bytes, mimeType };
}

const decodeHtml = (value: string): string =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

const normalizeClubName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

interface ClubLink {
  href: string;
  text: string;
}

function findClubInfoLinks(html: string): ClubLink[] {
  const links: ClubLink[] = [];
  const pattern = /<a\b[^>]*href="([^"]*clubInfoDisplay[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const text = decodeHtml(match[2].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    links.push({
      href: decodeHtml(match[1]),
      text,
    });
  }
  return links;
}

function pickBestClubLink(links: ClubLink[], clubName: string): ClubLink | null {
  const wanted = normalizeClubName(clubName);
  if (!wanted) return null;

  const exact = links.find((l) => normalizeClubName(l.text) === wanted);
  if (exact) return exact;

  const contains = links.find((l) => {
    const t = normalizeClubName(l.text);
    return t.length > 0 && (t.includes(wanted) || wanted.includes(t));
  });
  if (contains) return contains;

  const wantedTokens = wanted.split(" ").filter((tok) => tok.length >= 3);
  if (wantedTokens.length === 0) return null;

  let best: { link: ClubLink; score: number } | null = null;
  for (const link of links) {
    const candidateTokens = new Set(
      normalizeClubName(link.text)
        .split(" ")
        .filter((tok) => tok.length >= 3)
    );
    if (candidateTokens.size === 0) continue;

    let hits = 0;
    for (const tok of wantedTokens) {
      if (candidateTokens.has(tok)) hits += 1;
    }
    const score = hits / wantedTokens.length;
    if (score >= 0.5 && (!best || score > best.score)) {
      best = { link, score };
    }
  }

  return best?.link ?? null;
}

/**
 * Extrahiert den temporären WebObjects-Bildpfad des Vereinswappens aus `clubInfoDisplay`.
 * Beispiel: `/cgi-bin/WebObjects/nuLigaHBDE.woa/wr?wodata=444712132729573881`
 */
export function extractNuligaClubLogoSrc(html: string): string | null {
  const imgPattern = /<img\b[^>]*>/gi;
  for (const match of html.matchAll(imgPattern)) {
    const tag = match[0];
    const srcMatch = tag.match(/\bsrc="([^"]*\/wr\?wodata=[^"]+)"/i);
    if (srcMatch?.[1]) {
      return decodeHtml(srcMatch[1]);
    }
  }
  return null;
}

function resolveNuligaBaseUrl(sourceUrl?: string | null): URL {
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (/(^|\.)liga\.nu$/i.test(parsed.hostname)) {
        return new URL(".", parsed);
      }
    } catch {
      // Fallback auf HVNB-Standard-Host
    }
  }
  return new URL(DEFAULT_HVNB_NULIGA_BASE);
}

function buildSearchTerms(clubName: string): string[] {
  const trimmed = clubName.trim();
  if (!trimmed) return [];

  const terms: string[] = [];
  const pushUnique = (value: string) => {
    const clean = value.trim();
    if (clean.length >= 2 && !terms.includes(clean)) {
      terms.push(clean);
    }
  };

  const simplified = (trimmed.split("/")[0] ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(?:e\.?\s*v\.?|handball)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  pushUnique(simplified);
  pushUnique(trimmed);

  // Hyphen-Normalisierung (z. B. "HL Buchholz 08-Rosengarten" -> "Buchholz" / "Rosengarten")
  const words = simplified
    .split(/[\s-]+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !/^\d+$/.test(w) &&
        !/^(tus|tsv|vfl|hsg|jsg|mjsg|wjsg|mtv|tvv|club|sport|verein)$/i.test(w)
    );

  if (words.length > 0) {
    pushUnique(words[0]);
    pushUnique(words[words.length - 1]);
  }

  return terms;
}

function extractCookiePairs(setCookieHeaders: string[]): string[] {
  const pairs: string[] = [];
  for (const header of setCookieHeaders) {
    const firstPart = header.split(";")[0]?.trim();
    if (firstPart && firstPart.includes("=")) {
      pairs.push(firstPart);
    }
  }
  return pairs;
}

export function createDefaultNuligaSessionFetch(): NuligaSessionFetchFn {
  return async (url, options) => {
    const headers: Record<string, string> = {
      Accept: options?.accept ?? "text/html,application/xhtml+xml,*/*",
    };
    if (options?.cookieHeader) {
      headers.Cookie = options.cookieHeader;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15_000),
    });

    const rawCookies =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : res.headers.get("set-cookie")
          ? [res.headers.get("set-cookie") as string]
          : [];

    return {
      ok: res.ok,
      status: res.status,
      text: () => res.text(),
      arrayBuffer: () => res.arrayBuffer(),
      cookies: extractCookiePairs(rawCookies),
    };
  };
}

/**
 * Sucht einen Verein bei nuLiga (`clubSearch` -> `clubInfoDisplay`), lädt das
 * dort hinterlegte Vereinswappen inklusive WebObjects-Session-Cookie herunter
 * und validiert die Bildbytes.
 */
export async function resolveNuligaClubLogo(
  fetchSession: NuligaSessionFetchFn,
  target: NuligaClubLogoTarget
): Promise<NuligaClubLogoResult | null> {
  const clubName = target.clubName.trim();
  if (clubName.length < 2) return null;

  const base = resolveNuligaBaseUrl(target.sourceUrl);
  const federation = target.federationCode?.trim() || "HVNB";
  const searchTerms = buildSearchTerms(clubName);

  let clubLink: ClubLink | null = null;
  for (const term of searchTerms) {
    const searchUrl = new URL(
      `clubSearch?federation=${encodeURIComponent(federation)}&searchFor=${encodeURIComponent(term)}`,
      base
    ).toString();
    const res = await fetchSession(searchUrl);
    if (!res.ok) continue;
    const html = await res.text();
    const match = pickBestClubLink(findClubInfoLinks(html), clubName);
    if (match) {
      clubLink = match;
      break;
    }
  }

  if (!clubLink) return null;

  const externalClubId = clubLink.href.match(/club=(\d+)/)?.[1];
  if (!externalClubId) return null;

  const clubInfoUrl = new URL(
    `clubInfoDisplay?club=${encodeURIComponent(externalClubId)}`,
    base
  ).toString();

  const clubInfoRes = await fetchSession(clubInfoUrl);
  if (!clubInfoRes.ok) return null;

  const clubInfoHtml = await clubInfoRes.text();
  const logoSrc = extractNuligaClubLogoSrc(clubInfoHtml);
  if (!logoSrc) return null;

  const logoUrl = new URL(logoSrc, base.origin);
  if (!/(^|\.)liga\.nu$/i.test(logoUrl.hostname)) {
    return null;
  }

  const cookieHeader =
    clubInfoRes.cookies.length > 0 ? clubInfoRes.cookies.join("; ") : undefined;

  const imageRes = await fetchSession(logoUrl.toString(), {
    cookieHeader,
    accept: "image/png,image/jpeg,image/webp,image/gif,image/*,*/*",
  });
  if (!imageRes.ok) return null;

  const bytes = new Uint8Array(await imageRes.arrayBuffer());
  if (bytes.length < MIN_CLUB_LOGO_BYTES || bytes.length > MAX_CLUB_LOGO_BYTES) {
    return null;
  }

  const mimeType = detectImageMimeType(bytes);
  if (!mimeType) return null;

  return {
    data: bytes,
    mimeType,
    externalClubId,
    matchedClubName: clubLink.text,
  };
}
