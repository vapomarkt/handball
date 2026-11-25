"use client";

import { useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
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
  JERSEY_CARE_PRESETS,
  JERSEY_CONDITION_LABELS,
  type JerseyCondition,
  type JerseySetDTO,
} from "@/domain/schemas/jersey-set";

interface JerseySetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  activeTeamId: string;
  activeTeamName: string;
  initial?: JerseySetDTO | null;
  onSaved: () => void;
}

const CONDITIONS = Object.keys(JERSEY_CONDITION_LABELS) as JerseyCondition[];

export function JerseySetFormDialog({
  open,
  onOpenChange,
  clubId,
  activeTeamId,
  activeTeamName,
  initial,
  onSaved,
}: JerseySetFormDialogProps) {
  const isEdit = Boolean(initial);

  const [name, setName] = useState(initial?.name ?? "");
  const [colors, setColors] = useState(initial?.colors ?? "");
  const [scope, setScope] = useState<"TEAM" | "CLUB">(
    initial ? (initial.teamId ? "TEAM" : "CLUB") : "TEAM"
  );
  const [jerseyCount, setJerseyCount] = useState(
    initial?.jerseyCount != null ? String(initial.jerseyCount) : ""
  );
  const [sizes, setSizes] = useState(initial?.sizes ?? "");
  const [condition, setCondition] = useState<JerseyCondition>(
    initial?.condition ?? "GOOD"
  );
  const [conditionNote, setConditionNote] = useState(
    initial?.conditionNote ?? ""
  );
  const [careInstructions, setCareInstructions] = useState(
    initial?.careInstructions ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function appendCarePreset(preset: string) {
    setCareInstructions((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return preset;
      if (trimmed.toLowerCase().includes(preset.toLowerCase())) return prev;
      return `${trimmed}, ${preset}`;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        teamId: scope === "TEAM" ? (initial?.teamId ?? activeTeamId) : null,
        name,
        colors,
        sizes: sizes || null,
        jerseyCount: jerseyCount ? Number(jerseyCount) : null,
        condition,
        conditionNote: conditionNote || null,
        careInstructions: careInstructions || null,
      };

      const url = isEdit
        ? `/api/v1/clubs/${encodeURIComponent(clubId)}/jersey-sets/${encodeURIComponent(initial!.id)}`
        : `/api/v1/clubs/${encodeURIComponent(clubId)}/jersey-sets`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Trikotsatz konnte nicht gespeichert werden."
        );
        return;
      }

      onSaved();
      onOpenChange(false);
    } catch {
      setError("Netzwerkfehler beim Speichern des Trikotsatzes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Trikotsatz bearbeiten" : "Neuen Trikotsatz anlegen"}
          </DialogTitle>
          <DialogDescription>
            Verwalte Trikotsätze zentral, halte den aktuellen Zustand fest und
            hinterlege Pflegehinweise für den Waschdienst.
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
              <Label htmlFor="js-name">Bezeichnung *</Label>
              <Input
                id="js-name"
                required
                placeholder="z. B. Heimtrikot 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="js-colors">Farben *</Label>
              <Input
                id="js-colors"
                required
                placeholder="z. B. Orange / Schwarz"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="js-scope">Zuordnung</Label>
              <SelectNative
                id="js-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as "TEAM" | "CLUB")}
              >
                <option value="TEAM">{activeTeamName}</option>
                <option value="CLUB">Vereinsweit (alle Teams)</option>
              </SelectNative>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="js-count">Anzahl Trikots</Label>
              <Input
                id="js-count"
                type="number"
                min={1}
                max={60}
                placeholder="z. B. 16"
                value={jerseyCount}
                onChange={(e) => setJerseyCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="js-sizes">Größen / Umfang</Label>
              <Input
                id="js-sizes"
                placeholder="z. B. S–XXL + 2 TW"
                value={sizes}
                onChange={(e) => setSizes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Zustand festhalten
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="js-condition">Aktueller Zustand</Label>
                <SelectNative
                  id="js-condition"
                  value={condition}
                  onChange={(e) =>
                    setCondition(e.target.value as JerseyCondition)
                  }
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {JERSEY_CONDITION_LABELS[c]}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="js-cond-note">Zustandsnotiz</Label>
                <Input
                  id="js-cond-note"
                  placeholder="z. B. Nr. 7 Naht locker, Nr. 14 fehlt"
                  value={conditionNote}
                  onChange={(e) => setConditionNote(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-sky-200/80 bg-sky-50/50 p-3.5 dark:border-sky-900/60 dark:bg-sky-950/25">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="js-care"
                className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-900 dark:text-sky-200"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Pflegehinweise zum Waschen
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Diese Hinweise werden automatisch der Person angezeigt, die für
              die Trikotwäsche eingeteilt ist.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {JERSEY_CARE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => appendCarePreset(preset)}
                  className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-background px-2 py-1 text-[11px] font-medium text-sky-900 hover:bg-sky-100/60 dark:border-sky-800 dark:text-sky-200 dark:hover:bg-sky-900/40 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              id="js-care"
              rows={3}
              placeholder="z. B. Max. 30 °C auf links waschen, kein Weichspüler, nicht in den Trockner (Beflockung & Sponsorendruck!)."
              value={careInstructions}
              onChange={(e) => setCareInstructions(e.target.value)}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

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
              {isEdit ? "Änderungen speichern" : "Trikotsatz anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
