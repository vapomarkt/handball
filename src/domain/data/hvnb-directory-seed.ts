import { TeamGender } from "../schemas/handball";
import { LeagueAgeGroup } from "../schemas/league-catalog";

export interface HvnbRegionMeta {
  code: string;
  name: string;
  shortLabel: string;
  championshipPrefix: string;
}

export interface HvnbDirectoryTeamSeed {
  externalTeamId: string;
  name: string;
  clubName: string;
  shortName?: string | null;
  icalUrl?: string | null;
  externalUrl?: string | null;
}

export interface HvnbDirectoryGroupSeed {
  code: string;
  federationCode: "HVNB";
  regionCode: string;
  regionName: string;
  seasonName: string;
  leagueCode: string;
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
  name: string;
  shortName?: string | null;
  externalProvider: "HVNB_NULIGA";
  externalGroupId?: string | null;
  externalUrl?: string | null;
  teams: HvnbDirectoryTeamSeed[];
}

export const HVNB_REGIONS: readonly HvnbRegionMeta[] = [
  {
    code: "HVNB",
    name: "HVNB Verbandsebene (Niedersachsen & Bremen)",
    shortLabel: "HVNB Verband",
    championshipPrefix: "HVNB",
  },
  {
    code: "HRLU",
    name: "Handballregion Lüneburg-Stade",
    shortLabel: "HR Lüneburg-Stade",
    championshipPrefix: "HRLU",
  },
  {
    code: "HRHA",
    name: "Handballregion Hannover",
    shortLabel: "HR Hannover",
    championshipPrefix: "HRHA",
  },
  {
    code: "HRSON",
    name: "Handballregion Süd-Ost Niedersachsen",
    shortLabel: "HR Süd-Ost NI",
    championshipPrefix: "HRSON",
  },
  {
    code: "HRWN",
    name: "Handballregion West Niedersachsen",
    shortLabel: "HR West NI",
    championshipPrefix: "HRWN",
  },
  {
    code: "HROL",
    name: "Handballregion Oldenburg",
    shortLabel: "HR Oldenburg",
    championshipPrefix: "HROL",
  },
  {
    code: "HRBN",
    name: "Handballregion Bremen-Nordsee",
    shortLabel: "HR Bremen-Nordsee",
    championshipPrefix: "HRBN",
  },
  {
    code: "HROF",
    name: "Handballregion Ostfriesland",
    shortLabel: "HR Ostfriesland",
    championshipPrefix: "HROF",
  },
  {
    code: "HREJ",
    name: "Handballregion Ems-Jade",
    shortLabel: "HR Ems-Jade",
    championshipPrefix: "HREJ",
  },
  {
    code: "HRWE",
    name: "Handballregion Weser-Ems",
    shortLabel: "HR Weser-Ems",
    championshipPrefix: "HRWE",
  },
  {
    code: "HRSN",
    name: "Handballregion Südniedersachsen",
    shortLabel: "HR Südniedersachsen",
    championshipPrefix: "HRSN",
  },
  {
    code: "HRMN",
    name: "Handballregion Mitte Niedersachsen",
    shortLabel: "HR Mitte NI",
    championshipPrefix: "HRMN",
  },
  {
    code: "HREW",
    name: "Handballregion Elbe-Weser",
    shortLabel: "HR Elbe-Weser",
    championshipPrefix: "HREW",
  },
] as const;

export const HVNB_MJD_HOLLENSTEDT_ICAL_URL =
  "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/getTeamMeetingsWebcal?teamid=1762852&token=SqIaa%2F8DKoU%3D";

/**
 * Kuratiertes HVNB-Startverzeichnis für die Saison 2026/27.
 * Kann jederzeit durch einen externen HVNB-/handball.net-Feed über `HVNB_DIRECTORY_FEED_URL`
 * ergänzt oder ersetzt werden (idempotenter Upsert über `code` und `externalTeamId`).
 */
export function buildHvnbDirectorySeed(): HvnbDirectoryGroupSeed[] {
  return [
    {
      code: "HVNB-2627-HRLU-MJD-ROL-NORD",
      federationCode: "HVNB",
      regionCode: "HRLU",
      regionName: "Handballregion Lüneburg-Stade",
      seasonName: "2026/27",
      leagueCode: "DE-HVNB-YOUTH_D-MALE-ROL",
      ageGroup: "YOUTH_D",
      gender: "MALE",
      name: "Regionsoberliga männliche Jugend D Nord",
      shortName: "ROL MJD Nord",
      externalProvider: "HVNB_NULIGA",
      externalGroupId: "427189",
      externalUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/groupPage?championship=HRLU+26%2F27&group=427189",
      teams: [
        {
          externalTeamId: "1762852",
          name: "TuS Jahn Hollenstedt",
          clubName: "TuS Jahn Hollenstedt",
          shortName: "TuS Jahn",
          icalUrl: HVNB_MJD_HOLLENSTEDT_ICAL_URL,
          externalUrl:
            "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?team=1762852",
        },
        {
          externalTeamId: "1762853",
          name: "HL Buchholz 08 - Rosengarten II",
          clubName: "HL Buchholz 08-Rosengarten",
          shortName: "HL Buchholz II",
        },
        {
          externalTeamId: "1762854",
          name: "JSG Fredenbeck/Stade/Harsefeld (S)",
          clubName: "JSG Fredenbeck/Stade/Harsefeld",
          shortName: "JSG Fredenbeck",
        },
        {
          externalTeamId: "1762855",
          name: "mJSG Buxtehude/ Beckdorf (Bux)",
          clubName: "mJSG Buxtehude/Beckdorf",
          shortName: "mJSG Buxtehude",
        },
        {
          externalTeamId: "1762856",
          name: "SG Luhdorf-Scharmbeck",
          clubName: "SG Luhdorf-Scharmbeck",
          shortName: "SG Luhdorf",
        },
        {
          externalTeamId: "1762857",
          name: "HSG Seevetal",
          clubName: "HSG Seevetal",
          shortName: "HSG Seevetal",
        },
        {
          externalTeamId: "1762858",
          name: "MTV Tostedt",
          clubName: "MTV Tostedt",
          shortName: "MTV Tostedt",
        },
        {
          externalTeamId: "1762859",
          name: "TSV Eintracht Hittfeld",
          clubName: "TSV Eintracht Hittfeld",
          shortName: "TSV Hittfeld",
        },
      ],
    },
    {
      code: "HVNB-2627-HRLU-ADULT-MALE-ROL",
      federationCode: "HVNB",
      regionCode: "HRLU",
      regionName: "Handballregion Lüneburg-Stade",
      seasonName: "2026/27",
      leagueCode: "DE-HVNB-ADULT-MALE-ROL",
      ageGroup: "ADULT",
      gender: "MALE",
      name: "Regionsoberliga Männer Lüneburg-Stade",
      shortName: "ROL M HRLU",
      externalProvider: "HVNB_NULIGA",
      externalGroupId: "427110",
      externalUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=HRLU+26%2F27",
      teams: [
        {
          externalTeamId: "1761101",
          name: "TuS Jahn Hollenstedt",
          clubName: "TuS Jahn Hollenstedt",
          shortName: "TuS Jahn",
        },
        {
          externalTeamId: "1761102",
          name: "VfL Stade II",
          clubName: "VfL Stade",
          shortName: "VfL Stade II",
        },
        {
          externalTeamId: "1761103",
          name: "SV Beckdorf II",
          clubName: "SV Beckdorf",
          shortName: "SV Beckdorf II",
        },
        {
          externalTeamId: "1761104",
          name: "HSG Elbmarsch",
          clubName: "HSG Elbmarsch",
          shortName: "HSG Elbmarsch",
        },
        {
          externalTeamId: "1761105",
          name: "MTV Eyendorf",
          clubName: "MTV Eyendorf",
          shortName: "MTV Eyendorf",
        },
        {
          externalTeamId: "1761106",
          name: "HV Lüneburg II",
          clubName: "HV Lüneburg",
          shortName: "HV Lüneburg II",
        },
      ],
    },
    {
      code: "HVNB-2627-HVNB-ADULT-MALE-VL-NORD",
      federationCode: "HVNB",
      regionCode: "HVNB",
      regionName: "HVNB Verbandsebene (Niedersachsen & Bremen)",
      seasonName: "2026/27",
      leagueCode: "DE-HVNB-ADULT-MALE-VL",
      ageGroup: "ADULT",
      gender: "MALE",
      name: "Verbandsliga Männer Nord",
      shortName: "VL M Nord",
      externalProvider: "HVNB_NULIGA",
      externalGroupId: "426901",
      externalUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=HVNB+26%2F27",
      teams: [
        {
          externalTeamId: "1760101",
          name: "VfL Fredenbeck II",
          clubName: "VfL Fredenbeck",
          shortName: "Fredenbeck II",
        },
        {
          externalTeamId: "1760102",
          name: "SG Achim/Baden",
          clubName: "SG Achim/Baden",
          shortName: "Achim/Baden",
        },
        {
          externalTeamId: "1760103",
          name: "TSV Bremervörde",
          clubName: "TSV Bremervörde",
          shortName: "Bremervörde",
        },
        {
          externalTeamId: "1760104",
          name: "HSG Bützfleth/Drochtersen",
          clubName: "HSG Bützfleth/Drochtersen",
          shortName: "Bützfleth/D.",
        },
        {
          externalTeamId: "1760105",
          name: "TV Schiffdorf",
          clubName: "TV Schiffdorf",
          shortName: "Schiffdorf",
        },
        {
          externalTeamId: "1760106",
          name: "ATSV Habenhausen II",
          clubName: "ATSV Habenhausen",
          shortName: "Habenhausen II",
        },
      ],
    },
    {
      code: "HVNB-2627-HVNB-ADULT-FEMALE-OL-NORD",
      federationCode: "HVNB",
      regionCode: "HVNB",
      regionName: "HVNB Verbandsebene (Niedersachsen & Bremen)",
      seasonName: "2026/27",
      leagueCode: "DE-HVNB-ADULT-FEMALE-OL",
      ageGroup: "ADULT",
      gender: "FEMALE",
      name: "Oberliga Frauen Nord",
      shortName: "OL F Nord",
      externalProvider: "HVNB_NULIGA",
      externalGroupId: "426920",
      externalUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=HVNB+26%2F27",
      teams: [
        {
          externalTeamId: "1760201",
          name: "Buxtehuder SV III",
          clubName: "Buxtehuder SV",
          shortName: "BSV III",
        },
        {
          externalTeamId: "1760202",
          name: "VfL Stade",
          clubName: "VfL Stade",
          shortName: "VfL Stade",
        },
        {
          externalTeamId: "1760203",
          name: "TV Oyten II",
          clubName: "TV Oyten",
          shortName: "TV Oyten II",
        },
        {
          externalTeamId: "1760204",
          name: "SV Werder Bremen II",
          clubName: "SV Werder Bremen",
          shortName: "Werder II",
        },
        {
          externalTeamId: "1760205",
          name: "HL Buchholz 08-Rosengarten II",
          clubName: "HL Buchholz 08-Rosengarten",
          shortName: "Buchholz II",
        },
      ],
    },
    {
      code: "HVNB-2627-HRHA-ADULT-MALE-ROL",
      federationCode: "HVNB",
      regionCode: "HRHA",
      regionName: "Handballregion Hannover",
      seasonName: "2026/27",
      leagueCode: "DE-HVNB-ADULT-MALE-ROL",
      ageGroup: "ADULT",
      gender: "MALE",
      name: "Regionsoberliga Männer Hannover",
      shortName: "ROL M Hannover",
      externalProvider: "HVNB_NULIGA",
      externalGroupId: "427310",
      externalUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=HRHA+26%2F27",
      teams: [
        {
          externalTeamId: "1763101",
          name: "TSV Anderten III",
          clubName: "TSV Anderten",
          shortName: "Anderten III",
        },
        {
          externalTeamId: "1763102",
          name: "TV Hannover-Badenstedt",
          clubName: "TV Hannover-Badenstedt",
          shortName: "Badenstedt",
        },
        {
          externalTeamId: "1763103",
          name: "HSG Hannover-West",
          clubName: "HSG Hannover-West",
          shortName: "Hannover-West",
        },
        {
          externalTeamId: "1763104",
          name: "TuS Bothfeld 04",
          clubName: "TuS Bothfeld 04",
          shortName: "Bothfeld",
        },
        {
          externalTeamId: "1763105",
          name: "SG Misburg",
          clubName: "SG Misburg",
          shortName: "SG Misburg",
        },
      ],
    },
    {
      code: "HVNB-2627-HVNB-MJC-OL-NORDOST",
      federationCode: "HVNB",
      regionCode: "HVNB",
      regionName: "HVNB Verbandsebene (Niedersachsen & Bremen)",
      seasonName: "2026/27",
      leagueCode: "DE-HVNB-YOUTH_C-MALE-OL",
      ageGroup: "YOUTH_C",
      gender: "MALE",
      name: "Oberliga MJC Nordost",
      shortName: "OL MJC NO",
      externalProvider: "HVNB_NULIGA",
      externalGroupId: "426955",
      externalUrl:
        "https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/leaguePage?championship=HVNB+26%2F27",
      teams: [
        {
          externalTeamId: "1760501",
          name: "JSG Fredenbeck/Stade",
          clubName: "JSG Fredenbeck/Stade",
          shortName: "JSG Fredenbeck",
        },
        {
          externalTeamId: "1760502",
          name: "TSV Burgdorf II",
          clubName: "TSV Burgdorf",
          shortName: "Burgdorf II",
        },
        {
          externalTeamId: "1760503",
          name: "HV Lüneburg",
          clubName: "HV Lüneburg",
          shortName: "HV Lüneburg",
        },
        {
          externalTeamId: "1760504",
          name: "MTV Braunschweig",
          clubName: "MTV Braunschweig",
          shortName: "Braunschweig",
        },
      ],
    },
  ];
}
