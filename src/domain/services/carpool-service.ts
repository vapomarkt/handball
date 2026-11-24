import { EventRepository } from "../adapters/event-repositories";
import { CarpoolRepository } from "../adapters/league-provider";
import { MemberRepository } from "../adapters/repositories";
import { DomainError } from "../errors";
import {
  canSubmitRsvpForMember,
  canViewTeam,
  isTeamStaff,
  ViewerContext,
} from "../policies/rbac";
import {
  BookCarpoolSeatSchema,
  CarpoolBookingDTO,
  CarpoolDTO,
  CreateCarpoolSchema,
} from "../schemas/carpool";

export class CarpoolService {
  constructor(
    private readonly events: EventRepository,
    private readonly members: MemberRepository,
    private readonly carpools: CarpoolRepository
  ) {}

  async listCarpools(
    viewer: ViewerContext,
    teamId: string,
    eventId: string
  ): Promise<CarpoolDTO[]> {
    const event = await this.events.findById(eventId);
    if (!event || event.teamId !== teamId) {
      throw DomainError.notFound("Termin nicht gefunden.");
    }
    if (!canViewTeam(viewer, event.teamId, event.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Termin.");
    }
    return this.carpools.listByEventId(eventId);
  }

  async offerCarpool(
    viewer: ViewerContext,
    teamId: string,
    eventId: string,
    rawInput: unknown
  ): Promise<CarpoolDTO> {
    const event = await this.events.findById(eventId);
    if (!event || event.teamId !== teamId) {
      throw DomainError.notFound("Termin nicht gefunden.");
    }
    if (!canViewTeam(viewer, event.teamId, event.clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf diesen Termin.");
    }

    const parsed = CreateCarpoolSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Fahrgemeinschaftsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const driver = await this.members.findById(parsed.data.driverMemberId);
    if (!driver || driver.teamId !== teamId) {
      throw DomainError.notFound("Fahrer-Profil nicht gefunden.");
    }
    if (!canSubmitRsvpForMember(viewer, driver)) {
      throw DomainError.forbidden(
        "Du kannst nur für dein eigenes Profil (oder als Trainer) eine Fahrt anbieten."
      );
    }

    return this.carpools.create(eventId, parsed.data);
  }

  async deleteCarpool(
    viewer: ViewerContext,
    teamId: string,
    eventId: string,
    carpoolId: string
  ): Promise<void> {
    const carpool = await this.carpools.findById(carpoolId);
    if (!carpool || carpool.eventId !== eventId || carpool.teamId !== teamId) {
      throw DomainError.notFound("Fahrgemeinschaft nicht gefunden.");
    }

    const isDriver =
      carpool.driverUserId !== null && carpool.driverUserId === viewer.userId;
    const staff = isTeamStaff(viewer, carpool.teamId, carpool.clubId);
    if (!isDriver && !staff) {
      throw DomainError.forbidden(
        "Nur der Fahrer oder Trainer dürfen diese Fahrgemeinschaft löschen."
      );
    }

    await this.carpools.delete(carpoolId);
  }

  async bookSeat(
    viewer: ViewerContext,
    teamId: string,
    eventId: string,
    carpoolId: string,
    rawInput: unknown
  ): Promise<CarpoolBookingDTO> {
    const carpool = await this.carpools.findById(carpoolId);
    if (!carpool || carpool.eventId !== eventId || carpool.teamId !== teamId) {
      throw DomainError.notFound("Fahrgemeinschaft nicht gefunden.");
    }

    const parsed = BookCarpoolSeatSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Buchungsdaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    const passenger = await this.members.findById(parsed.data.passengerMemberId);
    if (!passenger || passenger.teamId !== teamId) {
      throw DomainError.notFound("Mitfahrer-Profil nicht gefunden.");
    }
    if (!canSubmitRsvpForMember(viewer, passenger)) {
      throw DomainError.forbidden(
        "Du kannst nur für dich selbst oder deine verknüpften Kinder einen Mitfahrplatz buchen."
      );
    }

    if (passenger.id === carpool.driverMemberId) {
      throw DomainError.validation(
        "Der Fahrer benötigt keinen eigenen Mitfahrplatz."
      );
    }

    if (carpool.bookings.some((b) => b.passengerMemberId === passenger.id)) {
      throw DomainError.conflict(
        "Für dieses Mitglied ist bereits ein Platz in dieser Fahrgemeinschaft gebucht."
      );
    }

    if (carpool.availableSeats <= 0) {
      throw DomainError.conflict(
        "In dieser Fahrgemeinschaft sind leider keine freien Plätze mehr verfügbar."
      );
    }

    return this.carpools.createBooking({
      carpoolId: carpool.id,
      passengerMemberId: passenger.id,
      bookedByUserId: viewer.userId,
    });
  }

  async cancelBooking(
    viewer: ViewerContext,
    teamId: string,
    eventId: string,
    carpoolId: string,
    bookingId: string
  ): Promise<void> {
    const booking = await this.carpools.findBookingById(bookingId);
    if (
      !booking ||
      booking.carpoolId !== carpoolId ||
      booking.eventId !== eventId ||
      booking.teamId !== teamId
    ) {
      throw DomainError.notFound("Buchung nicht gefunden.");
    }

    const staff = isTeamStaff(viewer, booking.teamId, booking.clubId);
    const isOwner =
      booking.bookedByUserId === viewer.userId ||
      booking.passengerUserId === viewer.userId ||
      viewer.linkedChildMemberIds.includes(booking.passengerMemberId);

    if (!staff && !isOwner) {
      throw DomainError.forbidden(
        "Keine Berechtigung zum Stornieren dieser Buchung."
      );
    }

    await this.carpools.deleteBooking(bookingId);
  }
}
