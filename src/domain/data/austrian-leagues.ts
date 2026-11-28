import { TeamGender } from "../schemas/handball";
import { LeagueAgeGroup } from "../schemas/league-catalog";

export interface LeagueCatalogSeedEntry {
  code: string;
  countryCode: string;
  federationCode: string;
  federationName: string;
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
  tier: number;
  name: string;
  shortName: string | null;
  displayName: string;
}

interface AustrianTierDef {
  key: string;
  tier: number;
  name: string;
  shortName: string;
}

const OEHB_ADULT_MALE_TIERS: AustrianTierDef[] = [
  { key: "HLA1", tier: 1, name: "HLA MEISTERLIGA", shortName: "HLA 1" },
  { key: "HLA2", tier: 2, name: "HLA CHALLENGE", shortName: "HLA 2" },
  { key: "RL", tier: 3, name: "Regionalliga", shortName: "RL" },
  { key: "LL", tier: 4, name: "Landesliga", shortName: "LL" },
  { key: "KL", tier: 5, name: "Klasse / Bezirksliga", shortName: "KL" },
];

const OEHB_ADULT_FEMALE_TIERS: AustrianTierDef[] = [
  { key: "WHA1", tier: 1, name: "WHA MEISTERLIGA", shortName: "WHA 1" },
  { key: "WHA2", tier: 2, name: "WHA CHALLENGE", shortName: "WHA 2" },
  { key: "RL", tier: 3, name: "Regionalliga", shortName: "RL" },
  { key: "LL", tier: 4, name: "Landesliga", shortName: "LL" },
  { key: "KL", tier: 5, name: "Klasse / Bezirksliga", shortName: "KL" },
];

const OEHB_YOUTH_TIERS: AustrianTierDef[] = [
  { key: "ELITE", tier: 1, name: "Elite Cup / Meisterliga", shortName: "Elite" },
  { key: "LL", tier: 2, name: "Landesliga / Meisterschaft", shortName: "LL" },
  { key: "KL", tier: 3, name: "Regional- / Bezirksklasse", shortName: "KL" },
];

/**
 * Erzeugt die Stammdaten für Österreich (ÖHB, countryCode = "AT") im selben
 * Katalogformat wie Deutschland – Basis für den mehrsprachigen/europäischen Ausbau.
 */
export function buildAustrianLeaguesCatalog(): LeagueCatalogSeedEntry[] {
  const entries: LeagueCatalogSeedEntry[] = [];
  const countryCode = "AT";
  const federationCode = "OEHB";
  const federationName = "Österreichischer Handballbund (ÖHB)";

  for (const t of OEHB_ADULT_MALE_TIERS) {
    entries.push({
      code: `AT-OEHB-ADULT-MALE-${t.key}`,
      countryCode,
      federationCode,
      federationName,
      ageGroup: "ADULT",
      gender: "MALE",
      tier: t.tier,
      name: t.name,
      shortName: t.shortName,
      displayName: `${t.name} (ÖHB)`,
    });
  }

  for (const t of OEHB_ADULT_FEMALE_TIERS) {
    entries.push({
      code: `AT-OEHB-ADULT-FEMALE-${t.key}`,
      countryCode,
      federationCode,
      federationName,
      ageGroup: "ADULT",
      gender: "FEMALE",
      tier: t.tier,
      name: t.name,
      shortName: t.shortName,
      displayName: `${t.name} (ÖHB)`,
    });
  }

  const youthGroups: Array<{
    ageGroup: LeagueAgeGroup;
    genders: TeamGender[];
  }> = [
    { ageGroup: "YOUTH_A", genders: ["MALE", "FEMALE"] },
    { ageGroup: "YOUTH_B", genders: ["MALE", "FEMALE"] },
    { ageGroup: "YOUTH_C", genders: ["MALE", "FEMALE"] },
    { ageGroup: "YOUTH_D", genders: ["MALE", "FEMALE", "MIXED"] },
    { ageGroup: "YOUTH_E", genders: ["MALE", "FEMALE", "MIXED"] },
    { ageGroup: "YOUTH_F_MINI", genders: ["MIXED"] },
  ];

  for (const yg of youthGroups) {
    for (const gender of yg.genders) {
      for (const t of OEHB_YOUTH_TIERS) {
        entries.push({
          code: `AT-OEHB-${yg.ageGroup}-${gender}-${t.key}`,
          countryCode,
          federationCode,
          federationName,
          ageGroup: yg.ageGroup,
          gender,
          tier: t.tier,
          name: t.name,
          shortName: t.shortName,
          displayName: `${t.name} (ÖHB)`,
        });
      }
    }
  }

  return entries;
}
