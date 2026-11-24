import { z } from "zod";

export const CreateCarpoolSchema = z.object({
  driverMemberId: z.string().min(1, "Fahrer-Profil erforderlich."),
  departureLocation: z
    .string()
    .trim()
    .min(2, "Abfahrtsort muss mindestens 2 Zeichen lang sein.")
    .max(150),
  departureTime: z.string().trim().max(40).nullable().optional(),
  totalSeats: z
    .number()
    .int()
    .min(1, "Mindestens 1 freier Platz erforderlich.")
    .max(9, "Maximal 9 Plätze pro Fahrzeug."),
  notes: z.string().trim().max(300).nullable().optional(),
});
export type CreateCarpoolInput = z.infer<typeof CreateCarpoolSchema>;

export const BookCarpoolSeatSchema = z.object({
  passengerMemberId: z.string().min(1, "Mitfahrer-Profil erforderlich."),
});
export type BookCarpoolSeatInput = z.infer<typeof BookCarpoolSeatSchema>;

export interface CarpoolBookingDTO {
  id: string;
  carpoolId: string;
  passengerMemberId: string;
  passengerFirstName: string;
  passengerLastName: string;
  bookedByUserId: string;
  createdAt: string;
}

export interface CarpoolDTO {
  id: string;
  eventId: string;
  driverMemberId: string;
  driverFirstName: string;
  driverLastName: string;
  driverUserId: string | null;
  departureLocation: string;
  departureTime: string | null;
  totalSeats: number;
  availableSeats: number;
  notes: string | null;
  bookings: CarpoolBookingDTO[];
  createdAt: string;
}
