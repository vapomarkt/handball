"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Award,
  CheckCircle2,
  ClipboardList,
  Clock,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { DutyFormDialog } from "@/components/duties/duty-form-dialog";
import { useAppContext } from "@/components/providers/app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardListSkeleton, EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DUTY_ASSIGNMENT_STATUS_LABELS,
  DUTY_CATEGORY_LABELS,
  DUTY_SCOPE_LABELS,
  type MatchdayDTO,
  type TeamWorkHoursSummaryDTO,
  type WorkDutyDTO,
} from "@/domain/schemas/duty";
import {
  JERSEY_CONDITION_LABELS,
  type JerseySetDTO,
} from "@/domain/schemas/jersey-set";

type ActiveTab = "duties" | "hours";

export default function DienstePage() {
  const { me, activeTeam, selectableTeams } = useAppContext();

  const [tab, setTab] = useState<ActiveTab>("duties");
  const [matchdays, setMatchdays] = useState<MatchdayDTO[]>([]);
  const [duties, setDuties] = useState<WorkDutyDTO[]>([]);
  const [jerseySets, setJerseySets] = useState<JerseySetDTO[]>([]);
  const [workHours, setWorkHours] = useState<TeamWorkHoursSummaryDTO | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dutyDialogOpen, setDutyDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkDutyDTO | null>(null);

  const isStaff = Boolean(
    activeTeam?.isClubAdmin ||
      activeTeam?.role === "CLUB_ADMIN" ||
      activeTeam?.role === "COACH" ||
      activeTeam?.role === "ASSISTANT_COACH" ||
      activeTeam?.role === "TEAM_MANAGER"
  );

  const myMemberInTeam =
    me?.memberships.find((m) => m.team.id === activeTeam?.teamId) ??
    me?.memberships.find((m) => m.club.id === activeTeam?.clubId) ??
    null;

  const clubTeams = selectableTeams
    .filter((t) => t.clubId === activeTeam?.clubId)
    .map((t) => ({ id: t.teamId, name: t.teamName }));

  const loadAll = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const [mdRes, dRes, whRes, jsRes] = await Promise.all([
        fetch(
          `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/matchdays`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties?teamId=${encodeURIComponent(activeTeam.teamId)}`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/work-hours`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/jersey-sets?teamId=${encodeURIComponent(activeTeam.teamId)}`,
          { cache: "no-store" }
        ),
      ]);
      if (mdRes.ok) setMatchdays((await mdRes.json()).matchdays ?? []);
      if (dRes.ok) setDuties((await dRes.json()).duties ?? []);
      if (whRes.ok) setWorkHours((await whRes.json()).summary ?? null);
      if (jsRes.ok) setJerseySets((await jsRes.json()).jerseySets ?? []);
      setError(null);
    } catch {
      setError("Dienste konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    Promise.all([
      fetch(
        `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/matchdays`,
        { cache: "no-store" }
      ),
      fetch(
        `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties?teamId=${encodeURIComponent(activeTeam.teamId)}`,
        { cache: "no-store" }
      ),
      fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/work-hours`,
        { cache: "no-store" }
      ),
      fetch(
        `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/jersey-sets?teamId=${encodeURIComponent(activeTeam.teamId)}`,
        { cache: "no-store" }
      ),
    ])
      .then(async ([mdRes, dRes, whRes, jsRes]) => {
        if (!active) return;
        if (mdRes.ok) setMatchdays((await mdRes.json()).matchdays ?? []);
        if (dRes.ok) setDuties((await dRes.json()).duties ?? []);
        if (whRes.ok) setWorkHours((await whRes.json()).summary ?? null);
        if (jsRes.ok) setJerseySets((await jsRes.json()).jerseySets ?? []);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Dienste konnten nicht geladen werden.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTeam]);

  async function handleClaim(dutyId: string) {
    if (!activeTeam || !myMemberInTeam) return;
    setError(null);
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties/${encodeURIComponent(dutyId)}/claim`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: myMemberInTeam.memberId }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message || "Dienst konnte nicht übernommen werden.");
      return;
    }
    await loadAll();
  }

  async function handleSwap(
    dutyId: string,
    assignmentId: string,
    action: "REQUEST_SWAP" | "ACCEPT_SWAP" | "CANCEL_SWAP"
  ) {
    if (!activeTeam) return;
    setError(null);
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties/${encodeURIComponent(dutyId)}/assignments/${encodeURIComponent(assignmentId)}/swap`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "ACCEPT_SWAP" && myMemberInTeam
            ? { replacementMemberId: myMemberInTeam.memberId }
            : {}),
          ...(action === "REQUEST_SWAP"
            ? { swapNote: "Suche Tauschpartner über die Tauschbörse." }
            : {}),
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message || "Tausch-Aktion fehlgeschlagen.");
      return;
    }
    await loadAll();
  }

  async function handleComplete(dutyId: string, assignmentId: string) {
    if (!activeTeam) return;
    setError(null);
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties/${encodeURIComponent(dutyId)}/assignments/${encodeURIComponent(assignmentId)}/complete`,
      { method: "PATCH" }
    );
    if (res.ok) await loadAll();
  }

  async function confirmDeleteDuty() {
    if (!activeTeam || !deleteTarget) return;
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties/${encodeURIComponent(deleteTarget.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadAll();
  }

  if (!activeTeam || !me) return null;

  return (
    <div className="space-y-5">
      {/* Kompakter Header */}
      <PageHeader
        title="Dienste"
        subtitle={`${activeTeam.teamName} · Heimspieltag, Kampfgericht & Arbeitsstunden`}
        actions={
          isStaff && tab === "duties" ? (
            <Button onClick={() => setDutyDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Dienst anlegen
            </Button>
          ) : undefined
        }
      />

      {/* Ruhige Segmented Tabs – fachlich klar auf Dienste & Stunden fokussiert */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as ActiveTab)}>
        <TabsList>
          <TabsTrigger value="duties">
            <ClipboardList className="h-4 w-4" />
            Dienste ({duties.length})
          </TabsTrigger>
          <TabsTrigger value="hours">
            <Clock className="h-4 w-4" />
            Arbeitsstunden-Konto
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {/* TAB 1: DIENSTE & TAUSCHBÖRSE */}
      {tab === "duties" && (
        <div className="space-y-3">
          {loading ? (
            <CardListSkeleton count={3} />
          ) : duties.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" />}
              title="Aktuell keine Dienste"
              description="Sobald Spieltags- oder Teamdienste angelegt werden, kannst du sie hier übernehmen oder tauschen."
              action={
                isStaff ? (
                  <Button size="sm" onClick={() => setDutyDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Dienst anlegen
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3">
              {duties.map((duty) => {
                const linkedChildIds = new Set(
                  me.guardianLinks.map((g) => g.childMemberId)
                );
                const isAssignedToMe = duty.assignments.some(
                  (a) =>
                    a.status !== "COMPLETED" &&
                    a.status !== "OPEN" &&
                    (a.assignedMemberUserId === me.user.id ||
                      a.assignedMemberId === myMemberInTeam?.memberId ||
                      (a.assignedMemberId !== null &&
                        linkedChildIds.has(a.assignedMemberId)))
                );

                const metaLine = [
                  DUTY_SCOPE_LABELS[duty.scope],
                  duty.matchdayTitle,
                  duty.assignedTeamName
                    ? `Team: ${duty.assignedTeamName}`
                    : null,
                  duty.jerseySet
                    ? `${duty.jerseySet.name} (${duty.jerseySet.colors})`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <Card key={duty.id} data-testid={`duty-card-${duty.id}`}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1 min-w-0">
                          {/* Max. 2–3 Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">
                              {DUTY_CATEGORY_LABELS[duty.category]}
                            </Badge>
                            <Badge variant="outline" className="font-mono">
                              +{duty.hoursCredit} Std.
                            </Badge>
                            {duty.requiresLicense && (
                              <Badge variant="unavailable" className="gap-1">
                                <Award className="h-3 w-3" />
                                Z/S-Lizenz
                              </Badge>
                            )}
                          </div>

                          <h2 className="text-base font-bold text-foreground">
                            {duty.title}
                          </h2>
                          {metaLine && (
                            <p className="text-xs text-muted-foreground">
                              {metaLine}
                            </p>
                          )}
                          {duty.description && (
                            <p className="text-xs text-muted-foreground">
                              {duty.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {duty.openSlots > 0 && myMemberInTeam && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleClaim(duty.id)}
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                              Slot übernehmen ({duty.openSlots} offen)
                            </Button>
                          )}
                          {isStaff && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-9 w-9 text-muted-foreground"
                                  aria-label={`Aktionen für Dienst ${duty.title}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  destructive
                                  onSelect={() => setDeleteTarget(duty)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Dienst löschen</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </div>

                      {/* Pflegehinweise zum Waschen */}
                      {duty.jerseySet &&
                        (duty.jerseySet.careInstructions ||
                          duty.jerseySet.conditionNote) && (
                          <div
                            data-testid={`laundry-care-${duty.id}`}
                            className={
                              isAssignedToMe
                                ? "rounded-xl border border-sky-400 bg-sky-50 p-3 text-xs space-y-1 dark:border-sky-700 dark:bg-sky-950/45"
                                : "rounded-lg border border-sky-200/80 bg-sky-50/50 p-3 text-xs space-y-1 dark:border-sky-900/60 dark:bg-sky-950/25"
                            }
                          >
                            <p className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                              <Sparkles className="h-3.5 w-3.5 shrink-0" />
                              {isAssignedToMe
                                ? `Deine Trikotwäsche (${duty.jerseySet.name}) – Pflegehinweise`
                                : `Pflegehinweise · ${duty.jerseySet.name}`}
                            </p>
                            {duty.jerseySet.careInstructions && (
                              <p className="text-sky-950/90 dark:text-sky-100/90 whitespace-pre-line">
                                {duty.jerseySet.careInstructions}
                              </p>
                            )}
                            {duty.jerseySet.conditionNote && (
                              <p className="text-muted-foreground">
                                Zustand (
                                {
                                  JERSEY_CONDITION_LABELS[
                                    duty.jerseySet.condition
                                  ]
                                }
                                ): {duty.jerseySet.conditionNote}
                              </p>
                            )}
                          </div>
                        )}

                      {/* Zugewiesene Slots & Tauschbörse */}
                      {duty.assignments.length > 0 && (
                        <div className="border-t border-border pt-2.5 space-y-2">
                          {duty.assignments.map((a) => {
                            const isMine =
                              a.assignedMemberUserId === me.user.id ||
                              a.assignedMemberId === myMemberInTeam?.memberId;
                            return (
                              <div
                                key={a.id}
                                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-muted/25 p-2.5 text-xs"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm">
                                      {a.assignedMemberFirstName}{" "}
                                      {a.assignedMemberLastName}
                                    </span>
                                    {a.assignedMemberTeamName && (
                                      <span className="text-muted-foreground">
                                        ({a.assignedMemberTeamName})
                                      </span>
                                    )}
                                    <Badge
                                      variant={
                                        a.status === "COMPLETED"
                                          ? "fit"
                                          : a.status === "SWAP_REQUESTED"
                                            ? "unavailable"
                                            : "secondary"
                                      }
                                    >
                                      {DUTY_ASSIGNMENT_STATUS_LABELS[a.status]}
                                    </Badge>
                                  </div>
                                  {a.swapNote && (
                                    <p className="text-amber-700 dark:text-amber-300">
                                      Tauschbörse: {a.swapNote}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  {a.status === "ASSIGNED" &&
                                    (isMine || isStaff) && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          handleSwap(
                                            duty.id,
                                            a.id,
                                            "REQUEST_SWAP"
                                          )
                                        }
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                        Tausch anfragen
                                      </Button>
                                    )}
                                  {a.status === "SWAP_REQUESTED" &&
                                    !isMine &&
                                    myMemberInTeam && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          handleSwap(
                                            duty.id,
                                            a.id,
                                            "ACCEPT_SWAP"
                                          )
                                        }
                                      >
                                        <ArrowLeftRight className="h-3 w-3 text-primary" />
                                        Tausch übernehmen
                                      </Button>
                                    )}
                                  {a.status === "SWAP_REQUESTED" &&
                                    (isMine || isStaff) && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 text-xs"
                                        onClick={() =>
                                          handleSwap(
                                            duty.id,
                                            a.id,
                                            "CANCEL_SWAP"
                                          )
                                        }
                                      >
                                        Abbrechen
                                      </Button>
                                    )}
                                  {isStaff && a.status !== "COMPLETED" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-xs"
                                      onClick={() =>
                                        handleComplete(duty.id, a.id)
                                      }
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      Erledigt
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ARBEITSSTUNDEN-KONTO */}
      {tab === "hours" && workHours && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Arbeitsstunden-Konto · {activeTeam.teamName}
            </CardTitle>
            <CardDescription>
              Jahres-Soll: {workHours.annualTargetHours} Std. · Team gesamt:{" "}
              <strong className="text-foreground">
                {workHours.totalCompletedHours} Std. geleistet
              </strong>{" "}
              ({workHours.totalPlannedHours} Std. geplant)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workHours.members.map((m) => (
              <div
                key={m.memberId}
                className="space-y-1.5 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-sm">
                  <span className="font-semibold break-words">
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="font-mono font-bold text-primary shrink-0">
                    {m.completedHours} / {m.targetHours} Std. (
                    {m.fulfillmentPercent}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all"
                    style={{ width: `${m.fulfillmentPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {m.completedDuties} erledigt · {m.plannedDuties} geplant (
                  {m.plannedHours} Std.) · Rest-Soll: {m.remainingHours} Std.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Dienst löschen?"
        description={
          deleteTarget
            ? `Dienst „${deleteTarget.title}“ wirklich endgültig löschen?`
            : undefined
        }
        confirmLabel="Dienst löschen"
        onConfirm={confirmDeleteDuty}
      />

      {isStaff && (
        <DutyFormDialog
          key={`duty-form-${dutyDialogOpen}`}
          open={dutyDialogOpen}
          onOpenChange={setDutyDialogOpen}
          clubId={activeTeam.clubId}
          activeTeamId={activeTeam.teamId}
          clubTeams={clubTeams}
          matchdays={matchdays}
          jerseySets={jerseySets}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}
