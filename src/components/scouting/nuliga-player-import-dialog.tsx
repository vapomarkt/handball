"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Flame,
  Loader2,
  RefreshCw,
} from "lucide-react";
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
import type {
  NuligaOpponentPlayerPreviewDTO,
  NuligaOpponentPlayersPreviewResponseDTO,
  OpponentDTO,
  ThreatLevel,
} from "@/domain/schemas/scouting";

interface NuligaPlayerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  opponent: OpponentDTO;
  onImported: () => Promise<void>;
}

function playerRowKey(p: NuligaOpponentPlayerPreviewDTO, index: number): string {
  return p.externalPlayerId ? `id:${p.externalPlayerId}` : `name:${p.name}:${index}`;
}

export function NuligaPlayerImportDialog({
  open,
  onOpenChange,
  teamId,
  opponent,
  onImported,
}: NuligaPlayerImportDialogProps) {
  const [sourceUrl, setSourceUrl] = useState(opponent.externalUrl ?? "");
  const [loadingPreview, setLoadingPreview] = useState(open);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] =
    useState<NuligaOpponentPlayersPreviewResponseDTO | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [threatOverrides, setThreatOverrides] = useState<
    Record<string, ThreatLevel>
  >({});

  const applyPreview = useCallback(
    (data: NuligaOpponentPlayersPreviewResponseDTO) => {
      setPreview(data);
      if (data.resolvedTeamUrl) {
        setSourceUrl(data.resolvedTeamUrl);
      } else if (data.resolvedGroupUrl && !sourceUrl) {
        setSourceUrl(data.resolvedGroupUrl);
      }

      // Sinnvolle Vorauswahl: Top-Torschützen (HIGH oder Top 5 mit Toren),
      // oder alle bereits importierten zum schnellen Aktualisieren.
      const nextSelected = new Set<string>();
      const nextThreats: Record<string, ThreatLevel> = {};
      data.players.forEach((p, idx) => {
        const key = playerRowKey(p, idx);
        nextThreats[key] = p.suggestedThreatLevel;
        const isTopScorer =
          p.suggestedThreatLevel === "HIGH" ||
          (idx < 5 && (p.goalsTotal ?? 0) > 0);
        if (isTopScorer || p.alreadyImported) {
          nextSelected.add(key);
        }
      });
      setSelectedKeys(nextSelected);
      setThreatOverrides(nextThreats);
    },
    [sourceUrl]
  );

  const fetchPreview = useCallback(
    async (overrideUrl?: string) => {
      setLoadingPreview(true);
      setError(null);
      try {
        const payload =
          overrideUrl && overrideUrl.trim().length > 0
            ? { sourceUrl: overrideUrl.trim() }
            : {};
        const res = await fetch(
          `/api/v1/teams/${encodeURIComponent(teamId)}/opponents/${encodeURIComponent(opponent.id)}/nuliga-preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const body = await res.json();
        if (!res.ok) {
          setError(
            body.error ??
              "nuLiga-Daten konnten für diesen Gegner nicht geladen werden."
          );
          setPreview(null);
          return;
        }
        applyPreview(body as NuligaOpponentPlayersPreviewResponseDTO);
      } catch {
        setError("Verbindung zu nuLiga fehlgeschlagen. Bitte erneut versuchen.");
        setPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    },
    [teamId, opponent.id, applyPreview]
  );

  useEffect(() => {
    if (!open) return;
    let active = true;
    const initialUrl = opponent.externalUrl ?? undefined;
    const payload =
      initialUrl && initialUrl.trim().length > 0
        ? { sourceUrl: initialUrl.trim() }
        : {};

    fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/opponents/${encodeURIComponent(opponent.id)}/nuliga-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )
      .then(async (res) => {
        const body = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(
            body.error ??
              "nuLiga-Daten konnten für diesen Gegner nicht geladen werden."
          );
          setPreview(null);
          return;
        }
        setError(null);
        applyPreview(body as NuligaOpponentPlayersPreviewResponseDTO);
      })
      .catch(() => {
        if (!active) return;
        setError("Verbindung zu nuLiga fehlgeschlagen. Bitte erneut versuchen.");
        setPreview(null);
      })
      .finally(() => {
        if (active) setLoadingPreview(false);
      });

    return () => {
      active = false;
    };
  }, [open, teamId, opponent.id, opponent.externalUrl, applyPreview]);

  function toggleRow(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectTopScorers() {
    if (!preview) return;
    const next = new Set<string>();
    preview.players.forEach((p, idx) => {
      if (
        p.suggestedThreatLevel === "HIGH" ||
        (idx < 5 && (p.goalsTotal ?? 0) > 0)
      ) {
        next.add(playerRowKey(p, idx));
      }
    });
    setSelectedKeys(next);
  }

  function selectAll() {
    if (!preview) return;
    setSelectedKeys(
      new Set(preview.players.map((p, idx) => playerRowKey(p, idx)))
    );
  }

  function selectNone() {
    setSelectedKeys(new Set());
  }

  async function handleImport() {
    if (!preview || selectedKeys.size === 0) return;
    setImporting(true);
    setError(null);
    try {
      const chosen = preview.players
        .map((p, idx) => ({ p, key: playerRowKey(p, idx) }))
        .filter(({ key }) => selectedKeys.has(key))
        .map(({ p, key }) => ({
          externalPlayerId: p.externalPlayerId,
          name: p.name,
          jerseyNumber: p.jerseyNumber,
          isSevenMeterShooter: p.isSevenMeterShooter,
          threatLevel: threatOverrides[key] ?? p.suggestedThreatLevel,
          goalsTotal: p.goalsTotal,
          gamesPlayed: p.gamesPlayed,
          sevenMeterGoals: p.sevenMeterGoals,
          sevenMeterAttempts: p.sevenMeterAttempts,
        }));

      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/opponents/${encodeURIComponent(opponent.id)}/nuliga-import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUrl:
              preview.resolvedTeamUrl ??
              (sourceUrl.trim() ? sourceUrl.trim() : null),
            players: chosen,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Import fehlgeschlagen.");
        return;
      }
      await onImported();
      onOpenChange(false);
    } catch {
      setError("Netzwerkfehler beim Importieren der Spieler.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 shrink-0 text-primary" />
            <span>Schlüsselspieler aus nuLiga importieren – {opponent.name}</span>
          </DialogTitle>
          <DialogDescription>
            Übernimmt Namen, Trikotnummern, Saisontore und 7m-Schützen direkt
            aus nuLiga. Bereits gepflegte Positionen, Wurfzonen und Notizen
            bleiben beim Aktualisieren erhalten.
          </DialogDescription>
        </DialogHeader>

        {/* Optionale manuelle nuLiga-URL (z. B. für Pokal-/Testspielgegner) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchPreview(sourceUrl);
          }}
          className="flex flex-col sm:flex-row gap-2 sm:items-end"
        >
          <div className="space-y-1 flex-1 min-w-0 w-full">
            <Label htmlFor="nuliga-opp-url" className="text-xs">
              nuLiga-Mannschafts- oder Staffelseite (optional, sonst automatisch
              aus Staffel)
            </Label>
            <Input
              id="nuliga-opp-url"
              type="url"
              placeholder="https://hvnb-handball.liga.nu/cgi-bin/WebObjects/nuLigaHBDE.woa/wa/teamPortrait?..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={loadingPreview}
            className="w-full sm:w-auto shrink-0 h-9"
          >
            {loadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Laden
          </Button>
        </form>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {preview?.warning && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{preview.warning}</span>
          </div>
        )}

        {loadingPreview ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Lade Torschützenliste & Spielberichte aus nuLiga…</span>
          </div>
        ) : preview && preview.players.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
              <span>
                <strong className="text-foreground">
                  {preview.players.length}
                </strong>{" "}
                Spieler gefunden
                {preview.statisticsAvailable ? " · Torschützenliste" : ""}
                {preview.reportsAnalyzed > 0
                  ? ` · ${preview.reportsAnalyzed} Spielbericht${preview.reportsAnalyzed === 1 ? "" : "e"}`
                  : ""}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={selectTopScorers}
                >
                  Top-Scorer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={selectAll}
                >
                  Alle
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={selectNone}
                >
                  Keine
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto border border-border rounded-lg divide-y divide-border flex-1 min-h-0">
              {preview.players.map((player, idx) => {
                const key = playerRowKey(player, idx);
                const checked = selectedKeys.has(key);
                const threat =
                  threatOverrides[key] ?? player.suggestedThreatLevel;

                return (
                  <div
                    key={key}
                    className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2.5 text-xs transition-colors ${
                      checked ? "bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRow(key)}
                        className="h-4 w-4 accent-primary shrink-0"
                      />
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-secondary text-secondary-foreground font-mono text-[11px] font-bold shrink-0">
                        {player.jerseyNumber ? `#${player.jerseyNumber}` : "–"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-foreground truncate">
                            {player.name}
                          </span>
                          {player.isSevenMeterShooter && (
                            <Badge variant="injured" className="gap-0.5 text-[10px] py-0">
                              <Flame className="h-2.5 w-2.5" />
                              7m
                              {player.sevenMeterGoals !== null
                                ? ` ${player.sevenMeterGoals}${player.sevenMeterAttempts ? `/${player.sevenMeterAttempts}` : ""}`
                                : ""}
                            </Badge>
                          )}
                          {player.alreadyImported && (
                            <Badge variant="secondary" className="gap-0.5 text-[10px] py-0">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Im Dossier
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {player.goalsTotal !== null ? (
                            <>
                              <strong className="text-foreground">
                                {player.goalsTotal} Tore
                              </strong>
                              {player.gamesPlayed !== null && (
                                <> · {player.gamesPlayed} Sp.</>
                              )}
                              {player.goalsPerGame !== null && (
                                <>
                                  {" "}
                                  (Ø {player.goalsPerGame.toFixed(1).replace(".", ",")}/Sp.)
                                </>
                              )}
                            </>
                          ) : (
                            <span>Aus Spielbericht (0 Tore)</span>
                          )}
                        </div>
                      </div>
                    </label>

                    <div className="shrink-0 w-28">
                      <SelectNative
                        aria-label={`Gefahrenstufe für ${player.name}`}
                        value={threat}
                        onChange={(e) =>
                          setThreatOverrides((prev) => ({
                            ...prev,
                            [key]: e.target.value as ThreatLevel,
                          }))
                        }
                        className="h-7 text-xs py-0"
                      >
                        <option value="HIGH">Hoch</option>
                        <option value="MEDIUM">Mittel</option>
                        <option value="LOW">Niedrig</option>
                      </SelectNative>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={importing || selectedKeys.size === 0}
            onClick={handleImport}
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            {selectedKeys.size === 1
              ? "1 Spieler übernehmen"
              : `${selectedKeys.size} Spieler übernehmen`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
