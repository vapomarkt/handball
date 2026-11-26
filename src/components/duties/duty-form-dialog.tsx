"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
  DUTY_CATEGORY_LABELS,
  type DutyCategory,
  type DutyScope,
  type MatchdayDTO,
} from "@/domain/schemas/duty";
import {
  JERSEY_CONDITION_LABELS,
  type JerseySetDTO,
} from "@/domain/schemas/jersey-set";

interface DutyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  activeTeamId: string;
  clubTeams: Array<{ id: string; name: string }>;
  matchdays: MatchdayDTO[];
  jerseySets?: JerseySetDTO[];
  onSaved: () => void;
}

const CATEGORIES = Object.keys(DUTY_CATEGORY_LABELS) as DutyCategory[];

export function DutyFormDialog({
  open,
  onOpenChange,
  clubId,
  activeTeamId,
  clubTeams,
  matchdays,
  jerseySets = [],
  onSaved,
}: DutyFormDialogProps) {
  const [scope, setScope] = useState<DutyScope>("CLUB_MATCHDAY");
  const [category, setCategory] = useState<DutyCategory>("TIMEKEEPER");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [matchdayId, setMatchdayId] = useState(matchdays[0]?.id ?? "");
  const [assignedTeamId, setAssignedTeamId] = useState("");
  const [jerseySetId, setJerseySetId] = useState("");
  const [hoursCredit, setHoursCredit] = useState("2");
  const [slotsNeeded, setSlotsNeeded] = useState("1");
  const [requiresLicense, setRequiresLicense] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedJerseySet =
    jerseySets.find((j) => j.id === jerseySetId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/clubs/${encodeURIComponent(clubId)}/duties`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            teamId: scope === "TEAM" ? activeTeamId : null,
            matchdayId: scope === "CLUB_MATCHDAY" ? matchdayId || null : null,
            category,
            title,
            description: description || null,
            hoursCredit: Number(hoursCredit),
            slotsNeeded: Number(slotsNeeded),
            requiresLicense,
            assignedTeamId:
              scope === "CLUB_MATCHDAY" ? assignedTeamId || null : null,
            jerseySetId:
              category === "JERSEY_LAUNDRY" ? jerseySetId || null : null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Dienst konnte nicht angelegt werden.");
        return;
      }
      onSaved();
      onOpenChange(false);
    } catch {
      setError("Netzwerkfehler beim Anlegen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuen Vereins- oder Teamdienst anlegen</DialogTitle>
          <DialogDescription>
            Erstelle Heimspieltag-Dienste (z. B. Kampfgericht inkl.
            Team-Delegation) oder interne Team-Aufgaben.
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-scope">Ebene</Label>
              <SelectNative
                id="d-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as DutyScope)}
              >
                <option value="CLUB_MATCHDAY">Heimspieltag (Verein)</option>
                <option value="TEAM">Team-Dienst</option>
              </SelectNative>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-cat">Kategorie</Label>
              <SelectNative
                id="d-cat"
                value={category}
                onChange={(e) => {
                  const next = e.target.value as DutyCategory;
                  setCategory(next);
                  setRequiresLicense(
                    next === "TIMEKEEPER" || next === "SECRETARY"
                  );
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {DUTY_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </SelectNative>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-title">Bezeichnung *</Label>
            <Input
              id="d-title"
              required
              placeholder={
                category === "JERSEY_LAUNDRY"
                  ? "z. B. Trikotwäsche – Heimtrikot"
                  : "z. B. Kampfgericht (Sekretär) – Damen 1"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {category === "JERSEY_LAUNDRY" && (
            <div className="space-y-2 rounded-xl border border-sky-200/80 bg-sky-50/50 p-3 dark:border-sky-900/60 dark:bg-sky-950/25">
              <div className="space-y-1.5">
                <Label htmlFor="d-jersey-set">
                  Trikotsatz (optional – zeigt Pflegehinweise beim Waschdienst)
                </Label>
                <SelectNative
                  id="d-jersey-set"
                  value={jerseySetId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setJerseySetId(nextId);
                    const chosen = jerseySets.find((j) => j.id === nextId);
                    if (chosen && !title.trim()) {
                      setTitle(`Trikotwäsche – ${chosen.name}`);
                    }
                  }}
                >
                  <option value="">Kein bestimmter Trikotsatz</option>
                  {jerseySets.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} ({j.colors})
                      {j.condition !== "GOOD" && j.condition !== "NEW"
                        ? ` · ${JERSEY_CONDITION_LABELS[j.condition]}`
                        : ""}
                    </option>
                  ))}
                </SelectNative>
              </div>
              {selectedJerseySet?.careInstructions && (
                <div className="text-xs text-sky-900 dark:text-sky-200 flex items-start gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Hinterlegte Pflegehinweise:</strong>{" "}
                    {selectedJerseySet.careInstructions}
                  </span>
                </div>
              )}
            </div>
          )}

          {scope === "CLUB_MATCHDAY" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="d-md">Heimspieltag</Label>
                <SelectNative
                  id="d-md"
                  value={matchdayId}
                  onChange={(e) => setMatchdayId(e.target.value)}
                >
                  <option value="">Kein Heimspieltag</option>
                  {matchdays.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-deleg">
                  Team-Delegation (optional)
                </Label>
                <SelectNative
                  id="d-deleg"
                  value={assignedTeamId}
                  onChange={(e) => setAssignedTeamId(e.target.value)}
                >
                  <option value="">Offen für den gesamten Verein</option>
                  {clubTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      Delegiert an {t.name}
                    </option>
                  ))}
                </SelectNative>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="d-hours">Arbeitsstunden-Gutschrift *</Label>
              <Input
                id="d-hours"
                type="number"
                step="0.25"
                min={0.25}
                max={24}
                required
                value={hoursCredit}
                onChange={(e) => setHoursCredit(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-slots">Benötigte Helfer *</Label>
              <Input
                id="d-slots"
                type="number"
                min={1}
                max={20}
                required
                value={slotsNeeded}
                onChange={(e) => setSlotsNeeded(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-desc">Hinweise</Label>
            <Input
              id="d-desc"
              placeholder="z. B. Treffpunkt 15 Min. vor Anwurf am Zeitnehmertisch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={requiresLicense}
              onChange={(e) => setRequiresLicense(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>Zeitnehmer-/Sekretär-Lizenz (Z/S) erforderlich</span>
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
              Dienst anlegen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
