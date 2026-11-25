import {
  CreateSeasonCatalogRecord,
  SeasonCatalogRepository,
  UpdateSeasonCatalogRecord,
} from "@/domain/adapters/season-catalog-repository";
import { SeasonCatalogDTO } from "@/domain/schemas/season-catalog";
import { prisma } from "../db/prisma";

function toSeasonCatalogDTO(row: {
  id: string;
  name: string;
  startDate: Date | null;
  endDate: Date | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): SeasonCatalogDTO {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    endDate: row.endDate ? row.endDate.toISOString() : null,
    sortOrder: row.sortOrder,
    isDefault: row.isDefault,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaSeasonCatalogRepository implements SeasonCatalogRepository {
  async findAll(options?: {
    activeOnly?: boolean;
  }): Promise<SeasonCatalogDTO[]> {
    const rows = await prisma.seasonCatalog.findMany({
      where: options?.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(toSeasonCatalogDTO);
  }

  async findById(id: string): Promise<SeasonCatalogDTO | null> {
    const row = await prisma.seasonCatalog.findUnique({ where: { id } });
    return row ? toSeasonCatalogDTO(row) : null;
  }

  async findByName(name: string): Promise<SeasonCatalogDTO | null> {
    const row = await prisma.seasonCatalog.findUnique({ where: { name } });
    return row ? toSeasonCatalogDTO(row) : null;
  }

  async create(input: CreateSeasonCatalogRecord): Promise<SeasonCatalogDTO> {
    const created = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.seasonCatalog.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.seasonCatalog.create({
        data: {
          name: input.name,
          startDate: input.startDate,
          endDate: input.endDate,
          sortOrder: input.sortOrder,
          isDefault: input.isDefault,
          isActive: input.isActive,
        },
      });
    });

    return toSeasonCatalogDTO(created);
  }

  async update(
    id: string,
    input: UpdateSeasonCatalogRecord
  ): Promise<SeasonCatalogDTO> {
    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.seasonCatalog.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      return tx.seasonCatalog.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.startDate !== undefined
            ? { startDate: input.startDate }
            : {}),
          ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
          ...(input.sortOrder !== undefined
            ? { sortOrder: input.sortOrder }
            : {}),
          ...(input.isDefault !== undefined
            ? { isDefault: input.isDefault }
            : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    });

    return toSeasonCatalogDTO(updated);
  }

  async delete(id: string): Promise<void> {
    await prisma.seasonCatalog.delete({ where: { id } });
  }
}
