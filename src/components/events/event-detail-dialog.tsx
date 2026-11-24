"use client";

import { useState } from "react";
import {
  Check,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Shirt,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DECLINE_REASON_CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  RSVP_STATUS_LABELS,
  type EventDTO,
} from "@/domain/schemas/event";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";
import { CarpoolSection } from "./carpool-section";
import { ResinBadge } from "./resin-badge";

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  event: EventDTO | null;
  roster: TeamMemberResponseDTO[];
  isStaff: boolean;
  onUpdated: () => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EventDetailDialog({
  open,
  onOpenChange,
  teamId,
  event,
  roster,
  isStaff,
  onUpdated,
}: EventDetailDialogProps) {
  const md = event?.matchDetails ?? null;

  const [nominated, setNominated] = useState<string[]>(
    md?.nominatedMemberIds ?? []
  );
  const [jerseyColor, setJerseyColor] = useState(md?.jerseyColor ?? "");
  const [refereeNote, setRefereeNote] = useState(md?.refereeNote ?? "");
  const [homeScoreHalf, setHomeScoreHalf] = useState(
    md?.homeScoreHalf !== null && md?.homeScoreHalf !== undefined
      ? String(md.homeScoreHalf)
      : ""
  );
  const [awayScoreHalf, setAwayScoreHalf] = useState(
    md?.awayScoreHalf !== null && md?.awayScoreHalf !== undefined
      ? String(md.awayScoreHalf)
      : ""
  );
  const [homeScoreFull, setHomeScoreFull] = useState(
    md?.homeScoreFull !== null && md?.homeScoreFull !== undefined
      ? String(md.homeScoreFull)
      : ""
  );
  const [awayScoreFull, setAwayScoreFull] = useState(
    md?.awayScoreFull !== null && md?.awayScoreFull !== undefined
      ? String(md.awayScoreFull)
      : ""
  );
  const [savingMatch, setSavingMatch] = useState(false);
  const [matchSavedMsg, setMatchSavedMsg] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  if (!event) return null;

  const players = roster.filter((m) => m.role === "PLAYER");

  function toggleNomination(memberId: string) {
    setNominated((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  async function handleSaveMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setSavingMatch(true);
    setMatchError(null);
    setMatchSavedMsg(null);

    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(event.id)}/match`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jerseyColor: jerseyColor || null,
            refereeNote: refereeNote || null,
            nominatedMemberIds: nominated,
            homeScoreHalf: homeScoreHalf === "" ? null : Number(homeScoreHalf),
            awayScoreHalf: awayScoreHalf === "" ? null : Number(awayScoreHalf),
            homeScoreFull: homeScoreFull === "" ? null : Number(homeScoreFull),
            awayScoreFull: awayScoreFull === "" ? null : Number(awayScoreFull),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMatchError(data?.error?.message || "Speichern fehlgeschlagen.");
        return;
      }
      setMatchSavedMsg("Spieltagsdaten & Kader gespeichert.");
      onUpdated();
    } catch {
      setMatchError("Netzwerkfehler beim Speichern.");
    } finally {
      setSavingMatch(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <Badge variant={event.type === "MATCH" ? "default" : "secondary"}>
              {EVENT_TYPE_LABELS[event.type]}
            </Badge>
            {event.venue && <ResinBadge policy={event.venue.resinPolicy} />}
          </div>
          <DialogTitle>{event.title}</DialogTitle>
          <DialogDescription>
            {formatDateTime(event.startAt)}
            {event.meetingAt
              ? ` · Treffpunkt: ${new Date(event.meetingAt).toLocaleTimeString(
                  "de-DE",
                  { hour: "2-digit", minute: "2-digit" }
                )} Uhr`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Halle & Beschreibung */}
          {event.venue && (
            <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  {event.venue.name}
                </p>
                {event.venue.mapsUrl && (
                  <a
                    href={event.venue.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Route
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {event.venue.address && (
                <p className="text-xs text-muted-foreground">
                  {event.venue.address}
                </p>
              )}
              {event.venue.notes && (
                <p className="text-xs text-foreground pt-0.5">
                  {event.venue.notes}
                </p>
              )}
            </div>
          )}

          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}

          {/* Spieltagsdetails, Nominierung & Ergebniserfassung (nur MATCH) */}
          {event.type === "MATCH" && md && (
            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-primary" />
                  Spieltag: {md.isHome ? "Heimspiel" : "Auswärtsspiel"} gegen{" "}
                  {md.opponentName}
                </h3>
                {md.homeScoreFull !== null && md.awayScoreFull !== null && (
                  <Badge variant="default" className="font-mono text-sm">
                    {md.homeScoreFull} : {md.awayScoreFull}
                    {md.homeScoreHalf !== null && md.awayScoreHalf !== null
                      ? ` (${md.homeScoreHalf}:${md.awayScoreHalf})`
                      : ""}
                  </Badge>
                )}
              </div>

              {!isStaff ? (
                <div className="space-y-2 text-sm">
                  {md.jerseyColor && (
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Shirt className="h-4 w-4 text-primary" />
                      Trikot:{" "}
                      <strong className="text-foreground">
                        {md.jerseyColor}
                      </strong>
                    </p>
                  )}
                  {md.refereeNote && (
                    <p className="text-xs text-muted-foreground">
                      Schiedsrichter: {md.refereeNote}
                    </p>
                  )}
                  <div className="pt-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Nominierter Spieltagskader ({md.nominatedMemberIds.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {players
                        .filter((p) => md.nominatedMemberIds.includes(p.id))
                        .map((p) => (
                          <Badge key={p.id} variant="secondary">
                            {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                            {p.firstName} {p.lastName}
                          </Badge>
                        ))}
                      {md.nominatedMemberIds.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Kader noch nicht nominiert.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveMatch} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="md-jersey" className="text-xs">
                        Trikotfarbe
                      </Label>
                      <Input
                        id="md-jersey"
                        value={jerseyColor}
                        onChange={(e) => setJerseyColor(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="md-ref" className="text-xs">
                        Schiedsrichter-Hinweis
                      </Label>
                      <Input
                        id="md-ref"
                        value={refereeNote}
                        onChange={(e) => setRefereeNote(e.target.value)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Ergebniserfassung Halbzeit & Endstand */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Halbzeitstand (Heim : Gast)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Halbzeit Heim"
                          type="number"
                          min={0}
                          max={99}
                          placeholder="HZ Heim"
                          value={homeScoreHalf}
                          onChange={(e) => setHomeScoreHalf(e.target.value)}
                          className="h-9 text-xs font-mono"
                        />
                        <span className="font-bold">:</span>
                        <Input
                          aria-label="Halbzeit Gast"
                          type="number"
                          min={0}
                          max={99}
                          placeholder="HZ Gast"
                          value={awayScoreHalf}
                          onChange={(e) => setAwayScoreHalf(e.target.value)}
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Endstand (Heim : Gast)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label="Endstand Heim"
                          type="number"
                          min={0}
                          max={99}
                          placeholder="Ende Heim"
                          value={homeScoreFull}
                          onChange={(e) => setHomeScoreFull(e.target.value)}
                          className="h-9 text-xs font-mono"
                        />
                        <span className="font-bold">:</span>
                        <Input
                          aria-label="Endstand Gast"
                          type="number"
                          min={0}
                          max={99}
                          placeholder="Ende Gast"
                          value={awayScoreFull}
                          onChange={(e) => setAwayScoreFull(e.target.value)}
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Spieltagskader-Nominierung */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Spieltagskader-Nominierung ({nominated.length} gewählt)
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {players.map((p) => {
                        const selected = nominated.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleNomination(p.id)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                              selected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:bg-muted"
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                            {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                            {p.firstName} {p.lastName}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {matchError && (
                    <p role="alert" className="text-xs text-red-600">
                      {matchError}
                    </p>
                  )}
                  {matchSavedMsg && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {matchSavedMsg}
                    </p>
                  )}

                  <Button type="submit" size="sm" disabled={savingMatch}>
                    {savingMatch && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Spieltagsdaten & Ergebnis speichern
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Fahrgemeinschaften (M2b – für Punktspiele & Turniere) */}
          {(event.type === "MATCH" || event.type === "TOURNAMENT") && (
            <CarpoolSection
              teamId={teamId}
              eventId={event.id}
              isStaff={isStaff}
            />
          )}

          {/* Rückmeldungen (DSGVO-sicher!) */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Rückmeldungen ({event.summary.accepted} Zugesagt ·{" "}
              {event.summary.maybe} Vielleicht · {event.summary.declined}{" "}
              Abgesagt · {event.summary.pending} Offen)
            </h3>

            {event.attendances.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Rückmeldungen vorhanden.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {event.attendances.map((att) => (
                  <div
                    key={att.id}
                    className="flex flex-col gap-1 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {att.memberJerseyNumber
                          ? `#${att.memberJerseyNumber} `
                          : ""}
                        {att.memberFirstName} {att.memberLastName}
                      </span>
                      <Badge
                        variant={
                          att.status === "ACCEPTED"
                            ? "fit"
                            : att.status === "DECLINED"
                              ? "injured"
                              : att.status === "MAYBE"
                                ? "unavailable"
                                : "secondary"
                        }
                      >
                        {RSVP_STATUS_LABELS[att.status]}
                      </Badge>
                    </div>

                    {/* DSGVO-geschützte Absagegründe nur bei canViewSensitive === true */}
                    {att.canViewSensitive &&
                      att.status === "DECLINED" &&
                      (att.declineReasonCategory || att.declineReason) && (
                        <p
                          className="flex items-center gap-1 text-xs text-muted-foreground"
                          data-testid="sensitive-decline-reason"
                        >
                          <Lock className="h-3 w-3 text-primary shrink-0" />
                          <span>
                            {att.declineReasonCategory
                              ? DECLINE_REASON_CATEGORY_LABELS[
                                  att.declineReasonCategory
                                ]
                              : ""}
                            {att.declineReasonCategory && att.declineReason
                              ? ": "
                              : ""}
                            {att.declineReason ?? ""}
                          </span>
                        </p>
                      )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
