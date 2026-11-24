import {
  DutyAssignmentStatus,
  MemberWorkHoursDTO,
  TeamWorkHoursSummaryDTO,
} from "../schemas/duty";

export interface WorkHoursMemberInput {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface WorkHoursAssignmentInput {
  memberId: string;
  status: DutyAssignmentStatus;
  hoursCredit: number;
}

/**
 * Reiner Arbeitsstunden-Rechner:
 * Summiert geleistete (COMPLETED) und geplante (ASSIGNED / SWAP_REQUESTED)
 * Vereins- und Teamdienste pro Mitglied gegen das optionale Jahres-Soll.
 */
export function computeTeamWorkHoursSummary(
  teamId: string,
  members: WorkHoursMemberInput[],
  assignments: WorkHoursAssignmentInput[],
  annualTargetHours = 8
): TeamWorkHoursSummaryDTO {
  const byMember = new Map<
    string,
    {
      completedDuties: number;
      completedHours: number;
      plannedDuties: number;
      plannedHours: number;
    }
  >();

  for (const a of assignments) {
    const bucket = byMember.get(a.memberId) ?? {
      completedDuties: 0,
      completedHours: 0,
      plannedDuties: 0,
      plannedHours: 0,
    };

    if (a.status === "COMPLETED") {
      bucket.completedDuties += 1;
      bucket.completedHours += a.hoursCredit;
    } else if (a.status === "ASSIGNED" || a.status === "SWAP_REQUESTED") {
      bucket.plannedDuties += 1;
      bucket.plannedHours += a.hoursCredit;
    }

    byMember.set(a.memberId, bucket);
  }

  let totalCompletedHours = 0;
  let totalPlannedHours = 0;

  const memberRows: MemberWorkHoursDTO[] = members.map((m) => {
    const b = byMember.get(m.id) ?? {
      completedDuties: 0,
      completedHours: 0,
      plannedDuties: 0,
      plannedHours: 0,
    };
    const completedHours = Math.round(b.completedHours * 100) / 100;
    const plannedHours = Math.round(b.plannedHours * 100) / 100;
    totalCompletedHours += completedHours;
    totalPlannedHours += plannedHours;

    const remainingHours = Math.max(
      0,
      Math.round((annualTargetHours - completedHours) * 100) / 100
    );
    const fulfillmentPercent =
      annualTargetHours > 0
        ? Math.min(100, Math.round((completedHours / annualTargetHours) * 100))
        : 100;

    return {
      memberId: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      role: m.role,
      completedDuties: b.completedDuties,
      completedHours,
      plannedDuties: b.plannedDuties,
      plannedHours,
      targetHours: annualTargetHours,
      remainingHours,
      fulfillmentPercent,
    };
  });

  return {
    teamId,
    annualTargetHours,
    totalCompletedHours: Math.round(totalCompletedHours * 100) / 100,
    totalPlannedHours: Math.round(totalPlannedHours * 100) / 100,
    members: memberRows,
  };
}
