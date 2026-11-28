"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFederationConfig } from "@/domain/data/federation-registry";
import { TeamGender } from "@/domain/schemas/handball";
import { LEAGUE_PROVIDER_LABELS } from "@/domain/schemas/league";
import { LeagueAgeGroup } from "@/domain/schemas/league-catalog";
import {
  LeagueDirectorySearchResponseDTO,
  LeagueGroupDTO,
  LeagueGroupTeamDTO,
} from "@/domain/schemas/league-directory";
import { cn } from "@/lib/utils";

export interface SelectedDirectoryTeam {
  team: LeagueGroupTeamDTO;
  group: Omit<LeagueGroupDTO, "teams">;
  opponentCount: number;
}

export type SelectedHvnbTeam = SelectedDirectoryTeam;

export interface LeagueDirectoryTeamPickerProps {
  countryCode?: string;
  /** Optional: auf einen bestimmten Landesverband filtern (z. B. "HVNB", "BHV", "HHV", "OEHB"). */
  federationCode?: string | null;
  clubName?: string;
  seasonName?: string;
  ageGroup?: LeagueAgeGroup;
  gender?: TeamGender;
  leagueId?: string | null;
  selected: SelectedDirectoryTeam | null;
  onSelect: (selection: SelectedDirectoryTeam | null) => void;
  autoImportSchedule: boolean;
  onAutoImportScheduleChange: (value: boolean) => void;
  seedGroupOpponents: boolean;
  onSeedGroupOpponentsChange: (value: boolean) => void;
  /** Kompakte Variante für den Auto-Suggest-Bereich im Onboarding (zeigt nur Treffer, wenn vorhanden) */
  suggestionsOnly?: boolean;
}

export function LeagueDirectoryTeamPicker({
  countryCode = "DE",
  federationCode,
  clubName,
  seasonName,
  ageGroup,
  gender,
  leagueId,
  selected,
  onSelect,
  autoImportSchedule,
  onAutoImportScheduleChange,
  seedGroupOpponents,
  onSeedGroupOpponentsChange,
  suggestionsOnly = false,
}: LeagueDirectoryTeamPickerProps) {
  const normalizedFederation = federationCode?.trim().toUpperCase() || null;
  const federationMeta = getFederationConfig(normalizedFederation);
  const queryKey = `${countryCode}|${normalizedFederation ?? "ALL"}|${clubName ?? ""}|${seasonName ?? ""}|${ageGroup ?? ""}|${gender ?? ""}|${leagueId ?? ""}`;
  const [fetchState, setFetchState] = useState<{
    queryKey: string | null;
    data: LeagueDirectorySearchResponseDTO | null;
    error: string | null;
  }>({
    queryKey: null,
    data: null,
    error: null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFederationFilter, setSelectedFederationFilter] = useState<
    string | null
  >(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ countryCode });
    if (normalizedFederation) params.set("federationCode", normalizedFederation);
    if (seasonName?.trim()) params.set("seasonName", seasonName.trim());
    if (ageGroup) params.set("ageGroup", ageGroup);
    if (gender) params.set("gender", gender);
    if (leagueId) params.set("leagueId", leagueId);
    if (clubName?.trim()) params.set("clubName", clubName.trim());

    fetch(`/api/v1/league-directory/search?${params.toString()}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json?.error?.message ||
              "Liga-Verzeichnis konnte nicht geladen werden."
          );
        }
        return json as LeagueDirectorySearchResponseDTO;
      })
      .then((result) => {
        if (cancelled) return;
        setFetchState({ queryKey, data: result, error: null });
        if (result.groups.length === 1) {
          setExpandedGroupId(result.groups[0].id);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchState({
          queryKey,
          data: null,
          error:
            err instanceof Error
              ? err.message
              : "Fehler beim Laden des Liga-Verzeichnisses.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    countryCode,
    normalizedFederation,
    clubName,
    seasonName,
    ageGroup,
    gender,
    leagueId,
    queryKey,
  ]);

  const loading = fetchState.queryKey !== queryKey;
  const data = fetchState.queryKey === queryKey ? fetchState.data : null;
  const error = fetchState.queryKey === queryKey ? fetchState.error : null;

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const q = searchQuery.trim().toLowerCase();
    return data.groups.filter((g) => {
      if (
        !normalizedFederation &&
        selectedFederationFilter &&
        g.federationCode !== selectedFederationFilter
      ) {
        return false;
      }
      if (selectedRegion && g.regionCode !== selectedRegion) return false;
      if (!q) return true;
      const inGroup =
        g.name.toLowerCase().includes(q) ||
        g.regionName.toLowerCase().includes(q) ||
        g.federationCode.toLowerCase().includes(q) ||
        (g.shortName?.toLowerCase().includes(q) ?? false);
      if (inGroup) return true;
      return g.teams.some(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.clubName.toLowerCase().includes(q)
      );
    });
  }, [
    data,
    searchQuery,
    selectedRegion,
    normalizedFederation,
    selectedFederationFilter,
  ]);

  const visibleRegions = useMemo(() => {
    if (!data) return [];
    if (!selectedFederationFilter || normalizedFederation) return data.regions;
    const map = new Map<string, { name: string; count: number }>();
    for (const g of data.groups) {
      if (g.federationCode !== selectedFederationFilter) continue;
      const existing = map.get(g.regionCode);
      if (existing) existing.count += 1;
      else map.set(g.regionCode, { name: g.regionName, count: 1 });
    }
    return Array.from(map.entries())
      .map(([code, info]) => ({ code, name: info.name, groupCount: info.count }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [data, selectedFederationFilter, normalizedFederation]);

  const headerTitle = federationMeta
    ? `Direkte Verbands-Zuordnung (${federationMeta.shortLabel} · ${federationMeta.regionLabel})`
    : "Direkte Verbands-Zuordnung (Staffel & Mannschaft)";
  const headerBadge = federationMeta?.shortLabel ?? "Verbandsverzeichnis";

  if (suggestionsOnly) {
    if (loading || error || !data || data.suggestions.length === 0 || selected) {
      return null;
    }

    const firstFed = getFederationConfig(data.suggestions[0]?.group.federationCode);

    return (
      <div className="rounded-xl border border-primary/35 bg-primary/5 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-bold text-foreground">
                Verbands-Treffer für „{clubName}“ gefunden
              </p>
              <p className="text-xs text-muted-foreground">
                Wähle deine offizielle Mannschaft mit einem Klick – Liga,
                Spielplan und Gegner werden direkt zugeordnet.
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {firstFed ? firstFed.shortLabel : "Verzeichnis"}
          </Badge>
        </div>

        <div className="space-y-2">
          {data.suggestions.slice(0, 3).map((sug) => (
            <button
              key={sug.team.id}
              type="button"
              onClick={() =>
                onSelect({
                  team: sug.team,
                  group: sug.group,
                  opponentCount: sug.opponentCount,
                })
              }
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-card px-3.5 py-3 text-left transition-all hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground">
                    {sug.team.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {sug.group.federationCode}
                  </Badge>
                  {sug.team.hasIcalFeed && (
                    <Badge variant="fit" className="text-[10px]">
                      Auto-Spielplan
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs font-medium text-foreground/80">
                  {sug.group.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {sug.group.regionName} · Saison {sug.group.seasonName} ·{" "}
                  {sug.opponentCount} Staffel-Gegner
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground">
                Übernehmen
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Ausgewählte Verbandsmannschaft + Auto-Import-Optionen */}
      {selected ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-3 dark:border-emerald-800/70 dark:bg-emerald-950/35">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <Check className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    {selected.group.federationCode}-Mannschaft zugeordnet
                  </p>
                  <Badge variant="outline" className="text-[10px]">
                    {LEAGUE_PROVIDER_LABELS[selected.group.externalProvider]}
                  </Badge>
                  {selected.team.hasIcalFeed && (
                    <Badge variant="fit" className="text-[10px]">
                      Spielplan-Feed aktiv
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {selected.team.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selected.group.name} · {selected.group.regionName} (
                  {selected.group.seasonName})
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onSelect(null)}
              className="shrink-0 text-xs"
            >
              Ändern
            </Button>
          </div>

          <div className="space-y-2 border-t border-emerald-200/80 pt-3 dark:border-emerald-900/60">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={autoImportSchedule}
                onChange={(e) => onAutoImportScheduleChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
              />
              <span>
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" />
                  Spielplan automatisch importieren & stündlich aktuell halten
                </span>
                <span className="block text-muted-foreground mt-0.5">
                  Heim-/Auswärtsspiele, Anwurfzeiten, Hallen und Ergebnisse
                  werden direkt übernommen. Lokale Team-Daten bleiben bei jedem
                  Re-Sync geschützt.
                </span>
              </span>
            </label>

            {selected.opponentCount > 0 && (
              <label className="flex items-start gap-2.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={seedGroupOpponents}
                  onChange={(e) => onSeedGroupOpponentsChange(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    Staffel-Gegner ({selected.opponentCount} Mannschaften) fürs
                    Scouting anlegen
                  </span>
                  <span className="block text-muted-foreground mt-0.5">
                    Alle weiteren Teams deiner Staffel stehen direkt unter
                    Taktik & Scouting bereit.
                  </span>
                </span>
              </label>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {headerTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                Wähle deine konkrete Staffel und klicke deine Mannschaft an –
                kein Kopieren von iCal-Links nötig.
              </p>
            </div>
            <Badge variant="outline">{headerBadge}</Badge>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Lade Staffeln & Mannschaften…</span>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          ) : !data || data.groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background/60 p-4 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                Für diese Auswahl sind noch keine Staffeln im Verzeichnis
                hinterlegt.
              </p>
              <p className="mt-1">
                Du kannst trotzdem fortfahren oder den Spielplan später unter
                Termine → Liga-Sync per iCal-Feed oder CSV verbinden.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Auto-Suggest Treffer */}
              {data.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Passend zu „{clubName}“
                  </p>
                  <div className="space-y-1.5">
                    {data.suggestions.slice(0, 3).map((sug) => (
                      <button
                        key={sug.team.id}
                        type="button"
                        onClick={() =>
                          onSelect({
                            team: sug.team,
                            group: sug.group,
                            opponentCount: sug.opponentCount,
                          })
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-primary/35 bg-primary/5 px-3 py-2.5 text-left transition-all hover:border-primary hover:bg-primary/10"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground">
                              {sug.team.name}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {sug.group.federationCode}
                            </Badge>
                            {sug.team.hasIcalFeed && (
                              <Badge variant="fit" className="text-[10px]">
                                Auto-Sync
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {sug.group.name} · {sug.group.regionName}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-primary">
                          Auswählen
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suchfeld + Verbands- & Regionsfilter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Verein, Stadt, Verband oder Staffel suchen…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8 pr-8 text-xs"
                    aria-label="Staffel oder Mannschaft im Verzeichnis suchen"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Suche leeren"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {!normalizedFederation && data.federations.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFederationFilter(null);
                        setSelectedRegion(null);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        selectedFederationFilter === null
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      Alle Verbände ({data.groups.length})
                    </button>
                    {data.federations.map((fed) => (
                      <button
                        key={fed.code}
                        type="button"
                        onClick={() => {
                          setSelectedFederationFilter(fed.code);
                          setSelectedRegion(null);
                        }}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                          selectedFederationFilter === fed.code
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {fed.code} ({fed.groupCount})
                      </button>
                    ))}
                  </div>
                )}

                {visibleRegions.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedRegion(null)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                        selectedRegion === null
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                      )}
                    >
                      Alle Regionen ({filteredGroups.length})
                    </button>
                    {visibleRegions.map((region) => (
                      <button
                        key={region.code}
                        type="button"
                        onClick={() => setSelectedRegion(region.code)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                          selectedRegion === region.code
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {region.name} ({region.groupCount})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Staffeln & deren Mannschaften */}
              {filteredGroups.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Keine Staffel für „{searchQuery}“ gefunden.
                </p>
              ) : (
                <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {filteredGroups.map((group) => {
                    const isExpanded =
                      expandedGroupId === group.id ||
                      filteredGroups.length === 1 ||
                      searchQuery.trim().length >= 2;
                    const { teams: groupTeams, ...groupMeta } = group;

                    return (
                      <div
                        key={group.id}
                        className="rounded-lg border border-border bg-card overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedGroupId((prev) =>
                              prev === group.id ? null : group.id
                            )
                          }
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-xs font-bold text-foreground">
                                {group.name}
                              </p>
                              {!normalizedFederation && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 text-[10px]"
                                >
                                  {group.federationCode}
                                </Badge>
                              )}
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {group.regionName} · {groupTeams.length}{" "}
                              Mannschaften
                            </p>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border bg-muted/15 p-2 grid gap-1.5 sm:grid-cols-2">
                            {groupTeams.map((team) => (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() =>
                                  onSelect({
                                    team,
                                    group: groupMeta,
                                    opponentCount: Math.max(
                                      0,
                                      groupTeams.length - 1
                                    ),
                                  })
                                }
                                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left text-xs transition-all hover:border-primary hover:bg-primary/5"
                              >
                                <span className="truncate font-medium text-foreground">
                                  {team.name}
                                </span>
                                {team.hasIcalFeed && (
                                  <Badge
                                    variant="fit"
                                    className="shrink-0 text-[10px]"
                                  >
                                    Feed
                                  </Badge>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
