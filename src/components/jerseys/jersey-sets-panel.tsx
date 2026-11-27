"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Pencil,
  Plus,
  Shirt,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SelectNative } from "@/components/ui/select-native";
import {
  JERSEY_CONDITION_LABELS,
  type JerseyCondition,
  type JerseySetDTO,
} from "@/domain/schemas/jersey-set";
import { JerseySetFormDialog } from "./jersey-set-form-dialog";

interface JerseySetsPanelProps {
  clubId: string;
  activeTeamId: string;
  activeTeamName: string;
  jerseySets: JerseySetDTO[];
  loading: boolean;
  isStaff: boolean;
  onChanged: () => void;
}

const CONDITIONS = Object.keys(JERSEY_CONDITION_LABELS) as JerseyCondition[];

export function getJerseyConditionBadgeVariant(
  condition: JerseyCondition
): "fit" | "unavailable" | "injured" | "secondary" {
  switch (condition) {
    case "NEW":
    case "GOOD":
      return "fit";
    case "WORN":
    case "INCOMPLETE":
      return "unavailable";
    case "NEEDS_REPAIR":
      return "injured";
    case "RETIRED":
      return "secondary";
  }
}

export function JerseySetsPanel({
  clubId,
  activeTeamId,
  activeTeamName,
  jerseySets,
  loading,
  isStaff,
  onChanged,
}: JerseySetsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JerseySetDTO | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(set: JerseySetDTO) {
    setEditing(set);
    setDialogOpen(true);
  }

  async function handleQuickConditionChange(
    set: JerseySetDTO,
    nextCondition: JerseyCondition
  ) {
    if (nextCondition === set.condition) return;
    setUpdatingId(set.id);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/clubs/${encodeURIComponent(clubId)}/jersey-sets/${encodeURIComponent(set.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ condition: nextCondition }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error?.message || "Zustand konnte nicht aktualisiert werden."
        );
        return;
      }
      onChanged();
    } catch {
      setError("Netzwerkfehler beim Aktualisieren des Zustands.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(set: JerseySetDTO) {
    if (
      !window.confirm(
        `Trikotsatz „${set.name}“ wirklich löschen? Bestehende Spieltags- und Dienst-Einträge behalten ihre übrigen Daten.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch(
      `/api/v1/clubs/${encodeURIComponent(clubId)}/jersey-sets/${encodeURIComponent(set.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(
        data?.error?.message || "Trikotsatz konnte nicht gelöscht werden."
      );
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Trikotsätze & Pflegehinweise</h2>
          <p className="text-xs text-muted-foreground">
            Verwaltete Trikotsätze stehen bei Punktspielen und Waschdiensten per
            Dropdown zur Auswahl.
          </p>
        </div>
        {isStaff && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Trikotsatz anlegen
          </Button>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Trikotsätze…</p>
      ) : jerseySets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Shirt className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">
              Noch keine Trikotsätze hinterlegt
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Lege Heim- und Auswärtstrikots mit Zustand und Pflegehinweisen an,
              damit sie bei Spielen und der Trikotwäsche per Dropdown auswählbar
              sind.
            </p>
            {isStaff && (
              <div className="pt-2">
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  Ersten Trikotsatz anlegen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {jerseySets.map((set) => {
            const needsAttention =
              set.condition === "NEEDS_REPAIR" ||
              set.condition === "INCOMPLETE";

            return (
              <Card key={set.id} data-testid={`jersey-set-card-${set.id}`}>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={getJerseyConditionBadgeVariant(
                            set.condition
                          )}
                          className="gap-1"
                        >
                          {needsAttention && (
                            <AlertTriangle className="h-3 w-3" />
                          )}
                          {JERSEY_CONDITION_LABELS[set.condition]}
                        </Badge>
                        <Badge variant="outline">
                          {set.teamName ?? "Vereinsweit"}
                        </Badge>
                        {set.jerseyCount != null && (
                          <Badge variant="secondary">
                            {set.jerseyCount} Trikots
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-base font-bold flex items-center gap-1.5 pt-0.5">
                        <Shirt className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate">{set.name}</span>
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Farben:{" "}
                        <strong className="text-foreground">{set.colors}</strong>
                        {set.sizes ? ` · Größen: ${set.sizes}` : ""}
                      </p>
                    </div>

                    {isStaff && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEdit(set)}
                          aria-label={`Trikotsatz ${set.name} bearbeiten`}
                          title="Bearbeiten"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(set)}
                          aria-label={`Trikotsatz ${set.name} löschen`}
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Zustandsnotiz */}
                  {set.conditionNote && (
                    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                      <span className="font-semibold text-foreground">
                        Zustandsnotiz:{" "}
                      </span>
                      <span className="text-muted-foreground">
                        {set.conditionNote}
                      </span>
                    </div>
                  )}

                  {/* Pflegehinweise zum Waschen */}
                  {set.careInstructions && (
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/60 px-3 py-2 text-xs dark:border-sky-900/60 dark:bg-sky-950/30">
                      <p className="font-semibold text-sky-900 dark:text-sky-200 flex items-center gap-1 mb-0.5">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" />
                        Pflegehinweise zum Waschen
                      </p>
                      <p className="text-sky-950/90 dark:text-sky-100/90 whitespace-pre-line">
                        {set.careInstructions}
                      </p>
                    </div>
                  )}

                  {/* Schnell-Zustandsänderung für Trainer */}
                  {isStaff && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
                      <label
                        htmlFor={`quick-cond-${set.id}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Zustand schnell ändern:
                      </label>
                      <div className="flex w-full sm:w-auto items-center gap-1.5">
                        {updatingId === set.id && (
                          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
                        )}
                        <SelectNative
                          id={`quick-cond-${set.id}`}
                          value={set.condition}
                          disabled={updatingId === set.id}
                          onChange={(e) =>
                            handleQuickConditionChange(
                              set,
                              e.target.value as JerseyCondition
                            )
                          }
                          className="h-8 text-xs w-full sm:w-40"
                        >
                          {CONDITIONS.map((c) => (
                            <option key={c} value={c}>
                              {JERSEY_CONDITION_LABELS[c]}
                            </option>
                          ))}
                        </SelectNative>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isStaff && (
        <JerseySetFormDialog
          key={`js-form-${editing?.id ?? "new"}-${dialogOpen}`}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          clubId={clubId}
          activeTeamId={activeTeamId}
          activeTeamName={activeTeamName}
          initial={editing}
          onSaved={onChanged}
        />
      )}
    </div>
  );
}
