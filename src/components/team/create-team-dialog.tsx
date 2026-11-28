"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import {
  HvnbTeamPicker,
  SelectedHvnbTeam,
} from "@/components/leagues/hvnb-team-picker";
import { LeagueSelector } from "@/components/leagues/league-selector";
import { NuligaRosterImportDialog } from "@/components/team/nuliga-roster-import-dialog";
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
import { isDirectoryLinkingSupported } from "@/domain/data/federation-registry";
import {
  defaultUsesResinForAgeGroup,
  GERMAN_AGE_GROUPS,
  getAgeGroupPrefix,
  suggestTeamName,
} from "@/domain/data/german-leagues";
import type { TeamGender } from "@/domain/schemas/handball";
import type { LeagueAgeGroup, LeagueDTO } from "@/domain/schemas/league-catalog";
import type {
  NuligaRosterImportResultDTO,
  NuligaRosterPreviewResponseDTO,
} from "@/domain/schemas/member";
import type { SeasonCatalogDTO } from "@/domain/schemas/season-catalog";
import { cn } from "@/lib/utils";

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  clubName: string;
  defaultSeasonName?: string;
  onCreated?: (team: { id: string; name: string }) => Promise<void> | void;
  onSwitchToTeam?: (teamId: string) => void;
}

const GENDER_LABELS: Record<TeamGender, { adult: string; youth: string }> = {
  MALE: { adult: "Herren", youth: "Männlich" },
  FEMALE: { adult: "Damen", youth: "Weiblich" },
  MIXED: { adult: "Gemischt", youth: "Gemischt" },
};

function getQuickTeamNameSuggestions(
  ageGroup: LeagueAgeGroup,
  gender: TeamGender
): string[] {
  const base = suggestTeamName(ageGroup, gender);
  if (ageGroup === "ADULT") {
    const prefix = gender === "FEMALE" ? "Damen" : "Herren";
    return [`${prefix} 1`, `${prefix} 2`, `${prefix} 3`];
  }
  if (ageGroup === "YOUTH_F_MINI") {
    return ["Minis", "Minis 1", "F-Jugend"];
  }
  if (ageGroup === "SENIOR") {
    return [base, `${base} 2`, "Ü32-Team"];
  }
  const shortPrefix = base.replace("-Jugend", "");
  return [base, `${shortPrefix}1-Jugend`, `${shortPrefix}2-Jugend`];
}

interface CreatedTeamSummary {
  id: string;
  name: string;
  hasLeagueLink: boolean;
  leagueName: string | null;
}

export function CreateTeamDialog({
  open,
  onOpenChange,
  clubId,
  clubName,
  defaultSeasonName,
  onCreated,
  onSwitchToTeam,
}: CreateTeamDialogProps) {
  const [step, setStep] = useState<1 | 2 | "done">(1);
  const [seasons, setSeasons] = useState<SeasonCatalogDTO[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [selectedSeasonCatalogId, setSelectedSeasonCatalogId] = useState("");

  // Schritt 1: Mannschafts-Basisdaten
  const [ageGroup, setAgeGroup] = useState<LeagueAgeGroup>("ADULT");
  const [gender, setGender] = useState<TeamGender>("MALE");
  const [teamName, setTeamName] = useState("Herren 2");
  const [teamNameTouched, setTeamNameTouched] = useState(false);
  const [usesResin, setUsesResin] = useState<boolean>(() =>
    defaultUsesResinForAgeGroup("ADULT")
  );
  const [usesResinTouched, setUsesResinTouched] = useState(false);

  // Schritt 2: Liga & HVNB-Verknüpfung
  const [selectedLeague, setSelectedLeague] = useState<LeagueDTO | null>(null);
  const [selectedHvnbTeam, setSelectedHvnbTeam] =
    useState<SelectedHvnbTeam | null>(null);
  const [autoImportSchedule, setAutoImportSchedule] = useState(true);
  const [seedGroupOpponents, setSeedGroupOpponents] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schritt 3 (Erfolg + Sofort-Kaderimport)
  const [createdTeam, setCreatedTeam] = useState<CreatedTeamSummary | null>(
    null
  );
  const [rosterPreviewLoading, setRosterPreviewLoading] = useState(false);
  const [rosterPreview, setRosterPreview] =
    useState<NuligaRosterPreviewResponseDTO | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] =
    useState<NuligaRosterImportResultDTO | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/v1/seasons", { cache: "no-store" })
      .then(async (res) => {
        if (!active || !res.ok) return;
        const data = await res.json();
        const list: SeasonCatalogDTO[] = data.seasons ?? [];
        if (!active) return;
        setSeasons(list);
        setSelectedSeasonCatalogId((prev) => {
          if (prev && list.some((s) => s.id === prev)) return prev;
          const byName = defaultSeasonName
            ? list.find((s) => s.name === defaultSeasonName)
            : undefined;
          const preferred = byName ?? list.find((s) => s.isDefault) ?? list[0];
          return preferred ? preferred.id : "";
        });
      })
      .finally(() => {
        if (active) setSeasonsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, defaultSeasonName]);

  // Hintergrund-Vorschau für Spielberichte direkt nach dem Anlegen einer HVNB-verknüpften Mannschaft
  useEffect(() => {
    if (!createdTeam || !createdTeam.hasLeagueLink) return;
    let active = true;
    fetch(
      `/api/v1/teams/${encodeURIComponent(createdTeam.id)}/members/nuliga-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    )
      .then(async (res) => {
        if (!active || !res.ok) return;
        const body = (await res.json()) as NuligaRosterPreviewResponseDTO;
        if (active) setRosterPreview(body);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setRosterPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [createdTeam]);

  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === selectedSeasonCatalogId) ?? null,
    [seasons, selectedSeasonCatalogId]
  );

  const activeAgeGroupMeta = useMemo(
    () =>
      GERMAN_AGE_GROUPS.find((g) => g.value === ageGroup) ??
      GERMAN_AGE_GROUPS[0],
    [ageGroup]
  );

  const adultAgeGroups = useMemo(
    () => GERMAN_AGE_GROUPS.filter((g) => g.section === "Erwachsene"),
    []
  );
  const youthAgeGroups = useMemo(
    () => GERMAN_AGE_GROUPS.filter((g) => g.section === "Jugend"),
    []
  );
  const quickSuggestions = useMemo(
    () => getQuickTeamNameSuggestions(ageGroup, gender),
    [ageGroup, gender]
  );

  function resetFormForAnotherTeam() {
    setStep(1);
    setAgeGroup("ADULT");
    setGender("MALE");
    setTeamName("Herren 2");
    setTeamNameTouched(false);
    setUsesResin(defaultUsesResinForAgeGroup("ADULT"));
    setUsesResinTouched(false);
    setSelectedLeague(null);
    setSelectedHvnbTeam(null);
    setAutoImportSchedule(true);
    setSeedGroupOpponents(true);
    setError(null);
    setCreatedTeam(null);
    setRosterPreview(null);
    setRosterPreviewLoading(false);
    setImportResult(null);
  }

  function handleDialogOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetFormForAnotherTeam();
    }
    onOpenChange(nextOpen);
  }

  function handleSelectAgeGroup(nextAgeGroup: LeagueAgeGroup) {
    const meta =
      GERMAN_AGE_GROUPS.find((g) => g.value === nextAgeGroup) ??
      GERMAN_AGE_GROUPS[0];
    const nextGender = meta.allowedGenders.includes(gender)
      ? gender
      : meta.defaultGender;
    setAgeGroup(nextAgeGroup);
    setGender(nextGender);
    setSelectedLeague(null);
    setSelectedHvnbTeam(null);
    setError(null);
    if (!teamNameTouched) {
      setTeamName(suggestTeamName(nextAgeGroup, nextGender));
    }
    if (!usesResinTouched) {
      setUsesResin(defaultUsesResinForAgeGroup(nextAgeGroup));
    }
  }

  function handleSelectGender(nextGender: TeamGender) {
    setGender(nextGender);
    setSelectedLeague(null);
    setSelectedHvnbTeam(null);
    setError(null);
    if (!teamNameTouched) {
      setTeamName(suggestTeamName(ageGroup, nextGender));
    }
  }

  function handleGoToStep2() {
    if (teamName.trim().length < 2) {
      setError("Bitte gib einen Mannschaftsnamen ein (mind. 2 Zeichen).");
      return;
    }
    if (!selectedSeason && !defaultSeasonName) {
      setError("Bitte wähle eine Saison aus.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (teamName.trim().length < 2) {
      setError("Bitte gib einen Mannschaftsnamen ein.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const resolvedLeagueId =
        selectedLeague?.id ?? selectedHvnbTeam?.group.leagueId ?? null;
      const payload: Record<string, unknown> = {
        name: teamName.trim(),
        category: activeAgeGroupMeta.defaultCategory,
        ageGroup,
        gender,
        usesResin,
        leagueId: resolvedLeagueId,
        leagueGroupTeamId: selectedHvnbTeam?.team.id ?? null,
        autoImportSchedule,
        seedGroupOpponents,
      };
      if (selectedSeason) {
        payload.seasonCatalogId = selectedSeason.id;
        payload.seasonName = selectedSeason.name;
      } else if (defaultSeasonName) {
        payload.seasonName = defaultSeasonName;
      }

      const res = await fetch(
        `/api/v1/clubs/${encodeURIComponent(clubId)}/teams`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message ?? "Mannschaft konnte nicht angelegt werden."
        );
        return;
      }

      const created = data.team as {
        id: string;
        name: string;
        leagueName?: string | null;
        leagueGroupTeamId?: string | null;
      };
      const hasLink = Boolean(
        created.leagueGroupTeamId ?? selectedHvnbTeam?.team.id
      );

      setRosterPreview(null);
      setRosterPreviewLoading(hasLink);
      setImportResult(null);
      setCreatedTeam({
        id: created.id,
        name: created.name,
        hasLeagueLink: hasLink,
        leagueName: created.leagueName ?? selectedLeague?.displayName ?? null,
      });
      setStep("done");

      if (onCreated) {
        await onCreated({ id: created.id, name: created.name });
      }
    } catch {
      setError("Netzwerkfehler beim Anlegen der Mannschaft.");
    } finally {
      setSubmitting(false);
    }
  }

  const foundPlayersCount = rosterPreview?.players.length ?? 0;
  const foundOfficialsCount = rosterPreview?.officials.length ?? 0;

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {step === "done" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Mannschaft angelegt!
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 text-primary" />
                  Weitere Mannschaft anlegen – {clubName}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {step === 1 &&
                "Schritt 1 von 2: Altersklasse, Geschlecht, Saison und Name festlegen."}
              {step === 2 &&
                "Schritt 2 von 2: Liga & optionale HVNB/nuLiga-Staffel verknüpfen."}
              {step === "done" &&
                "Du kannst jetzt direkt den Kader aus Spielberichten übernehmen oder eine weitere Mannschaft anlegen."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              {/* Saison */}
              <div className="sm:max-w-[240px] space-y-1.5">
                <Label htmlFor="ct-season">Saison *</Label>
                {seasonsLoading ? (
                  <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Lade Saisons…
                  </div>
                ) : (
                  <SelectNative
                    id="ct-season"
                    value={selectedSeasonCatalogId}
                    onChange={(e) => setSelectedSeasonCatalogId(e.target.value)}
                  >
                    {seasons.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.isDefault ? " (Aktuell)" : ""}
                      </option>
                    ))}
                  </SelectNative>
                )}
              </div>

              {/* Altersklasse Erwachsene */}
              <div className="space-y-2">
                <Label>Erwachsene</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {adultAgeGroups.map((item) => {
                    const active = ageGroup === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleSelectAgeGroup(item.value)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer",
                          active
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
                        )}
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.subtitle}
                          </p>
                        </div>
                        {active && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Altersklasse Jugend */}
              <div className="space-y-2">
                <Label>Jugend</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {youthAgeGroups.map((item) => {
                    const active = ageGroup === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => handleSelectAgeGroup(item.value)}
                        className={cn(
                          "flex flex-col rounded-xl border px-3 py-2 text-left transition-all cursor-pointer",
                          active
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-sm font-semibold text-foreground">
                            {item.shortLabel}
                          </span>
                          {active && (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {item.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Geschlecht */}
              <div className="space-y-2">
                <Label>Geschlecht</Label>
                <div
                  className={cn(
                    "grid gap-2",
                    activeAgeGroupMeta.allowedGenders.length === 1
                      ? "grid-cols-1"
                      : activeAgeGroupMeta.allowedGenders.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3"
                  )}
                >
                  {activeAgeGroupMeta.allowedGenders.map((g) => {
                    const active = gender === g;
                    const label =
                      ageGroup === "ADULT"
                        ? GENDER_LABELS[g].adult
                        : GENDER_LABELS[g].youth;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleSelectGender(g)}
                        className={cn(
                          "flex h-10 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all cursor-pointer",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground hover:border-primary/50"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mannschaftsname */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="ct-team-name">Mannschaftsname *</Label>
                <Input
                  id="ct-team-name"
                  required
                  placeholder="z. B. Herren 2 oder wC-Jugend"
                  value={teamName}
                  onChange={(e) => {
                    setTeamName(e.target.value);
                    setTeamNameTouched(true);
                  }}
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    Vorschläge:
                  </span>
                  {quickSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setTeamName(s);
                        setTeamNameTouched(true);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                        teamName === s
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Harz */}
              <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={usesResin}
                  onChange={(e) => {
                    setUsesResin(e.target.checked);
                    setUsesResinTouched(true);
                  }}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="font-semibold text-foreground block">
                    Diese Mannschaft spielt mit Harz (Backe)
                  </span>
                  <span className="text-muted-foreground">
                    Kann jederzeit auf der Kader-Seite umgeschaltet werden.
                  </span>
                </span>
              </label>

              <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <Button type="button" onClick={handleGoToStep2}>
                  Weiter zur Liga-Auswahl
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!selectedHvnbTeam && (
                <HvnbTeamPicker
                  suggestionsOnly
                  clubName={clubName}
                  seasonName={selectedSeason?.name ?? defaultSeasonName}
                  ageGroup={ageGroup}
                  gender={gender}
                  selected={selectedHvnbTeam}
                  onSelect={(selection) => {
                    setSelectedHvnbTeam(selection);
                    setError(null);
                  }}
                  autoImportSchedule={autoImportSchedule}
                  onAutoImportScheduleChange={setAutoImportSchedule}
                  seedGroupOpponents={seedGroupOpponents}
                  onSeedGroupOpponentsChange={setSeedGroupOpponents}
                />
              )}

              {!selectedHvnbTeam && (
                <LeagueSelector
                  ageGroup={ageGroup}
                  gender={gender}
                  selectedLeague={selectedLeague}
                  onSelect={(league) => {
                    setSelectedLeague(league);
                    setSelectedHvnbTeam(null);
                    setError(null);
                  }}
                />
              )}

              {(selectedHvnbTeam ||
                isDirectoryLinkingSupported(
                  selectedLeague?.federationCode
                )) && (
                <HvnbTeamPicker
                  federationCode={selectedLeague?.federationCode ?? null}
                  clubName={clubName}
                  seasonName={selectedSeason?.name ?? defaultSeasonName}
                  ageGroup={ageGroup}
                  gender={gender}
                  leagueId={selectedLeague?.id ?? null}
                  selected={selectedHvnbTeam}
                  onSelect={(selection) => {
                    setSelectedHvnbTeam(selection);
                    setError(null);
                  }}
                  autoImportSchedule={autoImportSchedule}
                  onAutoImportScheduleChange={setAutoImportSchedule}
                  seedGroupOpponents={seedGroupOpponents}
                  onSeedGroupOpponentsChange={setSeedGroupOpponents}
                />
              )}

              <div className="rounded-xl border border-border bg-muted/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <Trophy className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-foreground break-words">
                    {teamName}
                  </span>
                  <Badge variant="outline" className="text-[11px]">
                    {getAgeGroupPrefix(ageGroup, gender)}
                  </Badge>
                  <span className="text-muted-foreground">
                    · Saison {selectedSeason?.name ?? defaultSeasonName}
                  </span>
                </div>
                <span className="text-muted-foreground break-words">
                  {selectedHvnbTeam
                    ? selectedHvnbTeam.group.name
                    : selectedLeague
                      ? selectedLeague.displayName
                      : "Ohne Liga-Verknüpfung (später ergänzbar)"}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Zurück
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Mannschaft anlegen
                </Button>
              </div>
            </form>
          )}

          {step === "done" && createdTeam && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/35">
                <p className="text-sm font-bold text-foreground">
                  {createdTeam.name} ({clubName}) ist startklar!
                </p>
                {createdTeam.leagueName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Liga: {createdTeam.leagueName}
                  </p>
                )}
              </div>

              {/* Direkter Kader-Import aus Spielberichten */}
              {importResult ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {importResult.createdCount}{" "}
                      {importResult.createdCount === 1 ? "Person" : "Personen"}{" "}
                      in den Kader übernommen!
                    </p>
                    <p className="text-xs opacity-90 mt-0.5">
                      Du kannst jetzt im Kader den Team-Einladungslink teilen –
                      beim Beitritt werden die Profile automatisch verknüpft.
                    </p>
                  </div>
                </div>
              ) : rosterPreviewLoading ? (
                <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-center gap-2.5 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  <span>
                    Suche Spieler &amp; Offizielle in den letzten
                    nuLiga-Spielberichten…
                  </span>
                </div>
              ) : foundPlayersCount > 0 || foundOfficialsCount > 0 ? (
                <div className="rounded-xl border border-primary/35 bg-primary/5 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-foreground">
                        {foundPlayersCount} Spieler
                        {foundOfficialsCount > 0
                          ? ` & ${foundOfficialsCount} Offizielle`
                          : ""}{" "}
                        in den letzten {rosterPreview?.reportsAnalyzed ?? 0}{" "}
                        Spielberichten gefunden
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Übernehme deinen Kader mit Trikotnummern in einem Schritt
                        – kein manuelles Abtippen nötig.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <Download className="h-4 w-4" />
                    Kader aus Spielberichten übernehmen
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <p className="font-semibold text-foreground">
                      Kader aus nuLiga-Spielberichten übernehmen
                    </p>
                    <p className="mt-0.5">
                      {rosterPreview?.warning ??
                        "Falls Spielberichte in nuLiga (z. B. aus einem anderen Verband oder der Vorsaison) vorliegen, kannst du sie hier per URL importieren."}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setImportDialogOpen(true)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    nuLiga-Import öffnen
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetFormForAnotherTeam}
                >
                  <Plus className="h-4 w-4" />
                  Weitere Mannschaft anlegen
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleDialogOpenChange(false)}
                  >
                    Schließen
                  </Button>
                  {onSwitchToTeam && (
                    <Button
                      type="button"
                      onClick={() => {
                        const targetId = createdTeam.id;
                        handleDialogOpenChange(false);
                        onSwitchToTeam(targetId);
                      }}
                    >
                      Zu {createdTeam.name} wechseln
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {createdTeam && (
        <NuligaRosterImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          teamId={createdTeam.id}
          teamName={createdTeam.name}
          initialPreview={rosterPreview}
          onImported={(res) => {
            setImportResult(res);
          }}
        />
      )}
    </>
  );
}
