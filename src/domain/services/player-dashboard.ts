import type {
  TeamAnnouncementDTO,
  TeamPollDTO,
} from "../schemas/community";
import type {
  WorkDutyAssignmentDTO,
  WorkDutyDTO,
} from "../schemas/duty";
import type {
  EventAttendanceResponseDTO,
  EventDTO,
  VenueDTO,
} from "../schemas/event";
import type { RsvpStatus } from "../schemas/handball";

const UPCOMING_EVENT_CUTOFF_MS = 2 * 60 * 60 * 1000;
const PAST_DUTY_CUTOFF_MS = 4 * 60 * 60 * 1000;

export interface PersonalDutyItem {
  duty: WorkDutyDTO;
  assignment: WorkDutyAssignmentDTO;
  isLaundry: boolean;
  isSwapRequested: boolean;
}

/**
 * Liefert alle nicht abgesagten, anstehenden Termine (inkl. laufender Termine bis 2h nach Start),
 * aufsteigend nach Startzeit sortiert.
 */
export function getUpcomingEvents(
  events: readonly EventDTO[],
  nowMs: number = Date.now()
): EventDTO[] {
  const cutoff = nowMs - UPCOMING_EVENT_CUTOFF_MS;
  return events
    .filter((e) => !e.isCancelled && new Date(e.startAt).getTime() >= cutoff)
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
}

/**
 * Ermittelt den aktuellen RSVP-Status eines Mitglieds für einen Termin.
 */
export function getMemberRsvpStatus(
  event: Pick<EventDTO, "attendances">,
  memberId: string
): RsvpStatus {
  const found = event.attendances.find((a) => a.memberId === memberId);
  return found?.status ?? "PENDING";
}

/**
 * Prüft, ob die Rückmeldung für diesen Termin für Nicht-Staff bereits gesperrt ist
 * (abgesagt oder abgelaufene Rückmeldefrist).
 */
export function isEventRsvpLocked(
  event: Pick<EventDTO, "isCancelled" | "rsvpDeadlineAt">,
  isStaff: boolean,
  nowMs: number = Date.now()
): boolean {
  if (event.isCancelled) return true;
  if (isStaff) return false;
  if (!event.rsvpDeadlineAt) return false;
  const deadlineMs = new Date(event.rsvpDeadlineAt).getTime();
  if (Number.isNaN(deadlineMs)) return false;
  return nowMs > deadlineMs;
}

/**
 * Prüft, ob mindestens eines der übergebenen Mitglieder im Spieltagskader nominiert ist.
 */
export function isAnyMemberNominated(
  event: Pick<EventDTO, "matchDetails">,
  memberIds: readonly string[]
): boolean {
  const nominated = event.matchDetails?.nominatedMemberIds;
  if (!nominated || nominated.length === 0 || memberIds.length === 0) {
    return false;
  }
  const nominatedSet = new Set(nominated);
  return memberIds.some((id) => nominatedSet.has(id));
}

export interface OptimisticRsvpInput {
  eventId: string;
  memberId: string;
  status: RsvpStatus;
  memberFirstName?: string;
  memberLastName?: string;
  respondedAt?: string;
  attendance?: EventAttendanceResponseDTO;
}

/**
 * Wendet eine einzelne RSVP-Änderung optimistisch (oder nach Server-Antwort)
 * auf die Terminliste an und aktualisiert `attendances` sowie `summary` konsistent.
 */
export function applyOptimisticRsvpToEvents(
  events: readonly EventDTO[],
  input: OptimisticRsvpInput
): EventDTO[] {
  return events.map((ev) => {
    if (ev.id !== input.eventId) return ev;

    const existingIndex = ev.attendances.findIndex(
      (a) => a.memberId === input.memberId
    );
    const existing = existingIndex >= 0 ? ev.attendances[existingIndex] : null;
    const prevStatus: RsvpStatus = existing?.status ?? "PENDING";
    const nextStatus: RsvpStatus = input.attendance?.status ?? input.status;

    const nextAttendance: EventAttendanceResponseDTO =
      input.attendance ??
      (existing
        ? {
            ...existing,
            status: nextStatus,
            respondedAt: input.respondedAt ?? new Date().toISOString(),
          }
        : {
            id: `optimistic-${ev.id}-${input.memberId}`,
            eventId: ev.id,
            memberId: input.memberId,
            memberFirstName: input.memberFirstName ?? "",
            memberLastName: input.memberLastName ?? "",
            memberJerseyNumber: null,
            memberPrimaryPosition: null,
            status: nextStatus,
            respondedAt: input.respondedAt ?? new Date().toISOString(),
            canViewSensitive: false,
          });

    const nextAttendances =
      existingIndex >= 0
        ? ev.attendances.map((a, idx) =>
            idx === existingIndex ? nextAttendance : a
          )
        : [...ev.attendances, nextAttendance];

    const summary = { ...ev.summary };
    if (prevStatus !== nextStatus) {
      if (prevStatus === "ACCEPTED") {
        summary.accepted = Math.max(0, summary.accepted - 1);
      } else if (prevStatus === "DECLINED") {
        summary.declined = Math.max(0, summary.declined - 1);
      } else if (prevStatus === "MAYBE") {
        summary.maybe = Math.max(0, summary.maybe - 1);
      } else if (prevStatus === "PENDING") {
        summary.pending = Math.max(0, summary.pending - 1);
      }

      if (nextStatus === "ACCEPTED") summary.accepted += 1;
      else if (nextStatus === "DECLINED") summary.declined += 1;
      else if (nextStatus === "MAYBE") summary.maybe += 1;
      else if (nextStatus === "PENDING") summary.pending += 1;
    }

    return {
      ...ev,
      attendances: nextAttendances,
      summary,
    };
  });
}

/**
 * Filtert alle aktiven, anstehenden Dienste des Spielers (oder verknüpfter Kinder)
 * über sämtliche Dienst-Kategorien (Zeitnehmer, Kiosk, Trikotwäsche, Aufbau etc.).
 */
export function getPersonalUpcomingDuties(
  duties: readonly WorkDutyDTO[],
  params: {
    userId: string;
    memberId?: string | null;
    linkedChildIds: ReadonlySet<string>;
    nowMs?: number;
  }
): PersonalDutyItem[] {
  const nowMs = params.nowMs ?? Date.now();
  const cutoff = nowMs - PAST_DUTY_CUTOFF_MS;
  const items: PersonalDutyItem[] = [];

  for (const duty of duties) {
    const referenceIso = duty.endAt ?? duty.startAt;
    if (referenceIso) {
      const refMs = new Date(referenceIso).getTime();
      if (!Number.isNaN(refMs) && refMs < cutoff) {
        continue;
      }
    }

    const matchingAssignment = duty.assignments.find(
      (a) =>
        (a.status === "ASSIGNED" || a.status === "SWAP_REQUESTED") &&
        (a.assignedMemberUserId === params.userId ||
          (params.memberId != null && a.assignedMemberId === params.memberId) ||
          (a.assignedMemberId !== null &&
            params.linkedChildIds.has(a.assignedMemberId)))
    );

    if (matchingAssignment) {
      items.push({
        duty,
        assignment: matchingAssignment,
        isLaundry: duty.category === "JERSEY_LAUNDRY",
        isSwapRequested: matchingAssignment.status === "SWAP_REQUESTED",
      });
    }
  }

  return items.sort((a, b) => {
    const aMs = a.duty.startAt
      ? new Date(a.duty.startAt).getTime()
      : Number.POSITIVE_INFINITY;
    const bMs = b.duty.startAt
      ? new Date(b.duty.startAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (aMs !== bMs) return aMs - bMs;
    return a.duty.title.localeCompare(b.duty.title, "de");
  });
}

/**
 * Liefert offene Team-Umfragen, bei denen der aktuelle Nutzer noch nicht abgestimmt hat.
 */
export function getOpenUnvotedPolls(polls: readonly TeamPollDTO[]): TeamPollDTO[] {
  return polls
    .filter((p) => !p.isClosed && !p.options.some((o) => o.votedByMe))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

/**
 * Liefert die wichtigsten Team-Ankündigungen (angepinnte zuerst, dann neueste).
 */
export function getDashboardAnnouncements(
  announcements: readonly TeamAnnouncementDTO[],
  limit = 2
): TeamAnnouncementDTO[] {
  return [...announcements]
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    })
    .slice(0, Math.max(0, limit));
}

/**
 * Erzeugt einen sicheren Maps-/Navigations-Link für eine Halle
 * (bevorzugt gepflegte `mapsUrl`, sonst Google-Maps-Suche anhand der Adresse).
 */
export function buildVenueMapsHref(
  venue: Pick<VenueDTO, "mapsUrl" | "address" | "name"> | null | undefined
): string | null {
  if (!venue) return null;
  if (venue.mapsUrl && /^https?:\/\//i.test(venue.mapsUrl.trim())) {
    return venue.mapsUrl.trim();
  }
  const address = venue.address?.trim();
  if (address && address.length > 0) {
    const query = venue.name ? `${venue.name}, ${address}` : address;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return null;
}
