import { VenueRepository } from "../adapters/event-repositories";
import { DomainError } from "../errors";
import { canManageVenues, canViewClub, ViewerContext } from "../policies/rbac";
import {
  CreateVenueSchema,
  UpdateVenueSchema,
  VenueDTO,
} from "../schemas/event";

export class VenueService {
  constructor(private readonly venues: VenueRepository) {}

  async listVenues(viewer: ViewerContext, clubId: string): Promise<VenueDTO[]> {
    if (!canViewClub(viewer, clubId)) {
      throw DomainError.forbidden("Kein Zugriff auf die Hallen dieses Vereins.");
    }
    return this.venues.findByClubId(clubId);
  }

  async createVenue(
    viewer: ViewerContext,
    clubId: string,
    rawInput: unknown
  ): Promise<VenueDTO> {
    if (!canManageVenues(viewer, clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen Hallen anlegen."
      );
    }

    const parsed = CreateVenueSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Hallendaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.venues.create(clubId, parsed.data);
  }

  async updateVenue(
    viewer: ViewerContext,
    clubId: string,
    venueId: string,
    rawInput: unknown
  ): Promise<VenueDTO> {
    const existing = await this.venues.findById(venueId);
    if (!existing || existing.clubId !== clubId) {
      throw DomainError.notFound("Halle nicht gefunden.");
    }
    if (!canManageVenues(viewer, clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen Hallen bearbeiten."
      );
    }

    const parsed = UpdateVenueSchema.safeParse(rawInput);
    if (!parsed.success) {
      throw DomainError.validation(
        "Ungültige Hallendaten.",
        parsed.error.flatten().fieldErrors
      );
    }

    return this.venues.update(venueId, parsed.data);
  }

  async deleteVenue(
    viewer: ViewerContext,
    clubId: string,
    venueId: string
  ): Promise<void> {
    const existing = await this.venues.findById(venueId);
    if (!existing || existing.clubId !== clubId) {
      throw DomainError.notFound("Halle nicht gefunden.");
    }
    if (!canManageVenues(viewer, clubId)) {
      throw DomainError.forbidden(
        "Nur Trainer oder Vereins-Admins dürfen Hallen löschen."
      );
    }
    await this.venues.delete(venueId);
  }
}
