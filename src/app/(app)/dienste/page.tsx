"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  Dumbbell,
  Plus,
  ShieldCheck,
  Shirt,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { DutyFormDialog } from "@/components/duties/duty-form-dialog";
import { useAppContext } from "@/components/providers/app-context";
import { TrainingPanel } from "@/components/training/training-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type ActiveTab = "duties" | "hours" | "plans" | "drills";

export default function DiensteUndTrainingPage() {
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

  const isCoachingStaff =
    activeTeam?.isClubAdmin ||
    activeTeam?.role === "CLUB_ADMIN" ||
    activeTeam?.role === "COACH" ||
    activeTeam?.role === "ASSISTANT_COACH";

  const isStaff = isCoachingStaff || activeTeam?.role === "TEAM_MANAGER";

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

  async function handleDeleteDuty(duty: WorkDutyDTO) {
    if (!activeTeam) return;
    if (!window.confirm(`Dienst „${duty.title}“ wirklich löschen?`)) return;
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties/${encodeURIComponent(duty.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadAll();
  }

  if (!activeTeam || !me) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {activeTeam.clubName} · {activeTeam.teamName}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Dienste & Trainingsplaner
          </h1>
          <p className="text-sm text-muted-foreground">
            Heimspieltag- & Teamdienste, Kampfgericht, Arbeitsstunden-Konto &
            Übungsbibliothek
          </p>
        </div>

        {isStaff && tab === "duties" && (
          <Button onClick={() => setDutyDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Dienst anlegen
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setTab("duties")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            tab === "duties"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Dienste & Heimspieltag ({duties.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("hours")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            tab === "hours"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <Clock className="h-4 w-4" />
          Arbeitsstunden-Konto
        </button>
        <button
          type="button"
          onClick={() => setTab("plans")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            tab === "plans"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <Dumbbell className="h-4 w-4" />
          Trainingsplaner
        </button>
        <button
          type="button"
          onClick={() => setTab("drills")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            tab === "drills"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Übungsbibliothek
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {/* TAB 1: ZWEISTUFIGE DIENSTE & TAUSCHBÖRSE */}
      {tab === "duties" && (
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade Dienste…</p>
          ) : duties.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Aktuell sind keine Dienste hinterlegt.
              </CardContent>
            </Card>
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

                return (
                <Card key={duty.id} data-testid={`duty-card-${duty.id}`}>
                  <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            variant={
                              duty.scope === "CLUB_MATCHDAY"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {DUTY_SCOPE_LABELS[duty.scope]}
                          </Badge>
                          <Badge variant="outline">
                            {DUTY_CATEGORY_LABELS[duty.category]}
                          </Badge>
                          <Badge variant="outline" className="font-mono">
                            +{duty.hoursCredit} Std.
                          </Badge>
                          {duty.requiresLicense && (
                            <Badge variant="unavailable" className="gap-1">
                              <Award className="h-3 w-3" />
                              Z/S-Lizenz erforderlich
                            </Badge>
                          )}
                          {duty.assignedTeamName && (
                            <Badge variant="position" className="gap-1">
                              <Users className="h-3 w-3" />
                              Delegiert an {duty.assignedTeamName}
                            </Badge>
                          )}
                          {duty.jerseySet && (
                            <Badge variant="secondary" className="gap-1">
                              <Shirt className="h-3 w-3 text-primary" />
                              {duty.jerseySet.name} ({duty.jerseySet.colors})
                            </Badge>
                          )}
                        </div>

                        <h2 className="text-base font-bold">{duty.title}</h2>
                        {duty.matchdayTitle && (
                          <p className="text-xs font-medium text-primary">
                            {duty.matchdayTitle}
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
                            onClick={() => handleClaim(duty.id)}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Slot übernehmen ({duty.openSlots} offen)
                          </Button>
                        )}
                        {isStaff && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteDuty(duty)}
                            aria-label={`Dienst ${duty.title} löschen`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Pflegehinweise zum Waschen (besonders hervorgehoben für eingeteilte Person) */}
                    {duty.jerseySet &&
                      (duty.jerseySet.careInstructions ||
                        duty.jerseySet.conditionNote) && (
                        <div
                          data-testid={`laundry-care-${duty.id}`}
                          className={
                            isAssignedToMe
                              ? "rounded-xl border-2 border-sky-400 bg-sky-50 p-3.5 text-xs space-y-1.5 dark:border-sky-600 dark:bg-sky-950/50"
                              : "rounded-lg border border-sky-200/80 bg-sky-50/50 p-3 text-xs space-y-1 dark:border-sky-900/60 dark:bg-sky-950/25"
                          }
                        >
                          <p className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 shrink-0" />
                            {isAssignedToMe
                              ? `Deine Trikotwäsche (${duty.jerseySet.name}) – Pflegehinweise beachten`
                              : `Pflegehinweise zum Waschen · ${duty.jerseySet.name}`}
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
                              <div className="space-y-0.5">
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

                              <div className="flex flex-wrap items-center gap-1.5">
                                {a.status === "ASSIGNED" && (isMine || isStaff) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() =>
                                      handleSwap(duty.id, a.id, "REQUEST_SWAP")
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
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        handleSwap(duty.id, a.id, "ACCEPT_SWAP")
                                      }
                                    >
                                      <ArrowLeftRight className="h-3 w-3" />
                                      Tausch übernehmen
                                    </Button>
                                  )}
                                {a.status === "SWAP_REQUESTED" &&
                                  (isMine || isStaff) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() =>
                                        handleSwap(duty.id, a.id, "CANCEL_SWAP")
                                      }
                                    >
                                      Tausch abbrechen
                                    </Button>
                                  )}
                                {isStaff && a.status !== "COMPLETED" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => handleComplete(duty.id, a.id)}
                                  >
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
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
          <CardHeader>
            <CardTitle className="text-base">
              Arbeitsstunden-Konto · {activeTeam.teamName}
            </CardTitle>
            <CardDescription>
              Jahres-Soll: {workHours.annualTargetHours} Std. pro Mitglied ·
              Team gesamt:{" "}
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

      {/* TAB 3 & 4: TRAININGSPLANER & ÜBUNGSBIBLIOTHEK */}
      {tab === "plans" && (
        <TrainingPanel
          teamId={activeTeam.teamId}
          mode="plans"
          isStaff={isCoachingStaff}
        />
      )}
      {tab === "drills" && (
        <TrainingPanel
          teamId={activeTeam.teamId}
          mode="drills"
          isStaff={isCoachingStaff}
        />
      )}

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
