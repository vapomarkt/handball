import { describe, expect, it } from "vitest";
import {
  canViewSensitiveMemberFields,
  projectAttendanceDTO,
  projectTeamMemberDTO,
} from "@/domain/policies/gdpr";
import {
  canCreateTeam,
  canDeleteMember,
  canManageClub,
  canManageEvents,
  canManageInvites,
  canManageRoster,
  canManageTacticsAndTraining,
  canManageVenues,
  canViewTeam,
  getMemberEditScope,
  ViewerContext,
} from "@/domain/policies/rbac";
import { TeamMemberEntity } from "@/domain/schemas/member";

const CLUB_ID = "club-tsv";
const OTHER_CLUB_ID = "club-other";
const TEAM_H1 = "team-h1";
const TEAM_MC = "team-mc";

const sampleTeammate: TeamMemberEntity = {
  id: "member-jonas",
  clubId: CLUB_ID,
  teamId: TEAM_H1,
  userId: "user-jonas",
  role: "PLAYER",
  firstName: "Jonas",
  lastName: "Keller",
  email: "jonas@example.de",
  phone: "+49 174 5556677",
  jerseyNumber: 7,
  primaryPosition: "LA",
  secondaryPosition: "RM",
  throwingHand: "RIGHT",
  availabilityStatus: "INJURED",
  teamRoles: ["Kassenwart"],
  isMinor: false,
  passNumber: "DHB-2026-10407",
  injuryNote: "Bänderdehnung im Sprunggelenk",
  emergencyContact: "Maria Keller (+49 174 5556677)",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const sampleChild: TeamMemberEntity = {
  ...sampleTeammate,
  id: "member-leo",
  teamId: TEAM_MC,
  userId: null,
  firstName: "Leo",
  lastName: "Weber",
  isMinor: true,
  passNumber: "DHB-JUG-4414",
  emergencyContact: "Katrin Weber (+49 177 1234567)",
  injuryNote: "Leichte Prellung am Knie",
};

const sampleOtherChild: TeamMemberEntity = {
  ...sampleChild,
  id: "member-ben",
  firstName: "Ben",
  lastName: "Schulz",
  passNumber: "DHB-JUG-4401",
  emergencyContact: "Martin Schulz (+49 178 2345678)",
};

const clubAdminViewer: ViewerContext = {
  userId: "user-admin",
  email: "admin@tsv.de",
  name: "Sabine Krause",
  memberships: [
    {
      memberId: "m-admin",
      clubId: CLUB_ID,
      teamId: TEAM_H1,
      role: "CLUB_ADMIN",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const coachViewer: ViewerContext = {
  userId: "user-coach",
  email: "coach@tsv.de",
  name: "Markus Brenner",
  memberships: [
    { memberId: "m-coach", clubId: CLUB_ID, teamId: TEAM_H1, role: "COACH" },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const assistantCoachViewer: ViewerContext = {
  userId: "user-co",
  email: "co@tsv.de",
  name: "Co Trainer",
  memberships: [
    {
      memberId: "m-co",
      clubId: CLUB_ID,
      teamId: TEAM_H1,
      role: "ASSISTANT_COACH",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const playerViewer: ViewerContext = {
  userId: "user-lukas",
  email: "lukas@tsv.de",
  name: "Lukas Hartmann",
  memberships: [
    { memberId: "m-lukas", clubId: CLUB_ID, teamId: TEAM_H1, role: "PLAYER" },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const selfJonasViewer: ViewerContext = {
  userId: "user-jonas",
  email: "jonas@example.de",
  name: "Jonas Keller",
  memberships: [
    {
      memberId: "member-jonas",
      clubId: CLUB_ID,
      teamId: TEAM_H1,
      role: "PLAYER",
    },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

const parentViewer: ViewerContext = {
  userId: "user-parent",
  email: "katrin@tsv.de",
  name: "Katrin Weber",
  memberships: [
    { memberId: "m-parent", clubId: CLUB_ID, teamId: TEAM_MC, role: "PARENT" },
  ],
  linkedChildMemberIds: ["member-leo"],
  linkedChildTeamIds: [TEAM_MC],
};

const helperViewer: ViewerContext = {
  userId: "user-helper",
  email: "helfer@tsv.de",
  name: "Helfer Hans",
  memberships: [
    { memberId: "m-helper", clubId: CLUB_ID, teamId: TEAM_H1, role: "HELPER" },
  ],
  linkedChildMemberIds: [],
  linkedChildTeamIds: [],
};

describe("RBAC Berechtigungsregeln", () => {
  it("gewährt CLUB_ADMIN Zugriff auf alle Teams seines Vereins, aber nicht auf fremde Vereine", () => {
    expect(canManageClub(clubAdminViewer, CLUB_ID)).toBe(true);
    expect(canManageClub(clubAdminViewer, OTHER_CLUB_ID)).toBe(false);
    expect(canViewTeam(clubAdminViewer, TEAM_MC, CLUB_ID)).toBe(true);
    expect(canManageRoster(clubAdminViewer, TEAM_MC, CLUB_ID)).toBe(true);
    expect(canDeleteMember(clubAdminViewer, TEAM_MC, CLUB_ID)).toBe(true);
  });

  it("gewährt COACH und ASSISTANT_COACH Kader- und Einladungsrechte nur im eigenen Team", () => {
    expect(canManageRoster(coachViewer, TEAM_H1, CLUB_ID)).toBe(true);
    expect(canManageRoster(coachViewer, TEAM_MC, CLUB_ID)).toBe(false);
    expect(canDeleteMember(coachViewer, TEAM_H1, CLUB_ID)).toBe(true);
    expect(canCreateTeam(coachViewer, CLUB_ID)).toBe(true);

    expect(canManageRoster(assistantCoachViewer, TEAM_H1, CLUB_ID)).toBe(true);
    expect(canManageInvites(assistantCoachViewer, TEAM_H1, CLUB_ID)).toBe(true);
    // Co-Trainer darf keine Mitglieder endgültig löschen
    expect(canDeleteMember(assistantCoachViewer, TEAM_H1, CLUB_ID)).toBe(false);
  });

  it("verweigert PLAYER, PARENT und HELPER Verwaltungsrechte", () => {
    for (const v of [playerViewer, parentViewer, helperViewer]) {
      expect(canManageClub(v, CLUB_ID)).toBe(false);
      expect(canCreateTeam(v, CLUB_ID)).toBe(false);
      expect(canManageRoster(v, TEAM_H1, CLUB_ID)).toBe(false);
      expect(canManageInvites(v, TEAM_H1, CLUB_ID)).toBe(false);
      expect(canDeleteMember(v, TEAM_H1, CLUB_ID)).toBe(false);
    }
  });

  it("berechnet den Bearbeitungs-Scope korrekt (FULL, SELF_OR_GUARDIAN, NONE)", () => {
    expect(getMemberEditScope(coachViewer, sampleTeammate)).toBe("FULL");
    expect(getMemberEditScope(selfJonasViewer, sampleTeammate)).toBe(
      "SELF_OR_GUARDIAN"
    );
    expect(getMemberEditScope(playerViewer, sampleTeammate)).toBe("NONE");
    expect(getMemberEditScope(parentViewer, sampleChild)).toBe(
      "SELF_OR_GUARDIAN"
    );
    expect(getMemberEditScope(parentViewer, sampleOtherChild)).toBe("NONE");
  });
});

describe("DSGVO-Feldsichtbarkeit & serverseitige DTO-Projektion", () => {
  it("liefert für PLAYER bei Mitspielern KEINE sensiblen Felder aus (nicht einmal als Keys)", () => {
    expect(canViewSensitiveMemberFields(playerViewer, sampleTeammate)).toBe(
      false
    );

    const dto = projectTeamMemberDTO(playerViewer, sampleTeammate);
    expect(dto.canViewSensitive).toBe(false);
    expect(dto.firstName).toBe("Jonas");
    expect(dto.primaryPosition).toBe("LA");
    expect(dto.availabilityStatus).toBe("INJURED");

    // Verbindlicher DSGVO-Check: Sensible Felder dürfen im Payload nicht existieren
    expect("emergencyContact" in dto).toBe(false);
    expect("passNumber" in dto).toBe(false);
    expect("injuryNote" in dto).toBe(false);
    expect("phone" in dto).toBe(false);
    expect("email" in dto).toBe(false);
  });

  it("liefert für HELPER ebenfalls KEINE sensiblen Felder aus", () => {
    const dto = projectTeamMemberDTO(helperViewer, sampleTeammate);
    expect(dto.canViewSensitive).toBe(false);
    expect("emergencyContact" in dto).toBe(false);
    expect("passNumber" in dto).toBe(false);
    expect("injuryNote" in dto).toBe(false);
  });

  it("liefert für COACH, ASSISTANT_COACH, CLUB_ADMIN und den User selbst alle sensiblen Felder aus", () => {
    for (const viewer of [
      clubAdminViewer,
      coachViewer,
      assistantCoachViewer,
      selfJonasViewer,
    ]) {
      const dto = projectTeamMemberDTO(viewer, sampleTeammate);
      expect(dto.canViewSensitive).toBe(true);
      if (dto.canViewSensitive) {
        expect(dto.passNumber).toBe("DHB-2026-10407");
        expect(dto.emergencyContact).toBe("Maria Keller (+49 174 5556677)");
        expect(dto.injuryNote).toBe("Bänderdehnung im Sprunggelenk");
      }
    }
  });

  it("liefert für PARENT sensible Felder NUR für das eigene verknüpfte Kind, niemals für andere Kinder", () => {
    const ownChildDto = projectTeamMemberDTO(parentViewer, sampleChild);
    expect(ownChildDto.canViewSensitive).toBe(true);
    if (ownChildDto.canViewSensitive) {
      expect(ownChildDto.passNumber).toBe("DHB-JUG-4414");
      expect(ownChildDto.emergencyContact).toBe("Katrin Weber (+49 177 1234567)");
    }

    const otherChildDto = projectTeamMemberDTO(parentViewer, sampleOtherChild);
    expect(otherChildDto.canViewSensitive).toBe(false);
    expect("passNumber" in otherChildDto).toBe(false);
    expect("emergencyContact" in otherChildDto).toBe(false);
    expect("injuryNote" in otherChildDto).toBe(false);
  });

  it("versteckt fremde RSVP-Absagegründe (declineReason) vor Mitspielern (PLAYER)", () => {
    const attendance = {
      id: "att-1",
      eventId: "evt-1",
      memberId: sampleTeammate.id,
      clubId: CLUB_ID,
      teamId: TEAM_H1,
      memberUserId: sampleTeammate.userId,
      status: "DECLINED" as const,
      declineReason: "Arzttermin wegen Knieverletzung",
    };

    const forTeammate = projectAttendanceDTO(playerViewer, attendance);
    expect(forTeammate.status).toBe("DECLINED");
    expect("declineReason" in forTeammate).toBe(false);

    const forCoach = projectAttendanceDTO(coachViewer, attendance);
    expect("declineReason" in forCoach).toBe(true);
    if ("declineReason" in forCoach) {
      expect(forCoach.declineReason).toBe("Arzttermin wegen Knieverletzung");
    }

    const forSelf = projectAttendanceDTO(selfJonasViewer, attendance);
    expect("declineReason" in forSelf).toBe(true);
  });

  it("gewährt Betreuer (TEAM_MANAGER) Orga- & DSGVO-Rechte, blockiert aber Löschen & Taktik-Schreiben", () => {
    const teamManagerViewer: ViewerContext = {
      userId: "user-manager",
      email: "betreuer@tsv.de",
      name: "Petra Brandt",
      memberships: [
        {
          memberId: "m-manager",
          clubId: CLUB_ID,
          teamId: TEAM_H1,
          role: "TEAM_MANAGER",
        },
      ],
      linkedChildMemberIds: [],
      linkedChildTeamIds: [],
    };

    expect(canViewTeam(teamManagerViewer, TEAM_H1, CLUB_ID)).toBe(true);
    expect(canManageRoster(teamManagerViewer, TEAM_H1, CLUB_ID)).toBe(true);
    expect(canManageInvites(teamManagerViewer, TEAM_H1, CLUB_ID)).toBe(true);
    expect(canManageEvents(teamManagerViewer, TEAM_H1, CLUB_ID)).toBe(true);
    expect(canManageVenues(teamManagerViewer, CLUB_ID)).toBe(true);
    expect(getMemberEditScope(teamManagerViewer, sampleTeammate)).toBe("FULL");

    // Kein Löschen von Kader-Mitgliedern und keine sportlich-taktischen Schreibrechte
    expect(canDeleteMember(teamManagerViewer, TEAM_H1, CLUB_ID)).toBe(false);
    expect(canManageTacticsAndTraining(teamManagerViewer, TEAM_H1, CLUB_ID)).toBe(
      false
    );
    expect(canManageClub(teamManagerViewer, CLUB_ID)).toBe(false);

    // DSGVO: Betreuer darf Notfallkontakte & Verletzungsnotizen im eigenen Team einsehen
    expect(canViewSensitiveMemberFields(teamManagerViewer, sampleTeammate)).toBe(
      true
    );
    const dto = projectTeamMemberDTO(teamManagerViewer, sampleTeammate);
    expect(dto.canViewSensitive).toBe(true);
    if (dto.canViewSensitive) {
      expect(dto.emergencyContact).toBe("Maria Keller (+49 174 5556677)");
    }
  });
});
