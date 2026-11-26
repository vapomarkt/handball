import { MemberRole } from "../schemas/handball";
import {
  DEFAULT_ONBOARDING_STATE,
  ProfileCompletenessResult,
  ProfileFieldHint,
  ROLE_TOUR_STEPS,
  TourStepDefinition,
  UpdateOnboardingStateInput,
  UserOnboardingStateDTO,
} from "../schemas/onboarding-state";

export interface ProfileCompletenessMemberInput {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  emergencyContact?: string | null;
  primaryPosition?: string | null;
  throwingHand?: string | null;
}

export interface ProfileCompletenessChildInput {
  firstName?: string | null;
  emergencyContact?: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlaceholderName(
  firstName: string | null | undefined,
  lastName: string | null | undefined
): boolean {
  if (!hasText(firstName) || !hasText(lastName)) return true;
  const f = firstName!.trim().toLowerCase();
  const l = lastName!.trim().toLowerCase();
  if (f === "mitglied" || l === "neu" || f === "elternteil") return true;
  if (f.includes("@") || l.includes("@")) return true;
  return false;
}

/**
 * Berechnet die rollenabhängige Profil-Vollständigkeit für schnelle Onboarding-Hinweise.
 * Bewusst kompakt gehalten (nur 2–4 wirklich hilfreiche Felder pro Rolle).
 */
export function calculateProfileCompleteness(
  role: MemberRole,
  member: ProfileCompletenessMemberInput | null | undefined,
  linkedChildren: ProfileCompletenessChildInput[] = []
): ProfileCompletenessResult {
  const checks: Array<{ ok: boolean; hint: ProfileFieldHint }> = [];

  checks.push({
    ok: !isPlaceholderName(member?.firstName, member?.lastName),
    hint: {
      key: "name",
      label: "Vor- & Nachname",
      description: "Damit dich Team und Trainer direkt erkennen.",
    },
  });

  if (role === "PLAYER") {
    checks.push({
      ok: hasText(member?.primaryPosition),
      hint: {
        key: "primaryPosition",
        label: "Position",
        description: "Deine Hauptposition auf dem Feld (z. B. RM, LA, TW).",
      },
    });
    checks.push({
      ok: hasText(member?.throwingHand),
      hint: {
        key: "throwingHand",
        label: "Wurfhand",
        description: "Hilft Trainern bei Aufstellung und Taktik.",
      },
    });
    checks.push({
      ok: hasText(member?.phone),
      hint: {
        key: "phone",
        label: "Telefonnummer",
        description: "Für kurzfristige Rückfragen (nur für Trainer/Betreuer sichtbar).",
      },
    });
    checks.push({
      ok: hasText(member?.emergencyContact),
      hint: {
        key: "emergencyContact",
        label: "Notfallkontakt",
        description: "Wichtig bei Verletzungen (DSGVO-geschützt).",
      },
    });
  } else if (role === "PARENT") {
    checks.push({
      ok: hasText(member?.phone),
      hint: {
        key: "phone",
        label: "Telefonnummer",
        description: "Damit Trainer und Betreuer dich am Spieltag erreichen.",
      },
    });
    const childNeedsEmergency =
      linkedChildren.length > 0 &&
      linkedChildren.some((c) => !hasText(c.emergencyContact));
    const hasAnyEmergency =
      hasText(member?.emergencyContact) ||
      (linkedChildren.length > 0 && !childNeedsEmergency);
    checks.push({
      ok: hasAnyEmergency,
      hint: {
        key: "emergencyContact",
        label: "Notfallkontakt fürs Kind",
        description:
          "Nur für Trainer & Betreuer sichtbar – unverzichtbar bei Auswärtsspielen.",
      },
    });
  } else {
    // CLUB_ADMIN, COACH, ASSISTANT_COACH, TEAM_MANAGER, HELPER
    checks.push({
      ok: hasText(member?.phone),
      hint: {
        key: "phone",
        label: "Telefonnummer",
        description:
          role === "HELPER"
            ? "Für schnelle Absprachen bei Spieltags-Diensten."
            : "Für kurzfristige Absprachen im Team und am Spieltag.",
      },
    });
  }

  const totalCount = checks.length;
  const completedCount = checks.filter((c) => c.ok).length;
  const missingFields = checks.filter((c) => !c.ok).map((c) => c.hint);
  const percentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  return {
    percentage,
    completedCount,
    totalCount,
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

/**
 * Entscheidet deterministisch, ob die kurze App-Tour automatisch starten darf.
 * Respektiert strikt `tourDisabled` (dauerhaftes Abschalten) und bereits gesehene Rollen.
 */
export function shouldAutoStartTour(
  state: UserOnboardingStateDTO | null | undefined,
  activeRole: MemberRole | null | undefined
): boolean {
  if (!activeRole) return false;
  const effective = state ?? DEFAULT_ONBOARDING_STATE;
  if (effective.tourDisabled) return false;
  return !effective.tourCompletedRoles.includes(activeRole);
}

export function getTourStepsForRole(role: MemberRole): TourStepDefinition[] {
  return ROLE_TOUR_STEPS[role] ?? ROLE_TOUR_STEPS.PLAYER;
}

/**
 * Wendet einen Onboarding-State-Patch rein funktional an (genutzt von Service & Tests).
 */
export function applyOnboardingStatePatch(
  current: UserOnboardingStateDTO,
  patch: UpdateOnboardingStateInput,
  now = new Date()
): UserOnboardingStateDTO {
  let tourCompletedRoles = [...current.tourCompletedRoles];
  let tourLastCompletedAt = current.tourLastCompletedAt;
  let tourDisabled = current.tourDisabled;

  if (patch.resetTour) {
    tourCompletedRoles = [];
    tourDisabled = false;
  }

  if (typeof patch.tourDisabled === "boolean") {
    tourDisabled = patch.tourDisabled;
  }

  if (
    patch.completeTourForRole &&
    !tourCompletedRoles.includes(patch.completeTourForRole)
  ) {
    tourCompletedRoles.push(patch.completeTourForRole);
    tourLastCompletedAt = now.toISOString();
  } else if (patch.completeTourForRole) {
    tourLastCompletedAt = now.toISOString();
  }

  return {
    profilePromptDismissed:
      patch.profilePromptDismissed ?? current.profilePromptDismissed,
    passkeyPromptDismissed:
      patch.passkeyPromptDismissed ?? current.passkeyPromptDismissed,
    tourDisabled,
    tourCompletedRoles,
    tourLastCompletedAt,
    onboardingCompletedAt: patch.markOnboardingComplete
      ? (current.onboardingCompletedAt ?? now.toISOString())
      : current.onboardingCompletedAt,
  };
}
