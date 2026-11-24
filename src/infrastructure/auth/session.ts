import { headers } from "next/headers";
import { DomainError } from "@/domain/errors";
import { ViewerContext } from "@/domain/policies/rbac";
import { prisma } from "../db/prisma";
import { auth } from "./auth";

export async function getOptionalViewerContext(
  providedHeaders?: Headers
): Promise<ViewerContext | null> {
  const reqHeaders = providedHeaders ?? (await headers());
  const session = await auth.api.getSession({
    headers: reqHeaders,
  });

  if (!session?.user) {
    return null;
  }

  const [memberships, guardianLinks] = await Promise.all([
    prisma.teamMember.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        clubId: true,
        teamId: true,
        role: true,
      },
    }),
    prisma.guardianLink.findMany({
      where: { guardianUserId: session.user.id },
      select: {
        childMemberId: true,
        childMember: {
          select: { teamId: true },
        },
      },
    }),
  ]);

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    memberships: memberships.map((m) => ({
      memberId: m.id,
      clubId: m.clubId,
      teamId: m.teamId,
      role: m.role,
    })),
    linkedChildMemberIds: guardianLinks.map((g) => g.childMemberId),
    linkedChildTeamIds: Array.from(
      new Set(guardianLinks.map((g) => g.childMember.teamId))
    ),
  };
}

export async function requireViewerContext(
  providedHeaders?: Headers
): Promise<ViewerContext> {
  const viewer = await getOptionalViewerContext(providedHeaders);
  if (!viewer) {
    throw DomainError.unauthorized("Bitte melde dich an, um fortzufahren.");
  }
  return viewer;
}
