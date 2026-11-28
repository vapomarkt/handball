"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronRight,
  Clock,
  Coins,
  ExternalLink,
  MapPin,
  Trophy,
  UserCheck,
} from "lucide-react";
import { PlayerAvailabilitySwitcher } from "@/components/dashboard/player-availability-switcher";
import { PlayerDutiesCard } from "@/components/dashboard/player-duties-card";
import {
  QuickRsvpList,
  type DashboardRsvpTarget,
} from "@/components/dashboard/quick-rsvp-list";
import { TeamPulseSection } from "@/components/dashboard/team-pulse-section";
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
import { formatGermanDateTime, formatGermanTime } from "@/domain/date-time";
import type {
  CashboxOverviewDTO,
  TeamAnnouncementDTO,
  TeamPollDTO,
} from "@/domain/schemas/community";
import type { WorkDutyDTO } from "@/domain/schemas/duty";
import type {
  EventAttendanceResponseDTO,
  EventDTO,
} from "@/domain/schemas/event";
import {
  formatMemberRoles,
  hasMemberRole,
  isStaffMember,
  type RsvpStatus,
} from "@/domain/schemas/handball";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";
import { formatCentsEur } from "@/domain/services/cashbox-service";
import {
  applyOptimisticRsvpToEvents,
  buildVenueMapsHref,
  getDashboardAnnouncements,
  getMemberRsvpStatus,
  getOpenUnvotedPolls,
  getPersonalUpcomingDuties,
  getUpcomingEvents,
  isAnyMemberNominated,
} from "@/domain/services/player-dashboard";
import { cn } from "@/lib/utils";

function formatEventDateTime(iso: string) {
  return formatGermanDateTime(iso, { includeWeekday: true, includeUhr: true });
}

export default function DashboardPage() {
  const { me, activeTeam, refreshMe } = useAppContext();
  const [members, setMembers] = useState<TeamMemberResponseDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [duties, setDuties] = useState<WorkDutyDTO[]>([]);
  const [announcements, setAnnouncements] = useState<TeamAnnouncementDTO[]>([]);
  const [polls, setPolls] = useState<TeamPollDTO[]>([]);
  const [cashbox, setCashbox] = useState<CashboxOverviewDTO | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const isStaff = isStaffMember(activeTeam);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    const base = `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}`;

    const requests: Promise<Response | null>[] = [
      fetch(`${base}/events`, { cache: "no-store" }),
      fetch(
        `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/duties?teamId=${encodeURIComponent(activeTeam.teamId)}`,
        { cache: "no-store" }
      ),
      fetch(`${base}/announcements`, { cache: "no-store" }),
      fetch(`${base}/polls`, { cache: "no-store" }),
      fetch(`${base}/cashbox`, { cache: "no-store" }),
      isStaff
        ? fetch(`${base}/members`, { cache: "no-store" })
        : Promise.resolve(null),
    ];

    Promise.all(requests)
      .then(async ([eRes, dRes, aRes, pRes, cRes, mRes]) => {
        if (!active) return;
        if (eRes?.ok) setEvents((await eRes.json()).events ?? []);
        if (dRes?.ok) setDuties((await dRes.json()).duties ?? []);
        if (aRes?.ok) setAnnouncements((await aRes.json()).announcements ?? []);
        if (pRes?.ok) setPolls((await pRes.json()).polls ?? []);
        if (cRes?.ok) setCashbox(await cRes.json());
        if (mRes?.ok) {
          setMembers((await mRes.json()).members ?? []);
        } else if (!isStaff) {
          setMembers([]);
        }
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, [activeTeam, isStaff]);

  const rsvpTargets = useMemo<DashboardRsvpTarget[]>(() => {
    if (!me || !activeTeam) return [];
    const targets: DashboardRsvpTarget[] = [];
    const own = me.memberships.find(
      (m) => m.team.id === activeTeam.teamId && hasMemberRole(m, "PLAYER")
    );
    if (own) {
      targets.push({
        memberId: own.memberId,
        label: "Ich",
        isOwn: true,
      });
    }
    for (const g of me.guardianLinks.filter(
      (l) => l.teamId === activeTeam.teamId
    )) {
      targets.push({
        memberId: g.childMemberId,
        label: `${g.childFirstName} ${g.childLastName}`,
        isOwn: false,
      });
    }
    return targets;
  }, [me, activeTeam]);

  const [nowMs] = useState(() => Date.now());

  const upcomingEvents = useMemo(
    () => getUpcomingEvents(events, nowMs),
    [events, nowMs]
  );

  const nextEvent = upcomingEvents[0] ?? null;
  const followUpEvents = useMemo(
    () => upcomingEvents.slice(1),
    [upcomingEvents]
  );
  const nextMatch = useMemo(
    () => upcomingEvents.find((e) => e.type === "MATCH") ?? null,
    [upcomingEvents]
  );
  const showSeparateNextMatch = Boolean(
    isStaff &&
      rsvpTargets.length === 0 &&
      nextMatch &&
      nextMatch.matchDetails &&
      nextMatch.id !== nextEvent?.id
  );

  const myMembership = useMemo(() => {
    if (!me || !activeTeam) return undefined;
    return me.memberships.find((m) => m.team.id === activeTeam.teamId);
  }, [me, activeTeam]);

  const personalDuties = useMemo(() => {
    if (!me) return [];
    const linkedChildIds = new Set(
      me.guardianLinks.map((g) => g.childMemberId)
    );
    return getPersonalUpcomingDuties(duties, {
      userId: me.user.id,
      memberId: myMembership?.memberId,
      linkedChildIds,
      nowMs,
    });
  }, [duties, me, myMembership, nowMs]);

  const openUnvotedPolls = useMemo(() => getOpenUnvotedPolls(polls), [polls]);
  const highlightedAnnouncements = useMemo(
    () => getDashboardAnnouncements(announcements, 2),
    [announcements]
  );

  const handleOptimisticRsvp = useCallback(
    (eventId: string, memberId: string, nextStatus: RsvpStatus) => {
      setEvents((prev) =>
        applyOptimisticRsvpToEvents(prev, {
          eventId,
          memberId,
          status: nextStatus,
        })
      );
    },
    []
  );

  const handleConfirmedRsvp = useCallback(
    (
      eventId: string,
      memberId: string,
      attendance?: EventAttendanceResponseDTO
    ) => {
      if (!attendance) return;
      setEvents((prev) =>
        applyOptimisticRsvpToEvents(prev, {
          eventId,
          memberId,
          status: attendance.status,
          attendance,
        })
      );
    },
    []
  );

  const handlePollUpdated = useCallback((updatedPoll: TeamPollDTO) => {
    setPolls((prev) =>
      prev.map((p) => (p.id === updatedPoll.id ? updatedPoll : p))
    );
  }, []);

  if (!me || !activeTeam) {
    return null;
  }

  const players = members.filter((m) => hasMemberRole(m, "PLAYER"));
  const fitCount = players.filter((m) => m.availabilityStatus === "FIT").length;
  const injuredCount = players.filter(
    (m) => m.availabilityStatus === "INJURED"
  ).length;
  const unavailableCount = players.filter(
    (m) => m.availabilityStatus === "UNAVAILABLE"
  ).length;
  const unclaimedCount = players.filter((m) => !m.isClaimed).length;

  const nextEventResponded = nextEvent
    ? nextEvent.summary.accepted +
      nextEvent.summary.declined +
      nextEvent.summary.maybe
    : 0;
  const nextEventResponseRate =
    nextEvent && players.length > 0
      ? Math.min(100, Math.round((nextEventResponded / players.length) * 100))
      : 0;

  const nextEventMapsHref = nextEvent
    ? buildVenueMapsHref(nextEvent.venue)
    : null;
  const rsvpTargetMemberIds = rsvpTargets.map((t) => t.memberId);
  const nextEventNominated = nextEvent
    ? isAnyMemberNominated(nextEvent, rsvpTargetMemberIds)
    : false;
  const myOpenFinesCents = cashbox?.summary.myOpenFinesCents ?? 0;
  const myOpenFinesCount = cashbox?.summary.myOpenFinesCount ?? 0;

  return (
    <div className="space-y-5">
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
            ({formatMemberRoles(activeTeam.roles)})
            {activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}
          </>
        }
      />

      {/* Kompakter Fitness-Status-Umschalter für Spieler (ersetzt statische Profilkarte) */}
      {myMembership && hasMemberRole(activeTeam, "PLAYER") && (
        <PlayerAvailabilitySwitcher
          teamId={activeTeam.teamId}
          membership={myMembership}
          onStatusSaved={refreshMe}
        />
      )}

      {/* Schnelle Profil-Vervollständigung (nur wenn unvollständig & nicht ausgeblendet) */}
      <ProfileCompletionBanner />

      {/* Akuter Kassen-Hinweis (nur sichtbar bei offenen eigenen Strafen > 0 €) */}
      {myOpenFinesCents > 0 && (
        <Link
          href="/kasse?tab=cashbox"
          className="group flex items-center justify-between gap-3 rounded-xl border border-amber-300/80 bg-amber-50/75 px-4 py-3 transition-colors hover:border-amber-400 dark:border-amber-800/80 dark:bg-amber-950/35"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Coins className="h-4 w-4 text-amber-700 dark:text-amber-300 shrink-0" />
            <p className="text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100 truncate">
              Mannschaftskasse: {myOpenFinesCount}{" "}
              {myOpenFinesCount === 1 ? "offene Strafe" : "offene Strafen"} ·{" "}
              <span className="font-mono">
                {formatCentsEur(myOpenFinesCents)}
              </span>
            </p>
          </div>
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-900 dark:text-amber-200 group-hover:text-primary shrink-0">
            Zur Kasse
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}

      {/* Hero-Fokus: Nächster Termin (Above the Fold) */}
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
                  {nextEventNominated && (
                    <Badge
                      variant="outline"
                      className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      Nominiert
                    </Badge>
                  )}
                  <ChevronRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </div>
              </div>
              <CardDescription className="font-semibold text-foreground">
                {nextEvent.title}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                  {formatEventDateTime(nextEvent.startAt)}
                </span>
                {nextEvent.meetingAt && (
                  <span className="font-medium text-foreground/90">
                    Treffpunkt:{" "}
                    {formatGermanTime(nextEvent.meetingAt, { includeUhr: true })}
                  </span>
                )}
                {nextEvent.venue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{nextEvent.venue.name}</span>
                    {nextEventMapsHref && (
                      <a
                        href={nextEventMapsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          CARD_ACTION_LAYER_CLASS,
                          "ml-1 inline-flex items-center gap-0.5 font-semibold text-primary hover:underline"
                        )}
                      >
                        Route
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </span>
                )}
                {activeTeam.usesResin &&
                  nextEvent.venue &&
                  nextEvent.venue.resinPolicy !== "UNKNOWN" && (
                    <ResinBadge policy={nextEvent.venue.resinPolicy} />
                  )}
              </div>

              {nextEvent.matchDetails?.jerseyColor && (
                <p className="text-xs text-muted-foreground">
                  Trikot:{" "}
                  <span className="font-semibold text-foreground">
                    {nextEvent.matchDetails.jerseySet
                      ? `${nextEvent.matchDetails.jerseySet.name} (${nextEvent.matchDetails.jerseyColor})`
                      : nextEvent.matchDetails.jerseyColor}
                  </span>
                </p>
              )}

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
                    const status = getMemberRsvpStatus(nextEvent, t.memberId);
                    return (
                      <RsvpControls
                        key={t.memberId}
                        teamId={activeTeam.teamId}
                        eventId={nextEvent.id}
                        memberId={t.memberId}
                        memberLabel={t.isOwn ? undefined : t.label}
                        currentStatus={status}
                        requireDeclineReason={nextEvent.requireDeclineReason}
                        rsvpDeadlineAt={nextEvent.rsvpDeadlineAt}
                        isCancelled={nextEvent.isCancelled}
                        isStaff={isStaff}
                        onOptimisticStatus={(nextStatus) =>
                          handleOptimisticRsvp(
                            nextEvent.id,
                            t.memberId,
                            nextStatus
                          )
                        }
                        onRollbackStatus={() =>
                          handleOptimisticRsvp(nextEvent.id, t.memberId, status)
                        }
                        onUpdated={(att) =>
                          handleConfirmedRsvp(nextEvent.id, t.memberId, att)
                        }
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Separates nächstes Punktspiel nur für reine Staff-Nutzer ohne eigene Schnell-RSVP-Liste */}
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
                  Anwurf: {formatEventDateTime(nextMatch.startAt)}
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

      {/* Kommende Termine & Schnell-RSVP für Spieler & Eltern (1-Klick pro Zeile) */}
      {!loadingData && rsvpTargets.length > 0 && followUpEvents.length > 0 && (
        <QuickRsvpList
          teamId={activeTeam.teamId}
          events={followUpEvents}
          rsvpTargets={rsvpTargets}
          isStaff={isStaff}
          onOptimisticRsvp={handleOptimisticRsvp}
          onRollbackRsvp={handleOptimisticRsvp}
          onConfirmedRsvp={handleConfirmedRsvp}
        />
      )}

      {/* Staff-Kennzahlen (kompakt, exklusiv für Trainer/Betreuer/Admins) */}
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

      {/* Persönliche Dienste (alle Kategorien inkl. Trikotwäsche-Pflegehinweis) */}
      {!loadingData && <PlayerDutiesCard duties={personalDuties} />}

      {/* Offene Umfragen (1-Klick-Vote) & aktuelle Team-News */}
      {!loadingData && (
        <TeamPulseSection
          teamId={activeTeam.teamId}
          announcements={highlightedAnnouncements}
          openPolls={openUnvotedPolls}
          onPollUpdated={handlePollUpdated}
        />
      )}

      {/* Eltern-Übersicht verknüpfter Kinder */}
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
    </div>
  );
}
