"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Check,
  Copy,
  Link2,
  Loader2,
  MessageCircle,
  QrCode,
  Share2,
  Trash2,
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
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import {
  formatMemberRoles,
  getEffectiveRoles,
  getPrimaryMemberRole,
  INVITE_TYPE_LABELS,
  MEMBER_ROLE_LABELS,
  MEMBER_ROLE_ORDER,
  normalizeMemberRoles,
  type InviteType,
  type MemberRole,
} from "@/domain/schemas/handball";
import type { TeamInviteDTO } from "@/domain/schemas/invite";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";
import {
  buildInviteShareText,
  formatShortCode,
  formatTeamClubLabel,
} from "@/domain/services/invite-service";

const INVITABLE_ROLES_BASE: MemberRole[] = [
  "PLAYER",
  "TREASURER",
  "TEAM_MANAGER",
  "ASSISTANT_COACH",
  "COACH",
  "PARENT",
  "HELPER",
  "CLUB_ADMIN",
];

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName?: string;
  clubName?: string;
  members: TeamMemberResponseDTO[];
  viewerIsClubAdmin?: boolean;
  initialTargetMemberId?: string | null;
  initialType?: InviteType;
}

const INVITE_TYPE_HELP: Record<InviteType, string> = {
  TEAM_JOIN:
    "Ideal für die Team-WhatsApp-Gruppe oder als QR-Code in der Kabine (mehrfach nutzbar).",
  PROFILE_CLAIM:
    "Persönlicher 1×-Link für ein bereits angelegtes Spielerprofil im Kader. Zusätzliche Rollen (z. B. Kassenwart) können direkt mit vergeben werden.",
  GUARDIAN_LINK:
    "Für Eltern von Jugendspielern – verknüpft den Eltern-Account direkt mit dem Kind. Zusätzliche Rollen (z. B. Kassenwart) sind direkt kombinierbar.",
};

export function InviteDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  clubName,
  members,
  viewerIsClubAdmin = false,
  initialTargetMemberId = null,
  initialType = "TEAM_JOIN",
}: InviteDialogProps) {
  const [invites, setInvites] = useState<TeamInviteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [typeOverride, setTypeOverride] = useState<InviteType | null>(null);
  const [rolesOverride, setRolesOverride] = useState<MemberRole[] | null>(null);
  const [targetOverride, setTargetOverride] = useState<string | null>(null);

  const type = typeOverride ?? initialType;
  const targetMemberId = targetOverride ?? initialTargetMemberId ?? "";

  const targetMember =
    members.find((m) => m.id === targetMemberId) ?? null;

  const defaultRolesForCurrentSelection: MemberRole[] =
    type === "GUARDIAN_LINK"
      ? ["PARENT"]
      : type === "PROFILE_CLAIM" && targetMember
        ? getEffectiveRoles(targetMember)
        : ["PLAYER"];

  const selectedRoles: MemberRole[] = normalizeMemberRoles({
    roles:
      type === "GUARDIAN_LINK"
        ? [...(rolesOverride ?? defaultRolesForCurrentSelection), "PARENT"]
        : (rolesOverride ?? defaultRolesForCurrentSelection),
  });

  const setType = (next: InviteType) => {
    setTypeOverride(next);
    setRolesOverride(null);
  };
  const setTargetMemberId = (next: string) => {
    setTargetOverride(next);
    if (type === "PROFILE_CLAIM") {
      setRolesOverride(null);
    }
  };

  function toggleInviteRole(r: MemberRole) {
    if (r === "CLUB_ADMIN" && !viewerIsClubAdmin) return;
    if (r === "PARENT" && type === "GUARDIAN_LINK") return;

    const current = selectedRoles;
    if (current.includes(r)) {
      if (current.length <= 1) return;
      const next = current.filter((item) => item !== r);
      setRolesOverride(next);
      return;
    }
    const next = MEMBER_ROLE_ORDER.filter(
      (candidate) => candidate === r || current.includes(candidate)
    );
    setRolesOverride(next);
  }

  // QR-Code-Vorschau-State
  const [qrInvite, setQrInvite] = useState<TeamInviteDTO | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");

  const unclaimedMembers = members.filter((m) => !m.isClaimed);
  const teamClubLabel = formatTeamClubLabel(teamName, clubName);
  const trimmedTeamName = teamName?.trim() ?? "";
  const trimmedClubName = clubName?.trim() ?? "";
  const showSeparateClubName =
    Boolean(trimmedClubName) &&
    (!trimmedTeamName ||
      !trimmedTeamName.toLowerCase().includes(trimmedClubName.toLowerCase()));

  const loadInvites = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/invites`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setInvites(data.invites ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/invites`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.ok && active) {
          const data = await res.json();
          setInvites(data.invites ?? []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, teamId]);

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setTypeOverride(null);
      setTargetOverride(null);
      setRolesOverride(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  function getInviteUrl(token: string) {
    if (typeof window === "undefined") return `/invite/${token}`;
    return `${window.location.origin}/invite/${token}`;
  }

  async function openQrModal(invite: TeamInviteDTO) {
    setQrInvite(invite);
    try {
      const url = getInviteUrl(invite.token);
      const svg = await QRCode.toString(url, {
        type: "svg",
        margin: 1,
        width: 240,
        color: { dark: "#111827", light: "#ffffff" },
      });
      setQrSvg(svg);
    } catch {
      setQrSvg("");
    }
  }

  function buildShareText(invite: TeamInviteDTO): string {
    return buildInviteShareText({
      type: invite.type,
      role: invite.role,
      roles: invite.roles,
      inviteUrl: getInviteUrl(invite.token),
      shortCode: invite.shortCode,
      targetMemberName: invite.targetMemberName,
      teamName,
      clubName,
    });
  }

  function buildWhatsAppUrl(invite: TeamInviteDTO): string {
    return `https://wa.me/?text=${encodeURIComponent(buildShareText(invite))}`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const rolesToSend: MemberRole[] =
        type === "GUARDIAN_LINK"
          ? normalizeMemberRoles({ roles: [...selectedRoles, "PARENT"] })
          : selectedRoles;
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            role: getPrimaryMemberRole(rolesToSend),
            roles: rolesToSend,
            targetMemberId:
              type === "TEAM_JOIN" ? null : targetMemberId || null,
            expiresInDays: 14,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Einladung konnte nicht erstellt werden."
        );
        return;
      }
      await loadInvites();
    } catch {
      setError("Netzwerkfehler beim Erstellen.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(inviteId: string) {
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/invites/${encodeURIComponent(inviteId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await loadInvites();
    }
  }

  async function copyLink(invite: TeamInviteDTO) {
    try {
      await navigator.clipboard.writeText(getInviteUrl(invite.token));
      setCopiedKey(`link:${invite.id}`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback: ignore clipboard error in restricted browsers
    }
  }

  async function copyShareText(invite: TeamInviteDTO) {
    try {
      await navigator.clipboard.writeText(buildShareText(invite));
      setCopiedKey(`text:${invite.id}`);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // Fallback: ignore clipboard error in restricted browsers
    }
  }

  const activeInvites = invites.filter((i) => !i.revokedAt);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            {teamClubLabel && (
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {teamClubLabel}
              </p>
            )}
            <DialogTitle>Einladungen, Kurzcodes &amp; QR-Codes</DialogTitle>
            <DialogDescription>
              Lade Spieler, Kassenwarte, Eltern, Trainer, Betreuer oder Helfer
              mit einem Tipp per WhatsApp, QR-Code oder 6-stelligem Code ein.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleCreate}
            className="space-y-3 rounded-xl border border-border bg-muted/30 p-4"
          >
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
              >
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-type">Einladungstyp</Label>
                  <SelectNative
                    id="inv-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as InviteType)}
                  >
                    <option value="TEAM_JOIN">Team-Einladung (Link &amp; Code)</option>
                    <option value="PROFILE_CLAIM">
                      Persönlicher Profil-Claim
                    </option>
                    <option value="GUARDIAN_LINK">Eltern-Kind-Verknüpfung</option>
                  </SelectNative>
                </div>

                {type !== "TEAM_JOIN" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-target">Kader-Profil auswählen *</Label>
                    <SelectNative
                      id="inv-target"
                      required
                      value={targetMemberId}
                      onChange={(e) => setTargetMemberId(e.target.value)}
                    >
                      <option value="">Bitte wählen…</option>
                      {(type === "PROFILE_CLAIM"
                        ? unclaimedMembers
                        : members
                      ).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.jerseyNumber ? `#${m.jerseyNumber} ` : ""}
                          {m.firstName} {m.lastName}
                        </option>
                      ))}
                    </SelectNative>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>
                  {type === "GUARDIAN_LINK"
                    ? "Rollen für den Eltern-Zugang (kombinierbar)"
                    : "Rollen (mehrere kombinierbar)"}
                </Label>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Einladungsrollen auswählen"
                >
                  {INVITABLE_ROLES_BASE.filter(
                    (r) =>
                      viewerIsClubAdmin ||
                      r !== "CLUB_ADMIN" ||
                      selectedRoles.includes("CLUB_ADMIN")
                  ).map((r) => {
                    const active = selectedRoles.includes(r);
                    const lockedParent =
                      r === "PARENT" && type === "GUARDIAN_LINK";
                    const lockedAdmin =
                      r === "CLUB_ADMIN" && !viewerIsClubAdmin;
                    const disabled = lockedParent || lockedAdmin;
                    return (
                      <button
                        key={r}
                        type="button"
                        data-testid={`invite-role-toggle-${r}`}
                        aria-pressed={active}
                        disabled={disabled}
                        onClick={() => toggleInviteRole(r)}
                        title={
                          lockedParent
                            ? "Bei Eltern-Kind-Verknüpfung automatisch aktiv."
                            : lockedAdmin
                              ? "Nur Vereins-Admins dürfen diese Rolle vergeben."
                              : undefined
                        }
                        className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          disabled
                            ? "cursor-not-allowed opacity-70"
                            : "cursor-pointer"
                        } ${
                          active
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {active && <Check className="h-3 w-3 shrink-0" />}
                        {MEMBER_ROLE_LABELS[r]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Mehrere Rollen sind direkt kombinierbar (z. B. Spieler + Kassenwart oder Elternteil + Kassenwart).
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {INVITE_TYPE_HELP[type]}
            </p>

            <Button type="submit" size="sm" disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Einladung erzeugen
            </Button>
          </form>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aktive Einladungen ({activeInvites.length})
            </p>

            {loading ? (
              <p className="text-sm text-muted-foreground py-3">
                Lade Einladungen…
              </p>
            ) : activeInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3">
                Noch keine aktiven Einladungen vorhanden.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {activeInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex flex-col gap-2.5 rounded-xl border border-border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">
                          {INVITE_TYPE_LABELS[inv.type]}
                        </Badge>
                        <Badge variant="outline">
                          {formatMemberRoles(
                            inv.roles?.length ? inv.roles : [inv.role]
                          )}
                        </Badge>
                        {inv.targetMemberName && (
                          <span className="text-xs font-semibold text-foreground">
                            → {inv.targetMemberName}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {inv.usedCount}/{inv.maxUses ?? "∞"} genutzt
                      </span>
                    </div>

                    {inv.shortCode && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/8 px-3 py-1.5">
                        <span className="text-xs text-muted-foreground">
                          Kurzcode zum Vorlesen:
                        </span>
                        <span className="font-mono text-base font-extrabold tracking-widest text-primary">
                          {formatShortCode(inv.shortCode)}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyLink(inv)}
                      >
                        {copiedKey === `link:${inv.id}` ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Kopiert
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Link
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => copyShareText(inv)}
                        title="Einladungstext inkl. Verein, Mannschaft, Link und Kurzcode kopieren"
                      >
                        {copiedKey === `text:${inv.id}` ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            Kopiert
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3.5 w-3.5" />
                            Text
                          </>
                        )}
                      </Button>

                      <Button type="button" size="sm" variant="outline" asChild>
                        <a
                          href={buildWhatsAppUrl(inv)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                          WhatsApp
                        </a>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void openQrModal(inv)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        QR-Code
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="ml-auto"
                        onClick={() => handleRevoke(inv.id)}
                        aria-label="Einladung widerrufen"
                        title="Widerrufen"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* QR-Code-Vollbild-Dialog für Kabine & Elternabend */}
      <Dialog
        open={Boolean(qrInvite)}
        onOpenChange={(isOpen) => {
          if (!isOpen) setQrInvite(null);
        }}
      >
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>Einladungs-QR-Code</DialogTitle>
            <DialogDescription>
              Einfach mit der Handy-Kamera scannen – kein Suchen, kein Tippen.
            </DialogDescription>
          </DialogHeader>

          {qrInvite && (
            <div className="flex flex-col items-center gap-4 py-2 min-w-0">
              {teamClubLabel && (
                <div className="space-y-0.5 text-center">
                  {trimmedTeamName && (
                    <p className="text-base font-bold text-foreground leading-tight break-words">
                      {trimmedTeamName}
                    </p>
                  )}
                  {showSeparateClubName && (
                    <p className="text-xs font-medium text-muted-foreground break-words">
                      {trimmedClubName}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Badge variant="secondary">
                  {formatMemberRoles(
                    qrInvite.roles?.length ? qrInvite.roles : [qrInvite.role]
                  )}
                </Badge>
                {qrInvite.targetMemberName && (
                  <Badge variant="outline">{qrInvite.targetMemberName}</Badge>
                )}
              </div>

              {qrSvg ? (
                <div
                  className="max-w-full overflow-hidden rounded-2xl border border-border bg-white p-3 sm:p-4 shadow-xs [&_svg]:h-auto [&_svg]:max-w-full"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
              ) : (
                <div className="flex h-52 w-52 max-w-full items-center justify-center rounded-2xl border border-border">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {qrInvite.shortCode && (
                <div className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">
                    Alternativ Code eingeben:
                  </p>
                  <p className="font-mono text-2xl font-extrabold tracking-widest text-primary">
                    {formatShortCode(qrInvite.shortCode)}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
