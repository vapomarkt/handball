import { Prisma } from "@prisma/client";
import { JerseySetRepository } from "@/domain/adapters/jersey-set-repository";
import { DomainError } from "@/domain/errors";
import {
  CreateJerseySetInput,
  JerseySetDTO,
  UpdateJerseySetInput,
} from "@/domain/schemas/jersey-set";
import { prisma } from "../db/prisma";

const JERSEY_SET_INCLUDE = {
  team: { select: { name: true } },
};

type PrismaJerseySetRow = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.jerseySet.findUnique<{
        where: { id: string };
        include: typeof JERSEY_SET_INCLUDE;
      }>
    >
  >
>;

function mapJerseySet(row: PrismaJerseySetRow): JerseySetDTO {
  return {
    id: row.id,
    clubId: row.clubId,
    teamId: row.teamId,
    teamName: row.team?.name ?? null,
    name: row.name,
    colors: row.colors,
    sizes: row.sizes,
    jerseyCount: row.jerseyCount,
    condition: row.condition,
    conditionNote: row.conditionNote,
    careInstructions: row.careInstructions,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function handlePrismaError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw DomainError.conflict(
      "Ein Trikotsatz mit dieser Bezeichnung existiert bereits im Verein."
    );
  }
  throw error;
}

export class PrismaJerseySetRepository implements JerseySetRepository {
  async findByClubId(
    clubId: string,
    filter?: { teamId?: string }
  ): Promise<JerseySetDTO[]> {
    const rows = await prisma.jerseySet.findMany({
      where: {
        clubId,
        ...(filter?.teamId
          ? { OR: [{ teamId: filter.teamId }, { teamId: null }] }
          : {}),
      },
      include: JERSEY_SET_INCLUDE,
      orderBy: [{ name: "asc" }],
    });

    // Team-eigene Trikotsätze zuerst, danach vereinsweite
    if (filter?.teamId) {
      rows.sort((a, b) => {
        const aOwn = a.teamId === filter.teamId ? 0 : 1;
        const bOwn = b.teamId === filter.teamId ? 0 : 1;
        if (aOwn !== bOwn) return aOwn - bOwn;
        return a.name.localeCompare(b.name, "de");
      });
    }

    return rows.map(mapJerseySet);
  }

  async findById(jerseySetId: string): Promise<JerseySetDTO | null> {
    const row = await prisma.jerseySet.findUnique({
      where: { id: jerseySetId },
      include: JERSEY_SET_INCLUDE,
    });
    return row ? mapJerseySet(row) : null;
  }

  async create(
    clubId: string,
    input: CreateJerseySetInput
  ): Promise<JerseySetDTO> {
    try {
      const row = await prisma.jerseySet.create({
        data: {
          clubId,
          teamId: input.teamId ?? null,
          name: input.name,
          colors: input.colors,
          sizes: input.sizes ?? null,
          jerseyCount: input.jerseyCount ?? null,
          condition: input.condition,
          conditionNote: input.conditionNote ?? null,
          careInstructions: input.careInstructions ?? null,
        },
        include: JERSEY_SET_INCLUDE,
      });
      return mapJerseySet(row);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async update(
    jerseySetId: string,
    input: UpdateJerseySetInput
  ): Promise<JerseySetDTO> {
    try {
      const row = await prisma.jerseySet.update({
        where: { id: jerseySetId },
        data: {
          ...(input.teamId !== undefined ? { teamId: input.teamId } : {}),
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.colors !== undefined ? { colors: input.colors } : {}),
          ...(input.sizes !== undefined ? { sizes: input.sizes } : {}),
          ...(input.jerseyCount !== undefined
            ? { jerseyCount: input.jerseyCount }
            : {}),
          ...(input.condition !== undefined
            ? { condition: input.condition }
            : {}),
          ...(input.conditionNote !== undefined
            ? { conditionNote: input.conditionNote }
            : {}),
          ...(input.careInstructions !== undefined
            ? { careInstructions: input.careInstructions }
            : {}),
        },
        include: JERSEY_SET_INCLUDE,
      });
      return mapJerseySet(row);
    } catch (error) {
      handlePrismaError(error);
    }
  }

  async delete(jerseySetId: string): Promise<void> {
    await prisma.jerseySet.delete({ where: { id: jerseySetId } });
  }
}
