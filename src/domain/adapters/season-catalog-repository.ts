import { SeasonCatalogDTO } from "../schemas/season-catalog";

export interface CreateSeasonCatalogRecord {
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface UpdateSeasonCatalogRecord {
  name?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  sortOrder?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface SeasonCatalogRepository {
  findAll(options?: { activeOnly?: boolean }): Promise<SeasonCatalogDTO[]>;
  findById(id: string): Promise<SeasonCatalogDTO | null>;
  findByName(name: string): Promise<SeasonCatalogDTO | null>;
  create(input: CreateSeasonCatalogRecord): Promise<SeasonCatalogDTO>;
  update(
    id: string,
    input: UpdateSeasonCatalogRecord
  ): Promise<SeasonCatalogDTO>;
  delete(id: string): Promise<void>;
}
