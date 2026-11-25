"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
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
import type { SeasonCatalogDTO } from "@/domain/schemas/season-catalog";
import { cn } from "@/lib/utils";

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatGermanDate(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

interface SeasonFormState {
  name: string;
  startDate: string;
  endDate: string;
  sortOrder: string;
  isActive: boolean;
  isDefault: boolean;
}

export default function AdminSeasonsPage() {
  const { activeTeam } = useAppContext();
  const isAdmin = Boolean(activeTeam?.isClubAdmin);

  const [seasons, setSeasons] = useState<SeasonCatalogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<SeasonCatalogDTO | null>(
    null
  );
  const [form, setForm] = useState<SeasonFormState>({
    name: "",
    startDate: "",
    endDate: "",
    sortOrder: "60",
    isActive: true,
    isDefault: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(
    () => seasons.filter((s) => s.isActive).length,
    [seasons]
  );

  const nextSortOrder = useMemo(() => {
    if (seasons.length === 0) return 10;
    const maxOrder = Math.max(...seasons.map((s) => s.sortOrder));
    return maxOrder + 10;
  }, [seasons]);

  const fetchSeasons = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/v1/seasons?includeInactive=true", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Saison-Katalog konnte nicht geladen werden."
        );
        return;
      }
      setError(null);
      setSeasons(data.seasons ?? []);
    } catch {
      setError("Netzwerkfehler beim Laden des Saison-Katalogs.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    fetch("/api/v1/seasons?includeInactive=true", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(
            data?.error?.message ||
              "Saison-Katalog konnte nicht geladen werden."
          );
          return;
        }
        setError(null);
        setSeasons(data.seasons ?? []);
      })
      .catch(() => {
        if (active) {
          setError("Netzwerkfehler beim Laden des Saison-Katalogs.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isAdmin]);

  function openCreateDialog() {
    setEditingSeason(null);
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      sortOrder: String(nextSortOrder),
      isActive: true,
      isDefault: seasons.length === 0,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(season: SeasonCatalogDTO) {
    setEditingSeason(season);
    setForm({
      name: season.name,
      startDate: toDateInputValue(season.startDate),
      endDate: toDateInputValue(season.endDate),
      sortOrder: String(season.sortOrder),
      isActive: season.isActive,
      isDefault: season.isDefault,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSaveSeason(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    if (form.name.trim().length < 3) {
      setFormError(
        "Bitte gib einen Saisonnamen mit mindestens 3 Zeichen ein (z. B. 2029/30)."
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
        isActive: form.isDefault ? true : form.isActive,
        isDefault: form.isDefault,
      };

      const url = editingSeason
        ? `/api/v1/seasons/${encodeURIComponent(editingSeason.id)}`
        : "/api/v1/seasons";
      const method = editingSeason ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(
          data?.error?.message || "Saison konnte nicht gespeichert werden."
        );
        return;
      }

      setDialogOpen(false);
      setNotice(
        editingSeason
          ? `Saison „${payload.name}“ wurde aktualisiert.`
          : `Saison „${payload.name}“ wurde angelegt.`
      );
      await fetchSeasons();
    } catch {
      setFormError("Netzwerkfehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetDefault(season: SeasonCatalogDTO) {
    setBusyId(season.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/v1/seasons/${encodeURIComponent(season.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDefault: true, isActive: true }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message ||
            "Standard-Saison konnte nicht aktualisiert werden."
        );
        return;
      }
      setNotice(
        `„${season.name}“ ist jetzt die vorausgewählte Standard-Saison.`
      );
      await fetchSeasons();
    } catch {
      setError("Netzwerkfehler beim Aktualisieren.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(season: SeasonCatalogDTO) {
    setBusyId(season.id);
    setError(null);
    setNotice(null);
    try {
      const nextActive = !season.isActive;
      const res = await fetch(
        `/api/v1/seasons/${encodeURIComponent(season.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive: nextActive,
            ...(nextActive ? {} : { isDefault: false }),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Status konnte nicht geändert werden."
        );
        return;
      }
      setNotice(
        nextActive
          ? `Saison „${season.name}“ wurde aktiviert.`
          : `Saison „${season.name}“ wurde deaktiviert.`
      );
      await fetchSeasons();
    } catch {
      setError("Netzwerkfehler beim Ändern des Status.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(season: SeasonCatalogDTO) {
    const confirmed = window.confirm(
      `Saison „${season.name}“ wirklich aus dem Auswahl-Katalog entfernen? Bereits angelegte Mannschaften bleiben unverändert.`
    );
    if (!confirmed) return;

    setBusyId(season.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        `/api/v1/seasons/${encodeURIComponent(season.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Saison konnte nicht gelöscht werden."
        );
        return;
      }
      setNotice(`Saison „${season.name}“ wurde gelöscht.`);
      await fetchSeasons();
    } catch {
      setError("Netzwerkfehler beim Löschen.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <Card className="max-w-lg mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Kein Zugriff
          </CardTitle>
          <CardDescription>
            Die Pflege der Saisons steht ausschließlich Vereins-Admins zur
            Verfügung.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Saison-Verwaltung
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pflege hier die verfügbaren Spielzeiten für das Auswahl-Feld bei der
            Registrierung neuer Mannschaften.
          </p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          Neue Saison anlegen
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4 text-primary" />
            Saison-Katalog ({seasons.length})
          </CardTitle>
          <CardDescription>
            Aktive Saisons erscheinen im Auswahl-Feld der Registrierung. Die als
            „Standard“ markierte Saison wird automatisch vorausgewählt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Saisons…
            </div>
          ) : seasons.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Noch keine Saisons angelegt. Erstelle jetzt die erste Saison.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {seasons.map((season) => {
                const startFormatted = formatGermanDate(season.startDate);
                const endFormatted = formatGermanDate(season.endDate);
                const isLastActive = season.isActive && activeCount <= 1;
                const isBusy = busyId === season.id;

                return (
                  <div
                    key={season.id}
                    className={cn(
                      "flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                      !season.isActive && "opacity-65"
                    )}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-bold text-foreground">
                          {season.name}
                        </span>
                        {season.isDefault && (
                          <Badge className="gap-1">
                            <Star className="h-3 w-3" />
                            Standard
                          </Badge>
                        )}
                        <Badge
                          variant={season.isActive ? "secondary" : "outline"}
                        >
                          {season.isActive ? "Aktiv" : "Inaktiv"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        {startFormatted || endFormatted ? (
                          <span>
                            Zeitraum: {startFormatted ?? "–"} bis{" "}
                            {endFormatted ?? "–"}
                          </span>
                        ) : (
                          <span>Kein fester Zeitraum hinterlegt</span>
                        )}
                        <span>·</span>
                        <span>Sortierung: {season.sortOrder}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {!season.isDefault && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => void handleSetDefault(season)}
                        >
                          <Star className="h-3.5 w-3.5" />
                          Als Standard
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy || isLastActive}
                        title={
                          isLastActive
                            ? "Mindestens eine Saison muss aktiv bleiben"
                            : season.isActive
                              ? "Deaktivieren"
                              : "Aktivieren"
                        }
                        onClick={() => void handleToggleActive(season)}
                      >
                        {season.isActive ? (
                          <>
                            <EyeOff className="h-3.5 w-3.5" />
                            Deaktivieren
                          </>
                        ) : (
                          <>
                            <Eye className="h-3.5 w-3.5" />
                            Aktivieren
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isBusy}
                        onClick={() => openEditDialog(season)}
                        aria-label={`Saison ${season.name} bearbeiten`}
                        title="Bearbeiten"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={isBusy || isLastActive}
                        onClick={() => void handleDelete(season)}
                        aria-label={`Saison ${season.name} löschen`}
                        title={
                          isLastActive
                            ? "Die letzte aktive Saison kann nicht gelöscht werden"
                            : "Löschen"
                        }
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anlegen / Bearbeiten Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSeason ? "Saison bearbeiten" : "Neue Saison anlegen"}
            </DialogTitle>
            <DialogDescription>
              Saisons im Katalog stehen bei der Registrierung neuer Mannschaften
              im Auswahl-Feld zur Verfügung.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSeason} className="space-y-4">
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
              >
                {formError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="season-name">Saisonname *</Label>
              <Input
                id="season-name"
                required
                placeholder="z. B. 2029/30"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="season-start">Startdatum</Label>
                <Input
                  id="season-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, startDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="season-end">Enddatum</Label>
                <Input
                  id="season-end"
                  type="date"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, endDate: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="sm:max-w-[180px] space-y-1.5">
              <Label htmlFor="season-sort">Sortierung</Label>
              <Input
                id="season-sort"
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, sortOrder: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2.5 pt-2 border-t border-border">
              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={form.isDefault ? true : form.isActive}
                  disabled={form.isDefault}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                />
                <span>Aktiv (im Auswahl-Feld bei der Registrierung sichtbar)</span>
              </label>

              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isDefault: e.target.checked,
                      isActive: e.target.checked ? true : prev.isActive,
                    }))
                  }
                />
                <span>Als Standard-Saison automatisch vorauswählen</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingSeason ? "Änderungen speichern" : "Saison anlegen"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
