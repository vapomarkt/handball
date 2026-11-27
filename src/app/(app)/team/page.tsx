"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Droplets,
  Link2,
  Loader2,
  Lock,
  Search,
  ShieldAlert,
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
import { Input } from "@/components/ui/input";
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
import { formatPhoneNumber, toTelHref } from "@/domain/schemas/phone";

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
  const [nuligaImportOpen, setNuligaImportOpen] = useState(false);
  const [importNotice, setImportNotice] =
    useState<NuligaRosterImportResultDTO | null>(null);

  const isStaff =
    activeTeam?.isClubAdmin ||
    activeTeam?.role === "CLUB_ADMIN" ||
    activeTeam?.role === "COACH" ||
    activeTeam?.role === "ASSISTANT_COACH" ||
    activeTeam?.role === "TEAM_MANAGER";

  const canDelete =
    activeTeam?.isClubAdmin ||
    activeTeam?.role === "CLUB_ADMIN" ||
    activeTeam?.role === "COACH";

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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {members.length} Mitglieder im Team
              {activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}
            </span>
            {isStaff ? (
              <button
                type="button"
                onClick={handleToggleResin}
                disabled={savingResin}
                title="Umschalten, ob diese Mannschaft mit Harz (Backe) spielt. Bei ‚Ohne Harz‘ werden Hallen-Harzhinweise bei Terminen ausgeblendet."
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer disabled:opacity-60",
                  activeTeam.usesResin
                    ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {savingResin ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Droplets className="h-3 w-3" />
                )}
                {activeTeam.usesResin
                  ? "Mit Harz (Backe)"
                  : "Ohne Harz (Backe)"}
              </button>
            ) : !activeTeam.usesResin ? (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Droplets className="h-3 w-3" />
                Ohne Harz
              </Badge>
            ) : null}
          </div>
        </div>

        {isStaff && activeTab === "roster" && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setNuligaImportOpen(true)}
            >
              <Download className="h-4 w-4" />
              Aus Spielberichten
            </Button>
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

      {/* Tabs: Kader & Trikotsätze */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("roster")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            activeTab === "roster"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <Users className="h-4 w-4" />
          Kader ({members.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("jerseys")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            activeTab === "jerseys"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <Shirt className="h-4 w-4" />
          Trikotsätze ({jerseySets.length})
        </button>
      </div>

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
        <>
          {/* Erfolgs-Banner nach Spielbericht-Import + direkter Link zur Team-Einladung */}
          {importNotice && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0 text-sm text-emerald-900 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {importNotice.createdCount}{" "}
                    {importNotice.createdCount === 1 ? "Person" : "Personen"}{" "}
                    aus nuLiga übernommen
                    {importNotice.updatedCount > 0
                      ? ` · ${importNotice.updatedCount} Trikotnummer${importNotice.updatedCount === 1 ? "" : "n"} ergänzt`
                      : ""}
                  </p>
                  <p className="text-xs opacity-90 mt-0.5">
                    Teile jetzt einfach den normalen Team-Einladungslink – beim
                    Beitritt werden die Profile anhand des Namens automatisch
                    verknüpft.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                <Button size="sm" onClick={openTeamInvite}>
                  <Link2 className="h-3.5 w-3.5" />
                  Team-Link teilen
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
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4 sm:p-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-sm font-bold text-foreground">
                        Kader in Sekunden statt einzeln anlegen
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Übernehme Spieler, Trikotnummern und optional Offizielle
                        direkt aus euren letzten nuLiga-Spielberichten oder teile
                        einen Team-Link per WhatsApp &amp; QR-Code.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:shrink-0">
                    <Button
                      size="sm"
                      onClick={() => setNuligaImportOpen(true)}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Aus Spielberichten importieren
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={openTeamInvite}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Team-Link teilen
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

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
              Passe deine Filter an oder füge neue Spieler zum Kader hinzu.
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
              <Card
                key={member.id}
                interactive={canEditThis}
                data-testid={`member-card-${member.id}`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Trikotnummer */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-mono text-base font-bold">
                        {member.jerseyNumber !== null
                          ? `#${member.jerseyNumber}`
                          : "–"}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-bold text-foreground">
                            {canEditThis ? (
                              <button
                                type="button"
                                onClick={() => openEditDialog(member)}
                                className={cn(
                                  CARD_OVERLAY_TRIGGER_CLASS,
                                  "transition-colors group-hover:text-primary"
                                )}
                              >
                                {member.firstName} {member.lastName}
                                <span className="sr-only">
                                  {" "}– Profil bearbeiten
                                </span>
                              </button>
                            ) : (
                              <>
                                {member.firstName} {member.lastName}
                              </>
                            )}
                          </h2>
                          <Badge variant="outline">
                            {MEMBER_ROLE_LABELS[member.role]}
                          </Badge>
                          {member.isClubAdmin && member.role !== "CLUB_ADMIN" && (
                            <Badge variant="secondary">Vereins-Admin</Badge>
                          )}
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
                              className={cn(
                                CARD_ACTION_LAYER_CLASS,
                                "mt-2 select-text rounded-lg border border-border bg-muted/40 p-2.5 text-xs space-y-1"
                              )}
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
                                {member.phone && (() => {
                                  const formattedPhone = formatPhoneNumber(
                                    member.phone
                                  );
                                  const telHref = toTelHref(member.phone);
                                  return (
                                    <span>
                                      <span className="text-muted-foreground">
                                        Tel.:{" "}
                                      </span>
                                      {telHref ? (
                                        <a
                                          href={telHref}
                                          className="font-mono underline-offset-2 hover:text-primary hover:underline"
                                        >
                                          {formattedPhone}
                                        </a>
                                      ) : (
                                        formattedPhone
                                      )}
                                    </span>
                                  );
                                })()}
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
                          className={CARD_ACTION_LAYER_CLASS}
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
                          className={CARD_ACTION_LAYER_CLASS}
                          onClick={() =>
                            openClaimInvite(member.id, "GUARDIAN_LINK")
                          }
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Eltern-Link
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className={CARD_ACTION_LAYER_CLASS}
                          onClick={() => handleDelete(member)}
                          aria-label={`${member.firstName} ${member.lastName} entfernen`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                      {canEditThis && (
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden="true"
                        />
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
        </>
      )}

      {/* Dialoge */}
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

      {isStaff && (
        <InviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          teamId={activeTeam.teamId}
          teamName={activeTeam.teamName}
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
