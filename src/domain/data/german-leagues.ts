import { TeamGender } from "../schemas/handball";
import { LeagueAgeGroup } from "../schemas/league-catalog";

export interface AgeGroupOption {
  value: LeagueAgeGroup;
  label: string;
  shortLabel: string;
  subtitle: string;
  section: "Erwachsene" | "Jugend";
  defaultCategory: "Aktive" | "Jugend" | "Senioren";
  allowedGenders: TeamGender[];
  defaultGender: TeamGender;
  /** Standardwert, ob in dieser Altersklasse mit Harz (Backe) gespielt wird. */
  defaultUsesResin: boolean;
}

export const GERMAN_AGE_GROUPS: AgeGroupOption[] = [
  {
    value: "ADULT",
    label: "Aktive (Erwachsene)",
    shortLabel: "Aktive",
    subtitle: "Herren & Damen",
    section: "Erwachsene",
    defaultCategory: "Aktive",
    allowedGenders: ["MALE", "FEMALE"],
    defaultGender: "MALE",
    defaultUsesResin: true,
  },
  {
    value: "SENIOR",
    label: "Senioren & Freizeit",
    shortLabel: "Senioren",
    subtitle: "Ü32, Alte Herren & Hobby",
    section: "Erwachsene",
    defaultCategory: "Senioren",
    allowedGenders: ["MALE", "FEMALE", "MIXED"],
    defaultGender: "MALE",
    defaultUsesResin: true,
  },
  {
    value: "YOUTH_A",
    label: "A-Jugend",
    shortLabel: "A-Jugend",
    subtitle: "U19 (17–18 Jahre)",
    section: "Jugend",
    defaultCategory: "Jugend",
    allowedGenders: ["MALE", "FEMALE"],
    defaultGender: "MALE",
    defaultUsesResin: true,
  },
  {
    value: "YOUTH_B",
    label: "B-Jugend",
    shortLabel: "B-Jugend",
    subtitle: "U17 (15–16 Jahre)",
    section: "Jugend",
    defaultCategory: "Jugend",
    allowedGenders: ["MALE", "FEMALE"],
    defaultGender: "MALE",
    defaultUsesResin: true,
  },
  {
    value: "YOUTH_C",
    label: "C-Jugend",
    shortLabel: "C-Jugend",
    subtitle: "U15 (13–14 Jahre)",
    section: "Jugend",
    defaultCategory: "Jugend",
    allowedGenders: ["MALE", "FEMALE"],
    defaultGender: "MALE",
    defaultUsesResin: false,
  },
  {
    value: "YOUTH_D",
    label: "D-Jugend",
    shortLabel: "D-Jugend",
    subtitle: "U13 (11–12 Jahre)",
    section: "Jugend",
    defaultCategory: "Jugend",
    allowedGenders: ["MALE", "FEMALE", "MIXED"],
    defaultGender: "MALE",
    defaultUsesResin: false,
  },
  {
    value: "YOUTH_E",
    label: "E-Jugend",
    shortLabel: "E-Jugend",
    subtitle: "U11 (9–10 Jahre)",
    section: "Jugend",
    defaultCategory: "Jugend",
    allowedGenders: ["MALE", "FEMALE", "MIXED"],
    defaultGender: "MIXED",
    defaultUsesResin: false,
  },
  {
    value: "YOUTH_F_MINI",
    label: "F-Jugend / Minis",
    shortLabel: "Minis",
    subtitle: "U9 (bis 8 Jahre)",
    section: "Jugend",
    defaultCategory: "Jugend",
    allowedGenders: ["MIXED"],
    defaultGender: "MIXED",
    defaultUsesResin: false,
  },
];

const NO_RESIN_AGE_GROUPS = new Set<LeagueAgeGroup>([
  "YOUTH_C",
  "YOUTH_D",
  "YOUTH_E",
  "YOUTH_F_MINI",
]);

/**
 * Liefert den sinnvollen Standardwert, ob eine Altersklasse mit Harz (Backe) spielt.
 * In der D-Jugend und jünger wird grundsätzlich ohne Harz gespielt; in der C-Jugend
 * ist es standardmäßig deaktiviert und kann pro Team jederzeit aktiviert werden.
 */
export function defaultUsesResinForAgeGroup(
  ageGroup?: LeagueAgeGroup | null
): boolean {
  if (!ageGroup) return true;
  return !NO_RESIN_AGE_GROUPS.has(ageGroup);
}

/**
 * Bestimmt `usesResin` beim Anlegen einer Mannschaft:
 * 1. Explizite Angabe hat immer Vorrang.
 * 2. Ansonsten Ableitung aus `ageGroup`.
 * 3. Fallback auf `category` / `teamName` (z. B. "D-Jugend", "E-Jugend", "Minis").
 */
export function resolveTeamUsesResin(input: {
  usesResin?: boolean;
  ageGroup?: LeagueAgeGroup | null;
  category?: string | null;
  teamName?: string | null;
}): boolean {
  if (typeof input.usesResin === "boolean") {
    return input.usesResin;
  }
  if (input.ageGroup) {
    return defaultUsesResinForAgeGroup(input.ageGroup);
  }
  const haystack = `${input.category ?? ""} ${input.teamName ?? ""}`.toLowerCase();
  if (
    /\b([mwg]?[cdef]-?jugend|minis?|minihandball|u9|u11|u13|u15)\b/i.test(
      haystack
    )
  ) {
    return false;
  }
  return true;
}

export function suggestTeamName(
  ageGroup: LeagueAgeGroup,
  gender: TeamGender
): string {
  switch (ageGroup) {
    case "ADULT":
      return gender === "FEMALE" ? "Damen 1" : "Herren 1";
    case "SENIOR":
      if (gender === "FEMALE") return "Seniorinnen";
      if (gender === "MIXED") return "Freizeit-Team";
      return "Alte Herren";
    case "YOUTH_A":
      return gender === "FEMALE" ? "wA-Jugend" : "mA-Jugend";
    case "YOUTH_B":
      return gender === "FEMALE" ? "wB-Jugend" : "mB-Jugend";
    case "YOUTH_C":
      return gender === "FEMALE" ? "wC-Jugend" : "mC-Jugend";
    case "YOUTH_D":
      if (gender === "FEMALE") return "wD-Jugend";
      if (gender === "MIXED") return "gD-Jugend";
      return "mD-Jugend";
    case "YOUTH_E":
      if (gender === "FEMALE") return "wE-Jugend";
      if (gender === "MIXED") return "gE-Jugend";
      return "mE-Jugend";
    case "YOUTH_F_MINI":
      return "Minis";
  }
}

export function getAgeGroupPrefix(
  ageGroup: LeagueAgeGroup,
  gender: TeamGender
): string {
  switch (ageGroup) {
    case "ADULT":
      return gender === "FEMALE" ? "Frauen" : "Männer";
    case "SENIOR":
      if (gender === "FEMALE") return "Seniorinnen";
      if (gender === "MIXED") return "Mixed";
      return "Senioren";
    case "YOUTH_A":
      return gender === "FEMALE" ? "wA-Jugend" : "mA-Jugend";
    case "YOUTH_B":
      return gender === "FEMALE" ? "wB-Jugend" : "mB-Jugend";
    case "YOUTH_C":
      return gender === "FEMALE" ? "wC-Jugend" : "mC-Jugend";
    case "YOUTH_D":
      if (gender === "FEMALE") return "wD-Jugend";
      if (gender === "MIXED") return "gD-Jugend";
      return "mD-Jugend";
    case "YOUTH_E":
      if (gender === "FEMALE") return "wE-Jugend";
      if (gender === "MIXED") return "gE-Jugend";
      return "mE-Jugend";
    case "YOUTH_F_MINI":
      return "Minis / F-Jugend";
  }
}

export interface LeagueTierTemplate {
  key: string;
  tier: number;
  name: string;
  shortName: string;
}

export interface GermanFederationDefinition {
  code: string;
  name: string;
  shortLabel: string;
  regionLabel: string;
  isNational: boolean;
  searchKeywords: string[];
  adultTiers: LeagueTierTemplate[];
  youthUpperTiers: LeagueTierTemplate[]; // A- & B-Jugend
  youthCTiers: LeagueTierTemplate[]; // C-Jugend
  youthDTiers: LeagueTierTemplate[]; // D-Jugend
  youthETiers: LeagueTierTemplate[]; // E-Jugend
}

export const GERMAN_FEDERATIONS: GermanFederationDefinition[] = [
  {
    code: "DHB",
    name: "Deutscher Handballbund (Bundesebene)",
    shortLabel: "DHB",
    regionLabel: "Bundesweit · 1.–3. Liga & JBLH",
    isNational: true,
    searchKeywords: [
      "dhb",
      "bundesliga",
      "hbl",
      "hbf",
      "jblh",
      "3. liga",
      "dritte liga",
      "deutschland",
      "bundesebene",
    ],
    adultTiers: [],
    youthUpperTiers: [],
    youthCTiers: [],
    youthDTiers: [],
    youthETiers: [],
  },
  {
    code: "HBW",
    name: "Handball Baden-Württemberg",
    shortLabel: "HBW",
    regionLabel: "Baden-Württemberg (Baden, Württemberg, Südbaden)",
    isNational: false,
    searchKeywords: [
      "baden",
      "wuerttemberg",
      "württemberg",
      "suedbaden",
      "südbaden",
      "hbw",
      "bhv",
      "hvw",
      "shv",
      "stuttgart",
      "karlsruhe",
      "freiburg",
      "mannheim",
    ],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Baden-Württemberg", shortName: "RL BW" },
      { key: "OL", tier: 5, name: "Oberliga Baden-Württemberg", shortName: "OL BW" },
      { key: "VL", tier: 6, name: "Verbandsliga", shortName: "VL" },
      { key: "LL", tier: 7, name: "Landesliga", shortName: "LL" },
      { key: "BOL", tier: 8, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 9, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 10, name: "Bezirksklasse", shortName: "BK" },
      { key: "KL", tier: 11, name: "Kreisliga", shortName: "KL" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Baden-Württemberg", shortName: "RL BW" },
      { key: "OL", tier: 5, name: "Oberliga Baden-Württemberg", shortName: "OL BW" },
      { key: "VL", tier: 6, name: "Verbandsliga", shortName: "VL" },
      { key: "BOL", tier: 8, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 9, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 10, name: "Bezirksklasse", shortName: "BK" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Baden-Württemberg", shortName: "OL BW" },
      { key: "VL", tier: 6, name: "Verbandsliga", shortName: "VL" },
      { key: "BOL", tier: 8, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 9, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 10, name: "Bezirksklasse", shortName: "BK" },
    ],
    youthDTiers: [
      { key: "BOL", tier: 8, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 9, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 10, name: "Bezirksklasse", shortName: "BK" },
    ],
    youthETiers: [
      { key: "BL", tier: 9, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 10, name: "Bezirksklasse", shortName: "BK" },
      { key: "SF", tier: 11, name: "Spieltage / Turnierform", shortName: "Spieltage" },
    ],
  },
  {
    code: "BHV",
    name: "Bayerischer Handball-Verband",
    shortLabel: "BHV",
    regionLabel: "Bayern",
    isNational: false,
    searchKeywords: [
      "bayern",
      "bayerischer",
      "bhv",
      "muenchen",
      "münchen",
      "nuernberg",
      "nürnberg",
      "augsburg",
      "franken",
      "schwaben",
    ],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Bayern", shortName: "RL BY" },
      { key: "OL", tier: 5, name: "Oberliga Bayern", shortName: "OL BY" },
      { key: "BOL", tier: 6, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 8, name: "Bezirksklasse", shortName: "BK" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Bayern", shortName: "RL BY" },
      { key: "OL", tier: 5, name: "Oberliga Bayern", shortName: "OL BY" },
      { key: "BOL", tier: 6, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 8, name: "Bezirksklasse", shortName: "BK" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Bayern", shortName: "OL BY" },
      { key: "BOL", tier: 6, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 8, name: "Bezirksklasse", shortName: "BK" },
    ],
    youthDTiers: [
      { key: "BOL", tier: 6, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 8, name: "Bezirksklasse", shortName: "BK" },
    ],
    youthETiers: [
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "BK", tier: 8, name: "Bezirksklasse", shortName: "BK" },
      { key: "SF", tier: 9, name: "Turnierform / Spieltage", shortName: "Turnier" },
    ],
  },
  {
    code: "HVBER",
    name: "Handball-Verband Berlin",
    shortLabel: "HVB Berlin",
    regionLabel: "Berlin",
    isNational: false,
    searchKeywords: ["berlin", "hvb", "ostsee-spree", "ostsee"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Ostsee-Spree", shortName: "RL OS" },
      { key: "OL", tier: 5, name: "Oberliga Berlin", shortName: "OL BE" },
      { key: "VL", tier: 6, name: "Verbandsliga Berlin", shortName: "VL BE" },
      { key: "LL", tier: 7, name: "Landesliga Berlin", shortName: "LL BE" },
      { key: "BL", tier: 8, name: "Bezirksliga Berlin", shortName: "BL BE" },
      { key: "KL", tier: 9, name: "Kreisliga Berlin", shortName: "KL BE" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Ostsee-Spree", shortName: "RL OS" },
      { key: "OL", tier: 5, name: "Oberliga Berlin", shortName: "OL BE" },
      { key: "VL", tier: 6, name: "Verbandsliga Berlin", shortName: "VL BE" },
      { key: "LL", tier: 7, name: "Landesliga Berlin", shortName: "LL BE" },
      { key: "BL", tier: 8, name: "Bezirksliga Berlin", shortName: "BL BE" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Berlin", shortName: "OL BE" },
      { key: "VL", tier: 6, name: "Verbandsliga Berlin", shortName: "VL BE" },
      { key: "LL", tier: 7, name: "Landesliga Berlin", shortName: "LL BE" },
      { key: "BL", tier: 8, name: "Bezirksliga Berlin", shortName: "BL BE" },
    ],
    youthDTiers: [
      { key: "VL", tier: 6, name: "Verbandsliga Berlin", shortName: "VL BE" },
      { key: "LL", tier: 7, name: "Landesliga Berlin", shortName: "LL BE" },
      { key: "BL", tier: 8, name: "Bezirksliga Berlin", shortName: "BL BE" },
    ],
    youthETiers: [
      { key: "LL", tier: 7, name: "Landesliga Berlin", shortName: "LL BE" },
      { key: "BL", tier: 8, name: "Bezirksliga Berlin", shortName: "BL BE" },
      { key: "SF", tier: 9, name: "Spielrunden Berlin", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVBB",
    name: "Handball-Verband Brandenburg",
    shortLabel: "HVB Brandenburg",
    regionLabel: "Brandenburg",
    isNational: false,
    searchKeywords: ["brandenburg", "potsdam", "cottbus", "ostsee-spree"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Ostsee-Spree", shortName: "RL OS" },
      { key: "OL", tier: 5, name: "Oberliga Brandenburg", shortName: "OL BB" },
      { key: "VL", tier: 6, name: "Verbandsliga Brandenburg", shortName: "VL BB" },
      { key: "LL", tier: 7, name: "Landesliga Brandenburg", shortName: "LL BB" },
      { key: "KL", tier: 8, name: "Kreisliga", shortName: "KL" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Ostsee-Spree", shortName: "RL OS" },
      { key: "OL", tier: 5, name: "Oberliga Brandenburg", shortName: "OL BB" },
      { key: "VL", tier: 6, name: "Verbandsliga Brandenburg", shortName: "VL BB" },
      { key: "LL", tier: 7, name: "Landesliga Brandenburg", shortName: "LL BB" },
      { key: "KL", tier: 8, name: "Kreisliga", shortName: "KL" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Brandenburg", shortName: "OL BB" },
      { key: "VL", tier: 6, name: "Verbandsliga Brandenburg", shortName: "VL BB" },
      { key: "LL", tier: 7, name: "Landesliga Brandenburg", shortName: "LL BB" },
      { key: "KL", tier: 8, name: "Kreisliga", shortName: "KL" },
    ],
    youthDTiers: [
      { key: "VL", tier: 6, name: "Verbandsliga Brandenburg", shortName: "VL BB" },
      { key: "LL", tier: 7, name: "Landesliga Brandenburg", shortName: "LL BB" },
      { key: "KL", tier: 8, name: "Kreisliga", shortName: "KL" },
    ],
    youthETiers: [
      { key: "LL", tier: 7, name: "Landesliga Brandenburg", shortName: "LL BB" },
      { key: "KL", tier: 8, name: "Kreisliga", shortName: "KL" },
      { key: "SF", tier: 9, name: "Spielrunden / Turniere", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HHV_HH",
    name: "Hamburger Handball-Verband",
    shortLabel: "HHV Hamburg",
    regionLabel: "Hamburg",
    isNational: false,
    searchKeywords: ["hamburg", "hamburger", "hhv", "nord"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Nord", shortName: "RL Nord" },
      { key: "OL", tier: 5, name: "Oberliga Hamburg/SH", shortName: "OL HH/SH" },
      { key: "HHL", tier: 6, name: "Hamburg-Liga", shortName: "HH-Liga" },
      { key: "LL", tier: 7, name: "Landesliga Hamburg", shortName: "LL HH" },
      { key: "BL", tier: 8, name: "Bezirksliga Hamburg", shortName: "BL HH" },
      { key: "KL", tier: 9, name: "Kreisliga Hamburg", shortName: "KL HH" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Nord", shortName: "RL Nord" },
      { key: "OL", tier: 5, name: "Oberliga Hamburg/SH", shortName: "OL HH/SH" },
      { key: "HHL", tier: 6, name: "Hamburg-Liga", shortName: "HH-Liga" },
      { key: "LL", tier: 7, name: "Landesliga Hamburg", shortName: "LL HH" },
      { key: "BL", tier: 8, name: "Bezirksliga Hamburg", shortName: "BL HH" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Hamburg/SH", shortName: "OL HH/SH" },
      { key: "HHL", tier: 6, name: "Hamburg-Liga", shortName: "HH-Liga" },
      { key: "LL", tier: 7, name: "Landesliga Hamburg", shortName: "LL HH" },
      { key: "BL", tier: 8, name: "Bezirksliga Hamburg", shortName: "BL HH" },
    ],
    youthDTiers: [
      { key: "HHL", tier: 6, name: "Hamburg-Liga", shortName: "HH-Liga" },
      { key: "LL", tier: 7, name: "Landesliga Hamburg", shortName: "LL HH" },
      { key: "BL", tier: 8, name: "Bezirksliga Hamburg", shortName: "BL HH" },
    ],
    youthETiers: [
      { key: "LL", tier: 7, name: "Landesliga Hamburg", shortName: "LL HH" },
      { key: "BL", tier: 8, name: "Bezirksliga Hamburg", shortName: "BL HH" },
      { key: "SF", tier: 9, name: "Spielrunden Hamburg", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HHV",
    name: "Hessischer Handball-Verband",
    shortLabel: "HHV Hessen",
    regionLabel: "Hessen",
    isNational: false,
    searchKeywords: ["hessen", "hessischer", "hhv", "frankfurt", "kassel", "darmstadt", "wiesbaden"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Hessen", shortName: "RL HE" },
      { key: "OL", tier: 5, name: "Oberliga Hessen", shortName: "OL HE" },
      { key: "LL", tier: 6, name: "Landesliga Hessen", shortName: "LL HE" },
      { key: "BOL", tier: 7, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BLA", tier: 8, name: "Bezirksliga A", shortName: "BL A" },
      { key: "BLB", tier: 9, name: "Bezirksliga B", shortName: "BL B" },
      { key: "BLC", tier: 10, name: "Bezirksliga C", shortName: "BL C" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Hessen", shortName: "RL HE" },
      { key: "OL", tier: 5, name: "Oberliga Hessen", shortName: "OL HE" },
      { key: "BOL", tier: 7, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BLA", tier: 8, name: "Bezirksliga A", shortName: "BL A" },
      { key: "BLB", tier: 9, name: "Bezirksliga B", shortName: "BL B" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Hessen", shortName: "OL HE" },
      { key: "BOL", tier: 7, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BLA", tier: 8, name: "Bezirksliga A", shortName: "BL A" },
      { key: "BLB", tier: 9, name: "Bezirksliga B", shortName: "BL B" },
    ],
    youthDTiers: [
      { key: "BOL", tier: 7, name: "Bezirksoberliga", shortName: "BOL" },
      { key: "BLA", tier: 8, name: "Bezirksliga A", shortName: "BL A" },
      { key: "BLB", tier: 9, name: "Bezirksliga B", shortName: "BL B" },
    ],
    youthETiers: [
      { key: "BLA", tier: 8, name: "Bezirksliga A", shortName: "BL A" },
      { key: "BLB", tier: 9, name: "Bezirksliga B", shortName: "BL B" },
      { key: "SF", tier: 10, name: "Spielrunden / Turnierform", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVMV",
    name: "Handballverband Mecklenburg-Vorpommern",
    shortLabel: "HVMV",
    regionLabel: "Mecklenburg-Vorpommern",
    isNational: false,
    searchKeywords: ["mecklenburg", "vorpommern", "mv", "hvmv", "rostock", "schwerin"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Ostsee-Spree", shortName: "RL OS" },
      { key: "OL", tier: 5, name: "Oberliga MV", shortName: "OL MV" },
      { key: "VL", tier: 6, name: "Verbandsliga MV", shortName: "VL MV" },
      { key: "BL", tier: 7, name: "Bezirksliga MV", shortName: "BL MV" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Ostsee-Spree", shortName: "RL OS" },
      { key: "OL", tier: 5, name: "Oberliga MV", shortName: "OL MV" },
      { key: "VL", tier: 6, name: "Verbandsliga MV", shortName: "VL MV" },
      { key: "BL", tier: 7, name: "Bezirksliga MV", shortName: "BL MV" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga MV", shortName: "OL MV" },
      { key: "VL", tier: 6, name: "Verbandsliga MV", shortName: "VL MV" },
      { key: "BL", tier: 7, name: "Bezirksliga MV", shortName: "BL MV" },
    ],
    youthDTiers: [
      { key: "VL", tier: 6, name: "Verbandsliga MV", shortName: "VL MV" },
      { key: "BL", tier: 7, name: "Bezirksliga MV", shortName: "BL MV" },
    ],
    youthETiers: [
      { key: "BL", tier: 7, name: "Bezirksliga MV", shortName: "BL MV" },
      { key: "SF", tier: 8, name: "Spielrunden MV", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVNB",
    name: "Handballverband Niedersachsen-Bremen",
    shortLabel: "HVNB",
    regionLabel: "Niedersachsen & Bremen",
    isNational: false,
    searchKeywords: [
      "niedersachsen",
      "bremen",
      "hvnb",
      "hvn",
      "hannover",
      "braunschweig",
      "oldenburg",
      "osnabrueck",
      "osnabrück",
      "goettingen",
      "göttingen",
    ],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Niedersachsen", shortName: "RL NI" },
      { key: "OL", tier: 5, name: "Oberliga Niedersachsen", shortName: "OL NI" },
      { key: "VL", tier: 6, name: "Verbandsliga Niedersachsen", shortName: "VL NI" },
      { key: "LL", tier: 7, name: "Landesliga", shortName: "LL" },
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "RK", tier: 10, name: "Regionsklasse", shortName: "RK" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Niedersachsen", shortName: "RL NI" },
      { key: "OL", tier: 5, name: "Oberliga Niedersachsen", shortName: "OL NI" },
      { key: "VL", tier: 6, name: "Verbandsliga Niedersachsen", shortName: "VL NI" },
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "RK", tier: 10, name: "Regionsklasse", shortName: "RK" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Niedersachsen", shortName: "OL NI" },
      { key: "VL", tier: 6, name: "Verbandsliga Niedersachsen", shortName: "VL NI" },
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "RK", tier: 10, name: "Regionsklasse", shortName: "RK" },
    ],
    youthDTiers: [
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "RK", tier: 10, name: "Regionsklasse", shortName: "RK" },
    ],
    youthETiers: [
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "RK", tier: 10, name: "Regionsklasse", shortName: "RK" },
      { key: "SF", tier: 11, name: "Spielrunden / Turnierform", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HNR",
    name: "Handball Nordrhein",
    shortLabel: "HNR Nordrhein",
    regionLabel: "NRW · Mittelrhein & Niederrhein",
    isNational: false,
    searchKeywords: [
      "nordrhein",
      "mittelrhein",
      "niederrhein",
      "nrw",
      "hnr",
      "hvm",
      "hvn",
      "koeln",
      "köln",
      "duesseldorf",
      "düsseldorf",
      "essen",
      "bonn",
      "aachen",
    ],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Nordrhein", shortName: "RL NR" },
      { key: "OL", tier: 5, name: "Oberliga Nordrhein", shortName: "OL NR" },
      { key: "VL", tier: 6, name: "Verbandsliga Nordrhein", shortName: "VL NR" },
      { key: "LL", tier: 7, name: "Landesliga Nordrhein", shortName: "LL NR" },
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 10, name: "Regionsklasse / Kreisliga", shortName: "KL" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Nordrhein", shortName: "RL NR" },
      { key: "OL", tier: 5, name: "Oberliga Nordrhein", shortName: "OL NR" },
      { key: "VL", tier: 6, name: "Verbandsliga Nordrhein", shortName: "VL NR" },
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 10, name: "Kreisliga", shortName: "KL" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Nordrhein", shortName: "OL NR" },
      { key: "VL", tier: 6, name: "Verbandsliga Nordrhein", shortName: "VL NR" },
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 10, name: "Kreisliga", shortName: "KL" },
    ],
    youthDTiers: [
      { key: "ROL", tier: 8, name: "Regionsoberliga", shortName: "ROL" },
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 10, name: "Kreisliga", shortName: "KL" },
    ],
    youthETiers: [
      { key: "RLG", tier: 9, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 10, name: "Kreisliga", shortName: "KL" },
      { key: "SF", tier: 11, name: "Spielrunden / Turniere", shortName: "Spielrunden" },
    ],
  },
  {
    code: "PFHV",
    name: "Pfälzer Handball-Verband",
    shortLabel: "PfHV",
    regionLabel: "Rheinland-Pfalz · Pfalz",
    isNational: false,
    searchKeywords: ["pfalz", "pfaelzer", "pfälzer", "pfhv", "rheinland-pfalz", "kaiserslautern", "ludwigshafen", "rps"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "PFL", tier: 6, name: "Pfalzliga", shortName: "Pfalzliga" },
      { key: "VL", tier: 7, name: "Verbandsliga Pfalz", shortName: "VL Pfalz" },
      { key: "BL", tier: 8, name: "Bezirksliga Pfalz", shortName: "BL Pfalz" },
      { key: "KL", tier: 9, name: "Kreisliga Pfalz", shortName: "KL Pfalz" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "PFL", tier: 6, name: "Pfalzliga", shortName: "Pfalzliga" },
      { key: "BL", tier: 8, name: "Bezirksliga Pfalz", shortName: "BL Pfalz" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "PFL", tier: 6, name: "Pfalzliga", shortName: "Pfalzliga" },
      { key: "BL", tier: 8, name: "Bezirksliga Pfalz", shortName: "BL Pfalz" },
    ],
    youthDTiers: [
      { key: "PFL", tier: 6, name: "Pfalzliga", shortName: "Pfalzliga" },
      { key: "BL", tier: 8, name: "Bezirksliga Pfalz", shortName: "BL Pfalz" },
      { key: "KL", tier: 9, name: "Kreisliga Pfalz", shortName: "KL Pfalz" },
    ],
    youthETiers: [
      { key: "BL", tier: 8, name: "Bezirksliga Pfalz", shortName: "BL Pfalz" },
      { key: "SF", tier: 9, name: "Spielrunden Pfalz", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVRH",
    name: "Handball-Verband Rheinhessen",
    shortLabel: "HVR Rheinhessen",
    regionLabel: "Rheinland-Pfalz · Rheinhessen",
    isNational: false,
    searchKeywords: ["rheinhessen", "mainz", "worms", "rheinland-pfalz", "rps"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "RHL", tier: 6, name: "Rheinhessenliga", shortName: "RH-Liga" },
      { key: "VL", tier: 7, name: "Verbandsliga Rheinhessen", shortName: "VL RH" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinhessen", shortName: "BL RH" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "RHL", tier: 6, name: "Rheinhessenliga", shortName: "RH-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinhessen", shortName: "BL RH" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "RHL", tier: 6, name: "Rheinhessenliga", shortName: "RH-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinhessen", shortName: "BL RH" },
    ],
    youthDTiers: [
      { key: "RHL", tier: 6, name: "Rheinhessenliga", shortName: "RH-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinhessen", shortName: "BL RH" },
    ],
    youthETiers: [
      { key: "BL", tier: 8, name: "Bezirksliga Rheinhessen", shortName: "BL RH" },
      { key: "SF", tier: 9, name: "Spielrunden Rheinhessen", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVR",
    name: "Handball-Verband Rheinland",
    shortLabel: "HVR Rheinland",
    regionLabel: "Rheinland-Pfalz · Rheinland",
    isNational: false,
    searchKeywords: ["rheinland", "koblenz", "trier", "rheinland-pfalz", "rps"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "RLL", tier: 6, name: "Rheinlandliga", shortName: "RL-Liga" },
      { key: "VL", tier: 7, name: "Verbandsliga Rheinland", shortName: "VL RL" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinland", shortName: "BL RL" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "RLL", tier: 6, name: "Rheinlandliga", shortName: "RL-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinland", shortName: "BL RL" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "RLL", tier: 6, name: "Rheinlandliga", shortName: "RL-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinland", shortName: "BL RL" },
    ],
    youthDTiers: [
      { key: "RLL", tier: 6, name: "Rheinlandliga", shortName: "RL-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Rheinland", shortName: "BL RL" },
    ],
    youthETiers: [
      { key: "BL", tier: 8, name: "Bezirksliga Rheinland", shortName: "BL RL" },
      { key: "SF", tier: 9, name: "Spielrunden Rheinland", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVSAAR",
    name: "Handball-Verband Saar",
    shortLabel: "HVS Saar",
    regionLabel: "Saarland",
    isNational: false,
    searchKeywords: ["saar", "saarland", "saarbruecken", "saarbrücken", "rps"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "SLL", tier: 6, name: "Saarlandliga", shortName: "SL-Liga" },
      { key: "VL", tier: 7, name: "Verbandsliga Saar", shortName: "VL Saar" },
      { key: "BL", tier: 8, name: "Bezirksliga Saar", shortName: "BL Saar" },
      { key: "KL", tier: 9, name: "Kreisliga Saar", shortName: "KL Saar" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Südwest", shortName: "RL SW" },
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "SLL", tier: 6, name: "Saarlandliga", shortName: "SL-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Saar", shortName: "BL Saar" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga RPS", shortName: "OL RPS" },
      { key: "SLL", tier: 6, name: "Saarlandliga", shortName: "SL-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Saar", shortName: "BL Saar" },
    ],
    youthDTiers: [
      { key: "SLL", tier: 6, name: "Saarlandliga", shortName: "SL-Liga" },
      { key: "BL", tier: 8, name: "Bezirksliga Saar", shortName: "BL Saar" },
    ],
    youthETiers: [
      { key: "BL", tier: 8, name: "Bezirksliga Saar", shortName: "BL Saar" },
      { key: "SF", tier: 9, name: "Spielrunden Saar", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVS",
    name: "Handball-Verband Sachsen",
    shortLabel: "HVS Sachsen",
    regionLabel: "Sachsen",
    isNational: false,
    searchKeywords: ["sachsen", "leipzig", "dresden", "chemnitz", "hvs", "mitteldeutschland", "mhv"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Mitteldeutschland", shortName: "RL MD" },
      { key: "OL", tier: 5, name: "Oberliga Sachsen", shortName: "OL SN" },
      { key: "VL", tier: 6, name: "Verbandsliga Sachsen", shortName: "VL SN" },
      { key: "BL", tier: 7, name: "Bezirksliga Sachsen", shortName: "BL SN" },
      { key: "KL", tier: 8, name: "Kreisliga Sachsen", shortName: "KL SN" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Mitteldeutschland", shortName: "RL MD" },
      { key: "OL", tier: 5, name: "Oberliga Sachsen", shortName: "OL SN" },
      { key: "VL", tier: 6, name: "Verbandsliga Sachsen", shortName: "VL SN" },
      { key: "BL", tier: 7, name: "Bezirksliga Sachsen", shortName: "BL SN" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Sachsen", shortName: "OL SN" },
      { key: "VL", tier: 6, name: "Verbandsliga Sachsen", shortName: "VL SN" },
      { key: "BL", tier: 7, name: "Bezirksliga Sachsen", shortName: "BL SN" },
    ],
    youthDTiers: [
      { key: "BL", tier: 7, name: "Bezirksliga Sachsen", shortName: "BL SN" },
      { key: "KL", tier: 8, name: "Kreisliga Sachsen", shortName: "KL SN" },
    ],
    youthETiers: [
      { key: "BL", tier: 7, name: "Bezirksliga Sachsen", shortName: "BL SN" },
      { key: "KL", tier: 8, name: "Kreisliga Sachsen", shortName: "KL SN" },
      { key: "SF", tier: 9, name: "Spielrunden Sachsen", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVSA",
    name: "Handball-Verband Sachsen-Anhalt",
    shortLabel: "HVSA",
    regionLabel: "Sachsen-Anhalt",
    isNational: false,
    searchKeywords: ["sachsen-anhalt", "magdeburg", "halle", "hvsa", "mitteldeutschland", "mhv"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Mitteldeutschland", shortName: "RL MD" },
      { key: "OL", tier: 5, name: "Oberliga Sachsen-Anhalt", shortName: "OL ST" },
      { key: "VL", tier: 6, name: "Verbandsliga Sachsen-Anhalt", shortName: "VL ST" },
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "KL", tier: 8, name: "Kreisliga", shortName: "KL" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Mitteldeutschland", shortName: "RL MD" },
      { key: "OL", tier: 5, name: "Oberliga Sachsen-Anhalt", shortName: "OL ST" },
      { key: "VL", tier: 6, name: "Verbandsliga Sachsen-Anhalt", shortName: "VL ST" },
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Sachsen-Anhalt", shortName: "OL ST" },
      { key: "VL", tier: 6, name: "Verbandsliga Sachsen-Anhalt", shortName: "VL ST" },
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
    ],
    youthDTiers: [
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "KL", tier: 8, name: "Kreisliga", shortName: "KL" },
    ],
    youthETiers: [
      { key: "BL", tier: 7, name: "Bezirksliga", shortName: "BL" },
      { key: "SF", tier: 8, name: "Spielrunden / Turnierform", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVSH",
    name: "Handballverband Schleswig-Holstein",
    shortLabel: "HVSH",
    regionLabel: "Schleswig-Holstein",
    isNational: false,
    searchKeywords: ["schleswig", "holstein", "hvsh", "kiel", "flensburg", "luebeck", "lübeck", "nord"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Nord", shortName: "RL Nord" },
      { key: "OL", tier: 5, name: "Oberliga Schleswig-Holstein", shortName: "OL SH" },
      { key: "SHL", tier: 6, name: "Schleswig-Holstein-Liga", shortName: "SH-Liga" },
      { key: "LL", tier: 7, name: "Landesliga", shortName: "LL" },
      { key: "RLG", tier: 8, name: "Regionsliga / Kreisoberliga", shortName: "RLG/KOL" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Nord", shortName: "RL Nord" },
      { key: "OL", tier: 5, name: "Oberliga Schleswig-Holstein", shortName: "OL SH" },
      { key: "SHL", tier: 6, name: "Schleswig-Holstein-Liga", shortName: "SH-Liga" },
      { key: "RLG", tier: 8, name: "Regionsliga / Kreisoberliga", shortName: "RLG" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Schleswig-Holstein", shortName: "OL SH" },
      { key: "SHL", tier: 6, name: "Schleswig-Holstein-Liga", shortName: "SH-Liga" },
      { key: "RLG", tier: 8, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
    ],
    youthDTiers: [
      { key: "RLG", tier: 8, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
    ],
    youthETiers: [
      { key: "RLG", tier: 8, name: "Regionsliga", shortName: "RLG" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
      { key: "SF", tier: 10, name: "Spielrunden / Turnierform", shortName: "Spielrunden" },
    ],
  },
  {
    code: "THV",
    name: "Thüringer Handball-Verband",
    shortLabel: "THV",
    regionLabel: "Thüringen",
    isNational: false,
    searchKeywords: ["thueringen", "thüringen", "thv", "erfurt", "jena", "eisenach", "mitteldeutschland", "mhv"],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Mitteldeutschland", shortName: "RL MD" },
      { key: "OL", tier: 5, name: "Oberliga Thüringen", shortName: "OL TH" },
      { key: "VL", tier: 6, name: "Verbandsliga Thüringen", shortName: "VL TH" },
      { key: "LL", tier: 7, name: "Landesliga Thüringen", shortName: "LL TH" },
      { key: "BL", tier: 8, name: "Bezirksliga / Regionsoberliga", shortName: "BL/ROL" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Mitteldeutschland", shortName: "RL MD" },
      { key: "OL", tier: 5, name: "Oberliga Thüringen", shortName: "OL TH" },
      { key: "VL", tier: 6, name: "Verbandsliga Thüringen", shortName: "VL TH" },
      { key: "LL", tier: 7, name: "Landesliga Thüringen", shortName: "LL TH" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Thüringen", shortName: "OL TH" },
      { key: "VL", tier: 6, name: "Verbandsliga Thüringen", shortName: "VL TH" },
      { key: "LL", tier: 7, name: "Landesliga Thüringen", shortName: "LL TH" },
    ],
    youthDTiers: [
      { key: "LL", tier: 7, name: "Landesliga Thüringen", shortName: "LL TH" },
      { key: "BL", tier: 8, name: "Bezirksliga / Regionsliga", shortName: "BL" },
    ],
    youthETiers: [
      { key: "BL", tier: 8, name: "Bezirksliga / Regionsliga", shortName: "BL" },
      { key: "SF", tier: 9, name: "Spielrunden Thüringen", shortName: "Spielrunden" },
    ],
  },
  {
    code: "HVW",
    name: "Handball-Verband Westfalen",
    shortLabel: "HVW Westfalen",
    regionLabel: "NRW · Westfalen",
    isNational: false,
    searchKeywords: [
      "westfalen",
      "nrw",
      "hvw",
      "dortmund",
      "bielefeld",
      "muenster",
      "münster",
      "minden",
      "lemgo",
      "bochum",
      "paderborn",
    ],
    adultTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Westfalen", shortName: "RL WF" },
      { key: "OL", tier: 5, name: "Oberliga Westfalen", shortName: "OL WF" },
      { key: "VL", tier: 6, name: "Verbandsliga Westfalen", shortName: "VL WF" },
      { key: "LL", tier: 7, name: "Landesliga Westfalen", shortName: "LL WF" },
      { key: "BL", tier: 8, name: "Bezirksliga", shortName: "BL" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
      { key: "KK", tier: 10, name: "Kreisklasse", shortName: "KK" },
    ],
    youthUpperTiers: [
      { key: "RL", tier: 4, name: "Regionalliga Westfalen", shortName: "RL WF" },
      { key: "OL", tier: 5, name: "Oberliga Westfalen", shortName: "OL WF" },
      { key: "VL", tier: 6, name: "Verbandsliga Westfalen", shortName: "VL WF" },
      { key: "BL", tier: 8, name: "Bezirksliga", shortName: "BL" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
    ],
    youthCTiers: [
      { key: "OL", tier: 5, name: "Oberliga Westfalen", shortName: "OL WF" },
      { key: "VL", tier: 6, name: "Verbandsliga Westfalen", shortName: "VL WF" },
      { key: "BL", tier: 8, name: "Bezirksliga", shortName: "BL" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
    ],
    youthDTiers: [
      { key: "BL", tier: 8, name: "Bezirksliga", shortName: "BL" },
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
      { key: "KK", tier: 10, name: "Kreisklasse", shortName: "KK" },
    ],
    youthETiers: [
      { key: "KL", tier: 9, name: "Kreisliga", shortName: "KL" },
      { key: "KK", tier: 10, name: "Kreisklasse", shortName: "KK" },
      { key: "SF", tier: 11, name: "Spielrunden / Turniere", shortName: "Spielrunden" },
    ],
  },
];

export const GERMAN_FEDERATION_BY_CODE: ReadonlyMap<
  string,
  GermanFederationDefinition
> = new Map(GERMAN_FEDERATIONS.map((f) => [f.code, f]));

export interface GermanLeagueSeedEntry {
  code: string;
  countryCode: "DE";
  federationCode: string;
  federationName: string;
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
  tier: number;
  name: string;
  shortName: string;
  displayName: string;
}

function makeDisplayName(
  leagueName: string,
  federationShort: string,
  ageGroup: LeagueAgeGroup,
  gender: TeamGender,
  isNational: boolean
): string {
  const prefix = getAgeGroupPrefix(ageGroup, gender);
  if (isNational) {
    return `${leagueName} (${prefix})`;
  }
  return `${leagueName} (${federationShort} · ${prefix})`;
}

/**
 * Erzeugt den vollständigen, deterministischen Katalog aller gängigen deutschen
 * Handballligen von der 1. Bundesliga bis zur Kreisklasse / Minis über alle
 * DHB-Landesverbände.
 */
export function buildGermanLeaguesCatalog(): GermanLeagueSeedEntry[] {
  const entries: GermanLeagueSeedEntry[] = [];

  const dhb = GERMAN_FEDERATION_BY_CODE.get("DHB")!;

  // 1. DHB Bundesebene – Aktive Männer
  const dhbAdultMale: LeagueTierTemplate[] = [
    { key: "HBL1", tier: 1, name: "1. Handball-Bundesliga (HBL)", shortName: "1. HBL" },
    { key: "HBL2", tier: 2, name: "2. Handball-Bundesliga", shortName: "2. HBL" },
    { key: "L3_NO", tier: 3, name: "3. Liga Staffel Nord-Ost", shortName: "3. Liga NO" },
    { key: "L3_NW", tier: 3, name: "3. Liga Staffel Nord-West", shortName: "3. Liga NW" },
    { key: "L3_SW", tier: 3, name: "3. Liga Staffel Süd-West", shortName: "3. Liga SW" },
    { key: "L3_S", tier: 3, name: "3. Liga Staffel Süd", shortName: "3. Liga S" },
  ];

  for (const t of dhbAdultMale) {
    entries.push({
      code: `DE-DHB-ADULT-MALE-${t.key}`,
      countryCode: "DE",
      federationCode: dhb.code,
      federationName: dhb.name,
      ageGroup: "ADULT",
      gender: "MALE",
      tier: t.tier,
      name: t.name,
      shortName: t.shortName,
      displayName: makeDisplayName(t.name, dhb.shortLabel, "ADULT", "MALE", true),
    });
  }

  // 2. DHB Bundesebene – Aktive Frauen
  const dhbAdultFemale: LeagueTierTemplate[] = [
    { key: "HBF1", tier: 1, name: "1. Handball-Bundesliga Frauen (HBF)", shortName: "1. HBF" },
    { key: "HBF2", tier: 2, name: "2. Handball-Bundesliga Frauen", shortName: "2. HBF" },
    { key: "L3_NO", tier: 3, name: "3. Liga Frauen Staffel Nord-Ost", shortName: "3. Liga NO" },
    { key: "L3_NW", tier: 3, name: "3. Liga Frauen Staffel Nord-West", shortName: "3. Liga NW" },
    { key: "L3_SW", tier: 3, name: "3. Liga Frauen Staffel Süd-West", shortName: "3. Liga SW" },
    { key: "L3_S", tier: 3, name: "3. Liga Frauen Staffel Süd", shortName: "3. Liga S" },
  ];

  for (const t of dhbAdultFemale) {
    entries.push({
      code: `DE-DHB-ADULT-FEMALE-${t.key}`,
      countryCode: "DE",
      federationCode: dhb.code,
      federationName: dhb.name,
      ageGroup: "ADULT",
      gender: "FEMALE",
      tier: t.tier,
      name: t.name,
      shortName: t.shortName,
      displayName: makeDisplayName(t.name, dhb.shortLabel, "ADULT", "FEMALE", true),
    });
  }

  // 3. DHB Bundesebene – Jugend-Bundesliga (A- & B-Jugend)
  const dhbYouth: Array<{
    ageGroup: LeagueAgeGroup;
    gender: TeamGender;
    key: string;
    tier: number;
    name: string;
    shortName: string;
  }> = [
    {
      ageGroup: "YOUTH_A",
      gender: "MALE",
      key: "JBLH1",
      tier: 1,
      name: "1. Jugend-Bundesliga Handball (JBLH)",
      shortName: "1. JBLH",
    },
    {
      ageGroup: "YOUTH_A",
      gender: "MALE",
      key: "JBLH2",
      tier: 2,
      name: "2. Jugend-Bundesliga Handball (JBLH)",
      shortName: "2. JBLH",
    },
    {
      ageGroup: "YOUTH_A",
      gender: "FEMALE",
      key: "JBLH",
      tier: 1,
      name: "Jugend-Bundesliga Handball (JBLH)",
      shortName: "JBLH",
    },
    {
      ageGroup: "YOUTH_B",
      gender: "MALE",
      key: "JBLH",
      tier: 1,
      name: "Jugend-Bundesliga Handball (JBLH)",
      shortName: "JBLH",
    },
    {
      ageGroup: "YOUTH_B",
      gender: "FEMALE",
      key: "JBLH",
      tier: 1,
      name: "Jugend-Bundesliga Handball (JBLH)",
      shortName: "JBLH",
    },
  ];

  for (const y of dhbYouth) {
    entries.push({
      code: `DE-DHB-${y.ageGroup}-${y.gender}-${y.key}`,
      countryCode: "DE",
      federationCode: dhb.code,
      federationName: dhb.name,
      ageGroup: y.ageGroup,
      gender: y.gender,
      tier: y.tier,
      name: y.name,
      shortName: y.shortName,
      displayName: makeDisplayName(y.name, dhb.shortLabel, y.ageGroup, y.gender, true),
    });
  }

  // 4. Alle Landesverbände: Erwachsene, A- bis E-Jugend, Minis, Senioren/Freizeit
  const regionalFederations = GERMAN_FEDERATIONS.filter((f) => !f.isNational);

  for (const fed of regionalFederations) {
    const pushTiers = (
      ageGroup: LeagueAgeGroup,
      genders: TeamGender[],
      tiers: LeagueTierTemplate[]
    ) => {
      for (const gender of genders) {
        for (const t of tiers) {
          entries.push({
            code: `DE-${fed.code}-${ageGroup}-${gender}-${t.key}`,
            countryCode: "DE",
            federationCode: fed.code,
            federationName: fed.name,
            ageGroup,
            gender,
            tier: t.tier,
            name: t.name,
            shortName: t.shortName,
            displayName: makeDisplayName(
              t.name,
              fed.shortLabel,
              ageGroup,
              gender,
              false
            ),
          });
        }
      }
    };

    pushTiers("ADULT", ["MALE", "FEMALE"], fed.adultTiers);
    pushTiers("YOUTH_A", ["MALE", "FEMALE"], fed.youthUpperTiers);
    pushTiers("YOUTH_B", ["MALE", "FEMALE"], fed.youthUpperTiers);
    pushTiers("YOUTH_C", ["MALE", "FEMALE"], fed.youthCTiers);
    pushTiers("YOUTH_D", ["MALE", "FEMALE", "MIXED"], fed.youthDTiers);
    pushTiers("YOUTH_E", ["MALE", "FEMALE", "MIXED"], fed.youthETiers);

    // F-Jugend / Minis (Spielfeste / Turnierbetrieb)
    pushTiers("YOUTH_F_MINI", ["MIXED"], [
      {
        key: "MINI_FORT",
        tier: 10,
        name: "Spielfeste / Turnierbetrieb (Fortgeschrittene)",
        shortName: "Minis Fortg.",
      },
      {
        key: "MINI_ANF",
        tier: 11,
        name: "Spielfeste / Turnierbetrieb (Anfänger)",
        shortName: "Minis Anf.",
      },
    ]);

    // Senioren & Freizeit
    pushTiers("SENIOR", ["MALE", "FEMALE", "MIXED"], [
      {
        key: "SEN_LIGA",
        tier: 8,
        name: "Seniorenliga / Ü32–Ü40",
        shortName: "Ü32/Ü40",
      },
      {
        key: "HOBBY",
        tier: 12,
        name: "Freizeit- & Hobbyliga",
        shortName: "Freizeit",
      },
    ]);
  }

  return entries;
}
