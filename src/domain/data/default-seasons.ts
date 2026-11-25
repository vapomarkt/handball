export interface DefaultSeasonCatalogEntry {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}

/**
 * Standard-Handballsaisons (Spieljahr jeweils 01.07. bis 30.06.)
 * als Ausgangsbasis für den zentral gepflegten Saison-Katalog.
 */
export const DEFAULT_SEASON_CATALOG: readonly DefaultSeasonCatalogEntry[] = [
  {
    id: "season_cat_2024_25",
    name: "2024/25",
    startDate: "2024-07-01T00:00:00.000Z",
    endDate: "2025-06-30T23:59:59.000Z",
    sortOrder: 10,
    isDefault: false,
    isActive: true,
  },
  {
    id: "season_cat_2025_26",
    name: "2025/26",
    startDate: "2025-07-01T00:00:00.000Z",
    endDate: "2026-06-30T23:59:59.000Z",
    sortOrder: 20,
    isDefault: false,
    isActive: true,
  },
  {
    id: "season_cat_2026_27",
    name: "2026/27",
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2027-06-30T23:59:59.000Z",
    sortOrder: 30,
    isDefault: true,
    isActive: true,
  },
  {
    id: "season_cat_2027_28",
    name: "2027/28",
    startDate: "2027-07-01T00:00:00.000Z",
    endDate: "2028-06-30T23:59:59.000Z",
    sortOrder: 40,
    isDefault: false,
    isActive: true,
  },
  {
    id: "season_cat_2028_29",
    name: "2028/29",
    startDate: "2028-07-01T00:00:00.000Z",
    endDate: "2029-06-30T23:59:59.000Z",
    sortOrder: 50,
    isDefault: false,
    isActive: true,
  },
];
