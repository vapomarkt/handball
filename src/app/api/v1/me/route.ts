import { MemberRoleSchema } from "@/domain/schemas/handball";
import {
  DEFAULT_ONBOARDING_STATE,
  UserOnboardingStateDTO,
} from "@/domain/schemas/onboarding-state";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { prisma } from "@/infrastructure/db/prisma";
import { handleApiError, jsonOk } from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

function toOnboardingStateDTO(
  row: {
    profilePromptDismissed: boolean;
    passkeyPromptDismissed: boolean;
    tourDisabled: boolean;
    tourCompletedRoles: string[];
    tourLastCompletedAt: Date | null;
    onboardingCompletedAt: Date | null;
  } | null
): UserOnboardingStateDTO {
  if (!row) return { ...DEFAULT_ONBOARDING_STATE };
  const validRoles = row.tourCompletedRoles
    .map((r) => MemberRoleSchema.safeParse(r))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);
  return {
    profilePromptDismissed: row.profilePromptDismissed,
    passkeyPromptDismissed: row.passkeyPromptDismissed,
    tourDisabled: row.tourDisabled,
    tourCompletedRoles: validRoles,
    tourLastCompletedAt: row.tourLastCompletedAt
      ? row.tourLastCompletedAt.toISOString()
      : null,
    onboardingCompletedAt: row.onboardingCompletedAt
      ? row.onboardingCompletedAt.toISOString()
      : null,
  };
}

export async function GET(request: Request) {
  try {
    const viewer = await requireViewerContext(request.headers);

    const [
      memberships,
      guardianLinks,
      onboardingRow,
      credentialAccount,
      passkeyCount,
    ] = await Promise.all([
      prisma.teamMember.findMany({
        where: { userId: viewer.userId },
        include: {
          club: {
            select: {
              id: true,
              name: true,
              shortName: true,
              slug: true,
              logoUrl: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              category: true,
              ageGroup: true,
              gender: true,
              usesResin: true,
              leagueName: true,
              leagueGroupTeamId: true,
              season: { select: { id: true, name: true, isActive: true } },
            },
          },
        },
        orderBy: [{ club: { name: "asc" } }, { team: { name: "asc" } }],
      }),
      services.guardian.listMyLinkedChildren(viewer),
      prisma.userOnboardingState.findUnique({
        where: { userId: viewer.userId },
      }),
      prisma.account.findFirst({
        where: {
          userId: viewer.userId,
          providerId: "credential",
          password: { not: null },
        },
        select: { id: true },
      }),
      prisma.passkey.count({
        where: { userId: viewer.userId },
      }),
    ]);

    // Falls der User CLUB_ADMIN in einem Verein ist, auch alle Teams dieses Vereins zurückgeben
    const adminClubIds = Array.from(
      new Set(
        memberships
          .filter((m) => m.role === "CLUB_ADMIN")
          .map((m) => m.clubId)
      )
    );

    const [adminClubTeams, linkedChildDetails] = await Promise.all([
      adminClubIds.length > 0
        ? prisma.team.findMany({
            where: { clubId: { in: adminClubIds } },
            include: {
              club: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  slug: true,
                  logoUrl: true,
                },
              },
              season: { select: { id: true, name: true, isActive: true } },
            },
            orderBy: { name: "asc" },
          })
        : [],
      guardianLinks.length > 0
        ? prisma.teamMember.findMany({
            where: {
              id: { in: guardianLinks.map((g) => g.childMemberId) },
            },
            select: {
              id: true,
              emergencyContact: true,
              injuryNote: true,
              jerseyNumber: true,
              primaryPosition: true,
            },
          })
        : [],
    ]);

    const childDetailById = new Map(
      linkedChildDetails.map((c) => [c.id, c])
    );

    return jsonOk({
      user: {
        id: viewer.userId,
        email: viewer.email,
        name: viewer.name,
      },
      onboardingState: toOnboardingStateDTO(onboardingRow),
      authMethods: {
        hasPassword: Boolean(credentialAccount),
        passkeyCount,
      },
      memberships: memberships.map((m) => ({
        memberId: m.id,
        role: m.role,
        firstName: m.firstName,
        lastName: m.lastName,
        jerseyNumber: m.jerseyNumber,
        primaryPosition: m.primaryPosition,
        secondaryPosition: m.secondaryPosition,
        throwingHand: m.throwingHand,
        availabilityStatus: m.availabilityStatus,
        phone: m.phone,
        emergencyContact: m.emergencyContact,
        injuryNote: m.injuryNote,
        club: m.club,
        team: {
          id: m.team.id,
          name: m.team.name,
          category: m.team.category,
          ageGroup: m.team.ageGroup,
          gender: m.team.gender,
          usesResin: m.team.usesResin,
          leagueName: m.team.leagueName,
          leagueGroupTeamId: m.team.leagueGroupTeamId ?? null,
          seasonId: m.team.season.id,
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
        leagueGroupTeamId: t.leagueGroupTeamId ?? null,
        seasonId: t.season.id,
        seasonName: t.season.name,
        club: t.club,
      })),
      guardianLinks: guardianLinks.map((g) => {
        const detail = childDetailById.get(g.childMemberId);
        return {
          ...g,
          childEmergencyContact: detail?.emergencyContact ?? null,
          childInjuryNote: detail?.injuryNote ?? null,
          childJerseyNumber: detail?.jerseyNumber ?? null,
          childPrimaryPosition: detail?.primaryPosition ?? null,
        };
      }),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
