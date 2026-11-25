import { requireViewerContext } from "@/infrastructure/auth/session";
import { prisma } from "@/infrastructure/db/prisma";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function GET(request: Request) {
  try {
    const viewer = await requireViewerContext(request.headers);

    const [memberships, guardianLinks] = await Promise.all([
      prisma.teamMember.findMany({
        where: { userId: viewer.userId },
        include: {
          club: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true } },
          team: {
            select: {
              id: true,
              name: true,
              category: true,
              ageGroup: true,
              gender: true,
              usesResin: true,
              leagueName: true,
              season: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
        orderBy: [{ club: { name: "asc" } }, { team: { name: "asc" } }],
      }),
      services.guardian.listMyLinkedChildren(viewer),
    ]);

    // Falls der User CLUB_ADMIN in einem Verein ist, auch alle Teams dieses Vereins zurückgeben
    const adminClubIds = Array.from(
      new Set(
        memberships
          .filter((m) => m.role === "CLUB_ADMIN")
          .map((m) => m.clubId)
      )
    );

    const adminClubTeams =
      adminClubIds.length > 0
        ? await prisma.team.findMany({
            where: { clubId: { in: adminClubIds } },
            include: {
              club: { select: { id: true, name: true, shortName: true, slug: true, logoUrl: true } },
              season: { select: { id: true, name: true, isActive: true } },
            },
            orderBy: { name: "asc" },
          })
        : [];

    return jsonOk({
      user: {
        id: viewer.userId,
        email: viewer.email,
        name: viewer.name,
      },
      memberships: memberships.map((m) => ({
        memberId: m.id,
        role: m.role,
        firstName: m.firstName,
        lastName: m.lastName,
        jerseyNumber: m.jerseyNumber,
        primaryPosition: m.primaryPosition,
        availabilityStatus: m.availabilityStatus,
        club: m.club,
        team: {
          id: m.team.id,
          name: m.team.name,
          category: m.team.category,
          ageGroup: m.team.ageGroup,
          gender: m.team.gender,
          usesResin: m.team.usesResin,
          leagueName: m.team.leagueName,
          seasonName: m.team.season.name,
        },
      })),
      adminClubTeams: adminClubTeams.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category,
        ageGroup: t.ageGroup,
        gender: t.gender,
        usesResin: t.usesResin,
        leagueName: t.leagueName,
        seasonName: t.season.name,
        club: t.club,
      })),
      guardianLinks,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
