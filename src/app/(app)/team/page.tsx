"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Droplets,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Shirt,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { JerseySetsPanel } from "@/components/jerseys/jersey-sets-panel";
import { useAppContext } from "@/components/providers/app-context";
import { InviteDialog } from "@/components/team/invite-dialog";
import { MemberDetailDialog } from "@/components/team/member-detail-dialog";
import { MemberFormDialog } from "@/components/team/member-form-dialog";
import { NuligaRosterImportDialog } from "@/components/team/nuliga-roster-import-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CARD_ACTION_LAYER_CLASS,
  CARD_OVERLAY_TRIGGER_CLASS,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardListSkeleton, EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { SelectNative } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AVAILABILITY_STATUS_LABELS,
  HANDBALL_POSITION_LABELS,
  MEMBER_ROLE_LABELS,
  THROWING_HAND_LABELS,
  type HandballPosition,
  type InviteType,
} from "@/domain/schemas/handball";
import type { GuardianLinkDTO } from "@/domain/schemas/invite";
import type { JerseySetDTO } from "@/domain/schemas/jersey-set";
import type {
  NuligaRosterImportResultDTO,
  TeamMemberResponseDTO,
} from "@/domain/schemas/member";

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

type TeamTab = "roster" | "jerseys";

export default function TeamRosterPage() {
  const { me, activeTeam, refreshMe } = useAppContext();

  const [activeTab, setActiveTab] = useState<TeamTab>("roster");
  const [members, setMembers] = useState<TeamMemberResponseDTO[]>([]);
  const [guardianLinks, setGuardianLinks] = useState<GuardianLinkDTO[]>([]);
  const [jerseySets, setJerseySets] = useState<JerseySetDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingJerseys, setLoadingJerseys] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingResin, setSavingResin] = useState(false);

  const [posFilter, setPosFilter] = useState<"ALL" | HandballPosition>("ALL");
  const [query, setQuery] = useState("");

  // Dialog states
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [memberDialogMode, setMemberDialogMode] = useState<
    "create" | "edit-full" | "edit-self"
  >("create");
  const [selectedMember, setSelectedMember] =
    useState<TeamMemberResponseDTO | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<TeamMemberResponseDTO | null>(null);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTargetId, setInviteTargetId] = useState<string | null>(null);
  const [inviteInitialType, setInviteInitialType] =
    useState<InviteType>("TEAM_JOIN");
  const [nuligaImportOpen, setNuligaImportOpen] = useState(false);
  const [importNotice, setImportNotice] =
    useState<NuligaRosterImportResultDTO | null>(null);

  const isStaff = Boolean(
    activeTeam?.isClubAdmin ||
      activeTeam?.role === "CLUB_ADMIN" ||
      activeTeam?.role === "COACH" ||
      activeTeam?.role === "ASSISTANT_COACH" ||
      activeTeam?.role === "TEAM_MANAGER"
  );

  const canDelete = Boolean(
    activeTeam?.isClubAdmin ||
      activeTeam?.role === "CLUB_ADMIN" ||
      activeTeam?.role === "COACH"
  );

  const linkedChildIds = useMemo(
    () => new Set(me?.guardianLinks.map((g) => g.childMemberId) ?? []),
    [me]
  );

  const detailMember = useMemo(
    () => members.find((m) => m.id === detailMemberId) ?? null,
    [members, detailMemberId]
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

  const loadJerseySets = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const res = await fetch(
        `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/jersey-sets?teamId=${encodeURIComponent(activeTeam.teamId)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setJerseySets(data.jerseySets ?? []);
      }
    } finally {
      setLoadingJerseys(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/jersey-sets?teamId=${encodeURIComponent(activeTeam.teamId)}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          setJerseySets(data.jerseySets ?? []);
        }
      })
      .finally(() => {
        if (active) setLoadingJerseys(false);
      });
    return () => {
      active = false;
    };
  }, [activeTeam]);

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

  async function confirmDeleteMember() {
    if (!activeTeam || !deleteTarget) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members/${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      if (detailMemberId === deleteTarget.id) setDetailMemberId(null);
      await loadRoster();
    }
  }

  async function handleToggleResin() {
    if (!activeTeam || savingResin) return;
    setSavingResin(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usesResin: !activeTeam.usesResin }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error?.message ||
            "Harz-Einstellung konnte nicht gespeichert werden."
        );
        return;
      }
      await refreshMe();
    } catch {
      setError("Netzwerkfehler beim Speichern der Harz-Einstellung.");
    } finally {
      setSavingResin(false);
    }
  }

  if (!activeTeam || !me) return null;

  return (
    <div className="space-y-5">
      {/* Kompakter Header (max. 2 Aktionen: 1x Primary + Overflow-Menü) */}
      <PageHeader
        title={`Kader · ${activeTeam.teamName}`}
        subtitle={
          <>
            {members.length} Mitglieder
            {activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}
            {!activeTeam.usesResin ? " · Ohne Harz" : ""}
          </>
        }
        actions={
          isStaff && activeTab === "roster" ? (
            <>
              <Button onClick={openCreateDialog}>
                <UserPlus className="h-4 w-4" />
                Spieler hinzufügen
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Weitere Kader-Aktionen"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={openTeamInvite}>
                    <Link2 className="h-4 w-4 text-primary" />
                    <span>Einladungen &amp; Team-Link</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setNuligaImportOpen(true)}>
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <span>Aus Spielberichten importieren</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={savingResin}
                    onSelect={() => void handleToggleResin()}
                  >
                    {savingResin ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Droplets className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      {activeTeam.usesResin
                        ? "Harz (Backe): Aktiv (deaktivieren)"
                        : "Harz (Backe): Aus (aktivieren)"}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : undefined
        }
      />

      {/* Ruhige Segmented Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TeamTab)}
      >
        <TabsList>
          <TabsTrigger value="roster">
            <Users className="h-4 w-4" />
            Kader ({members.length})
          </TabsTrigger>
          <TabsTrigger value="jerseys">
            <Shirt className="h-4 w-4" />
            Trikotsätze ({jerseySets.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "jerseys" ? (
        <JerseySetsPanel
          clubId={activeTeam.clubId}
          activeTeamId={activeTeam.teamId}
          activeTeamName={activeTeam.teamName}
          jerseySets={jerseySets}
          loading={loadingJerseys}
          isStaff={isStaff}
          onChanged={loadJerseySets}
        />
      ) : (
        <div className="space-y-4">
          {/* Erfolgs-Banner nach Spielbericht-Import */}
          {importNotice && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0 text-sm text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {importNotice.createdCount}{" "}
                    {importNotice.createdCount === 1 ? "Person" : "Personen"}{" "}
                    übernommen
                    {importNotice.updatedCount > 0
                      ? ` · ${importNotice.updatedCount} Nummer${importNotice.updatedCount === 1 ? "" : "n"} ergänzt`
                      : ""}
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    Teile jetzt den Team-Einladungslink – Profile werden anhand
                    des Namens automatisch verknüpft.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={openTeamInvite}>
                  <Link2 className="h-3.5 w-3.5" />
                  Team-Link
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setImportNotice(null)}
                >
                  Schließen
                </Button>
              </div>
            </div>
          )}

          {/* Schnellstart-Karte, solange noch keine Spieler im Kader sind */}
          {isStaff &&
            !loading &&
            !importNotice &&
            members.filter((m) => m.role === "PLAYER").length === 0 && (
              <Card className="border-primary/25 bg-primary/5">
                <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Kader schnell befüllen
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Importiere Spieler &amp; Nummern aus nuLiga-Spielberichten
                        oder teile den Team-Link.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setNuligaImportOpen(true)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Aus Spielberichten
                    </Button>
                    <Button size="sm" variant="ghost" onClick={openTeamInvite}>
                      <Link2 className="h-3.5 w-3.5" />
                      Team-Link
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Kompakte 1-zeilige Suche + Positions-Filter (kein 8-Button-Block) */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name, Nummer oder Position suchen…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <SelectNative
              aria-label="Position filtern"
              value={posFilter}
              onChange={(e) =>
                setPosFilter(e.target.value as "ALL" | HandballPosition)
              }
              className="sm:w-52 shrink-0"
            >
              {POSITION_FILTERS.map((pos) => (
                <option key={pos} value={pos}>
                  {pos === "ALL"
                    ? "Alle Positionen"
                    : `${pos} · ${HANDBALL_POSITION_LABELS[pos].full}`}
                </option>
              ))}
            </SelectNative>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {/* Scanbare Kaderliste (max. 2-3 Badges, 0 Inline-Detailboxen) */}
          {loading ? (
            <CardListSkeleton count={4} />
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="h-5 w-5" />}
              title="Keine passenden Mitglieder"
              description="Passe Suche oder Position an oder füge neue Spieler zum Kader hinzu."
            />
          ) : (
            <div className="grid gap-2.5">
              {filteredMembers.map((member) => {
                const isOwnProfile =
                  member.canViewSensitive && member.userId === me.user.id;
                const isLinkedChild = linkedChildIds.has(member.id);
                const canEditThis = isStaff || isOwnProfile || isLinkedChild;

                const metaParts: string[] = [];
                if (member.primaryPosition) {
                  metaParts.push(
                    `${member.primaryPosition} · ${HANDBALL_POSITION_LABELS[member.primaryPosition].full}`
                  );
                }
                if (member.secondaryPosition) {
                  metaParts.push(`2. ${member.secondaryPosition}`);
                }
                if (member.throwingHand) {
                  metaParts.push(THROWING_HAND_LABELS[member.throwingHand]);
                }
                if (member.teamRoles.length > 0) {
                  metaParts.push(member.teamRoles.join(", "));
                }

                // Max. 2–3 handlungsrelevante/abweichende Badges (kein 'Spieler'/'Fit'-Rauschen)
                const showRoleBadge = member.role !== "PLAYER";
                const showAvailabilityBadge =
                  member.availabilityStatus !== "FIT";

                return (
                  <Card
                    key={member.id}
                    interactive
                    data-testid={`member-card-${member.id}`}
                  >
                    <CardContent className="p-3.5 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-mono text-sm font-bold">
                            {member.jerseyNumber !== null
                              ? `#${member.jerseyNumber}`
                              : "–"}
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                                <button
                                  type="button"
                                  onClick={() => setDetailMemberId(member.id)}
                                  className={cn(
                                    CARD_OVERLAY_TRIGGER_CLASS,
                                    "transition-colors group-hover:text-primary"
                                  )}
                                >
                                  {member.firstName} {member.lastName}
                                  <span className="sr-only">
                                    {" "}– Profildetails öffnen
                                  </span>
                                </button>
                              </h2>

                              {showRoleBadge && (
                                <Badge variant="outline">
                                  {MEMBER_ROLE_LABELS[member.role]}
                                </Badge>
                              )}
                              {showAvailabilityBadge && (
                                <Badge
                                  variant={
                                    member.availabilityStatus === "INJURED"
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
                              )}
                              {isLinkedChild && (
                                <Badge variant="default">Dein Kind</Badge>
                              )}
                              {isStaff && !member.isClaimed && !isLinkedChild && (
                                <Badge variant="secondary">
                                  Noch ohne Login
                                </Badge>
                              )}
                            </div>

                            <p className="truncate text-xs text-muted-foreground">
                              {metaParts.length > 0
                                ? metaParts.join(" · ")
                                : member.isClubAdmin &&
                                    member.role !== "CLUB_ADMIN"
                                  ? "Vereins-Admin"
                                  : MEMBER_ROLE_LABELS[member.role]}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {(isStaff || canEditThis || canDelete) && (
                            <div className={CARD_ACTION_LAYER_CLASS}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 text-muted-foreground"
                                    aria-label={`Aktionen für ${member.firstName} ${member.lastName}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canEditThis && (
                                    <DropdownMenuItem
                                      onSelect={() => openEditDialog(member)}
                                    >
                                      <Pencil className="h-4 w-4 text-muted-foreground" />
                                      <span>Bearbeiten</span>
                                    </DropdownMenuItem>
                                  )}
                                  {isStaff &&
                                    !member.isClaimed &&
                                    !member.isMinor && (
                                      <DropdownMenuItem
                                        onSelect={() =>
                                          openClaimInvite(
                                            member.id,
                                            "PROFILE_CLAIM"
                                          )
                                        }
                                      >
                                        <Link2 className="h-4 w-4 text-primary" />
                                        <span>Claim-Link erstellen</span>
                                      </DropdownMenuItem>
                                    )}
                                  {isStaff && member.isMinor && (
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        openClaimInvite(
                                          member.id,
                                          "GUARDIAN_LINK"
                                        )
                                      }
                                    >
                                      <UserCheck className="h-4 w-4 text-primary" />
                                      <span>Eltern-Link erstellen</span>
                                    </DropdownMenuItem>
                                  )}
                                  {canDelete && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        destructive
                                        onSelect={() => setDeleteTarget(member)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Aus Kader entfernen</span>
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          )}
                          <ChevronRight
                            className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                            aria-hidden="true"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Eltern-Kind-Verknüpfungen (für Staff) */}
          {isStaff && guardianLinks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
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
                    <div className="min-w-0">
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
        </div>
      )}

      {/* Mitglieds-Detail-Dialog (Progressive Disclosure inkl. geschützter Profildaten) */}
      <MemberDetailDialog
        open={detailMember !== null}
        onOpenChange={(open) => {
          if (!open) setDetailMemberId(null);
        }}
        member={detailMember}
        isStaff={isStaff}
        canEdit={Boolean(
          detailMember &&
            (isStaff ||
              (detailMember.canViewSensitive &&
                detailMember.userId === me.user.id) ||
              linkedChildIds.has(detailMember.id))
        )}
        canDelete={canDelete}
        isLinkedChild={Boolean(
          detailMember && linkedChildIds.has(detailMember.id)
        )}
        onEdit={openEditDialog}
        onOpenInvite={openClaimInvite}
        onRequestDelete={setDeleteTarget}
      />

      {/* Bearbeiten / Anlegen Dialog */}
      <MemberFormDialog
        key={`${memberDialogMode}-${selectedMember?.id ?? "new"}-${memberDialogOpen}`}
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        teamId={activeTeam.teamId}
        mode={memberDialogMode}
        member={selectedMember}
        usesResin={activeTeam.usesResin}
        viewerIsClubAdmin={Boolean(activeTeam.isClubAdmin)}
        onSaved={() => {
          void loadRoster();
          void refreshMe();
        }}
      />

      {/* Bestätigungsdialog statt window.confirm */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Mitglied aus Kader entfernen?"
        description={
          deleteTarget
            ? `Möchtest du ${deleteTarget.firstName} ${deleteTarget.lastName} wirklich aus dem Kader von ${activeTeam.teamName} entfernen?`
            : undefined
        }
        confirmLabel="Aus Kader entfernen"
        onConfirm={confirmDeleteMember}
      />

      {isStaff && (
        <InviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          teamId={activeTeam.teamId}
          teamName={activeTeam.teamName}
          clubName={activeTeam.clubName}
          members={members}
          initialTargetMemberId={inviteTargetId}
          initialType={inviteInitialType}
        />
      )}

      {isStaff && nuligaImportOpen && (
        <NuligaRosterImportDialog
          open={nuligaImportOpen}
          onOpenChange={setNuligaImportOpen}
          teamId={activeTeam.teamId}
          teamName={activeTeam.teamName}
          onImported={async (res) => {
            setImportNotice(res);
            await loadRoster();
          }}
          onOpenInvite={openTeamInvite}
        />
      )}
    </div>
  );
}
