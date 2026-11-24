"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  Calendar,
  Clock,
  MapPin,
  Shield,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { ResinBadge } from "@/components/events/resin-badge";
import { RsvpControls } from "@/components/events/rsvp-controls";
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
  const { me, activeTeam, selectableTeams } = useAppContext();
  const [members, setMembers] = useState<TeamMemberResponseDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const reloadDashboard = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const [mRes, eRes] = await Promise.all([
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/events`,
          { cache: "no-store" }
        ),
      ]);
      if (mRes.ok) setMembers((await mRes.json()).members ?? []);
      if (eRes.ok) setEvents((await eRes.json()).events ?? []);
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
    ])
      .then(async ([mRes, eRes]) => {
        if (!active) return;
        if (mRes.ok) setMembers((await mRes.json()).members ?? []);
        if (eRes.ok) setEvents((await eRes.json()).events ?? []);
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
    activeTeam.role === "CLUB_ADMIN" ||
    activeTeam.role === "COACH" ||
    activeTeam.role === "ASSISTANT_COACH";

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
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {activeTeam.clubName} · Saison {activeTeam.seasonName}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {activeTeam.teamName}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Angemeldet als{" "}
            <span className="font-medium text-foreground">{me.user.name}</span>{" "}
            ({MEMBER_ROLE_LABELS[activeTeam.role]})
            {activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}
          </p>
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

      {/* KPI-Leiste */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Kadergröße
            </p>
            <p className="mt-1 text-2xl font-extrabold">
              {loadingData ? "–" : players.length}
            </p>
            <p className="text-xs text-muted-foreground">Aktive Spieler:innen</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Fit</p>
            <p className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {loadingData ? "–" : fitCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {injuredCount} verletzt · {unavailableCount} abwesend
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Nächster Termin
            </p>
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

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">
              Offene Profile
            </p>
            <p className="mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {loadingData ? "–" : unclaimedCount}
            </p>
            <p className="text-xs text-muted-foreground">Noch nicht geclaimt</p>
          </CardContent>
        </Card>
      </div>

      {/* Nächster Termin mit 1-Klick-RSVP & Nächstes Spiel mit Harz-Hinweis */}
      <div className="grid gap-4 md:grid-cols-2">
        {nextEvent && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4 text-primary" />
                  Nächster Termin
                </CardTitle>
                <Badge
                  variant={nextEvent.type === "MATCH" ? "default" : "secondary"}
                >
                  {EVENT_TYPE_LABELS[nextEvent.type]}
                </Badge>
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
                    <ResinBadge policy={nextEvent.venue.resinPolicy} />
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
                <div className="pt-1 space-y-2">
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

              <Button size="sm" variant="outline" asChild>
                <Link href="/termine">
                  Alle Termine öffnen
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {nextMatch && nextMatch.matchDetails && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-primary" />
                  Nächstes Punktspiel
                </CardTitle>
                <Badge variant="outline">
                  {nextMatch.matchDetails.isHome ? "Heimspiel" : "Auswärts"}
                </Badge>
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
                  <ResinBadge policy={nextMatch.venue.resinPolicy} />
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
              <Button size="sm" variant="outline" asChild>
                <Link href="/termine">
                  Spieltag & Kader ansehen
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rollen-spezifische Karten */}
      <div className="grid gap-4 md:grid-cols-2">
        {isStaff && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                Trainer- & Vereins-Steuerung
              </CardTitle>
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
              <Button size="sm" asChild>
                <Link href="/team">
                  <UserPlus className="h-4 w-4" />
                  Kader & Einladungen verwalten
                </Link>
              </Button>
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
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div>
                    <p className="font-semibold text-sm">
                      {link.childFirstName} {link.childLastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {link.teamName} · {link.relationship}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/team">
                      Profil öffnen
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {myMembership && activeTeam.role === "PLAYER" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-primary" />
                Dein Spielerprofil
              </CardTitle>
              <CardDescription>
                Deine sportlichen Eckdaten in {activeTeam.teamName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-secondary-foreground font-mono text-lg font-bold">
                    {myMembership.jerseyNumber
                      ? `#${myMembership.jerseyNumber}`
                      : "–"}
                  </div>
                  <div>
                    <p className="font-bold">
                      {myMembership.firstName} {myMembership.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                >
                  {AVAILABILITY_STATUS_LABELS[myMembership.availabilityStatus]}
                </Badge>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link href="/team">
                  Eigenes Profil bearbeiten
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
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
              Wechsle jederzeit zwischen deinen Teams und Rollen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectableTeams.map((team) => (
              <div
                key={team.teamId}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
              >
                <div>
                  <p className="font-semibold">{team.teamName}</p>
                  <p className="text-xs text-muted-foreground">
                    {team.clubName}
                    {team.leagueName ? ` · ${team.leagueName}` : ""}
                  </p>
                </div>
                <Badge variant="secondary">
                  {MEMBER_ROLE_LABELS[team.role]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
