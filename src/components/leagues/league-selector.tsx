"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Globe2,
  Loader2,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAgeGroupPrefix } from "@/domain/data/german-leagues";
import { TeamGender } from "@/domain/schemas/handball";
import {
  LeagueAgeGroup,
  LeagueCatalogResponseDTO,
  LeagueDTO,
  LeagueFederationSummaryDTO,
} from "@/domain/schemas/league-catalog";
import { cn } from "@/lib/utils";

interface LeagueSelectorProps {
  ageGroup: LeagueAgeGroup;
  gender: TeamGender;
  selectedLeague: LeagueDTO | null;
  onSelect: (league: LeagueDTO | null) => void;
}

function getTierLabel(tier: number, isNational: boolean): string {
  if (isNational) return "Bundesebene";
  if (tier <= 5) return "Regionalliga / Oberliga";
  if (tier <= 7) return "Verbands- / Landesebene";
  if (tier <= 9) return "Bezirks- / Regionsebene";
  return "Kreis- / Spielbetrieb";
}

export function LeagueSelector({
  ageGroup,
  gender,
  selectedLeague,
  onSelect,
}: LeagueSelectorProps) {
  const queryKey = `${ageGroup}:${gender}`;
  const [fetchState, setFetchState] = useState<{
    queryKey: string | null;
    catalog: LeagueCatalogResponseDTO | null;
    error: string | null;
  }>({
    queryKey: null,
    catalog: null,
    error: null,
  });

  const [selectedFederationCode, setSelectedFederationCode] = useState<
    string | null
  >(selectedLeague?.federationCode ?? null);
  const [federationSearch, setFederationSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      countryCode: "DE",
      ageGroup,
      gender,
    });

    fetch(`/api/v1/leagues?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error?.message || "Liga-Katalog konnte nicht geladen werden."
          );
        }
        return data as LeagueCatalogResponseDTO;
      })
      .then((data) => {
        if (cancelled) return;
        setFetchState({ queryKey, catalog: data, error: null });
        if (
          selectedLeague &&
          !data.leagues.some((l) => l.id === selectedLeague.id)
        ) {
          onSelect(null);
        }
        if (
          selectedFederationCode &&
          !data.federations.some((f) => f.code === selectedFederationCode)
        ) {
          setSelectedFederationCode(null);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchState({
          queryKey,
          catalog: null,
          error:
            err instanceof Error
              ? err.message
              : "Netzwerkfehler beim Laden der Ligen.",
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroup, gender, queryKey]);

  const loading = fetchState.queryKey !== queryKey;
  const catalog = fetchState.queryKey === queryKey ? fetchState.catalog : null;
  const loadError = fetchState.queryKey === queryKey ? fetchState.error : null;

  const contextLabel = getAgeGroupPrefix(ageGroup, gender);

  const filteredFederations = useMemo(() => {
    if (!catalog) return [];
    const q = federationSearch.trim().toLowerCase();
    if (!q) return catalog.federations;
    return catalog.federations.filter((fed) => {
      const haystack = [
        fed.code,
        fed.name,
        fed.regionLabel,
        ...fed.searchKeywords,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [catalog, federationSearch]);

  const nationalFederation = useMemo(
    () => filteredFederations.find((f) => f.isNational) ?? null,
    [filteredFederations]
  );

  const regionalFederations = useMemo(
    () => filteredFederations.filter((f) => !f.isNational),
    [filteredFederations]
  );

  const activeFederation: LeagueFederationSummaryDTO | null = useMemo(() => {
    if (!catalog || !selectedFederationCode) return null;
    return (
      catalog.federations.find((f) => f.code === selectedFederationCode) ?? null
    );
  }, [catalog, selectedFederationCode]);

  const leaguesInFederation = useMemo(() => {
    if (!catalog || !selectedFederationCode) return [];
    return catalog.leagues.filter(
      (l) => l.federationCode === selectedFederationCode
    );
  }, [catalog, selectedFederationCode]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/30 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Lade deutsche Handballligen für {contextLabel}…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
      >
        {loadError}
      </div>
    );
  }

  if (!catalog || catalog.federations.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-semibold">
          Für {contextLabel} sind noch keine Ligen in der Datenbank hinterlegt.
        </p>
        <p className="mt-1 text-xs opacity-90">
          Führe den Liga-Import für Deutschland aus:{" "}
          <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono dark:bg-white/10">
            npm run db:import-leagues:de
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Kontext-Zeile: Land + Altersklasse */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <Globe2 className="h-4 w-4 text-primary" />
          <span className="font-semibold">Deutschland</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">DHB & Landesverbände</span>
        </div>
        <Badge variant="secondary">{contextLabel}</Badge>
      </div>

      {/* Bestätigung der aktuell gewählten Liga */}
      {selectedLeague && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">
                Ausgewählte Spielklasse
              </p>
              <p className="truncate text-sm font-bold text-foreground">
                {selectedLeague.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedLeague.federationName} · {contextLabel}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect(null);
              setSelectedFederationCode(null);
            }}
            className="shrink-0 text-xs"
          >
            Ändern
          </Button>
        </div>
      )}

      {/* Stufe A: Verband auswählen */}
      {!activeFederation ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              1. Verband / Bundesland wählen
            </p>
            <span className="text-xs text-muted-foreground">
              {filteredFederations.length}{" "}
              {filteredFederations.length === 1 ? "Verband" : "Verbände"}
            </span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Verband, Bundesland oder Stadt suchen (z. B. Bayern, NRW, Hannover)…"
              value={federationSearch}
              onChange={(e) => setFederationSearch(e.target.value)}
              className="pl-9 pr-9"
              aria-label="Verband suchen"
            />
            {federationSearch && (
              <button
                type="button"
                onClick={() => setFederationSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Suche leeren"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {filteredFederations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
              Kein Verband für „{federationSearch}“ gefunden.
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bundesebene (DHB) hervorgehoben, wenn für Altersklasse vorhanden */}
              {nationalFederation && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedFederationCode(nationalFederation.code)
                  }
                  className="group flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-left transition-all hover:border-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {nationalFederation.name}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {nationalFederation.regionLabel}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="default">
                      {nationalFederation.leagueCount} Ligen
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                </button>
              )}

              {/* Landesverbände im kompakten 2-Spalten-Raster */}
              {regionalFederations.length > 0 && (
                <div className="grid max-h-[300px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {regionalFederations.map((fed) => (
                    <button
                      key={fed.code}
                      type="button"
                      onClick={() => setSelectedFederationCode(fed.code)}
                      className="group flex items-center justify-between gap-2.5 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-foreground">
                            {fed.code}
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {fed.name}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {fed.regionLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-medium text-muted-foreground">
                          {fed.leagueCount}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Stufe B: Spielklasse im gewählten Verband */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSelectedFederationCode(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Verband wechseln
            </button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">
                {activeFederation.name}
              </span>
            </div>
          </div>

          <p className="text-sm font-semibold text-foreground">
            2. Spielklasse / Liga auswählen ({leaguesInFederation.length})
          </p>

          <div className="grid gap-2">
            {leaguesInFederation.map((league) => {
              const isSelected = selectedLeague?.id === league.id;
              return (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => onSelect(league)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/60 hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "inline-flex min-w-14 shrink-0 items-center justify-center rounded-md px-2 py-1 font-mono text-xs font-bold",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {league.shortName || `L${league.tier}`}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {league.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getTierLabel(league.tier, activeFederation.isNational)}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background"
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
