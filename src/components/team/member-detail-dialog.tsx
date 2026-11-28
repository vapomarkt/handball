"use client";

import {
  Link2,
  Lock,
  Pencil,
  Phone,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AVAILABILITY_STATUS_LABELS,
  HANDBALL_POSITION_LABELS,
  MEMBER_ROLE_LABELS,
  THROWING_HAND_LABELS,
  type InviteType,
} from "@/domain/schemas/handball";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";
import { formatPhoneNumber, toTelHref } from "@/domain/schemas/phone";

interface MemberDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMemberResponseDTO | null;
  isStaff: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isLinkedChild: boolean;
  onEdit: (member: TeamMemberResponseDTO) => void;
  onOpenInvite: (memberId: string, type: InviteType) => void;
  onRequestDelete: (member: TeamMemberResponseDTO) => void;
}

export function MemberDetailDialog({
  open,
  onOpenChange,
  member,
  isStaff,
  canEdit,
  canDelete,
  isLinkedChild,
  onEdit,
  onOpenInvite,
  onRequestDelete,
}: MemberDetailDialogProps) {
  if (!member) return null;

  const sensitiveMember = member.canViewSensitive ? member : null;

  const hasSensitiveData = Boolean(
    sensitiveMember &&
      (sensitiveMember.passNumber ||
        sensitiveMember.emergencyContact ||
        sensitiveMember.injuryNote ||
        sensitiveMember.phone ||
        sensitiveMember.email)
  );

  const formattedPhone = sensitiveMember?.phone
    ? formatPhoneNumber(sensitiveMember.phone)
    : null;
  const telHref = sensitiveMember?.phone
    ? toTelHref(sensitiveMember.phone)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-mono text-base font-bold">
              {member.jerseyNumber !== null ? `#${member.jerseyNumber}` : "–"}
            </div>
            <div className="min-w-0">
              <DialogTitle>
                {member.firstName} {member.lastName}
              </DialogTitle>
              <DialogDescription>
                {MEMBER_ROLE_LABELS[member.role]}
                {member.isClubAdmin && member.role !== "CLUB_ADMIN"
                  ? " · Vereins-Admin"
                  : ""}
                {isLinkedChild ? " · Dein Kind" : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status & Sportliche Daten */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant={
                member.availabilityStatus === "FIT"
                  ? "fit"
                  : member.availabilityStatus === "INJURED"
                    ? "injured"
                    : "unavailable"
              }
            >
              {AVAILABILITY_STATUS_LABELS[member.availabilityStatus]}
            </Badge>
            {member.primaryPosition && (
              <Badge variant="position">
                {member.primaryPosition} ·{" "}
                {HANDBALL_POSITION_LABELS[member.primaryPosition].full}
              </Badge>
            )}
            {member.secondaryPosition && (
              <Badge variant="outline" className="font-mono">
                2. {member.secondaryPosition}
              </Badge>
            )}
            {!member.isClaimed && isStaff && (
              <Badge variant="secondary">Noch ohne Login</Badge>
            )}
          </div>

          {(member.throwingHand || member.teamRoles.length > 0) && (
            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs">
              {member.throwingHand && (
                <div>
                  <dt className="text-muted-foreground">Wurfhand</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">
                    {THROWING_HAND_LABELS[member.throwingHand]}
                  </dd>
                </div>
              )}
              {member.teamRoles.length > 0 && (
                <div>
                  <dt className="text-muted-foreground">Team-Ämter</dt>
                  <dd className="mt-0.5 font-semibold text-foreground">
                    {member.teamRoles.join(", ")}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* DSGVO-geschützte Profildaten */}
          {sensitiveMember && hasSensitiveData && (
            <div
              className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs space-y-2"
              data-testid="sensitive-member-fields"
            >
              <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" />
                <span>Geschützte Profildaten</span>
              </div>

              <dl className="space-y-1.5 text-foreground">
                {formattedPhone && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Telefon</dt>
                    <dd className="font-mono font-medium">
                      {telHref ? (
                        <a
                          href={telHref}
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {formattedPhone}
                        </a>
                      ) : (
                        formattedPhone
                      )}
                    </dd>
                  </div>
                )}
                {sensitiveMember.email && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">E-Mail</dt>
                    <dd className="truncate font-medium">
                      {sensitiveMember.email}
                    </dd>
                  </div>
                )}
                {sensitiveMember.passNumber && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">Pass-Nr.</dt>
                    <dd className="font-mono font-medium">
                      {sensitiveMember.passNumber}
                    </dd>
                  </div>
                )}
                {sensitiveMember.emergencyContact && (
                  <div className="flex flex-col gap-0.5 pt-1 border-t border-border/70">
                    <dt className="text-muted-foreground">Notfallkontakt</dt>
                    <dd className="font-medium">
                      {sensitiveMember.emergencyContact}
                    </dd>
                  </div>
                )}
              </dl>

              {sensitiveMember.injuryNote && (
                <p className="flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-red-800 dark:bg-red-950/50 dark:text-red-200">
                  <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{sensitiveMember.injuryNote}</span>
                </p>
              )}
            </div>
          )}

          {/* Aktionen */}
          {(canEdit || isStaff || canDelete) && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-2">
                {isStaff && !member.isClaimed && !member.isMinor && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenInvite(member.id, "PROFILE_CLAIM");
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Claim-Link
                  </Button>
                )}
                {isStaff && member.isMinor && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenInvite(member.id, "GUARDIAN_LINK");
                    }}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Eltern-Link
                  </Button>
                )}
                {canDelete && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      onOpenChange(false);
                      onRequestDelete(member);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Entfernen
                  </Button>
                )}
              </div>

              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onEdit(member);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Bearbeiten
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
