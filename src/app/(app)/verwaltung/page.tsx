"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Shield,
  Star,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
import { CreateTeamDialog } from "@/components/team/create-team-dialog";
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
import type { ClubDTO, TeamDTO } from "@/domain/schemas/club";
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
  const router = useRouter();
  const { activeTeam, setActiveTeamId, refreshMe } = useAppContext();
  const isAdmin = Boolean(activeTeam?.isClubAdmin);
  const clubId = activeTeam?.clubId ?? null;

  const [seasons, setSeasons] = useState<SeasonCatalogDTO[]>([]);
  const [clubInfo, setClubInfo] = useState<ClubDTO | null>(null);
  const [clubTeams, setClubTeams] = useState<TeamDTO[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Vereinslogo-State
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [logoBusy, setLogoBusy] = useState<
    "upload" | "nuliga" | "remove" | null
  >(null);
  const [nuligaSearchName, setNuligaSearchName] = useState("");
  const [showNuligaSearch, setShowNuligaSearch] = useState(false);

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

  const fetchClubTeams = useCallback(async () => {
    if (!isAdmin || !clubId) return;
    try {
      const res = await fetch(`/api/v1/clubs/${encodeURIComponent(clubId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setClubInfo(data.club ?? null);
        setClubTeams(data.teams ?? []);
      }
    } finally {
      setLoadingTeams(false);
    }
  }, [isAdmin, clubId]);

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

    if (clubId) {
      fetch(`/api/v1/clubs/${encodeURIComponent(clubId)}`, {
        cache: "no-store",
      })
        .then(async (res) => {
          if (!active || !res.ok) return;
          const data = await res.json();
          if (active) {
            setClubInfo(data.club ?? null);
            setClubTeams(data.teams ?? []);
            if (data.club?.name) {
              setNuligaSearchName((prev) => prev || data.club.name);
            }
          }
        })
        .finally(() => {
          if (active) setLoadingTeams(false);
        });
    }

    return () => {
      active = false;
    };
  }, [isAdmin, clubId]);

  async function handleLogoFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !clubId) return;

    setError(null);
    setNotice(null);

    if (file.size > 2 * 1024 * 1024) {
      setError("Das Vereinslogo darf maximal 2 MB groß sein.");
      return;
    }

    setLogoBusy("upload");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(
        `/api/v1/clubs/${encodeURIComponent(clubId)}/logo`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Vereinslogo konnte nicht hochgeladen werden."
        );
        return;
      }
      setClubInfo(data.club ?? null);
      setNotice("Vereinslogo wurde erfolgreich gespeichert.");
      await refreshMe();
    } catch {
      setError("Netzwerkfehler beim Hochladen des Vereinslogos.");
    } finally {
      setLogoBusy(null);
    }
  }

  async function handleImportLogoFromNuliga(customSearchName?: string) {
    if (!clubId) return;
    setError(null);
    setNotice(null);
    setLogoBusy("nuliga");
    try {
      const trimmed = customSearchName?.trim();
      const res = await fetch(
        `/api/v1/clubs/${encodeURIComponent(clubId)}/logo/nuliga`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(trimmed ? { searchName: trimmed } : {}),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message ||
            "Vereinslogo konnte nicht aus nuLiga geladen werden."
        );
        setShowNuligaSearch(true);
        return;
      }
      setClubInfo(data.club ?? null);
      setShowNuligaSearch(false);
      setNotice(
        data.matchedClubName
          ? `Vereinslogo für „${data.matchedClubName}“ wurde aus nuLiga übernommen.`
          : "Vereinslogo wurde aus nuLiga übernommen."
      );
      await refreshMe();
    } catch {
      setError("Netzwerkfehler beim nuLiga-Abruf.");
    } finally {
      setLogoBusy(null);
    }
  }

  async function handleRemoveLogo() {
    if (!clubId) return;
    setError(null);
    setNotice(null);
    setLogoBusy("remove");
    try {
      const res = await fetch(
        `/api/v1/clubs/${encodeURIComponent(clubId)}/logo`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Vereinslogo konnte nicht entfernt werden."
        );
        return;
      }
      setClubInfo(data.club ?? null);
      setNotice("Vereinslogo wurde entfernt.");
      await refreshMe();
    } catch {
      setError("Netzwerkfehler beim Entfernen des Vereinslogos.");
    } finally {
      setLogoBusy(null);
    }
  }

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
            Vereins- &amp; Saison-Verwaltung
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege weitere Mannschaften in deinem Verein an und pflege die
            verfügbaren Spielzeiten.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTeam && (
            <Button type="button" onClick={() => setCreateTeamOpen(true)}>
              <Plus className="h-4 w-4" />
              Weitere Mannschaft anlegen
            </Button>
          )}
          <Button type="button" variant="outline" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Neue Saison anlegen
          </Button>
        </div>
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

      {/* Vereinslogo (nur Vereins-Admins) */}
      {activeTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ImageIcon className="h-4 w-4 text-primary" />
              Vereinslogo · {clubInfo?.name ?? activeTeam.clubName}
            </CardTitle>
            <CardDescription>
              Das Vereinswappen erscheint im Dashboard, in der Navigation und auf
              Einladungsseiten. Nur Vereins-Admins können das Logo ändern.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-border bg-white p-2 shadow-xs">
                {(clubInfo?.logoUrl ?? activeTeam.clubLogoUrl) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={clubInfo?.logoUrl ?? activeTeam.clubLogoUrl ?? ""}
                    alt={`Vereinslogo ${clubInfo?.name ?? activeTeam.clubName}`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Shield className="h-9 w-9 text-muted-foreground/50" />
                )}
              </div>

              <div className="flex-1 space-y-2.5">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  aria-label="Vereinslogo hochladen"
                  onChange={handleLogoFileChange}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={logoBusy !== null}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {logoBusy === "upload" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Eigenes Logo hochladen
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={logoBusy !== null}
                    onClick={() => void handleImportLogoFromNuliga()}
                  >
                    {logoBusy === "nuliga" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Aus nuLiga laden
                  </Button>
                  {(clubInfo?.logoUrl ?? activeTeam.clubLogoUrl) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/50"
                      disabled={logoBusy !== null}
                      onClick={() => void handleRemoveLogo()}
                    >
                      {logoBusy === "remove" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Entfernen
                    </Button>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  Unterstützt PNG, JPG, WebP oder GIF (max. 2 MB). Trainer
                  können unter{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/team")}
                    className="font-medium text-primary hover:underline"
                  >
                    Team → Kader
                  </button>{" "}
                  zusätzlich die Vereins-Admin-Rolle in Personalunion erhalten.
                </p>
              </div>
            </div>

            {showNuligaSearch && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleImportLogoFromNuliga(nuligaSearchName);
                }}
                className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1 space-y-1">
                  <Label htmlFor="nuliga-logo-search" className="text-xs">
                    Abweichender Vereinsname bei nuLiga
                  </Label>
                  <Input
                    id="nuliga-logo-search"
                    value={nuligaSearchName}
                    onChange={(e) => setNuligaSearchName(e.target.value)}
                    placeholder="z. B. TuS Jahn Hollenstedt"
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={logoBusy !== null || nuligaSearchName.trim().length < 2}
                >
                  {logoBusy === "nuliga" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Erneut suchen
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mannschaften im Verein */}
      {activeTeam && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />
                Mannschaften · {activeTeam.clubName} ({clubTeams.length})
              </CardTitle>
              <CardDescription>
                Füge weitere Mannschaften hinzu und übernehme deren Kader direkt
                aus nuLiga-Spielberichten.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setCreateTeamOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Mannschaft hinzufügen
            </Button>
          </CardHeader>
          <CardContent>
            {loadingTeams ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Lade Mannschaften…
              </div>
            ) : clubTeams.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Noch keine Mannschaften gefunden.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {clubTeams.map((team) => {
                  const isCurrent = team.id === activeTeam.teamId;
                  return (
                    <div
                      key={team.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-foreground">
                            {team.name}
                          </span>
                          {team.seasonName && (
                            <Badge variant="outline" className="text-[11px]">
                              {team.seasonName}
                            </Badge>
                          )}
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[11px]">
                              Aktiv
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {team.leagueName ?? "Ohne Liga-Verknüpfung"}
                          {typeof team.memberCount === "number"
                            ? ` · ${team.memberCount} ${team.memberCount === 1 ? "Mitglied" : "Mitglieder"}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveTeamId(team.id);
                          router.push("/team");
                        }}
                        className="self-start sm:self-center shrink-0"
                      >
                        Zum Kader
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
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

            <div className="flex flex-wrap justify-end gap-2 pt-2">
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

      {activeTeam && (
        <CreateTeamDialog
          open={createTeamOpen}
          onOpenChange={setCreateTeamOpen}
          clubId={activeTeam.clubId}
          clubName={activeTeam.clubName}
          defaultSeasonName={activeTeam.seasonName}
          onCreated={async (created) => {
            setNotice(`Mannschaft „${created.name}“ wurde angelegt.`);
            await Promise.all([fetchClubTeams(), refreshMe()]);
          }}
          onSwitchToTeam={(teamId) => {
            setActiveTeamId(teamId);
            router.push("/team");
          }}
        />
      )}
    </div>
  );
}
