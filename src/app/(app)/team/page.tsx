"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link2,
  Lock,
  Pencil,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
import { InviteDialog } from "@/components/team/invite-dialog";
import { MemberFormDialog } from "@/components/team/member-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AVAILABILITY_STATUS_LABELS,
  HANDBALL_POSITION_LABELS,
  MEMBER_ROLE_LABELS,
  THROWING_HAND_LABELS,
  type HandballPosition,
  type InviteType,
} from "@/domain/schemas/handball";
import type { GuardianLinkDTO } from "@/domain/schemas/invite";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";

const POSITION_FILTERS: Array<"ALL" | HandballPosition> = [
  "ALL",
  "TW",
  "LA",
  "RL",
  "RM",
  "RR",
  "RA",
  "KM",
];

export default function TeamRosterPage() {
  const { me, activeTeam } = useAppContext();

  const [members, setMembers] = useState<TeamMemberResponseDTO[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<GuardianLinkDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [posFilter, setPosFilter] = useState<"ALL" | HandballPosition>("ALL");
  const [query, setQuery] = useState("");

  // Dialog states
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberDialogMode, setMemberDialogMode] = useState<
    "create" | "edit-full" | "edit-self"
  >("create");
  const [selectedMember, setSelectedMember] =
    useState<TeamMemberResponseDTO | null>(null);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTargetId, setInviteTargetId] = useState<string | null>(null);
  const [inviteInitialType, setInviteInitialType] =
    useState<InviteType>("TEAM_JOIN");

  const isStaff =
    activeTeam?.role === "CLUB_ADMIN" ||
    activeTeam?.role === "COACH" ||
    activeTeam?.role === "ASSISTANT_COACH";

  const canDelete =
    activeTeam?.role === "CLUB_ADMIN" || activeTeam?.role === "COACH";

  const linkedChildIds = useMemo(
    () => new Set(me?.guardianLinks.map((g) => g.childMemberId) ?? []),
    [me]
  );

  const fetchRosterData = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Kader konnte nicht geladen werden.");
        return;
      }
      setError(null);
      setMembers(data.members ?? []);

      if (isStaff) {
        const gRes = await fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/guardians`,
          { cache: "no-store" }
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          setGuardianLinks(gData.links ?? []);
        }
      } else {
        setGuardianLinks([]);
      }
    } catch {
      setError("Netzwerkfehler beim Laden des Kaders.");
    } finally {
      setLoading(false);
    }
  }, [activeTeam, isStaff]);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    fetch(`/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!active) return;
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message || "Kader konnte nicht geladen werden.");
          return;
        }
        setError(null);
        setMembers(data.members ?? []);
        if (isStaff) {
          const gRes = await fetch(
            `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/guardians`,
            { cache: "no-store" }
          );
          if (gRes.ok && active) {
            const gData = await gRes.json();
            setGuardianLinks(gData.links ?? []);
          }
        } else {
          setGuardianLinks([]);
        }
      })
      .catch(() => {
        if (active) setError("Netzwerkfehler beim Laden des Kaders.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTeam, isStaff]);

  const loadRoster = fetchRosterData;

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (
        posFilter !== "ALL" &&
        m.primaryPosition !== posFilter &&
        m.secondaryPosition !== posFilter
      ) {
        return false;
      }
      if (!q) return true;
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
      const jersey = m.jerseyNumber !== null ? String(m.jerseyNumber) : "";
      const pos = `${m.primaryPosition ?? ""} ${m.secondaryPosition ?? ""}`.toLowerCase();
      return fullName.includes(q) || jersey.includes(q) || pos.includes(q);
    });
  }, [members, posFilter, query]);

  function openCreateDialog() {
    setSelectedMember(null);
    setMemberDialogMode("create");
    setMemberDialogOpen(true);
  }

  function openEditDialog(m: TeamMemberResponseDTO) {
    setSelectedMember(m);
    setMemberDialogMode(isStaff ? "edit-full" : "edit-self");
    setMemberDialogOpen(true);
  }

  function openClaimInvite(memberId: string, type: InviteType) {
    setInviteTargetId(memberId);
    setInviteInitialType(type);
    setInviteDialogOpen(true);
  }

  function openTeamInvite() {
    setInviteTargetId(null);
    setInviteInitialType("TEAM_JOIN");
    setInviteDialogOpen(true);
  }

  async function handleDelete(member: TeamMemberResponseDTO) {
    if (!activeTeam) return;
    const confirmed = window.confirm(
      `Möchtest du ${member.firstName} ${member.lastName} wirklich aus dem Kader entfernen?`
    );
    if (!confirmed) return;

    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members/${encodeURIComponent(member.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      await loadRoster();
    }
  }

  if (!activeTeam || !me) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {activeTeam.clubName} · Saison {activeTeam.seasonName}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Kader · {activeTeam.teamName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {members.length} Mitglieder im Team
            {activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}
          </p>
        </div>

        {isStaff && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openTeamInvite}>
              <Link2 className="h-4 w-4" />
              Einladungen
            </Button>
            <Button onClick={openCreateDialog}>
              <UserPlus className="h-4 w-4" />
              Spieler hinzufügen
            </Button>
          </div>
        )}
      </div>

      {/* Filter & Suche */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Nach Name, Trikotnummer oder Position suchen…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Position filtern"
        >
          {POSITION_FILTERS.map((pos) => {
            const active = posFilter === pos;
            return (
              <button
                key={pos}
                type="button"
                onClick={() => setPosFilter(pos)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {pos === "ALL"
                  ? "Alle Positionen"
                  : `${pos} · ${HANDBALL_POSITION_LABELS[pos].full}`}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {/* Kaderliste */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-6">Lade Kader…</p>
      ) : filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="font-semibold">Keine passenden Mitglieder gefunden</p>
            <p className="text-sm text-muted-foreground">
              Passe deine Filter an oder füge neue Spieler:innen zum Kader hinzu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredMembers.map((member) => {
            const isOwnProfile =
              member.canViewSensitive && member.userId === me.user.id;
            const isLinkedChild = linkedChildIds.has(member.id);
            const canEditThis = isStaff || isOwnProfile || isLinkedChild;

            return (
              <Card key={member.id} data-testid={`member-card-${member.id}`}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5">
                      {/* Trikotnummer */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-mono text-base font-bold">
                        {member.jerseyNumber !== null
                          ? `#${member.jerseyNumber}`
                          : "–"}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-foreground">
                            {member.firstName} {member.lastName}
                          </h2>
                          <Badge variant="outline">
                            {MEMBER_ROLE_LABELS[member.role]}
                          </Badge>
                          <Badge
                            variant={
                              member.availabilityStatus === "FIT"
                                ? "fit"
                                : member.availabilityStatus === "INJURED"
                                  ? "injured"
                                  : "unavailable"
                            }
                          >
                            {
                              AVAILABILITY_STATUS_LABELS[
                                member.availabilityStatus
                              ]
                            }
                          </Badge>
                          {!member.isClaimed && (
                            <Badge variant="secondary">Noch ohne Login</Badge>
                          )}
                          {isLinkedChild && (
                            <Badge variant="default">Dein Kind</Badge>
                          )}
                        </div>

                        {/* Handball-Positionen, Wurfhand & Team-Ämter */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          {member.primaryPosition && (
                            <Badge variant="position">
                              {member.primaryPosition} ·{" "}
                              {
                                HANDBALL_POSITION_LABELS[member.primaryPosition]
                                  .full
                              }
                            </Badge>
                          )}
                          {member.secondaryPosition && (
                            <Badge variant="outline" className="font-mono">
                              2. {member.secondaryPosition}
                            </Badge>
                          )}
                          {member.throwingHand && (
                            <span className="px-1">
                              Wurfhand:{" "}
                              <strong className="text-foreground">
                                {THROWING_HAND_LABELS[member.throwingHand]}
                              </strong>
                            </span>
                          )}
                          {member.teamRoles.map((tr) => (
                            <Badge key={tr} variant="secondary">
                              {tr}
                            </Badge>
                          ))}
                        </div>

                        {/* DSGVO-geschützte Details (werden NUR vom Server geliefert, wenn berechtigt) */}
                        {member.canViewSensitive &&
                          (member.passNumber ||
                            member.emergencyContact ||
                            member.injuryNote ||
                            member.phone) && (
                            <div
                              className="mt-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs space-y-1"
                              data-testid="sensitive-member-fields"
                            >
                              <div className="flex items-center gap-1 font-semibold text-muted-foreground">
                                <Lock className="h-3 w-3 text-primary" />
                                <span>Geschützte Profildaten</span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-foreground">
                                {member.passNumber && (
                                  <span>
                                    <span className="text-muted-foreground">
                                      Pass-Nr.:{" "}
                                    </span>
                                    <span className="font-mono">
                                      {member.passNumber}
                                    </span>
                                  </span>
                                )}
                                {member.emergencyContact && (
                                  <span>
                                    <span className="text-muted-foreground">
                                      Notfallkontakt:{" "}
                                    </span>
                                    {member.emergencyContact}
                                  </span>
                                )}
                                {member.phone && (
                                  <span>
                                    <span className="text-muted-foreground">
                                      Tel.:{" "}
                                    </span>
                                    {member.phone}
                                  </span>
                                )}
                              </div>
                              {member.injuryNote && (
                                <p className="flex items-center gap-1 text-red-700 dark:text-red-300 pt-0.5">
                                  <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                  <span>{member.injuryNote}</span>
                                </p>
                              )}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Aktionen */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                      {isStaff && !member.isClaimed && !member.isMinor && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openClaimInvite(member.id, "PROFILE_CLAIM")
                          }
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Claim-Link
                        </Button>
                      )}
                      {isStaff && member.isMinor && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openClaimInvite(member.id, "GUARDIAN_LINK")
                          }
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Eltern-Link
                        </Button>
                      )}
                      {canEditThis && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(member)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Bearbeiten
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(member)}
                          aria-label={`${member.firstName} ${member.lastName} entfernen`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Eltern-Kind-Verknüpfungen (für Trainer/Admin sichtbar) */}
      {isStaff && guardianLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" />
              Eltern-Kind-Verknüpfungen ({guardianLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {guardianLinks.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <div>
                  <span className="font-semibold">{g.guardianName}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    ({g.guardianEmail})
                  </span>{" "}
                  →{" "}
                  <span className="font-semibold text-primary">
                    {g.childFirstName} {g.childLastName}
                  </span>
                </div>
                <Badge variant="secondary">{g.relationship}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Dialoge */}
      <MemberFormDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        teamId={activeTeam.teamId}
        mode={memberDialogMode}
        member={selectedMember}
        onSaved={loadRoster}
      />

      {isStaff && (
        <InviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          teamId={activeTeam.teamId}
          members={members}
          initialTargetMemberId={inviteTargetId}
          initialType={inviteInitialType}
        />
      )}
    </div>
  );
}
