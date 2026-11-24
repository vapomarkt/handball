import {
  CreateVenueInput,
  DeclineReasonCategory,
  EventAttendanceEntity,
  EventEntity,
  EventType,
  MatchDetailsDTO,
  UpdateEventInput,
  UpdateMatchDetailsInput,
  UpdateVenueInput,
  VenueDTO,
} from "../schemas/event";
import { RsvpStatus } from "../schemas/handball";

export interface VenueRepository {
  findByClubId(clubId: string): Promise<VenueDTO[]>;
  findById(venueId: string): Promise<VenueDTO | null>;
  create(clubId: string, input: CreateVenueInput): Promise<VenueDTO>;
  update(venueId: string, input: UpdateVenueInput): Promise<VenueDTO>;
  delete(venueId: string): Promise<void>;
}

export interface CreateEventRecordInput {
  clubId: string;
  teamId: string;
  recurrenceId?: string | null;
  venueId?: string | null;
  type: EventType;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  meetingAt?: Date | null;
  rsvpDeadlineAt?: Date | null;
  requireDeclineReason: boolean;
  matchDetails?: {
    opponentName: string;
    isHome: boolean;
    throwOffAt?: Date | null;
    jerseyColor?: string | null;
    refereeNote?: string | null;
  };
}

export interface CreateRecurrenceRecordInput {
  clubId: string;
  teamId: string;
  venueId?: string | null;
  type: EventType;
  title: string;
  description?: string | null;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  startDate: Date;
  endDate: Date;
  excludedDates: string[];
  rsvpDeadlineHours?: number | null;
  requireDeclineReason: boolean;
}

export interface EventRepository {
  findByTeamId(
    teamId: string,
    options?: { from?: Date; to?: Date; type?: EventType }
  ): Promise<EventEntity[]>;
  findById(eventId: string): Promise<EventEntity | null>;
  createSingle(input: CreateEventRecordInput): Promise<EventEntity>;
  createRecurringSeries(
    recurrence: CreateRecurrenceRecordInput,
    occurrences: Array<{
      startAt: Date;
      endAt: Date;
      rsvpDeadlineAt: Date | null;
    }>
  ): Promise<{ recurrenceId: string; events: EventEntity[] }>;
  update(eventId: string, input: UpdateEventInput): Promise<EventEntity>;
  delete(eventId: string): Promise<void>;
  upsertAttendance(input: {
    eventId: string;
    memberId: string;
    status: RsvpStatus;
    declineReasonCategory: DeclineReasonCategory | null;
    declineReason: string | null;
    respondedByUserId: string;
  }): Promise<EventAttendanceEntity>;
  upsertMatchDetails(
    eventId: string,
    input: UpdateMatchDetailsInput
  ): Promise<MatchDetailsDTO>;
}
