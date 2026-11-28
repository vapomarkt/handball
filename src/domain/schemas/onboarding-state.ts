import { z } from "zod";
import { MemberRole, MemberRoleSchema } from "./handball";
import { optionalPhoneSchema } from "./phone";

export interface UserOnboardingStateDTO {
  profilePromptDismissed: boolean;
  passkeyPromptDismissed: boolean;
  tourDisabled: boolean;
  tourCompletedRoles: MemberRole[];
  tourLastCompletedAt: string | null;
  onboardingCompletedAt: string | null;
}

export const DEFAULT_ONBOARDING_STATE: UserOnboardingStateDTO = {
  profilePromptDismissed: false,
  passkeyPromptDismissed: false,
  tourDisabled: false,
  tourCompletedRoles: [],
  tourLastCompletedAt: null,
  onboardingCompletedAt: null,
};

export interface AuthMethodsSummaryDTO {
  hasPassword: boolean;
  passkeyCount: number;
}

export const UpdateOnboardingStateSchema = z.object({
  profilePromptDismissed: z.boolean().optional(),
  passkeyPromptDismissed: z.boolean().optional(),
  tourDisabled: z.boolean().optional(),
  completeTourForRole: MemberRoleSchema.optional(),
  resetTour: z.boolean().optional(),
  markOnboardingComplete: z.boolean().optional(),
});
export type UpdateOnboardingStateInput = z.infer<
  typeof UpdateOnboardingStateSchema
>;

export const QuickProfileUpdateSchema = z.object({
  teamId: z.string().min(1).optional(),
  firstName: z.string().trim().min(1, "Vorname erforderlich.").max(60).optional(),
  lastName: z.string().trim().min(1, "Nachname erforderlich.").max(60).optional(),
  phone: optionalPhoneSchema,
  emergencyContact: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional(),
  primaryPosition: z
    .enum(["TW", "LA", "RL", "RM", "RR", "RA", "KM"])
    .nullable()
    .optional(),
  secondaryPosition: z
    .enum(["TW", "LA", "RL", "RM", "RR", "RA", "KM"])
    .nullable()
    .optional(),
  throwingHand: z.enum(["RIGHT", "LEFT", "BOTH"]).nullable().optional(),
  availabilityStatus: z.enum(["FIT", "INJURED", "UNAVAILABLE"]).optional(),
  injuryNote: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional(),
  /** Optionales Update für ein verknüpftes Kind (bei Eltern-Profilen) */
  childMemberId: z.string().min(1).optional(),
  childEmergencyContact: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional(),
  childInjuryNote: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .transform((v) => (v === "" ? null : v))
    .optional(),
});
export type QuickProfileUpdateInput = z.infer<typeof QuickProfileUpdateSchema>;

export interface ProfileFieldHint {
  key: string;
  label: string;
  description: string;
}

export interface ProfileCompletenessResult {
  percentage: number;
  completedCount: number;
  totalCount: number;
  missingFields: ProfileFieldHint[];
  isComplete: boolean;
}

export interface TourStepDefinition {
  id: string;
  /** Entspricht dem `data-tour-id`-Attribut in der App-Shell oder auf dem Dashboard */
  targetId: string;
  title: string;
  description: string;
  /** Optionale Route, auf die dieser Schritt verweist */
  routeHint?: string;
}

/**
 * Rollenspezifische App-Kurztour (bewusst maximal 3–4 kurze Schritte, ~20 Sekunden).
 */
export const ROLE_TOUR_STEPS: Record<MemberRole, TourStepDefinition[]> = {
  CLUB_ADMIN: [
    {
      id: "admin-switcher",
      targetId: "team-switcher",
      title: "Verein & Mannschaftswechsler",
      description:
        "Hier wechselst du mit einem Tipp zwischen allen Mannschaften deines Vereins.",
    },
    {
      id: "admin-team",
      targetId: "nav-team",
      title: "Kader & 1-Klick-Einladungen",
      description:
        "Lade Trainer, Betreuer, Spieler und Eltern per WhatsApp, QR-Code oder 6-stelligem Code ein.",
      routeHint: "/team",
    },
    {
      id: "admin-verwaltung",
      targetId: "nav-verwaltung",
      title: "Vereins- & Saisonverwaltung",
      description:
        "Verwalte Saisons und zentrale Vereinsdaten an einem Ort.",
      routeHint: "/verwaltung",
    },
    {
      id: "admin-profil",
      targetId: "nav-profil",
      title: "Dein Profil & Passkey",
      description:
        "Richte Face ID / Fingerabdruck ein oder starte diese Kurztour jederzeit erneut.",
      routeHint: "/profil",
    },
  ],
  COACH: [
    {
      id: "coach-dashboard",
      targetId: "nav-dashboard",
      title: "Deine Trainer-Übersicht",
      description:
        "Nächster Termin, Zu-/Absagen und verletzte Spieler auf einen Blick.",
      routeHint: "/dashboard",
    },
    {
      id: "coach-team",
      targetId: "nav-team",
      title: "Kader & Einladungen",
      description:
        "Lege Spieler an und lade dein Team per QR-Code, WhatsApp oder kurzem Team-Code ein.",
      routeHint: "/team",
    },
    {
      id: "coach-termine",
      targetId: "nav-termine",
      title: "Termine, Hallen & Liga-Sync",
      description:
        "Plane Trainings, verknüpfe den offiziellen Spielplan und behalte alle Rückmeldungen im Blick.",
      routeHint: "/termine",
    },
    {
      id: "coach-taktik",
      targetId: "nav-taktik",
      title: "Taktiktafel & Training",
      description:
        "Zeichne Spielzüge, plane Einheiten und gib fertige Spielzüge für deine Mannschaft frei.",
      routeHint: "/taktik",
    },
  ],
  ASSISTANT_COACH: [
    {
      id: "assistant-dashboard",
      targetId: "nav-dashboard",
      title: "Alles Wichtige auf einen Blick",
      description:
        "Sieh sofort, wer beim nächsten Training oder Spiel dabei ist und wer ausfällt.",
      routeHint: "/dashboard",
    },
    {
      id: "assistant-team",
      targetId: "nav-team",
      title: "Kader & Einladungen",
      description:
        "Pflege den Kader, lade neue Spieler ein und greife im Notfall auf Notfallkontakte zu.",
      routeHint: "/team",
    },
    {
      id: "assistant-termine",
      targetId: "nav-termine",
      title: "Termine & Rückmeldungen",
      description:
        "Erstelle Trainings, verwalte Zu-/Absagen und koordiniere Fahrgemeinschaften.",
      routeHint: "/termine",
    },
    {
      id: "assistant-taktik",
      targetId: "nav-taktik",
      title: "Taktik & Trainingspläne",
      description:
        "Unterstütze direkt bei Trainingsinhalten, Übungen und Spielzügen.",
      routeHint: "/taktik",
    },
  ],
  TEAM_MANAGER: [
    {
      id: "manager-dashboard",
      targetId: "nav-dashboard",
      title: "Deine Betreuer-Zentrale",
      description:
        "Alle anstehenden Termine, Rückmeldungen und Aufgaben direkt auf dem Startbildschirm.",
      routeHint: "/dashboard",
    },
    {
      id: "manager-team",
      targetId: "nav-team",
      title: "Kader, Einladungen & Notfallkontakte",
      description:
        "Lade Spieler oder Eltern ein und habe Notfallkontakte sowie Trikotsätze immer griffbereit.",
      routeHint: "/team",
    },
    {
      id: "manager-termine",
      targetId: "nav-termine",
      title: "Termine & Fahrgemeinschaften",
      description:
        "Koordiniere Abfahrtszeiten, Hallen-Infos und Fahrgemeinschaften für Auswärtsspiele.",
      routeHint: "/termine",
    },
    {
      id: "manager-dienste",
      targetId: "nav-dienste",
      title: "Dienste & Organisation",
      description:
        "Organisiere Zeitnehmer, Trikotwäsche und Spieltagsdienste zuverlässig im Team.",
      routeHint: "/dienste",
    },
  ],
  TREASURER: [
    {
      id: "treasurer-kasse",
      targetId: "nav-kasse",
      title: "Deine Mannschaftskasse",
      description:
        "Trage Strafen, Einzahlungen und Ausgaben ein, markiere bezahlte Posten und pflege den Strafenkatalog.",
      routeHint: "/kasse",
    },
    {
      id: "treasurer-dashboard",
      targetId: "nav-dashboard",
      title: "Überblick & nächste Termine",
      description:
        "Auf der Startseite siehst du jederzeit anstehende Spiele, Trainings und wichtige Team-Infos.",
      routeHint: "/dashboard",
    },
    {
      id: "treasurer-profil",
      targetId: "nav-profil",
      title: "Dein Profil & schneller Login",
      description:
        "Pflege deine Kontaktdaten oder aktiviere Face ID / Fingerabdruck für den schnellen Zugriff.",
      routeHint: "/profil",
    },
  ],
  PLAYER: [
    {
      id: "player-dashboard",
      targetId: "nav-dashboard",
      title: "Zu- & Absagen mit einem Tipp",
      description:
        "Auf der Übersicht siehst du sofort den nächsten Termin und kannst direkt zu- oder absagen.",
      routeHint: "/dashboard",
    },
    {
      id: "player-termine",
      targetId: "nav-termine",
      title: "Alle Spiele, Trainings & Hallen",
      description:
        "Hier findest du Anwurfzeiten, Hallenadressen, Harz-Hinweise und Fahrgemeinschaften.",
      routeHint: "/termine",
    },
    {
      id: "player-dienste",
      targetId: "nav-dienste",
      title: "Deine Dienste & Trikotwäsche",
      description:
        "Sieh auf einen Blick, wann du für Zeitnehmer, Kiosk oder Trikotwäsche eingeteilt bist.",
      routeHint: "/dienste",
    },
    {
      id: "player-profil",
      targetId: "nav-profil",
      title: "Dein Profil & schneller Login",
      description:
        "Ergänze Position, Notfallkontakt oder richte Face ID / Fingerabdruck ein.",
      routeHint: "/profil",
    },
  ],
  PARENT: [
    {
      id: "parent-dashboard",
      targetId: "nav-dashboard",
      title: "Zu- & Absagen für dein Kind",
      description:
        "Melde dein Kind direkt auf der Startseite mit einem Tipp für Training oder Spiel an und ab.",
      routeHint: "/dashboard",
    },
    {
      id: "parent-termine",
      targetId: "nav-termine",
      title: "Termine, Hallen & Fahrgemeinschaften",
      description:
        "Alle Spielorte inkl. Navigation sowie Mitfahrgelegenheiten zu Auswärtsspielen.",
      routeHint: "/termine",
    },
    {
      id: "parent-dienste",
      targetId: "nav-dienste",
      title: "Helfer- & Trikotwäsche-Dienste",
      description:
        "Übernimm unkompliziert Dienste am Spieltag oder tausche Termine mit anderen Eltern.",
      routeHint: "/dienste",
    },
    {
      id: "parent-profil",
      targetId: "nav-profil",
      title: "Notfallkontakt & Kind-Profil",
      description:
        "Halte Notfallkontakt und wichtige Hinweise aktuell – nur für Trainer und Betreuer sichtbar.",
      routeHint: "/profil",
    },
  ],
  HELPER: [
    {
      id: "helper-dienste",
      targetId: "nav-dienste",
      title: "Offene & deine Dienste",
      description:
        "Hier siehst du alle Spieltags-Dienste (z. B. Kiosk, Zeitnehmer, Aufbau) und kannst Schichten übernehmen.",
      routeHint: "/dienste",
    },
    {
      id: "helper-termine",
      targetId: "nav-termine",
      title: "Heimspieltage & Zeiten",
      description:
        "Alle Termine, Hallen und Treffpunkte deiner Mannschaft auf einen Blick.",
      routeHint: "/termine",
    },
    {
      id: "helper-profil",
      targetId: "nav-profil",
      title: "Dein Profil & Login",
      description:
        "Pflege deine Kontaktdaten oder aktiviere den 1-Klick-Login per Fingerabdruck / Face ID.",
      routeHint: "/profil",
    },
  ],
};
