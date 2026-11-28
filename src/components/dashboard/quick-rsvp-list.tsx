"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import {
  EventTypeBadge,
  MatchLocationBadge,
} from "@/components/events/match-badges";
import { RsvpControls } from "@/components/events/rsvp-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filter-chips";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatGermanDateTime, formatGermanTime } from "@/domain/date-time";
import type {
  EventAttendanceResponseDTO,
  EventDTO,
} from "@/domain/schemas/event";
import type { RsvpStatus } from "@/domain/schemas/handball";
import {
  getMemberRsvpStatus,
  isAnyMemberNominated,
} from "@/domain/services/player-dashboard";

export interface DashboardRsvpTarget {
  memberId: string;
  label: string;
  isOwn: boolean;
}

interface QuickRsvpListProps {
  teamId: string;
  events: EventDTO[];
  rsvpTargets: DashboardRsvpTarget[];
  isStaff: boolean;
  onOptimisticRsvp: (
    eventId: string,
    memberId: string,
    nextStatus: RsvpStatus
  ) => void;
  onRollbackRsvp: (
    eventId: string,
    memberId: string,
    previousStatus: RsvpStatus
  ) => void;
  onConfirmedRsvp: (
    eventId: string,
    memberId: string,
    attendance?: EventAttendanceResponseDTO
  ) => void;
}

type RsvpFilter = "ALL" | "OPEN";

const INITIAL_VISIBLE_COUNT = 6;

function formatCompactDate(iso: string) {
  return formatGermanDateTime(iso, { includeWeekday: true, includeUhr: true });
}

function formatTimeOnly(iso: string) {
  return formatGermanTime(iso);
}

export function QuickRsvpList({
  teamId,
  events,
  rsvpTargets,
  isStaff,
  onOptimisticRsvp,
  onRollbackRsvp,
  onConfirmedRsvp,
}: QuickRsvpListProps) {
  const [filter, setFilter] = useState<RsvpFilter>("ALL");
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    rsvpTargets[0]?.memberId ?? ""
  );
  const [expanded, setExpanded] = useState(false);

  const activeTarget = useMemo(() => {
    return (
      rsvpTargets.find((t) => t.memberId === selectedTargetId) ??
      rsvpTargets[0] ??
      null
    );
  }, [rsvpTargets, selectedTargetId]);

  const openEvents = useMemo(() => {
    if (!activeTarget) return [];
    return events.filter(
      (ev) => getMemberRsvpStatus(ev, activeTarget.memberId) === "PENDING"
    );
  }, [events, activeTarget]);

  const filteredEvents = filter === "OPEN" ? openEvents : events;
  const visibleEvents = expanded
    ? filteredEvents
    : filteredEvents.slice(0, INITIAL_VISIBLE_COUNT);
  const remainingCount = Math.max(
    0,
    filteredEvents.length - visibleEvents.length
  );

  if (!activeTarget || events.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarCheck2 className="h-4 w-4 text-primary shrink-0" />
            <CardTitle className="text-base truncate">
              Kommende Termine
            </CardTitle>
            {openEvents.length > 0 ? (
              <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:bg-amber-950/40">
                {openEvents.length} offen
              </Badge>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Alles beantwortet
              </span>
            )}
          </div>

          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as RsvpFilter)}
          >
            <TabsList className="h-9">
              <TabsTrigger value="ALL" className="px-2.5 text-xs">
                Alle ({events.length})
              </TabsTrigger>
              <TabsTrigger value="OPEN" className="px-2.5 text-xs">
                Offen ({openEvents.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {rsvpTargets.length > 1 && (
          <FilterChips
            ariaLabel="Rückmeldung für Person wählen"
            value={activeTarget.memberId}
            onChange={setSelectedTargetId}
            options={rsvpTargets.map((t) => ({
              value: t.memberId,
              label: t.label,
            }))}
          />
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-6 px-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mb-1.5" />
            <p className="text-sm font-semibold text-foreground">
              Alle kommenden Termine sind beantwortet
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Über den Tab „Alle“ kannst du deine Rückmeldungen jederzeit anpassen.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleEvents.map((ev) => {
              const status = getMemberRsvpStatus(ev, activeTarget.memberId);
              const nominated = isAnyMemberNominated(ev, [
                activeTarget.memberId,
              ]);
              const heading =
                ev.type === "MATCH" && ev.matchDetails
                  ? ev.matchDetails.opponentName
                  : ev.title;

              return (
                <div
                  key={ev.id}
                  data-testid={`quick-rsvp-row-${ev.id}`}
                  className="py-3 first:pt-1 last:pb-1 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/termine?eventId=${encodeURIComponent(ev.id)}`}
                    className="group min-w-0 flex-1 space-y-1"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {heading}
                      </span>
                      {ev.matchDetails ? (
                        <MatchLocationBadge
                          isHome={ev.matchDetails.isHome}
                          labelMode="short"
                        />
                      ) : (
                        <EventTypeBadge type={ev.type} />
                      )}
                      {nominated && (
                        <Badge
                          variant="outline"
                          className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          Nominiert
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground/90">
                        <Clock className="h-3 w-3 text-primary shrink-0" />
                        {formatCompactDate(ev.startAt)}
                      </span>
                      {ev.meetingAt && (
                        <span>Treffp. {formatTimeOnly(ev.meetingAt)}</span>
                      )}
                      {ev.venue && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{ev.venue.name}</span>
                        </span>
                      )}
                    </div>
                  </Link>

                  <div className="shrink-0 sm:max-w-[280px]">
                    <RsvpControls
                      teamId={teamId}
                      eventId={ev.id}
                      memberId={activeTarget.memberId}
                      currentStatus={status}
                      requireDeclineReason={ev.requireDeclineReason}
                      rsvpDeadlineAt={ev.rsvpDeadlineAt}
                      isCancelled={ev.isCancelled}
                      isStaff={isStaff}
                      size="compact"
                      onOptimisticStatus={(nextStatus) =>
                        onOptimisticRsvp(ev.id, activeTarget.memberId, nextStatus)
                      }
                      onRollbackStatus={() =>
                        onRollbackRsvp(ev.id, activeTarget.memberId, status)
                      }
                      onUpdated={(att) =>
                        onConfirmedRsvp(ev.id, activeTarget.memberId, att)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
          {remainingCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(true)}
              className="text-xs px-2"
            >
              Weitere {remainingCount} Termine anzeigen
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {events.length} weitere anstehende Termine
            </span>
          )}
          <Link
            href="/termine"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
          >
            Alle Termine
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
