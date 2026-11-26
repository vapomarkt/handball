import { DomainError } from "@/domain/errors";
import { QuickProfileUpdateSchema } from "@/domain/schemas/onboarding-state";
import { requireViewerContext } from "@/infrastructure/auth/session";
import { prisma } from "@/infrastructure/db/prisma";
import {
  handleApiError,
  jsonOk,
  parseJsonBody,
} from "@/infrastructure/http/api-handler";
import { services } from "@/infrastructure/services/container";

export async function PATCH(request: Request) {
  try {
    const viewer = await requireViewerContext(request.headers);
    const body = await parseJsonBody(request);
    const parsed = QuickProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Profildaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const input = parsed.data;

    // 1. User-Anzeigename aktualisieren, wenn Vor- und Nachname angegeben wurden
    if (input.firstName || input.lastName) {
      const nameParts = viewer.name.trim().split(/\s+/);
      const nextFirst = input.firstName ?? nameParts[0] ?? "";
      const nextLast =
        input.lastName ??
        (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");
      const fullName = `${nextFirst} ${nextLast}`.trim();
      if (fullName.length > 0) {
        await prisma.user.update({
          where: { id: viewer.userId },
          data: { name: fullName },
        });
      }
    }

    // 2. Eigenes TeamMember-Profil im gewählten (oder ersten) Team aktualisieren
    const targetMembership = input.teamId
      ? viewer.memberships.find((m) => m.teamId === input.teamId)
      : viewer.memberships[0];

    let updatedMember = null;
    if (targetMembership) {
      const memberPatch: Record<string, unknown> = {};
      if (input.firstName !== undefined) memberPatch.firstName = input.firstName;
      if (input.lastName !== undefined) memberPatch.lastName = input.lastName;
      if (input.phone !== undefined) memberPatch.phone = input.phone;
      if (input.emergencyContact !== undefined) {
        memberPatch.emergencyContact = input.emergencyContact;
      }
      if (input.primaryPosition !== undefined) {
        memberPatch.primaryPosition = input.primaryPosition;
      }
      if (input.secondaryPosition !== undefined) {
        memberPatch.secondaryPosition = input.secondaryPosition;
      }
      if (input.throwingHand !== undefined) {
        memberPatch.throwingHand = input.throwingHand;
      }
      if (input.availabilityStatus !== undefined) {
        memberPatch.availabilityStatus = input.availabilityStatus;
      }
      if (input.injuryNote !== undefined) {
        memberPatch.injuryNote = input.injuryNote;
      }

      if (Object.keys(memberPatch).length > 0) {
        updatedMember = await services.roster.updateMember(
          viewer,
          targetMembership.teamId,
          targetMembership.memberId,
          memberPatch
        );
      }
    }

    // 3. Optional: verknüpftes Kind aktualisieren (z. B. Notfallkontakt beim Eltern-Onboarding)
    let updatedChild = null;
    if (
      input.childMemberId &&
      (input.childEmergencyContact !== undefined ||
        input.childInjuryNote !== undefined)
    ) {
      const child = await prisma.teamMember.findUnique({
        where: { id: input.childMemberId },
        select: { id: true, teamId: true },
      });
      if (!child) {
        throw DomainError.notFound("Verknüpftes Kinderprofil nicht gefunden.");
      }
      const childPatch: Record<string, unknown> = {};
      if (input.childEmergencyContact !== undefined) {
        childPatch.emergencyContact = input.childEmergencyContact;
      }
      if (input.childInjuryNote !== undefined) {
        childPatch.injuryNote = input.childInjuryNote;
      }
      updatedChild = await services.roster.updateMember(
        viewer,
        child.teamId,
        child.id,
        childPatch
      );
    }

    return jsonOk({
      member: updatedMember,
      child: updatedChild,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
