"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Trash2 } from "lucide-react";
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

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  members: TeamMemberResponseDTO[];
  initialTargetMemberId?: string | null;
  initialType?: InviteType;
}

export function InviteDialog({
  open,
  onOpenChange,
  teamId,
  members,
  initialTargetMemberId = null,
  initialType = "TEAM_JOIN",
}: InviteDialogProps) {
  const [invites, setInvites] = useState<TeamInviteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [type, setType] = useState<InviteType>(initialType);
  const [role, setRole] = useState<MemberRole>("PLAYER");
  const [targetMemberId, setTargetMemberId] = useState<string>(
    initialTargetMemberId ?? ""
  );

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
        setError(data?.error?.message || "Einladung konnte nicht erstellt werden.");
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

  function getInviteUrl(token: string) {
    if (typeof window === "undefined") return `/invite/${token}`;
    return `${window.location.origin}/invite/${token}`;
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Einladungs- & Profil-Claim-Links</DialogTitle>
          <DialogDescription>
            Lade Spieler direkt ins Team ein oder erstelle personalisierte
            Claim- & Eltern-Verknüpfungslinks.
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
                <option value="TEAM_JOIN">Team-Einladungscode</option>
                <option value="PROFILE_CLAIM">
                  Persönlicher Profil-Claim
                </option>
                <option value="GUARDIAN_LINK">Eltern-Kind-Verknüpfung</option>
              </SelectNative>
            </div>

            {type === "TEAM_JOIN" ? (
              <div className="space-y-1.5">
                <Label htmlFor="inv-role">Standard-Rolle</Label>
                <SelectNative
                  id="inv-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                >
                  <option value="PLAYER">Spieler</option>
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
                  {(type === "PROFILE_CLAIM" ? unclaimedMembers : members).map(
                    (m) => (
                      <option key={m.id} value={m.id}>
                        {m.jerseyNumber ? `#${m.jerseyNumber} ` : ""}
                        {m.firstName} {m.lastName}
                      </option>
                    )
                  )}
                </SelectNative>
              </div>
            )}
          </div>

          <Button type="submit" size="sm" disabled={creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Einladungslink erzeugen
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
              Noch keine aktiven Einladungslinks vorhanden.
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {activeInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
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
                    <span className="text-xs text-muted-foreground">
                      {inv.usedCount}/{inv.maxUses ?? "∞"} genutzt
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">
                      {getInviteUrl(inv.token)}
                    </code>
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
                          Kopieren
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
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
  );
}
