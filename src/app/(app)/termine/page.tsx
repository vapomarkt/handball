"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { EventDetailDialog } from "@/components/events/event-detail-dialog";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { LeagueSyncPanel } from "@/components/events/league-sync-panel";
import {
  EventTypeBadge,
  MatchLocationBadge,
  MatchResultBadge,
  MatchScoreStatusBadges,
} from "@/components/events/match-badges";
import { ResinBadge } from "@/components/events/resin-badge";
import { RsvpControls } from "@/components/events/rsvp-controls";
import { VenueFormDialog } from "@/components/events/venue-form-dialog";
import { useAppContext } from "@/components/providers/app-context";
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
import { cn } from "@/lib/utils";
import {
  EVENT_TYPE_LABELS,
  type EventDTO,
  type EventType,
  type MemberAttendanceStatDTO,
  type VenueDTO,
} from "@/domain/schemas/event";
import type { RsvpStatus } from "@/domain/schemas/handball";
import type { JerseySetDTO } from "@/domain/schemas/jersey-set";
import type { LeagueImportSourceDTO } from "@/domain/schemas/league";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";

type ActiveTab = "events" | "venues" | "stats" | "sync";

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TerminePageContent() {
  const { me, activeTeam } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdFromUrl = searchParams.get("eventId");

  const [tab, setTab] = useState<ActiveTab>("events");
  const [typeFilter, setTypeFilter] = useState<"ALL" | EventType>("ALL");
  const [showPast, setShowPast] = useState(false);

  const [events, setEvents] = useState<EventDTO[]>([]);
  const [venues, setVenues] = useState<VenueDTO[]>([]);
  const [jerseySets, setJerseySets] = useState<JerseySetDTO[]>([]);
  const [leagueSources, setLeagueSources] = useState<LeagueImportSourceDTO[]>(
    []
  );
  const [roster, setRoster] = useState<TeamMemberResponseDTO[]>([]);
  const [stats, setStats] = useState<MemberAttendanceStatDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingResults, setSyncingResults] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Dialogs
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [venueFormOpen, setVenueFormOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueDTO | null>(null);

  const effectiveSelectedEventId = selectedEventId ?? eventIdFromUrl;

  const isStaff =
    activeTeam?.isClubAdmin ||
    activeTeam?.role === "CLUB_ADMIN" ||
    activeTeam?.role === "COACH" ||
    activeTeam?.role === "ASSISTANT_COACH" ||
    activeTeam?.role === "TEAM_MANAGER";

  const syncableSources = useMemo(
    () =>
      leagueSources.filter(
        (s) =>
          (s.provider === "HVNB_NULIGA" &&
            (Boolean(s.sourceUrl) || Boolean(s.leagueGroupTeamId))) ||
          (s.provider === "ICAL_URL" && Boolean(s.sourceUrl))
      ),
    [leagueSources]
  );

  // Eigene Mitgliedschaft & verknüpfte Kinder in diesem Team für 1-Klick-RSVP
  const rsvpTargets = useMemo(() => {
    if (!me || !activeTeam) return [];
    const targets: Array<{ memberId: string; label?: string }> = [];
    const own = me.memberships.find(
      (m) => m.team.id === activeTeam.teamId && m.role === "PLAYER"
    );
    if (own) {
      targets.push({ memberId: own.memberId });
    }
    const children = me.guardianLinks.filter(
      (g) => g.teamId === activeTeam.teamId
    );
    for (const c of children) {
      targets.push({
        memberId: c.childMemberId,
        label: `${c.childFirstName} ${c.childLastName}`,
      });
    }
    return targets;
  }, [me, activeTeam]);

  const loadAll = useCallback(async () => {
    if (!activeTeam) return;
    try {
      const [evRes, venRes, rosRes, statRes, jsRes, srcRes] = await Promise.all([
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/events`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/venues`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/attendance-stats`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/jersey-sets?teamId=${encodeURIComponent(activeTeam.teamId)}`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/league-sources`,
          { cache: "no-store" }
        ),
      ]);

      if (evRes.ok) {
        const d = await evRes.json();
        setEvents(d.events ?? []);
      }
      if (venRes.ok) {
        const d = await venRes.json();
        setVenues(d.venues ?? []);
      }
      if (rosRes.ok) {
        const d = await rosRes.json();
        setRoster(d.members ?? []);
      }
      if (statRes.ok) {
        const d = await statRes.json();
        setStats(d.stats ?? []);
      }
      if (jsRes.ok) {
        const d = await jsRes.json();
        setJerseySets(d.jerseySets ?? []);
      }
      if (srcRes.ok) {
        const d = await srcRes.json();
        setLeagueSources(d.sources ?? []);
      }
      setError(null);
    } catch {
      setError("Termindaten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    Promise.all([
      fetch(`/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/events`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/venues`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/members`, {
        cache: "no-store",
      }),
      fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/attendance-stats`,
        { cache: "no-store" }
      ),
      fetch(
        `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/jersey-sets?teamId=${encodeURIComponent(activeTeam.teamId)}`,
        { cache: "no-store" }
      ),
      fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/league-sources`,
        { cache: "no-store" }
      ),
    ])
      .then(async ([evRes, venRes, rosRes, statRes, jsRes, srcRes]) => {
        if (!active) return;
        if (evRes.ok) setEvents((await evRes.json()).events ?? []);
        if (venRes.ok) setVenues((await venRes.json()).venues ?? []);
        if (rosRes.ok) setRoster((await rosRes.json()).members ?? []);
        if (statRes.ok) setStats((await statRes.json()).stats ?? []);
        if (jsRes.ok) setJerseySets((await jsRes.json()).jerseySets ?? []);
        if (srcRes.ok) setLeagueSources((await srcRes.json()).sources ?? []);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Termindaten konnten nicht geladen werden.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTeam]);

  const [nowMs] = useState(() => Date.now());

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (typeFilter !== "ALL" && ev.type !== typeFilter) return false;
      const startMs = new Date(ev.startAt).getTime();
      if (!showPast && startMs < nowMs - 3 * 60 * 60 * 1000) return false;
      return true;
    });
  }, [events, typeFilter, showPast, nowMs]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === effectiveSelectedEventId) ?? null,
    [events, effectiveSelectedEventId]
  );

  async function handleSyncResults() {
    if (!activeTeam || syncableSources.length === 0) return;
    setSyncingResults(true);
    setSyncFeedback(null);
    setError(null);
    try {
      let totalResults = 0;
      let hadError = false;
      for (const src of syncableSources) {
        const res = await fetch(
          `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/league-sources/${encodeURIComponent(src.id)}/sync`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          }
        );
        if (res.ok) {
          const data = await res.json();
          totalResults += data.summary?.resultsUpdatedCount ?? 0;
        } else {
          hadError = true;
        }
      }
      await loadAll();
      if (totalResults > 0) {
        setSyncFeedback(
          totalResults === 1
            ? "1 Spielergebnis automatisch aus der Liga nachgetragen."
            : `${totalResults} Spielergebnisse automatisch aus der Liga nachgetragen.`
        );
      } else if (hadError) {
        setError("Ergebnisse konnten aktuell nicht aus der Liga abgerufen werden.");
      } else {
        setSyncFeedback("Alle verfügbaren Spielergebnisse sind bereits aktuell.");
      }
    } catch {
      setError("Ergebnisse konnten aktuell nicht aus der Liga abgerufen werden.");
    } finally {
      setSyncingResults(false);
    }
  }

  async function handleDeleteEvent(ev: EventDTO) {
    if (!activeTeam) return;
    if (!window.confirm(`Termin „${ev.title}“ wirklich löschen?`)) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/events/${encodeURIComponent(ev.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadAll();
  }

  async function handleDeleteVenue(v: VenueDTO) {
    if (!activeTeam) return;
    if (!window.confirm(`Halle „${v.name}“ wirklich entfernen?`)) return;
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/venues/${encodeURIComponent(v.id)}`,
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
            {activeTeam.clubName} · Saison {activeTeam.seasonName}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Termine & Spielplan · {activeTeam.teamName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {activeTeam.usesResin
              ? "Trainings, Punktspiele, Hallen-Harzregelung & 1-Klick-Rückmeldung"
              : "Trainings, Punktspiele, Hallen & 1-Klick-Rückmeldung"}
          </p>
        </div>

        {isStaff && (
          <div className="flex flex-wrap gap-2">
            {tab === "venues" ? (
              <Button
                onClick={() => {
                  setEditingVenue(null);
                  setVenueFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Halle anlegen
              </Button>
            ) : (
              <Button onClick={() => setEventFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Termin / Serie anlegen
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Haupt-Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setTab("events")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            tab === "events"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Termine ({events.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("venues")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            tab === "venues"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <MapPin className="h-4 w-4" />
          {activeTeam.usesResin
            ? `Hallen & Harz-Info (${venues.length})`
            : `Hallen (${venues.length})`}
        </button>
        <button
          type="button"
          onClick={() => setTab("stats")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            tab === "stats"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Anwesenheitsstatistik
        </button>
        <button
          type="button"
          onClick={() => setTab("sync")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
            tab === "sync"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Liga-Import & Sync
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {/* TAB 1: TERMINE & SPIELPLAN */}
      {tab === "events" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "TRAINING", "MATCH", "TOURNAMENT"] as const).map(
                (t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      typeFilter === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    {t === "ALL" ? "Alle" : EVENT_TYPE_LABELS[t]}
                  </button>
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isStaff && showPast && syncableSources.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={syncingResults}
                  onClick={handleSyncResults}
                  className="h-8 text-xs"
                >
                  {syncingResults ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Ergebnisse abrufen
                </Button>
              )}

              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPast}
                  onChange={(e) => setShowPast(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                Vergangene Termine anzeigen
              </label>
            </div>
          </div>

          {syncFeedback && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200">
              {syncFeedback}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground py-6">Lade Termine…</p>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
                <Calendar className="h-8 w-8 text-muted-foreground" />
                <p className="font-semibold">Keine passenden Termine gefunden</p>
                <p className="text-sm text-muted-foreground">
                  Aktiviere vergangene Termine oder lege ein neues Training bzw.
                  Punktspiel an.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredEvents.map((ev) => (
                <Card
                  key={ev.id}
                  interactive
                  data-testid={`event-card-${ev.id}`}
                  className={cn(
                    ev.matchDetails &&
                      (ev.matchDetails.isHome
                        ? "border-l-4 border-l-primary"
                        : "border-l-4 border-l-secondary"),
                    ev.isCancelled && "opacity-70"
                  )}
                >
                  <CardContent className="p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {ev.matchDetails && (
                            <MatchLocationBadge isHome={ev.matchDetails.isHome} />
                          )}
                          {ev.matchDetails && (
                            <MatchResultBadge matchDetails={ev.matchDetails} />
                          )}
                          {ev.matchDetails && (
                            <MatchScoreStatusBadges
                              matchDetails={ev.matchDetails}
                            />
                          )}
                          {ev.isCancelled && (
                            <Badge variant="injured">Abgesagt</Badge>
                          )}
                          <EventTypeBadge type={ev.type} />
                          {activeTeam.usesResin && ev.venue && (
                            <ResinBadge policy={ev.venue.resinPolicy} />
                          )}
                        </div>

                        <h2 className="text-base font-bold text-foreground">
                          <button
                            type="button"
                            onClick={() => setSelectedEventId(ev.id)}
                            className={cn(
                              CARD_OVERLAY_TRIGGER_CLASS,
                              "transition-colors group-hover:text-primary"
                            )}
                          >
                            {ev.title}
                            <span className="sr-only">
                              {" "}– Details
                              {ev.type === "MATCH" ? " & Spieltag" : ""} öffnen
                            </span>
                          </button>
                        </h2>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Clock className="h-3.5 w-3.5 text-primary" />
                            {formatEventDate(ev.startAt)} ·{" "}
                            {formatTime(ev.startAt)}
                            {ev.endAt ? `–${formatTime(ev.endAt)}` : ""} Uhr
                          </span>
                          {ev.meetingAt && (
                            <span>
                              Treffpunkt: {formatTime(ev.meetingAt)} Uhr
                            </span>
                          )}
                          {ev.venue && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-primary" />
                              {ev.venue.name}
                            </span>
                          )}
                        </div>

                        {/* Rückmelde-Zusammenfassung */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                            <Users className="h-3.5 w-3.5" />
                            {ev.summary.accepted} Zugesagt
                          </span>
                          <span className="text-amber-700 dark:text-amber-400">
                            · {ev.summary.maybe} Vielleicht
                          </span>
                          <span className="text-red-700 dark:text-red-400">
                            · {ev.summary.declined} Abgesagt
                          </span>
                          <span className="text-muted-foreground">
                            · {ev.summary.pending} Offen
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isStaff && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className={CARD_ACTION_LAYER_CLASS}
                            onClick={() => handleDeleteEvent(ev)}
                            aria-label={`Termin ${ev.title} löschen`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {/* 1-Klick-RSVP für Spieler und verknüpfte Eltern-Kinder */}
                    {rsvpTargets.length > 0 && !ev.isCancelled && (
                      <div
                        className={cn(
                          CARD_ACTION_LAYER_CLASS,
                          "border-t border-border pt-3 space-y-2.5"
                        )}
                      >
                        {rsvpTargets.map((target) => {
                          const existing = ev.attendances.find(
                            (a) => a.memberId === target.memberId
                          );
                          const currentStatus: RsvpStatus =
                            existing?.status ?? "PENDING";
                          return (
                            <RsvpControls
                              key={target.memberId}
                              teamId={activeTeam.teamId}
                              eventId={ev.id}
                              memberId={target.memberId}
                              memberLabel={target.label}
                              currentStatus={currentStatus}
                              requireDeclineReason={ev.requireDeclineReason}
                              onUpdated={loadAll}
                            />
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HALLEN & HARZ-REGELUNG */}
      {tab === "venues" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {venues.map((v) => (
            <Card key={v.id} interactive={isStaff}>
              <CardContent className="p-4 sm:p-5 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-bold text-base">
                      {isStaff ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVenue(v);
                            setVenueFormOpen(true);
                          }}
                          className={cn(
                            CARD_OVERLAY_TRIGGER_CLASS,
                            "transition-colors group-hover:text-primary"
                          )}
                        >
                          {v.name}
                          <span className="sr-only"> – Halle bearbeiten</span>
                        </button>
                      ) : (
                        v.name
                      )}
                    </h2>
                    {v.address && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {v.address}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeTeam.usesResin && (
                      <ResinBadge policy={v.resinPolicy} />
                    )}
                    {isStaff && (
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                </div>

                {v.notes && (
                  <p className="text-xs text-foreground rounded-lg bg-muted/40 p-2.5">
                    {v.notes}
                  </p>
                )}

                {(v.mapsUrl || isStaff) && (
                  <div className="flex items-center justify-between pt-1">
                    {v.mapsUrl ? (
                      <a
                        href={v.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          CARD_ACTION_LAYER_CLASS,
                          "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        )}
                      >
                        In Maps öffnen
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span />
                    )}

                    {isStaff && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className={CARD_ACTION_LAYER_CLASS}
                        onClick={() => handleDeleteVenue(v)}
                        aria-label={`Halle ${v.name} entfernen`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 3: ANWESENHEITSSTATISTIK */}
      {tab === "stats" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Trainings- & Spielbeteiligung ({activeTeam.teamName})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Spieler oder Termine für Statistiken vorhanden.
              </p>
            ) : (
              stats.map((row) => (
                <div
                  key={row.memberId}
                  className="space-y-1.5 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">
                      {row.jerseyNumber ? `#${row.jerseyNumber} ` : ""}
                      {row.firstName} {row.lastName}
                      {row.primaryPosition ? (
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                          ({row.primaryPosition})
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono font-bold text-primary">
                      {row.participationRate}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all"
                      style={{ width: `${row.participationRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.accepted} Zugesagt · {row.maybe} Vielleicht ·{" "}
                    {row.declined} Abgesagt · {row.pending} Offen (aus{" "}
                    {row.totalEvents} Terminen)
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: LIGA-IMPORT & AUTO-SYNC (M2b) */}
      {tab === "sync" && (
        <LeagueSyncPanel
          teamId={activeTeam.teamId}
          clubName={activeTeam.clubName}
          isStaff={isStaff}
          onImported={loadAll}
        />
      )}

      {/* Dialoge */}
      {isStaff && (
        <>
          <EventFormDialog
            key={`ev-form-${eventFormOpen}`}
            open={eventFormOpen}
            onOpenChange={setEventFormOpen}
            teamId={activeTeam.teamId}
            venues={venues}
            jerseySets={jerseySets}
            onSaved={loadAll}
          />
          <VenueFormDialog
            key={`ven-form-${editingVenue?.id ?? "new"}-${venueFormOpen}`}
            open={venueFormOpen}
            onOpenChange={setVenueFormOpen}
            clubId={activeTeam.clubId}
            venue={editingVenue}
            usesResin={activeTeam.usesResin}
            onSaved={loadAll}
          />
        </>
      )}

      <EventDetailDialog
        key={`ev-detail-${selectedEvent?.id ?? "none"}-${selectedEvent?.matchDetails?.homeScoreFull ?? ""}:${selectedEvent?.matchDetails?.awayScoreFull ?? ""}-${selectedEvent?.matchDetails?.homeScoreHalf ?? ""}:${selectedEvent?.matchDetails?.awayScoreHalf ?? ""}-${selectedEvent?.matchDetails?.scoreManuallyEdited ?? false}-${selectedEvent?.matchDetails?.officialHomeScoreFull ?? ""}:${selectedEvent?.matchDetails?.officialAwayScoreFull ?? ""}-${selectedEvent?.matchDetails?.jerseySetId ?? ""}-${selectedEvent?.matchDetails?.nominatedMemberIds.length ?? 0}`}
        open={selectedEvent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedEventId(null);
            if (eventIdFromUrl) {
              router.replace("/termine", { scroll: false });
            }
          }
        }}
        teamId={activeTeam.teamId}
        event={selectedEvent}
        roster={roster}
        jerseySets={jerseySets}
        isStaff={isStaff}
        usesResin={activeTeam.usesResin}
        onUpdated={loadAll}
      />
    </div>
  );
}

export default function TerminePage() {
  return (
    <Suspense fallback={null}>
      <TerminePageContent />
    </Suspense>
  );
}
