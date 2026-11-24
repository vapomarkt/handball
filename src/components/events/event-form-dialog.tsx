"use client";

import { useState } from "react";
import { Loader2, Repeat } from "lucide-react";
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
  EVENT_TYPE_LABELS,
  type EventType,
  type VenueDTO,
} from "@/domain/schemas/event";

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  venues: VenueDTO[];
  onSaved: () => void;
}

const WEEKDAYS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Di" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Do" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 0, label: "So" },
];

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as EventType[];

function defaultDateStr(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function EventFormDialog({
  open,
  onOpenChange,
  teamId,
  venues,
  onSaved,
}: EventFormDialogProps) {
  const [recurring, setRecurring] = useState(false);
  const [type, setType] = useState<EventType>("TRAINING");
  const [title, setTitle] = useState("Mannschaftstraining");
  const [description, setDescription] = useState("");
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [requireDeclineReason, setRequireDeclineReason] = useState(false);

  // Single event fields
  const [date, setDate] = useState(defaultDateStr(3));
  const [startTime, setStartTime] = useState("19:30");
  const [endTime, setEndTime] = useState("21:00");
  const [meetingTime, setMeetingTime] = useState("");

  // Recurring fields
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([2, 4]); // Di & Do
  const [endDate, setEndDate] = useState(defaultDateStr(30));
  const [excludedDatesText, setExcludedDatesText] = useState("");
  const [rsvpDeadlineHours, setRsvpDeadlineHours] = useState("4");

  // Match fields
  const [opponentName, setOpponentName] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [jerseyColor, setJerseyColor] = useState("Orange / Schwarz");
  const [refereeNote, setRefereeNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleWeekday(dow: number) {
    setDaysOfWeek((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let body: Record<string, unknown>;

      if (recurring) {
        const excludedDates = excludedDatesText
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));

        body = {
          recurring: true,
          type,
          title,
          description: description || null,
          venueId: venueId || null,
          daysOfWeek,
          startTime,
          endTime,
          startDate: date,
          endDate,
          excludedDates,
          rsvpDeadlineHours: rsvpDeadlineHours
            ? Number(rsvpDeadlineHours)
            : null,
          requireDeclineReason,
        };
      } else {
        const startAt = new Date(`${date}T${startTime}:00`).toISOString();
        const endAt = endTime
          ? new Date(`${date}T${endTime}:00`).toISOString()
          : null;
        const meetingAt = meetingTime
          ? new Date(`${date}T${meetingTime}:00`).toISOString()
          : null;

        body = {
          type,
          title,
          description: description || null,
          venueId: venueId || null,
          startAt,
          endAt,
          meetingAt,
          requireDeclineReason,
          ...(type === "MATCH"
            ? {
                matchDetails: {
                  opponentName,
                  isHome,
                  throwOffAt: startAt,
                  jerseyColor: jerseyColor || null,
                  refereeNote: refereeNote || null,
                },
              }
            : {}),
        };
      }

      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Termin konnte nicht angelegt werden.");
        return;
      }

      onSaved();
      onOpenChange(false);
    } catch {
      setError("Netzwerkfehler beim Anlegen des Termins.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Neuen Termin oder Serie anlegen</DialogTitle>
          <DialogDescription>
            Erstelle ein einzelnes Training, ein Punktspiel inkl. Spieltagsdaten
            oder eine wiederkehrende Trainingsserie mit Ferien-Ausnahmen.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {/* Einzeltermin vs. Serientermin */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRecurring(false)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                !recurring
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              Einzeltermin / Punktspiel
            </button>
            <button
              type="button"
              onClick={() => {
                setRecurring(true);
                if (type === "MATCH") setType("TRAINING");
              }}
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                recurring
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              Serientermin (z. B. Di & Do)
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ev-type">Termintyp</Label>
              <SelectNative
                id="ev-type"
                value={type}
                onChange={(e) => {
                  const next = e.target.value as EventType;
                  setType(next);
                  if (next === "MATCH") {
                    setRecurring(false);
                    if (title === "Mannschaftstraining") {
                      setTitle("Punktspiel");
                    }
                  }
                }}
              >
                {EVENT_TYPES.filter((t) => !(recurring && t === "MATCH")).map(
                  (t) => (
                    <option key={t} value={t}>
                      {EVENT_TYPE_LABELS[t]}
                    </option>
                  )
                )}
              </SelectNative>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ev-venue">Halle (inkl. Harz-Regelung)</Label>
              <SelectNative
                id="ev-venue"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
              >
                <option value="">Keine Halle ausgewählt</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </SelectNative>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Titel *</Label>
            <Input
              id="ev-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {recurring ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <div className="space-y-1.5">
                <Label>Wochentage *</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((wd) => {
                    const active = daysOfWeek.includes(wd.value);
                    return (
                      <button
                        key={wd.value}
                        type="button"
                        onClick={() => toggleWeekday(wd.value)}
                        className={`h-9 w-10 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:bg-muted"
                        }`}
                      >
                        {wd.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-rec-start">Von Datum</Label>
                  <Input
                    id="ev-rec-start"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-rec-end">Bis Datum</Label>
                  <Input
                    id="ev-rec-end"
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-rec-t1">Beginn</Label>
                  <Input
                    id="ev-rec-t1"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-rec-t2">Ende</Label>
                  <Input
                    id="ev-rec-t2"
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-rec-excl">
                    Ferien-Ausnahmen (YYYY-MM-DD, kommagetrennt)
                  </Label>
                  <Input
                    id="ev-rec-excl"
                    placeholder="z. B. 2026-12-24, 2026-12-31"
                    value={excludedDatesText}
                    onChange={(e) => setExcludedDatesText(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-rec-dl">
                    RSVP-Frist (Stunden vor Beginn)
                  </Label>
                  <Input
                    id="ev-rec-dl"
                    type="number"
                    min={1}
                    max={168}
                    value={rsvpDeadlineHours}
                    onChange={(e) => setRsvpDeadlineHours(e.target.value)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="ev-date">Datum *</Label>
                <Input
                  id="ev-date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-start">
                  {type === "MATCH" ? "Anwurf *" : "Beginn *"}
                </Label>
                <Input
                  id="ev-start"
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-end">Ende</Label>
                <Input
                  id="ev-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-meet">Treffpunkt</Label>
                <Input
                  id="ev-meet"
                  type="time"
                  value={meetingTime}
                  onChange={(e) => setMeetingTime(e.target.value)}
                />
              </div>
            </div>
          )}

          {!recurring && type === "MATCH" && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Spieltagsdetails
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-opp">Gegner *</Label>
                  <Input
                    id="ev-opp"
                    required
                    placeholder="z. B. SG Neustadt"
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-home">Heim / Auswärts</Label>
                  <SelectNative
                    id="ev-home"
                    value={isHome ? "HOME" : "AWAY"}
                    onChange={(e) => setIsHome(e.target.value === "HOME")}
                  >
                    <option value="HOME">Heimspiel</option>
                    <option value="AWAY">Auswärtsspiel</option>
                  </SelectNative>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ev-jersey">Trikotfarbe</Label>
                  <Input
                    id="ev-jersey"
                    placeholder="z. B. Orange / Schwarz"
                    value={jerseyColor}
                    onChange={(e) => setJerseyColor(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ev-ref">Schiedsrichter-Hinweis</Label>
                  <Input
                    id="ev-ref"
                    placeholder="z. B. SR-Gespann Bezirk Nord"
                    value={refereeNote}
                    onChange={(e) => setRefereeNote(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Beschreibung / Notizen</Label>
            <Input
              id="ev-desc"
              placeholder="Schwerpunkte, Hinweise zur Anreise…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={requireDeclineReason}
              onChange={(e) => setRequireDeclineReason(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>Absagegrund verpflichtend abfragen (DSGVO-geschützt)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {recurring ? "Terminserie erzeugen" : "Termin anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
