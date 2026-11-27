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
  INVITE_TYPE_LABELS,
  MEMBER_ROLE_LABELS,
  type InviteType,
  type MemberRole,
} from "@/domain/schemas/handball";
import type { TeamInviteDTO } from "@/domain/schemas/invite";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";
import { formatShortCode } from "@/domain/services/invite-service";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName?: string;
  members: TeamMemberResponseDTO[];
  initialTargetMemberId?: string | null;
  initialType?: InviteType;
}

const INVITE_TYPE_HELP: Record<InviteType, string> = {
  TEAM_JOIN:
    "Ideal für die Team-WhatsApp-Gruppe oder als QR-Code in der Kabine (mehrfach nutzbar).",
  PROFILE_CLAIM:
    "Persönlicher 1×-Link für ein bereits angelegtes Spielerprofil im Kader.",
  GUARDIAN_LINK:
    "Für Eltern von Jugendspielern – verknüpft den Eltern-Account direkt mit dem Kind.",
};

export function InviteDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  members,
  initialTargetMemberId = null,
  initialType = "TEAM_JOIN",
}: InviteDialogProps) {
  const [invites, setInvites] = useState<TeamInviteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [typeOverride, setTypeOverride] = useState<InviteType | null>(null);
  const [role, setRole] = useState<MemberRole>("PLAYER");
  const [targetOverride, setTargetOverride] = useState<string | null>(null);

  const type = typeOverride ?? initialType;
  const targetMemberId = targetOverride ?? initialTargetMemberId ?? "";
  const setType = (next: InviteType) => setTypeOverride(next);
  const setTargetMemberId = (next: string) => setTargetOverride(next);

  // QR-Code-Vorschau-State
  const [qrInvite, setQrInvite] = useState<TeamInviteDTO | null>(null);
  const [qrSvg, setQrSvg] = useState<string>("");

  const unclaimedMembers = members.filter((m) => !m.isClaimed);

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

  function buildWhatsAppUrl(invite: TeamInviteDTO): string {
    const url = getInviteUrl(invite.token);
    const short = invite.shortCode ? formatShortCode(invite.shortCode) : null;
    const teamLabel = teamName ? ` (${teamName})` : "";
    const greeting =
      invite.type === "GUARDIAN_LINK" && invite.targetMemberName
        ? `Hallo! Hier ist euer Eltern-Zugang zu ThrowOff${teamLabel} für ${invite.targetMemberName}:`
        : invite.type === "PROFILE_CLAIM" && invite.targetMemberName
          ? `Hi ${invite.targetMemberName.split(" ")[0]}! Hier ist dein persönlicher Link zu ThrowOff${teamLabel}:`
          : `Hallo! Tritt unserem Team${teamLabel} als ${MEMBER_ROLE_LABELS[invite.role]} bei ThrowOff bei:`;

    const lines = [
      greeting,
      url,
      ...(short ? [`Oder gib einfach den Team-Code ein: ${short}`] : []),
      "Anmeldung geht in 30 Sekunden per E-Mail-Code – kein Passwort nötig.",
    ];
    return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            role: type === "GUARDIAN_LINK" ? "PARENT" : role,
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
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 2000);
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
            <DialogTitle>Einladungen, Kurzcodes &amp; QR-Codes</DialogTitle>
            <DialogDescription>
              Lade Spieler, Eltern, Betreuer oder Helfer mit einem Tipp per
              WhatsApp, QR-Code oder 6-stelligem Code ein.
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

              {type === "TEAM_JOIN" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="inv-role">Rolle</Label>
                  <SelectNative
                    id="inv-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as MemberRole)}
                  >
                    <option value="PLAYER">Spieler</option>
                    <option value="TEAM_MANAGER">Betreuer</option>
                    <option value="ASSISTANT_COACH">Co-Trainer</option>
                    <option value="COACH">Trainer</option>
                    <option value="HELPER">Vereinshelfer</option>
                  </SelectNative>
                </div>
              ) : (
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
                          {MEMBER_ROLE_LABELS[inv.role]}
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
                        {copiedId === inv.id ? (
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
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Badge variant="secondary">
                  {MEMBER_ROLE_LABELS[qrInvite.role]}
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
