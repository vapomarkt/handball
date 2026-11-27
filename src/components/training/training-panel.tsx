"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Clock,
  Dumbbell,
  Loader2,
  Plus,
  Share2,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  HANDBALL_DRILL_TAGS,
  TRAINING_PHASE_LABELS,
  type DrillDTO,
  type TrainingPhaseItem,
  type TrainingPhaseType,
  type TrainingPlanDTO,
} from "@/domain/schemas/training";

interface TrainingPanelProps {
  teamId: string;
  mode: "plans" | "drills";
  isStaff: boolean;
}

const PHASES = Object.keys(TRAINING_PHASE_LABELS) as TrainingPhaseType[];

export function TrainingPanel({ teamId, mode, isStaff }: TrainingPanelProps) {
  const [drills, setDrills] = useState<DrillDTO[]>([]);
  const [plans, setPlans] = useState<TrainingPlanDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>("ALL");

  // Drill dialog
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillPhase, setDrillPhase] = useState<TrainingPhaseType>("TACTICS");
  const [drillDuration, setDrillDuration] = useState("15");
  const [drillEquipment, setDrillEquipment] = useState("");
  const [drillDesc, setDrillDesc] = useState("");
  const [drillTags, setDrillTags] = useState<string[]>(["6:0-Abwehr"]);
  const [savingDrill, setSavingDrill] = useState(false);

  // Plan dialog
  const [planOpen, setPlanOpen] = useState(false);
  const [planTitle, setPlanTitle] = useState("");
  const [planFocus, setPlanFocus] = useState("");
  const [planTarget, setPlanTarget] = useState("90");
  const [planShared, setPlanShared] = useState(true);
  const [planPhases, setPlanPhases] = useState<TrainingPhaseItem[]>([
    {
      id: "p-1",
      phase: "WARMUP",
      title: "Einlaufen & Mobilisation",
      durationMinutes: 15,
    },
    {
      id: "p-2",
      phase: "TACTICS",
      title: "6:0-Abwehr Kooperation",
      durationMinutes: 30,
    },
    {
      id: "p-3",
      phase: "GAME_FORM",
      title: "Abschlussspiel 6-gegen-6",
      durationMinutes: 35,
    },
    {
      id: "p-4",
      phase: "COOLDOWN",
      title: "Cool-down & Dehnen",
      durationMinutes: 10,
    },
  ]);
  const [savingPlan, setSavingPlan] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dRes, pRes] = await Promise.all([
        fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/drills`, {
          cache: "no-store",
        }),
        fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/training-plans`, {
          cache: "no-store",
        }),
      ]);
      if (dRes.ok) setDrills((await dRes.json()).drills ?? []);
      if (pRes.ok) setPlans((await pRes.json()).plans ?? []);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/drills`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/training-plans`, {
        cache: "no-store",
      }),
    ])
      .then(async ([dRes, pRes]) => {
        if (!active) return;
        if (dRes.ok) setDrills((await dRes.json()).drills ?? []);
        if (pRes.ok) setPlans((await pRes.json()).plans ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId]);

  const filteredDrills = useMemo(() => {
    if (tagFilter === "ALL") return drills;
    return drills.filter((d) => d.tags.includes(tagFilter));
  }, [drills, tagFilter]);

  function toggleDrillTag(tag: string) {
    setDrillTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleCreateDrill(e: React.FormEvent) {
    e.preventDefault();
    setSavingDrill(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/drills`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: drillTitle,
            phase: drillPhase,
            durationMinutes: Number(drillDuration),
            equipment: drillEquipment || null,
            description: drillDesc || null,
            tags: drillTags,
            teamScope: "CLUB",
          }),
        }
      );
      if (res.ok) {
        setDrillTitle("");
        setDrillEquipment("");
        setDrillDesc("");
        setDrillOpen(false);
        await loadData();
      }
    } finally {
      setSavingDrill(false);
    }
  }

  async function handleDeleteDrill(id: string) {
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/drills/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadData();
  }

  function addPhaseFromDrill(drill?: DrillDTO) {
    setPlanPhases((prev) => [
      ...prev,
      {
        id: `p-${Date.now()}-${prev.length}`,
        phase: drill?.phase ?? "TECHNIQUE",
        title: drill?.title ?? "Neue Trainingsphase",
        durationMinutes: drill?.durationMinutes ?? 15,
        drillId: drill?.id ?? null,
        equipment: drill?.equipment ?? null,
      },
    ]);
  }

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setSavingPlan(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/training-plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: planTitle,
            focus: planFocus || null,
            targetDurationMinutes: Number(planTarget),
            phases: planPhases,
            isSharedWithTeam: planShared,
          }),
        }
      );
      if (res.ok) {
        setPlanTitle("");
        setPlanFocus("");
        setPlanOpen(false);
        await loadData();
      }
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleToggleShare(plan: TrainingPlanDTO) {
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/training-plans/${encodeURIComponent(plan.id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSharedWithTeam: !plan.isSharedWithTeam }),
      }
    );
    if (res.ok) await loadData();
  }

  async function handleDeletePlan(id: string) {
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/training-plans/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadData();
  }

  const totalDraftMinutes = planPhases.reduce(
    (sum, p) => sum + p.durationMinutes,
    0
  );

  if (mode === "drills") {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTagFilter("ALL")}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                tagFilter === "ALL"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              Alle Tags
            </button>
            {HANDBALL_DRILL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setTagFilter(tag)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                  tagFilter === tag
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {isStaff && (
            <Button size="sm" onClick={() => setDrillOpen(true)}>
              <Plus className="h-4 w-4" />
              Übung anlegen
            </Button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Lade Übungsbibliothek…</p>
        ) : filteredDrills.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Keine Übungen für diesen Filter vorhanden.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredDrills.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary">
                          {TRAINING_PHASE_LABELS[d.phase]}
                        </Badge>
                        <Badge variant="outline" className="gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {d.durationMinutes} Min.
                        </Badge>
                      </div>
                      <h3 className="font-bold text-sm">{d.title}</h3>
                    </div>
                    {isStaff && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteDrill(d.id)}
                        aria-label={`Übung ${d.title} löschen`}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-xs text-muted-foreground">
                      {d.description}
                    </p>
                  )}
                  {d.equipment && (
                    <p className="text-xs text-foreground">
                      <span className="text-muted-foreground">Material: </span>
                      {d.equipment}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {d.tags.map((t) => (
                      <Badge key={t} variant="position">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Handball-Übung anlegen</DialogTitle>
              <DialogDescription>
                Erweitere die Vereins-Übungsbibliothek mit Phase, Dauer,
                Material und Handball-Tags.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateDrill} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="dr-title">Titel *</Label>
                <Input
                  id="dr-title"
                  required
                  value={drillTitle}
                  onChange={(e) => setDrillTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="dr-phase">Trainingsphase</Label>
                  <SelectNative
                    id="dr-phase"
                    value={drillPhase}
                    onChange={(e) =>
                      setDrillPhase(e.target.value as TrainingPhaseType)
                    }
                  >
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {TRAINING_PHASE_LABELS[p]}
                      </option>
                    ))}
                  </SelectNative>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dr-dur">Dauer (Minuten)</Label>
                  <Input
                    id="dr-dur"
                    type="number"
                    min={3}
                    max={90}
                    required
                    value={drillDuration}
                    onChange={(e) => setDrillDuration(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dr-eq">Material</Label>
                <Input
                  id="dr-eq"
                  placeholder="z. B. Leibchen, 8 Bälle, 4 Hütchen"
                  value={drillEquipment}
                  onChange={(e) => setDrillEquipment(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dr-desc">Ablauf & Coaching-Punkte</Label>
                <Input
                  id="dr-desc"
                  value={drillDesc}
                  onChange={(e) => setDrillDesc(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Handball-Tags</Label>
                <div className="flex flex-wrap gap-1.5">
                  {HANDBALL_DRILL_TAGS.map((tag) => {
                    const active = drillTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleDrillTag(tag)}
                        className={`rounded-md border px-2 py-1 text-xs font-medium cursor-pointer ${
                          active
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDrillOpen(false)}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={savingDrill}>
                  {savingDrill && <Loader2 className="h-4 w-4 animate-spin" />}
                  Übung speichern
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // mode === "plans"
  return (
    <div className="space-y-4">
      {isStaff && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setPlanOpen(true)}>
            <Plus className="h-4 w-4" />
            Trainingsplan erstellen
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Trainingspläne…</p>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <BookOpen className="h-7 w-7 text-muted-foreground" />
            <p className="font-semibold text-sm">
              Noch keine Trainingspläne vorhanden
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{plan.title}</CardTitle>
                      <Badge
                        variant={
                          plan.totalPlannedMinutes <= plan.targetDurationMinutes
                            ? "fit"
                            : "unavailable"
                        }
                        className="font-mono"
                      >
                        {plan.totalPlannedMinutes} / {plan.targetDurationMinutes}{" "}
                        Min.
                      </Badge>
                      {plan.isSharedWithTeam && (
                        <Badge variant="outline">Für Team freigegeben</Badge>
                      )}
                    </div>
                    {plan.focus && (
                      <CardDescription className="mt-1">
                        Schwerpunkt: {plan.focus}
                      </CardDescription>
                    )}
                  </div>

                  {isStaff && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleShare(plan)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        {plan.isSharedWithTeam ? "Nur Trainer" : "Freigeben"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeletePlan(plan.id)}
                        aria-label={`Plan ${plan.title} löschen`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {plan.phases.map((ph, idx) => (
                  <div
                    key={ph.id}
                    className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-muted/25 p-3 text-sm"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {idx + 1}.
                        </span>
                        <Badge variant="secondary">
                          {TRAINING_PHASE_LABELS[ph.phase]}
                        </Badge>
                        <span className="font-semibold">{ph.title}</span>
                      </div>
                      {(ph.equipment || ph.notes) && (
                        <p className="text-xs text-muted-foreground pl-5">
                          {ph.equipment ? `Material: ${ph.equipment}` : ""}
                          {ph.equipment && ph.notes ? " · " : ""}
                          {ph.notes ?? ""}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline" className="font-mono self-start sm:self-center">
                      {ph.durationMinutes} Min.
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Trainingsplan-Builder Dialog */}
      <Dialog open={planOpen} onOpenChange={setPlanOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-primary" />
              Trainingsplan-Builder
            </DialogTitle>
            <DialogDescription>
              Stelle deine Einheit nach Phasen zusammen und behalte das
              Zeitbudget im Blick.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="tp-title">Titel *</Label>
                <Input
                  id="tp-title"
                  required
                  placeholder="z. B. Dienstagstraining – Gegenstoß & 6:0"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tp-target">Zeitbudget (Min.)</Label>
                <Input
                  id="tp-target"
                  type="number"
                  min={30}
                  max={240}
                  required
                  value={planTarget}
                  onChange={(e) => setPlanTarget(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tp-focus">Trainingsschwerpunkt</Label>
              <Input
                id="tp-focus"
                placeholder="z. B. Überzahlspiel & schnelle Mitte"
                value={planFocus}
                onChange={(e) => setPlanFocus(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>
                  Phasen ({totalDraftMinutes} / {planTarget} Min.)
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addPhaseFromDrill()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Phase hinzufügen
                </Button>
              </div>

              {drills.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-muted-foreground">Aus Bibliothek:</span>
                  {drills.slice(0, 4).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => addPhaseFromDrill(d)}
                      className="rounded border border-border bg-muted/40 px-2 py-0.5 hover:border-primary cursor-pointer"
                    >
                      + {d.title} ({d.durationMinutes}m)
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {planPhases.map((ph, idx) => (
                  <div
                    key={ph.id}
                    className="grid gap-2 sm:grid-cols-12 items-center rounded-lg border border-border p-2"
                  >
                    <SelectNative
                      value={ph.phase}
                      onChange={(e) => {
                        const next = [...planPhases];
                        next[idx] = {
                          ...ph,
                          phase: e.target.value as TrainingPhaseType,
                        };
                        setPlanPhases(next);
                      }}
                      className="h-9 text-xs sm:col-span-4"
                    >
                      {PHASES.map((p) => (
                        <option key={p} value={p}>
                          {TRAINING_PHASE_LABELS[p]}
                        </option>
                      ))}
                    </SelectNative>
                    <Input
                      value={ph.title}
                      onChange={(e) => {
                        const next = [...planPhases];
                        next[idx] = { ...ph, title: e.target.value };
                        setPlanPhases(next);
                      }}
                      className="h-9 text-xs sm:col-span-5"
                    />
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={ph.durationMinutes}
                      onChange={(e) => {
                        const next = [...planPhases];
                        next[idx] = {
                          ...ph,
                          durationMinutes: Number(e.target.value) || 10,
                        };
                        setPlanPhases(next);
                      }}
                      className="h-9 text-xs font-mono sm:col-span-2"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 sm:col-span-1"
                      onClick={() =>
                        setPlanPhases((prev) => prev.filter((x) => x.id !== ph.id))
                      }
                      aria-label="Phase entfernen"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={planShared}
                onChange={(e) => setPlanShared(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <span>Trainingsplan fürs Team sichtbar freigeben</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlanOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingPlan}>
                {savingPlan && <Loader2 className="h-4 w-4 animate-spin" />}
                Trainingsplan speichern
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
