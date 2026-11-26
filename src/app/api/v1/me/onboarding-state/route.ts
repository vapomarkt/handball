import { DomainError } from "@/domain/errors";
import { MemberRoleSchema } from "@/domain/schemas/handball";
import {
  DEFAULT_ONBOARDING_STATE,
  UpdateOnboardingStateSchema,
  UserOnboardingStateDTO,
} from "@/domain/schemas/onboarding-state";
import { applyOnboardingStatePatch } from "@/domain/services/onboarding-state-service";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { prisma } from "@/infrastructure/db/prisma";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";

function mapRow(
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
    .filter((p) => p.success)
    .map((p) => p.data);
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
    const row = await prisma.userOnboardingState.findUnique({
      where: { userId: viewer.userId },
    });
    return jsonOk({ onboardingState: mapRow(row) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const body = await parseJsonBody(request);
    const parsed = UpdateOnboardingStateSchema.safeParse(body);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Onboarding-Einstellungen.",
        parsed.error.flatten().fieldErrors
      );
    }

    const existing = await prisma.userOnboardingState.findUnique({
      where: { userId: viewer.userId },
    });
    const current = mapRow(existing);
    const next = applyOnboardingStatePatch(current, parsed.data);

    const saved = await prisma.userOnboardingState.upsert({
      where: { userId: viewer.userId },
      create: {
        userId: viewer.userId,
        profilePromptDismissed: next.profilePromptDismissed,
        passkeyPromptDismissed: next.passkeyPromptDismissed,
        tourDisabled: next.tourDisabled,
        tourCompletedRoles: next.tourCompletedRoles,
        tourLastCompletedAt: next.tourLastCompletedAt
          ? new Date(next.tourLastCompletedAt)
          : null,
        onboardingCompletedAt: next.onboardingCompletedAt
          ? new Date(next.onboardingCompletedAt)
          : null,
      },
      update: {
        profilePromptDismissed: next.profilePromptDismissed,
        passkeyPromptDismissed: next.passkeyPromptDismissed,
        tourDisabled: next.tourDisabled,
        tourCompletedRoles: next.tourCompletedRoles,
        tourLastCompletedAt: next.tourLastCompletedAt
          ? new Date(next.tourLastCompletedAt)
          : null,
        onboardingCompletedAt: next.onboardingCompletedAt
          ? new Date(next.onboardingCompletedAt)
          : null,
      },
    });

    return jsonOk({ onboardingState: mapRow(saved) });
  } catch (error) {
    return handleApiError(error);
  }
}
