import { describe, expect, it } from "vitest";
import {
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
  MemberRole,
} from "@/domain/schemas/handball";
import { SelfUpdateMemberSchema } from "@/domain/schemas/member";
import {
  DEFAULT_ONBOARDING_STATE,
  ROLE_TOUR_STEPS,
} from "@/domain/schemas/onboarding-state";
import {
  formatShortCode,
  generateShortCode,
  normalizeInviteLookup,
} from "@/domain/services/invite-service";
import {
  applyOnboardingStatePatch,
  calculateProfileCompleteness,
  getTourStepsForRole,
  shouldAutoStartTour,
} from "@/domain/services/onboarding-state-service";

const ALL_ROLES: MemberRole[] = [
  "CLUB_ADMIN",
  "COACH",
  "ASSISTANT_COACH",
  "TEAM_MANAGER",
  "PLAYER",
  "PARENT",
  "HELPER",
];

describe("Rollen-Vollständigkeit & App-Tour-Definitionen", () => {
  it("definiert Labels, Beschreibungen und 3–4 kurze Tour-Schritte für jede Rolle", () => {
    for (const role of ALL_ROLES) {
      expect(MEMBER_ROLE_LABELS[role]).toBeTruthy();
      expect(MEMBER_ROLE_DESCRIPTIONS[role]).toBeTruthy();
      const steps = getTourStepsForRole(role);
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.length).toBeLessThanOrEqual(4);
      expect(ROLE_TOUR_STEPS[role]).toBe(steps);
    }
  });
});

describe("App-Tour-Automatik & Persistenz-Logik", () => {
  it("startet beim ersten Besuch einer Rolle und stoppt nach Abschluss oder Deaktivierung", () => {
    expect(shouldAutoStartTour(DEFAULT_ONBOARDING_STATE, "PLAYER")).toBe(true);
    expect(shouldAutoStartTour(DEFAULT_ONBOARDING_STATE, null)).toBe(false);

    const afterPlayerTour = applyOnboardingStatePatch(
      DEFAULT_ONBOARDING_STATE,
      { completeTourForRole: "PLAYER" },
      new Date("2026-11-26T12:00:00.000Z")
    );
    expect(shouldAutoStartTour(afterPlayerTour, "PLAYER")).toBe(false);
    // Neue Rolle (z. B. Spieler wird später Trainer) bekommt wieder die kurze Einführung
    expect(shouldAutoStartTour(afterPlayerTour, "COACH")).toBe(true);
    expect(afterPlayerTour.tourLastCompletedAt).toBe(
      "2026-11-26T12:00:00.000Z"
    );

    // Dauerhaft abgeschaltet: niemals mehr automatisch starten (auch bei anderer Rolle)
    const disabled = applyOnboardingStatePatch(afterPlayerTour, {
      tourDisabled: true,
    });
    expect(shouldAutoStartTour(disabled, "COACH")).toBe(false);
    expect(shouldAutoStartTour(disabled, "TEAM_MANAGER")).toBe(false);

    // Manueller Reset im Profil reaktiviert die Tour sauber
    const reset = applyOnboardingStatePatch(disabled, { resetTour: true });
    expect(reset.tourDisabled).toBe(false);
    expect(reset.tourCompletedRoles).toEqual([]);
    expect(shouldAutoStartTour(reset, "PLAYER")).toBe(true);
  });
});

describe("Profil-Vervollständigung pro Rolle", () => {
  it("erkennt fehlende Felder bei Spielern (Position, Wurfhand, Telefon, Notfallkontakt)", () => {
    const partial = calculateProfileCompleteness("PLAYER", {
      firstName: "Jarle",
      lastName: "Hofmann",
      primaryPosition: null,
      throwingHand: "RIGHT",
      phone: null,
      emergencyContact: null,
    });
    expect(partial.isComplete).toBe(false);
    expect(partial.completedCount).toBe(2);
    expect(partial.totalCount).toBe(5);
    expect(partial.percentage).toBe(40);
    expect(partial.missingFields.map((f) => f.key)).toEqual([
      "primaryPosition",
      "phone",
      "emergencyContact",
    ]);

    const complete = calculateProfileCompleteness("PLAYER", {
      firstName: "Jarle",
      lastName: "Hofmann",
      primaryPosition: "RM",
      throwingHand: "RIGHT",
      phone: "0170 123456",
      emergencyContact: "Eltern 0170 987654",
    });
    expect(complete.isComplete).toBe(true);
    expect(complete.percentage).toBe(100);
  });

  it("berücksichtigt bei Eltern den Notfallkontakt der verknüpften Kinder", () => {
    const missingChildEmergency = calculateProfileCompleteness(
      "PARENT",
      {
        firstName: "Katrin",
        lastName: "Hofmann",
        phone: "0170 111222",
        emergencyContact: null,
      },
      [{ firstName: "Jarle", emergencyContact: null }]
    );
    expect(missingChildEmergency.isComplete).toBe(false);
    expect(missingChildEmergency.missingFields.map((f) => f.key)).toEqual([
      "emergencyContact",
    ]);

    const filledChildEmergency = calculateProfileCompleteness(
      "PARENT",
      {
        firstName: "Katrin",
        lastName: "Hofmann",
        phone: "0170 111222",
        emergencyContact: null,
      },
      [{ firstName: "Jarle", emergencyContact: "Katrin 0170 111222" }]
    );
    expect(filledChildEmergency.isComplete).toBe(true);
    expect(filledChildEmergency.percentage).toBe(100);
  });

  it("hält das Profil für Betreuer, Trainer und Helfer schlank (Name + Telefon)", () => {
    for (const role of [
      "TEAM_MANAGER",
      "COACH",
      "ASSISTANT_COACH",
      "CLUB_ADMIN",
      "HELPER",
    ] as const) {
      const res = calculateProfileCompleteness(role, {
        firstName: "Petra",
        lastName: "Brandt",
        phone: "+49 170 5550199",
      });
      expect(res.isComplete).toBe(true);
      expect(res.percentage).toBe(100);
    }
  });
});

describe("Einladungs-Kurzcodes & Normalisierung", () => {
  it("erzeugt 6-stellige Kurzcodes ohne verwechselbare Zeichen (0, O, 1, I)", () => {
    for (let i = 0; i < 40; i++) {
      const code = generateShortCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(formatShortCode(code)).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    }
  });

  it("normalisiert Kurzcodes (mit Bindestrich/Kleinschreibung) und komplette Einladungs-URLs", () => {
    expect(normalizeInviteLookup("h7k-4p9")).toBe("H7K4P9");
    expect(normalizeInviteLookup("  H7K 4P9  ")).toBe("H7K4P9");
    expect(
      normalizeInviteLookup("https://throwoff.app/invite/AbCdEfGh1234567890Xy")
    ).toBe("AbCdEfGh1234567890Xy");
    expect(
      normalizeInviteLookup("https://throwoff.app/invite/h7k-4p9?utm=whatsapp")
    ).toBe("H7K4P9");
  });
});

describe("SelfUpdateMemberSchema für schnelle Profil-Vervollständigung", () => {
  it("erlaubt Name, Position, Wurfhand, Telefon & Notfallkontakt, filtert aber Rolle/Trikot/Passnummer aus", () => {
    const parsed = SelfUpdateMemberSchema.parse({
      firstName: "  Lena ",
      lastName: "Meyer",
      primaryPosition: "LA",
      throwingHand: "LEFT",
      phone: "0171 9998880",
      emergencyContact: "Vater 0171 111222",
      role: "CLUB_ADMIN",
      jerseyNumber: 99,
      passNumber: "HACK-123",
    });

    expect(parsed.firstName).toBe("Lena");
    expect(parsed.lastName).toBe("Meyer");
    expect(parsed.primaryPosition).toBe("LA");
    expect(parsed.throwingHand).toBe("LEFT");
    expect(parsed.phone).toBe("+491719998880");
    expect("role" in parsed).toBe(false);
    expect("jerseyNumber" in parsed).toBe(false);
    expect("passNumber" in parsed).toBe(false);
  });
});
