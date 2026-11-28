"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Shirt,
  Sparkles,
  Trophy,
  UserCheck,
} from "lucide-react";
import {
  EventTypeBadge,
  MatchLocationBadge,
} from "@/components/events/match-badges";
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
import { CardListSkeleton, EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { WorkDutyDTO } from "@/domain/schemas/duty";
import type { EventDTO } from "@/domain/schemas/event";
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
  const { me, activeTeam } = useAppContext();
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
  const nextMatch = upcomingEvents.find((e) => e.type === "MATCH") ?? null;
  const showSeparateNextMatch = Boolean(
    nextMatch && nextMatch.matchDetails && nextMatch.id !== nextEvent?.id
  );

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
      {/* Kompakter 2-zeiliger Header ohne doppelte Nav-Buttons */}
      <PageHeader
        leading={
          activeTeam.clubLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={activeTeam.clubLogoUrl}
              alt={`Vereinslogo ${activeTeam.clubName}`}
              className="hidden sm:block h-12 w-12 shrink-0 rounded-full object-contain bg-white p-1 border border-border shadow-xs"
            />
          ) : undefined
        }
        title={activeTeam.teamName}
        subtitle={
          <>
            {activeTeam.clubName} ·{" "}
            <span className="font-medium text-foreground">{me.user.name}</span>{" "}
            ({MEMBER_ROLE_LABELS[activeTeam.role]})
            {activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}
          </>
        }
      />

      {/* Schnelle Profil-Vervollständigung (nur wenn unvollständig & nicht ausgeblendet) */}
      <ProfileCompletionBanner />

      {/* Persönlicher Hinweis: Zugewiesene Trikotwäsche */}
      {myLaundryDuties.length > 0 && (
        <Card className="border-sky-300/80 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/35">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shirt className="h-4 w-4 text-sky-700 dark:text-sky-300 shrink-0" />
                <h2 className="text-sm font-bold text-sky-950 dark:text-sky-100">
                  Deine Trikotwäsche
                </h2>
              </div>
              <Link
                href="/dienste"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
              >
                Zu den Diensten
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {myLaundryDuties.map((duty) => (
              <div key={duty.id} className="text-xs space-y-1">
                <p className="font-semibold text-foreground">
                  {duty.title}
                  {duty.jerseySet
                    ? ` · ${duty.jerseySet.name} (${duty.jerseySet.colors})`
                    : ""}
                </p>
                {duty.jerseySet?.careInstructions && (
                  <p className="text-sky-950/90 dark:text-sky-100/90 flex items-start gap-1.5 whitespace-pre-line">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-300" />
                    <span>{duty.jerseySet.careInstructions}</span>
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Hero-Fokus: Nächster Termin (+ separates nächstes Punktspiel nur falls unterschiedlich) */}
      {loadingData ? (
        <CardListSkeleton count={2} />
      ) : !nextEvent ? (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="Kein anstehender Termin"
          description={
            isStaff
              ? "Lege ein Training oder Punktspiel an oder verknüpfe euren Spielplan."
              : "Sobald Trainer neue Trainings oder Spiele anlegen, erscheinen sie hier."
          }
          action={
            <Button size="sm" asChild>
              <Link href="/termine">Zu den Terminen</Link>
            </Button>
          }
        />
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            showSeparateNextMatch && "md:grid-cols-2"
          )}
        >
          <Card interactive className="border-primary/25">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base min-w-0">
                  <Calendar className="h-4 w-4 text-primary shrink-0" />
                  <Link
                    href={`/termine?eventId=${encodeURIComponent(nextEvent.id)}`}
                    className={cn(
                      CARD_OVERLAY_TRIGGER_CLASS,
                      "truncate transition-colors group-hover:text-primary"
                    )}
                  >
                    Nächster Termin
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-1.5 shrink-0">
                  {nextEvent.matchDetails ? (
                    <MatchLocationBadge
                      isHome={nextEvent.matchDetails.isHome}
                      labelMode="long"
                    />
                  ) : (
                    <EventTypeBadge type={nextEvent.type} />
                  )}
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <CardDescription className="font-medium text-foreground">
                {nextEvent.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {formatShortDate(nextEvent.startAt)} Uhr
                </span>
                {nextEvent.venue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {nextEvent.venue.name}
                  </span>
                )}
                {activeTeam.usesResin &&
                  nextEvent.venue &&
                  nextEvent.venue.resinPolicy !== "UNKNOWN" && (
                    <ResinBadge policy={nextEvent.venue.resinPolicy} />
                  )}
              </div>

              {isStaff && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {nextEvent.summary.accepted} zugesagt
                  </span>{" "}
                  · {nextEvent.summary.maybe} vielleicht ·{" "}
                  {nextEvent.summary.declined} abgesagt ·{" "}
                  {nextEvent.summary.pending} offen ({nextEventResponseRate}%)
                </p>
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

          {showSeparateNextMatch && nextMatch && nextMatch.matchDetails && (
            <Card interactive>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base min-w-0">
                    <Trophy className="h-4 w-4 text-primary shrink-0" />
                    <Link
                      href={`/termine?eventId=${encodeURIComponent(nextMatch.id)}`}
                      className={cn(
                        CARD_OVERLAY_TRIGGER_CLASS,
                        "truncate transition-colors group-hover:text-primary"
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
                <CardDescription className="font-medium text-foreground">
                  {nextMatch.matchDetails.opponentName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Anwurf: {formatShortDate(nextMatch.startAt)} Uhr
                </p>
                {nextMatch.venue && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {nextMatch.venue.name}
                    </span>
                    {activeTeam.usesResin &&
                      nextMatch.venue.resinPolicy !== "UNKNOWN" && (
                        <ResinBadge policy={nextMatch.venue.resinPolicy} />
                      )}
                  </div>
                )}
                {nextMatch.matchDetails.jerseyColor && (
                  <p>
                    Trikot:{" "}
                    <span className="font-semibold text-foreground">
                      {nextMatch.matchDetails.jerseyColor}
                    </span>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Staff-Kennzahlen (kompakt, nur für Trainer/Betreuer/Admins) */}
      {isStaff && !loadingData && (
        <div className="grid grid-cols-3 gap-3">
          <Card interactive>
            <CardContent className="p-3.5 sm:p-4">
              <Link
                href="/team"
                className={cn(
                  CARD_OVERLAY_TRIGGER_CLASS,
                  "block text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                )}
              >
                Kader fit
              </Link>
              <p className="mt-1 text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {fitCount}
                <span className="text-sm font-semibold text-muted-foreground">
                  /{players.length}
                </span>
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                {injuredCount > 0 || unavailableCount > 0
                  ? `${injuredCount} verl. · ${unavailableCount} abw.`
                  : "Alle einsatzbereit"}
              </p>
            </CardContent>
          </Card>

          <Card interactive>
            <CardContent className="p-3.5 sm:p-4">
              <Link
                href={
                  nextEvent
                    ? `/termine?eventId=${encodeURIComponent(nextEvent.id)}`
                    : "/termine"
                }
                className={cn(
                  CARD_OVERLAY_TRIGGER_CLASS,
                  "block text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                )}
              >
                Zusagen
              </Link>
              <p className="mt-1 text-xl sm:text-2xl font-extrabold text-primary">
                {nextEvent
                  ? `${nextEvent.summary.accepted}/${players.length}`
                  : "–"}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                {nextEvent ? `${nextEventResponseRate}% Antwort` : "Kein Termin"}
              </p>
            </CardContent>
          </Card>

          <Card interactive>
            <CardContent className="p-3.5 sm:p-4">
              <Link
                href="/team"
                className={cn(
                  CARD_OVERLAY_TRIGGER_CLASS,
                  "block text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary"
                )}
              >
                Ohne Login
              </Link>
              <p
                className={cn(
                  "mt-1 text-xl sm:text-2xl font-extrabold",
                  unclaimedCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-foreground"
                )}
              >
                {unclaimedCount}
              </p>
              <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                {unclaimedCount > 0 ? "Noch offen" : "Alle verknüpft"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rollen-Fokus für Eltern & Spieler (ohne doppelte Teamliste) */}
      {me.guardianLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCheck className="h-4 w-4 text-primary" />
              Verknüpfte Kinder-Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {me.guardianLinks.map((link) => (
              <Link
                key={link.id}
                href="/team"
                className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:border-primary/40 hover:bg-muted/50"
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
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-mono text-base font-bold">
                {myMembership.jerseyNumber ? `#${myMembership.jerseyNumber}` : "–"}
              </div>
              <div className="min-w-0">
                <Link
                  href="/team"
                  className={cn(
                    CARD_OVERLAY_TRIGGER_CLASS,
                    "block font-bold text-sm truncate transition-colors group-hover:text-primary"
                  )}
                >
                  {myMembership.firstName} {myMembership.lastName}
                </Link>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Activity className="h-3 w-3 text-primary shrink-0" />
                  {myMembership.primaryPosition
                    ? `${myMembership.primaryPosition} · ${HANDBALL_POSITION_LABELS[myMembership.primaryPosition].full}`
                    : "Position im Profil ergänzen"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {myMembership.availabilityStatus !== "FIT" && (
                <Badge
                  variant={
                    myMembership.availabilityStatus === "INJURED"
                      ? "injured"
                      : "unavailable"
                  }
                >
                  {AVAILABILITY_STATUS_LABELS[myMembership.availabilityStatus]}
                </Badge>
              )}
              <ChevronRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                aria-hidden="true"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
