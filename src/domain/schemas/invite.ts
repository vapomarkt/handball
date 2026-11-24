import { z } from "zod";
import { InviteType, InviteTypeSchema, MemberRole, MemberRoleSchema } from "./handball";

export const CreateTeamInviteSchema = z
  .object({
    type: InviteTypeSchema,
    role: MemberRoleSchema.default("PLAYER"),
    targetMemberId: z.string().min(1).optional().nullable(),
    maxUses: z.number().int().min(1).max(200).optional().nullable(),
    expiresInDays: z.number().int().min(1).max(90).default(14),
  })
  .superRefine((val, ctx) => {
    if (
      (val.type === "PROFILE_CLAIM" || val.type === "GUARDIAN_LINK") &&
      !val.targetMemberId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Für Profil-Claim- und Eltern-Einladungen muss ein konkretes Kader-Profil ausgewählt werden.",
        path: ["targetMemberId"],
      });
    }
  });
export type CreateTeamInviteInput = z.infer<typeof CreateTeamInviteSchema>;

export const ClaimInviteSchema = z.object({
  firstName: z.string().trim().min(1).max(60).optional(),
  lastName: z.string().trim().min(1).max(60).optional(),
  relationship: z.string().trim().min(2).max(40).default("Elternteil"),
});
export type ClaimInviteInput = z.infer<typeof ClaimInviteSchema>;

export const CreateGuardianLinkSchema = z.object({
  guardianEmail: z.string().trim().email("Gültige E-Mail-Adresse des Elternteils erforderlich."),
  childMemberId: z.string().min(1, "Jugendspieler-Profil muss ausgewählt sein."),
  relationship: z.string().trim().min(2).max(40).default("Elternteil"),
});
export type CreateGuardianLinkInput = z.infer<typeof CreateGuardianLinkSchema>;

export interface TeamInviteEntity {
  id: string;
  clubId: string;
  teamId: string;
  token: string;
  type: InviteType;
  role: MemberRole;
  targetMemberId: string | null;
  createdByUserId: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface TeamInviteDTO {
  id: string;
  clubId: string;
  teamId: string;
  token: string;
  type: InviteType;
  role: MemberRole;
  targetMemberId: string | null;
  targetMemberName?: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface InvitePreviewDTO {
  token: string;
  type: InviteType;
  role: MemberRole;
  clubName: string;
  teamName: string;
  seasonName: string;
  targetMemberFirstName: string | null;
  isValid: boolean;
  invalidReason?: string;
}

export interface GuardianLinkDTO {
  id: string;
  guardianUserId: string;
  guardianName: string;
  guardianEmail: string;
  childMemberId: string;
  childFirstName: string;
  childLastName: string;
  teamId: string;
  teamName: string;
  relationship: string;
  createdAt: string;
}
