"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Shield,
  Shirt,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import { MatchLocationBadge } from "@/components/events/match-badges";
import { ResinBadge } from "@/components/events/resin-badge";
import { RsvpControls } from "@/components/events/rsvp-controls";
import { ProfileCompletionBanner } from "@/components/onboarding/profile-completion-banner";
import { useAppContext } from "@/components/providers/app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CARD_ACTION_LAYER_CLASS,
  CARD_OVERLAY_TRIGGER_CLASS,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WorkDutyDTO } from "@/domain/schemas/duty";
import { EVENT_TYPE_LABELS, type EventDTO } from "@/domain/schemas/event";
import {
  AVAILABILITY_STATUS_LABELS,
  HANDBALL_POSITION_LABELS,
  MEMBER_ROLE_LABELS,
  type RsvpStatus,
} from "@/domain/schemas/handball";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { me, activeTeam, selectableTeams, setActiveTeamId } = useAppContext();
  const [members, setMembers] = useState<TeamMemberResponseDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [duties, setDuties] = useState<WorkDutyDTO[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const reloadDashboard = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const [mRes, eRes, dRes] = await Promise.all([
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/events`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties?teamId=${encodeURIComponent(activeTeam.teamId)}`,
          { cache: "no-store" }
        ),
      ]);
      if (mRes.ok) setMembers((await mRes.json()).members ?? []);
      if (eRes.ok) setEvents((await eRes.json()).events ?? []);
      if (dRes.ok) setDuties((await dRes.json()).duties ?? []);
    } finally {
      setLoadingData(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    Promise.all([
      fetch(`/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/events`, {
        cache: "no-store",
      }),
      fetch(
        `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties?teamId=${encodeURIComponent(activeTeam.teamId)}`,
        { cache: "no-store" }
      ),
    ])
      .then(async ([mRes, eRes, dRes]) => {
        if (!active) return;
        if (mRes.ok) setMembers((await mRes.json()).members ?? []);
        if (eRes.ok) setEvents((await eRes.json()).events ?? []);
        if (dRes.ok) setDuties((await dRes.json()).duties ?? []);
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, [activeTeam]);

  const rsvpTargets = useMemo(() => {
    if (!me || !activeTeam) return [];
    const targets: Array<{ memberId: string; label?: string }> = [];
    const own = me.memberships.find(
      (m) => m.team.id === activeTeam.teamId && m.role === "PLAYER"
    );
    if (own) targets.push({ memberId: own.memberId });
    for (const g of me.guardianLinks.filter(
      (l) => l.teamId === activeTeam.teamId
    )) {
      targets.push({
        memberId: g.childMemberId,
        label: `${g.childFirstName} ${g.childLastName}`,
      });
    }
    return targets;
  }, [me, activeTeam]);

  const [nowMs] = useState(() => Date.now());

  const upcomingEvents = useMemo(() => {
    const cutoff = nowMs - 2 * 60 * 60 * 1000;
    return events.filter(
      (e) => !e.isCancelled && new Date(e.startAt).getTime() >= cutoff
    );
  }, [events, nowMs]);

  const nextEvent = upcomingEvents[0] ?? null;
  const nextMatch =
    upcomingEvents.find((e) => e.type === "MATCH") ?? null;

  if (!me || !activeTeam) {
    return null;
  }

  const isStaff =
    activeTeam.isClubAdmin ||
    activeTeam.role === "CLUB_ADMIN" ||
    activeTeam.role === "COACH" ||
    activeTeam.role === "ASSISTANT_COACH" ||
    activeTeam.role === "TEAM_MANAGER";

  const players = members.filter((m) => m.role === "PLAYER");
  const fitCount = players.filter((m) => m.availabilityStatus === "FIT").length;
  const injuredCount = players.filter(
    (m) => m.availabilityStatus === "INJURED"
  ).length;
  const unavailableCount = players.filter(
    (m) => m.availabilityStatus === "UNAVAILABLE"
  ).length;
  const unclaimedCount = players.filter((m) => !m.isClaimed).length;

  const myMembership = me.memberships.find(
    (m) => m.team.id === activeTeam.teamId
  );

  const myLinkedChildIds = new Set(
    me.guardianLinks.map((g) => g.childMemberId)
  );
  const myLaundryDuties = duties.filter(
    (d) =>
      d.category === "JERSEY_LAUNDRY" &&
      d.assignments.some(
        (a) =>
          (a.status === "ASSIGNED" || a.status === "SWAP_REQUESTED") &&
          (a.assignedMemberUserId === me.user.id ||
            a.assignedMemberId === myMembership?.memberId ||
            (a.assignedMemberId !== null &&
              myLinkedChildIds.has(a.assignedMemberId)))
      )
  );

  const nextEventResponded = nextEvent
    ? nextEvent.summary.accepted +
      nextEvent.summary.declined +
      nextEvent.summary.maybe
    : 0;
  const nextEventResponseRate =
    nextEvent && players.length > 0
      ? Math.min(100, Math.round((nextEventResponded / players.length) * 100))
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3.5 min-w-0">
          {activeTeam.clubLogoUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={activeTeam.clubLogoUrl}
              alt={`Vereinslogo ${activeTeam.clubName}`}
              className="h-14 w-14 shrink-0 rounded-full object-contain bg-white p-1 border border-border shadow-sm"
            />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary break-words">
              {activeTeam.clubName} · Saison {activeTeam.seasonName}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl break-words">
              {activeTeam.teamName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 break-words">
              Angemeldet als{" "}
              <span className="font-medium text-foreground">{me.user.name}</span>{" "}
              ({MEMBER_ROLE_LABELS[activeTeam.role]})
              {activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/termine">
              <Calendar className="h-4 w-4" />
              Termine
            </Link>
          </Button>
          <Button asChild>
            <Link href="/team">
              <Users className="h-4 w-4" />
              Zum Kader
            </Link>
          </Button>
        </div>
      </div>

      {/* Schnelle Profil-Vervollständigung (nur wenn unvollständig & nicht ausgeblendet) */}
      <ProfileCompletionBanner />

      {/* Zugewiesene Trikotwäsche & Pflegehinweise */}
      {myLaundryDuties.length > 0 && (
        <Card className="border-sky-300 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/35">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shirt className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                <h2 className="text-sm font-bold text-sky-950 dark:text-sky-100">
                  Deine Trikotwäsche – Pflegehinweise
                </h2>
              </div>
              <Link
                href="/dienste"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Zu den Diensten
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="space-y-2.5">
              {myLaundryDuties.map((duty) => (
                <div
                  key={duty.id}
                  className="rounded-lg border border-sky-200/80 bg-background/80 p-3 text-xs space-y-1 dark:border-sky-900/60"
                >
                  <p className="font-semibold text-foreground">
                    {duty.title}
                    {duty.jerseySet
                      ? ` · ${duty.jerseySet.name} (${duty.jerseySet.colors})`
                      : ""}
                  </p>
                  {duty.jerseySet?.careInstructions ? (
                    <p className="text-sky-950/90 dark:text-sky-100/90 flex items-start gap-1.5 whitespace-pre-line">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-300" />
                      <span>{duty.jerseySet.careInstructions}</span>
                    </p>
                  ) : (
                    <p className="text-muted-foreground">
                      Keine besonderen Pflegehinweise hinterlegt.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI-Leiste */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card interactive>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/team"
                className={cn(
                  CARD_OVERLAY_TRIGGER_CLASS,
                  "text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                )}
              >
                Kadergröße
              </Link>
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1 text-2xl font-extrabold">
              {loadingData ? "–" : players.length}
            </p>
            <p className="text-xs text-muted-foreground">Aktive Spieler</p>
          </CardContent>
        </Card>

        <Card interactive>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/team"
                className={cn(
                  CARD_OVERLAY_TRIGGER_CLASS,
                  "text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                )}
              >
                Fit
              </Link>
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {loadingData ? "–" : fitCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {injuredCount} verletzt · {unavailableCount} abwesend
            </p>
          </CardContent>
        </Card>

        <Card interactive>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={
                  nextEvent
                    ? `/termine?eventId=${encodeURIComponent(nextEvent.id)}`
                    : "/termine"
                }
                className={cn(
                  CARD_OVERLAY_TRIGGER_CLASS,
                  "text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                )}
              >
                Nächster Termin
              </Link>
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1 text-2xl font-extrabold text-primary">
              {loadingData || !nextEvent
                ? "–"
                : `${nextEvent.summary.accepted}/${players.length}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {nextEvent
                ? `Zugesagt (${nextEventResponseRate}% Rückmeldung)`
                : "Kein Termin geplant"}
            </p>
          </CardContent>
        </Card>

        <Card interactive>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/team"
                className={cn(
                  CARD_OVERLAY_TRIGGER_CLASS,
                  "text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                )}
              >
                Offene Profile
              </Link>
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>
            <p className="mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {loadingData ? "–" : unclaimedCount}
            </p>
            <p className="text-xs text-muted-foreground">Noch nicht geclaimt</p>
          </CardContent>
        </Card>
      </div>

      {/* Nächster Termin mit 1-Klick-RSVP & Nächstes Spiel mit Harz-Hinweis */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {nextEvent && (
          <Card interactive>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  <Link
                    href={`/termine?eventId=${encodeURIComponent(nextEvent.id)}`}
                    className={cn(
                      CARD_OVERLAY_TRIGGER_CLASS,
                      "transition-colors group-hover:text-primary"
                    )}
                  >
                    Nächster Termin
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge
                    variant={
                      nextEvent.type === "MATCH" ? "default" : "secondary"
                    }
                  >
                    {EVENT_TYPE_LABELS[nextEvent.type]}
                  </Badge>
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <CardDescription>{nextEvent.title}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {formatShortDate(nextEvent.startAt)} Uhr
                </p>
                {nextEvent.venue && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {nextEvent.venue.name}
                    </span>
                    {activeTeam.usesResin && (
                      <ResinBadge policy={nextEvent.venue.resinPolicy} />
                    )}
                  </div>
                )}
              </div>

              {isStaff && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-1">
                  <p className="font-semibold text-foreground">
                    Rückmeldequote: {nextEventResponseRate}%
                  </p>
                  <p className="text-muted-foreground">
                    {nextEvent.summary.accepted} Zugesagt ·{" "}
                    {nextEvent.summary.maybe} Vielleicht ·{" "}
                    {nextEvent.summary.declined} Abgesagt ·{" "}
                    {nextEvent.summary.pending} Offen
                  </p>
                </div>
              )}

              {rsvpTargets.length > 0 && (
                <div className={cn(CARD_ACTION_LAYER_CLASS, "pt-1 space-y-2")}>
                  {rsvpTargets.map((t) => {
                    const existing = nextEvent.attendances.find(
                      (a) => a.memberId === t.memberId
                    );
                    const status: RsvpStatus = existing?.status ?? "PENDING";
                    return (
                      <RsvpControls
                        key={t.memberId}
                        teamId={activeTeam.teamId}
                        eventId={nextEvent.id}
                        memberId={t.memberId}
                        memberLabel={t.label}
                        currentStatus={status}
                        requireDeclineReason={nextEvent.requireDeclineReason}
                        onUpdated={reloadDashboard}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {nextMatch && nextMatch.matchDetails && (
          <Card interactive>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-primary" />
                  <Link
                    href={`/termine?eventId=${encodeURIComponent(nextMatch.id)}`}
                    className={cn(
                      CARD_OVERLAY_TRIGGER_CLASS,
                      "transition-colors group-hover:text-primary"
                    )}
                  >
                    Nächstes Punktspiel
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  <MatchLocationBadge
                    isHome={nextMatch.matchDetails.isHome}
                    labelMode="long"
                  />
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <CardDescription>
                Gegner: {nextMatch.matchDetails.opponentName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Anwurf: {formatShortDate(nextMatch.startAt)} Uhr
              </p>
              {nextMatch.venue && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {nextMatch.venue.name}
                  </span>
                  {activeTeam.usesResin && (
                    <ResinBadge policy={nextMatch.venue.resinPolicy} />
                  )}
                </div>
              )}
              {nextMatch.matchDetails.jerseyColor && (
                <p className="text-xs text-muted-foreground">
                  Trikot:{" "}
                  <strong className="text-foreground">
                    {nextMatch.matchDetails.jerseyColor}
                  </strong>
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rollen-spezifische Karten */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isStaff && (
          <Card interactive>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4 text-primary" />
                  <Link
                    href="/team"
                    className={cn(
                      CARD_OVERLAY_TRIGGER_CLASS,
                      "transition-colors group-hover:text-primary"
                    )}
                  >
                    Trainer- & Vereins-Steuerung
                  </Link>
                </CardTitle>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary shrink-0"
                  aria-hidden="true"
                />
              </div>
              <CardDescription>
                Schnellzugriff auf Kaderpflege, Einladungen und Profil-Claims.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3.5 text-sm">
                <p className="font-semibold text-foreground">
                  {unclaimedCount > 0
                    ? `${unclaimedCount} Kader-Profile warten auf Konto-Verknüpfung`
                    : "Alle Spieler-Profile sind verknüpft"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Erstelle persönliche Claim-Links im Kader, damit Spieler oder
                  Eltern ihr Profil mit einem Klick übernehmen können.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {me.guardianLinks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck className="h-4 w-4 text-primary" />
                Verknüpfte Kinder-Profile
              </CardTitle>
              <CardDescription>
                Du verwaltest diese Jugendspieler stellvertretend ohne eigenen
                Kinder-Login.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {me.guardianLinks.map((link) => (
                <Link
                  key={link.id}
                  href="/team"
                  className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate transition-colors group-hover:text-primary">
                      {link.childFirstName} {link.childLastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {link.teamName} · {link.relationship}
                    </p>
                  </div>
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary shrink-0"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        {myMembership && activeTeam.role === "PLAYER" && (
          <Card interactive>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-primary" />
                  <Link
                    href="/team"
                    className={cn(
                      CARD_OVERLAY_TRIGGER_CLASS,
                      "transition-colors group-hover:text-primary"
                    )}
                  >
                    Dein Spielerprofil
                  </Link>
                </CardTitle>
                <ChevronRight
                  className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary shrink-0"
                  aria-hidden="true"
                />
              </div>
              <CardDescription>
                Deine sportlichen Eckdaten in {activeTeam.teamName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-mono text-lg font-bold">
                    {myMembership.jerseyNumber
                      ? `#${myMembership.jerseyNumber}`
                      : "–"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold truncate">
                      {myMembership.firstName} {myMembership.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {myMembership.primaryPosition
                        ? `${myMembership.primaryPosition} · ${HANDBALL_POSITION_LABELS[myMembership.primaryPosition].full}`
                        : "Position noch offen"}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    myMembership.availabilityStatus === "FIT"
                      ? "fit"
                      : myMembership.availabilityStatus === "INJURED"
                        ? "injured"
                        : "unavailable"
                  }
                  className="shrink-0"
                >
                  {AVAILABILITY_STATUS_LABELS[myMembership.availabilityStatus]}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Deine Mannschaften ({selectableTeams.length})
            </CardTitle>
            <CardDescription>
              Wechsle jederzeit per Klick zwischen deinen Teams und Rollen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectableTeams.map((team) => {
              const isCurrent = team.teamId === activeTeam.teamId;
              return (
                <button
                  key={team.teamId}
                  type="button"
                  onClick={() => setActiveTeamId(team.teamId)}
                  aria-pressed={isCurrent}
                  className={cn(
                    "group flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    isCurrent
                      ? "border-primary/50 bg-primary/5"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate transition-colors group-hover:text-primary">
                      {team.teamName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {team.clubName}
                      {team.leagueName ? ` · ${team.leagueName}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={isCurrent ? "default" : "secondary"}>
                      {MEMBER_ROLE_LABELS[team.role]}
                    </Badge>
                    {!isCurrent && (
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
