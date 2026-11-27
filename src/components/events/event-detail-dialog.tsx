"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Loader2,
  Lock,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
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
import { SelectNative } from "@/components/ui/select-native";
import {
  DECLINE_REASON_CATEGORY_LABELS,
  formatMatchScore,
  formatOfficialMatchScore,
  hasOfficialScoreDiscrepancy,
  RSVP_STATUS_LABELS,
  shouldShowMatchScoreEditor,
  type EventDTO,
} from "@/domain/schemas/event";
import {
  JERSEY_CONDITION_LABELS,
  type JerseySetDTO,
} from "@/domain/schemas/jersey-set";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";
import { CarpoolSection } from "./carpool-section";
import {
  EventTypeBadge,
  MatchLocationBadge,
  MatchResultBadge,
  MatchScoreStatusBadges,
} from "./match-badges";
import { ResinBadge } from "./resin-badge";

interface EventDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  event: EventDTO | null;
  roster: TeamMemberResponseDTO[];
  jerseySets?: JerseySetDTO[];
  isStaff: boolean;
  usesResin?: boolean;
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
  jerseySets = [],
  isStaff,
  usesResin = true,
  onUpdated,
}: EventDetailDialogProps) {
  const md = event?.matchDetails ?? null;

  const [nominated, setNominated] = useState<string[]>(
    md?.nominatedMemberIds ?? []
  );
  const [jerseySetId, setJerseySetId] = useState(md?.jerseySetId ?? "");
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
  const [openedAt] = useState(() => new Date());
  const [showScoreOverride, setShowScoreOverride] = useState(false);

  if (!event) return null;

  const players = roster.filter((m) => m.role === "PLAYER");
  const scoreRelevantByDefault = shouldShowMatchScoreEditor(event, openedAt);
  const showScoreFields = scoreRelevantByDefault || showScoreOverride;

  function toggleNomination(memberId: string) {
    setNominated((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  }

  function handleHideScoreOverride() {
    setShowScoreOverride(false);
    setHomeScoreHalf(
      md?.homeScoreHalf !== null && md?.homeScoreHalf !== undefined
        ? String(md.homeScoreHalf)
        : ""
    );
    setAwayScoreHalf(
      md?.awayScoreHalf !== null && md?.awayScoreHalf !== undefined
        ? String(md.awayScoreHalf)
        : ""
    );
    setHomeScoreFull(
      md?.homeScoreFull !== null && md?.homeScoreFull !== undefined
        ? String(md.homeScoreFull)
        : ""
    );
    setAwayScoreFull(
      md?.awayScoreFull !== null && md?.awayScoreFull !== undefined
        ? String(md.awayScoreFull)
        : ""
    );
  }

  async function handleSaveMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    setSavingMatch(true);
    setMatchError(null);
    setMatchSavedMsg(null);

    try {
      const payload: Record<string, unknown> = {
        jerseySetId: jerseySetId || null,
        jerseyColor: jerseyColor || null,
        refereeNote: refereeNote || null,
        nominatedMemberIds: nominated,
      };
      if (showScoreFields) {
        payload.homeScoreHalf =
          homeScoreHalf === "" ? null : Number(homeScoreHalf);
        payload.awayScoreHalf =
          awayScoreHalf === "" ? null : Number(awayScoreHalf);
        payload.homeScoreFull =
          homeScoreFull === "" ? null : Number(homeScoreFull);
        payload.awayScoreFull =
          awayScoreFull === "" ? null : Number(awayScoreFull);
      }

      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(event.id)}/match`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMatchError(data?.error?.message || "Speichern fehlgeschlagen.");
        return;
      }
      const hasScoreInput =
        showScoreFields &&
        (homeScoreFull !== "" ||
          awayScoreFull !== "" ||
          homeScoreHalf !== "" ||
          awayScoreHalf !== "");
      setMatchSavedMsg(
        hasScoreInput
          ? "Spieltagsdaten & Ergebnis gespeichert."
          : "Spieltagsdaten & Kader gespeichert."
      );
      onUpdated();
    } catch {
      setMatchError("Netzwerkfehler beim Speichern.");
    } finally {
      setSavingMatch(false);
    }
  }

  async function handleAdoptOfficialScores() {
    if (
      !event ||
      !md ||
      md.officialHomeScoreFull === null ||
      md.officialAwayScoreFull === null
    ) {
      return;
    }
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
            homeScoreFull: md.officialHomeScoreFull,
            awayScoreFull: md.officialAwayScoreFull,
            homeScoreHalf: md.officialHomeScoreHalf,
            awayScoreHalf: md.officialAwayScoreHalf,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setMatchError(
          data?.error?.message ||
            "Offizielles Ergebnis konnte nicht übernommen werden."
        );
        return;
      }
      setHomeScoreFull(String(md.officialHomeScoreFull));
      setAwayScoreFull(String(md.officialAwayScoreFull));
      setHomeScoreHalf(
        md.officialHomeScoreHalf !== null ? String(md.officialHomeScoreHalf) : ""
      );
      setAwayScoreHalf(
        md.officialAwayScoreHalf !== null ? String(md.officialAwayScoreHalf) : ""
      );
      setMatchSavedMsg("Offizielles Liga-Ergebnis übernommen.");
      onUpdated();
    } catch {
      setMatchError("Netzwerkfehler beim Übernehmen.");
    } finally {
      setSavingMatch(false);
    }
  }

  const scoreDiscrepancy = md ? hasOfficialScoreDiscrepancy(md) : false;
  const officialScoreLabel = md ? formatOfficialMatchScore(md) : null;
  const localScoreLabel = md ? formatMatchScore(md) : null;

  const scoreInputsGrid = (
    <div
      className="grid gap-3 sm:grid-cols-2"
      data-testid="match-score-inputs"
    >
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
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {md && (
              <MatchLocationBadge isHome={md.isHome} labelMode="long" />
            )}
            <EventTypeBadge type={event.type} />
            {usesResin && event.venue && (
              <ResinBadge policy={event.venue.resinPolicy} />
            )}
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <MatchResultBadge matchDetails={md} />
                  <MatchScoreStatusBadges matchDetails={md} />
                </div>
              </div>

              {scoreDiscrepancy && officialScoreLabel && localScoreLabel && (
                <div
                  role="alert"
                  data-testid="official-score-discrepancy-alert"
                  className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-950 dark:border-amber-600/80 dark:bg-amber-950/60 dark:text-amber-100 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                    <div className="space-y-1">
                      <p className="font-bold">
                        Abweichung zum offiziell gemeldeten Liga-Ergebnis
                      </p>
                      <p>
                        Lokal (manuell korrigiert):{" "}
                        <strong className="font-mono">{localScoreLabel}</strong>{" "}
                        · Offiziell gemeldet (Liga):{" "}
                        <strong className="font-mono">
                          {officialScoreLabel}
                        </strong>
                      </p>
                      <p className="text-[11px] opacity-85">
                        Der manuell korrigierte Spielstand bleibt beim
                        automatischen Sync geschützt.
                      </p>
                    </div>
                  </div>
                  {isStaff && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={savingMatch}
                      onClick={handleAdoptOfficialScores}
                      className="h-7 text-xs border-amber-400 bg-background hover:bg-amber-100 dark:border-amber-600 dark:hover:bg-amber-950"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Offizielles Ergebnis ({officialScoreLabel}) übernehmen
                    </Button>
                  )}
                </div>
              )}

              {!scoreDiscrepancy &&
                md.scoreManuallyEdited &&
                localScoreLabel && (
                  <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Dieser Spielstand wurde manuell eingetragen bzw. korrigiert
                      und wird beim automatischen Liga-Sync nicht überschrieben.
                    </span>
                  </div>
                )}

              {!isStaff ? (
                <div className="space-y-2 text-sm">
                  {(md.jerseySet || md.jerseyColor) && (
                    <p className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                      <Shirt className="h-4 w-4 text-primary" />
                      Trikot:{" "}
                      <strong className="text-foreground">
                        {md.jerseySet
                          ? `${md.jerseySet.name} (${md.jerseySet.colors})`
                          : md.jerseyColor}
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
                  {/* Ab Anwurf / bei bereits vorhandenem Spielstand steht die Ergebniserfassung oben */}
                  {scoreRelevantByDefault && scoreInputsGrid}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="md-jersey" className="text-xs">
                        Trikotsatz
                      </Label>
                      {jerseySets.length > 0 ? (
                        <SelectNative
                          id="md-jersey"
                          value={jerseySetId}
                          onChange={(e) => {
                            const nextId = e.target.value;
                            setJerseySetId(nextId);
                            const chosen = jerseySets.find(
                              (j) => j.id === nextId
                            );
                            if (chosen) {
                              setJerseyColor(chosen.colors);
                            }
                          }}
                          className="h-9 text-xs"
                        >
                          <option value="">
                            Benutzerdefinierte Trikotfarbe…
                          </option>
                          {jerseySets.map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.name} ({j.colors})
                              {j.condition !== "GOOD" && j.condition !== "NEW"
                                ? ` · ${JERSEY_CONDITION_LABELS[j.condition]}`
                                : ""}
                            </option>
                          ))}
                        </SelectNative>
                      ) : (
                        <Input
                          id="md-jersey"
                          value={jerseyColor}
                          onChange={(e) => setJerseyColor(e.target.value)}
                          className="h-9 text-xs"
                        />
                      )}
                      {jerseySets.length > 0 && !jerseySetId && (
                        <Input
                          aria-label="Benutzerdefinierte Trikotfarbe"
                          placeholder="z. B. Orange / Schwarz"
                          value={jerseyColor}
                          onChange={(e) => setJerseyColor(e.target.value)}
                          className="h-9 text-xs mt-1.5"
                        />
                      )}
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

                  {/* Optional aufgeklappte Ergebniserfassung für Sondersituationen vor Anwurf */}
                  {!scoreRelevantByDefault && showScoreOverride && (
                    <div
                      data-testid="early-score-editor"
                      className="rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {event.isCancelled
                            ? "Ergebnis (abgesagtes Spiel / Wertung)"
                            : "Ergebnis (vor regulärem Anwurf)"}
                        </span>
                        <button
                          type="button"
                          onClick={handleHideScoreOverride}
                          className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          Ausblenden
                        </button>
                      </div>
                      {scoreInputsGrid}
                    </div>
                  )}

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

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button type="submit" size="sm" disabled={savingMatch}>
                      {savingMatch && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {showScoreFields
                        ? "Spieltagsdaten & Ergebnis speichern"
                        : "Spieltagsdaten & Kader speichern"}
                    </Button>

                    {!scoreRelevantByDefault && !showScoreOverride && (
                      <button
                        type="button"
                        data-testid="toggle-early-score-entry"
                        onClick={() => setShowScoreOverride(true)}
                        title="Für Sondersituationen, z. B. vorgezogenes Spiel oder Spielwertung"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Ergebnis eintragen
                      </button>
                    )}
                  </div>
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
