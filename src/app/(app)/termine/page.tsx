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
  MoreHorizontal,
  Pencil,
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CardListSkeleton, EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatGermanDate, formatGermanTime } from "@/domain/date-time";
import {
  EVENT_TYPE_LABELS,
  type EventDTO,
  type EventType,
  type MemberAttendanceStatDTO,
  type VenueDTO,
} from "@/domain/schemas/event";
import {
  hasMemberRole,
  isStaffMember,
  type RsvpStatus,
} from "@/domain/schemas/handball";
import type { JerseySetDTO } from "@/domain/schemas/jersey-set";
import type { LeagueImportSourceDTO } from "@/domain/schemas/league";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";

type ActiveTab = "events" | "venues" | "stats" | "sync";

const TYPE_FILTER_OPTIONS: ReadonlyArray<{
  value: "ALL" | EventType;
  label: string;
}> = [
  { value: "ALL", label: "Alle" },
  { value: "TRAINING", label: EVENT_TYPE_LABELS.TRAINING },
  { value: "MATCH", label: EVENT_TYPE_LABELS.MATCH },
  { value: "TOURNAMENT", label: EVENT_TYPE_LABELS.TOURNAMENT },
];

function formatEventDate(iso: string) {
  return formatGermanDate(iso, { includeWeekday: true });
}

function formatTime(iso: string) {
  return formatGermanTime(iso);
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
  const [deleteEventTarget, setDeleteEventTarget] = useState<EventDTO | null>(
    null
  );
  const [deleteVenueTarget, setDeleteVenueTarget] = useState<VenueDTO | null>(
    null
  );

  const effectiveSelectedEventId = selectedEventId ?? eventIdFromUrl;

  const isStaff = isStaffMember(activeTeam);

  const effectiveTab: ActiveTab =
    !isStaff && (tab === "stats" || tab === "sync") ? "events" : tab;

  const syncableSources = useMemo(
    () =>
      leagueSources.filter(
        (s) =>
          (s.provider === "ICAL_URL" && Boolean(s.sourceUrl)) ||
          ((s.provider === "HVNB_NULIGA" ||
            s.provider === "NULIGA" ||
            s.provider === "HANDBALL360" ||
            s.provider === "HANDBALL4ALL") &&
            (Boolean(s.sourceUrl) ||
              Boolean(s.leagueGroupTeamId) ||
              Boolean(s.providerConfig)))
      ),
    [leagueSources]
  );

  const rsvpTargets = useMemo(() => {
    if (!me || !activeTeam) return [];
    const targets: Array<{ memberId: string; label?: string }> = [];
    const own = me.memberships.find(
      (m) => m.team.id === activeTeam.teamId && hasMemberRole(m, "PLAYER")
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

      if (evRes.ok) setEvents((await evRes.json()).events ?? []);
      if (venRes.ok) setVenues((await venRes.json()).venues ?? []);
      if (rosRes.ok) setRoster((await rosRes.json()).members ?? []);
      if (statRes.ok) setStats((await statRes.json()).stats ?? []);
      if (jsRes.ok) setJerseySets((await jsRes.json()).jerseySets ?? []);
      if (srcRes.ok) setLeagueSources((await srcRes.json()).sources ?? []);
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
        setError(
          "Ergebnisse konnten aktuell nicht aus der Liga abgerufen werden."
        );
      } else {
        setSyncFeedback("Alle verfügbaren Spielergebnisse sind bereits aktuell.");
      }
    } catch {
      setError("Ergebnisse konnten aktuell nicht aus der Liga abgerufen werden.");
    } finally {
      setSyncingResults(false);
    }
  }

  async function confirmDeleteEvent() {
    if (!activeTeam || !deleteEventTarget) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/events/${encodeURIComponent(deleteEventTarget.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadAll();
  }

  async function confirmDeleteVenue() {
    if (!activeTeam || !deleteVenueTarget) return;
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(activeTeam.clubId)}/venues/${encodeURIComponent(deleteVenueTarget.id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadAll();
  }

  if (!activeTeam || !me) return null;

  return (
    <div className="space-y-5">
      {/* Kompakter Header (max. 2 Aktionen) */}
      <PageHeader
        title="Termine"
        subtitle={`${activeTeam.teamName}${activeTeam.leagueName ? ` · ${activeTeam.leagueName}` : ""}`}
        actions={
          isStaff ? (
            <>
              {effectiveTab === "venues" ? (
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
                  Termin anlegen
                </Button>
              )}

              {syncableSources.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Weitere Termin-Aktionen"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      disabled={syncingResults}
                      onSelect={() => void handleSyncResults()}
                    >
                      {syncingResults ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-primary" />
                      )}
                      <span>Ergebnisse aus Liga abrufen</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTab("sync")}>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Liga-Import &amp; Sync öffnen</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          ) : undefined
        }
      />

      {/* Ruhige Segmented Tabs (rollenadaptiv: Statistik & Sync für Staff) */}
      <Tabs
        value={effectiveTab}
        onValueChange={(v) => setTab(v as ActiveTab)}
      >
        <TabsList>
          <TabsTrigger value="events">
            <Calendar className="h-4 w-4" />
            Termine ({events.length})
          </TabsTrigger>
          <TabsTrigger value="venues">
            <MapPin className="h-4 w-4" />
            {activeTeam.usesResin
              ? `Hallen & Harz-Info (${venues.length})`
              : `Hallen (${venues.length})`}
          </TabsTrigger>
          {isStaff && (
            <TabsTrigger value="stats">
              <BarChart3 className="h-4 w-4" />
              Statistik
            </TabsTrigger>
          )}
          {isStaff && (
            <TabsTrigger value="sync">
              <RefreshCw className="h-4 w-4" />
              Liga-Import &amp; Sync
            </TabsTrigger>
          )}
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

      {/* TAB 1: TERMINE & SPIELPLAN */}
      {effectiveTab === "events" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <FilterChips
              options={TYPE_FILTER_OPTIONS}
              value={typeFilter}
              onChange={setTypeFilter}
              ariaLabel="Terminart filtern"
            />

            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={showPast}
                onChange={(e) => setShowPast(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Vergangene anzeigen
            </label>
          </div>

          {syncFeedback && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200">
              {syncFeedback}
            </div>
          )}

          {loading ? (
            <CardListSkeleton count={3} />
          ) : filteredEvents.length === 0 ? (
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="Keine passenden Termine"
              description="Aktiviere vergangene Termine oder passe den Filter an."
              action={
                isStaff ? (
                  <Button size="sm" onClick={() => setEventFormOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Termin anlegen
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid gap-3">
              {filteredEvents.map((ev) => {
                const showResinWarning = Boolean(
                  activeTeam.usesResin &&
                    ev.venue &&
                    ev.venue.resinPolicy !== "UNKNOWN"
                );
                return (
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
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-1.5 min-w-0">
                          {/* Max. 2–3 handlungsrelevante Badges */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {ev.matchDetails ? (
                              <MatchLocationBadge
                                isHome={ev.matchDetails.isHome}
                              />
                            ) : (
                              <EventTypeBadge type={ev.type} />
                            )}
                            {ev.matchDetails && (
                              <MatchResultBadge
                                matchDetails={ev.matchDetails}
                              />
                            )}
                            {ev.matchDetails && (
                              <MatchScoreStatusBadges
                                matchDetails={ev.matchDetails}
                              />
                            )}
                            {ev.isCancelled && (
                              <Badge variant="injured">Abgesagt</Badge>
                            )}
                            {showResinWarning && ev.venue && (
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

                          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <Clock className="h-3.5 w-3.5 text-primary" />
                              {formatEventDate(ev.startAt)} ·{" "}
                              {formatTime(ev.startAt)}
                              {ev.endAt ? `–${formatTime(ev.endAt)}` : ""} Uhr
                            </span>
                            {ev.meetingAt && (
                              <span>
                                Treffpunkt {formatTime(ev.meetingAt)} Uhr
                              </span>
                            )}
                            {ev.venue && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-primary" />
                                {ev.venue.name}
                              </span>
                            )}
                          </div>

                          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <Users className="h-3.5 w-3.5" />
                              {ev.summary.accepted} zugesagt
                            </span>
                            {ev.summary.maybe > 0 && (
                              <span>· {ev.summary.maybe} vielleicht</span>
                            )}
                            {ev.summary.declined > 0 && (
                              <span>· {ev.summary.declined} abgesagt</span>
                            )}
                            {ev.summary.pending > 0 && (
                              <span>· {ev.summary.pending} offen</span>
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {isStaff && (
                            <div className={CARD_ACTION_LAYER_CLASS}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 text-muted-foreground"
                                    aria-label={`Aktionen für Termin ${ev.title}`}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onSelect={() => setSelectedEventId(ev.id)}
                                  >
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    <span>Details öffnen</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    destructive
                                    onSelect={() => setDeleteEventTarget(ev)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Termin löschen</span>
                                  </DropdownMenuItem>
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

                      {rsvpTargets.length > 0 && !ev.isCancelled && (
                        <div
                          className={cn(
                            CARD_ACTION_LAYER_CLASS,
                            "border-t border-border pt-3 space-y-2"
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HALLEN & HARZ-REGELUNG */}
      {effectiveTab === "venues" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {venues.length === 0 ? (
            <EmptyState
              className="sm:col-span-2"
              icon={<MapPin className="h-5 w-5" />}
              title="Noch keine Hallen hinterlegt"
              description="Lege Heim- und Auswärtshallen inkl. Adresse und Harzregelung an."
              action={
                isStaff ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingVenue(null);
                      setVenueFormOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Halle anlegen
                  </Button>
                ) : undefined
              }
            />
          ) : (
            venues.map((v) => (
              <Card key={v.id} interactive={isStaff}>
                <CardContent className="p-4 space-y-2.5">
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
                    <div className="flex items-center gap-1 shrink-0">
                      {activeTeam.usesResin && (
                        <ResinBadge policy={v.resinPolicy} />
                      )}
                      {isStaff && (
                        <div className={CARD_ACTION_LAYER_CLASS}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-9 w-9 text-muted-foreground"
                                aria-label={`Aktionen für Halle ${v.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setEditingVenue(v);
                                  setVenueFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                                <span>Halle bearbeiten</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                destructive
                                onSelect={() => setDeleteVenueTarget(v)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Halle entfernen</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>

                  {v.notes && (
                    <p className="text-xs text-muted-foreground">{v.notes}</p>
                  )}

                  {v.mapsUrl && (
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
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 3: ANWESENHEITSSTATISTIK (Staff) */}
      {effectiveTab === "stats" && isStaff && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Beteiligung ({activeTeam.teamName})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Daten für Statistiken vorhanden.
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
                    {row.accepted} zugesagt · {row.maybe} vielleicht ·{" "}
                    {row.declined} abgesagt · {row.pending} offen (
                    {row.totalEvents} Termine)
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 4: LIGA-IMPORT & AUTO-SYNC (Staff) */}
      {effectiveTab === "sync" && isStaff && (
        <LeagueSyncPanel
          teamId={activeTeam.teamId}
          clubName={activeTeam.clubName}
          isStaff={isStaff}
          onImported={loadAll}
        />
      )}

      {/* Bestätigungsdialoge statt window.confirm */}
      <ConfirmDialog
        open={deleteEventTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteEventTarget(null);
        }}
        title="Termin löschen?"
        description={
          deleteEventTarget
            ? `Termin „${deleteEventTarget.title}“ wirklich endgültig löschen?`
            : undefined
        }
        confirmLabel="Termin löschen"
        onConfirm={confirmDeleteEvent}
      />

      <ConfirmDialog
        open={deleteVenueTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteVenueTarget(null);
        }}
        title="Halle entfernen?"
        description={
          deleteVenueTarget
            ? `Halle „${deleteVenueTarget.name}“ wirklich entfernen?`
            : undefined
        }
        confirmLabel="Halle entfernen"
        onConfirm={confirmDeleteVenue}
      />

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
