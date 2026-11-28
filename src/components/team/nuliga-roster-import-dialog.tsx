"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  Link2,
  Loader2,
  Pencil,
  RefreshCw,
  Shield,
  Users,
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
import type { MemberRole } from "@/domain/schemas/handball";
import type {
  NuligaRosterCandidateDTO,
  NuligaRosterImportResultDTO,
  NuligaRosterPreviewResponseDTO,
} from "@/domain/schemas/member";

interface NuligaRosterImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  teamName: string;
  initialPreview?: NuligaRosterPreviewResponseDTO | null;
  onImported: (result: NuligaRosterImportResultDTO) => Promise<void> | void;
  onOpenInvite?: () => void;
}

interface CandidateDraft {
  firstName: string;
  lastName: string;
  jerseyNumber: string;
  role: MemberRole;
}

const OFFICIAL_ROLE_OPTIONS: Array<{ value: MemberRole; label: string }> = [
  { value: "COACH", label: "Trainer" },
  { value: "ASSISTANT_COACH", label: "Co-Trainer" },
  { value: "TEAM_MANAGER", label: "Betreuer" },
  { value: "TREASURER", label: "Kassenwart" },
  { value: "HELPER", label: "Vereinshelfer" },
];

function candidateKey(c: NuligaRosterCandidateDTO, index: number): string {
  const idPart = c.externalPlayerId
    ? `id:${c.externalPlayerId}`
    : `name:${c.firstName}:${c.lastName}:${index}`;
  return `${c.kind}:${idPart}`;
}

function buildInitialState(data: NuligaRosterPreviewResponseDTO): {
  selected: Set<string>;
  drafts: Record<string, CandidateDraft>;
  markAsMinor: boolean;
} {
  const selected = new Set<string>();
  const drafts: Record<string, CandidateDraft> = {};
  const filterGuestThreshold = data.reportsAnalyzed >= 3 ? 2 : 1;

  data.players.forEach((p, idx) => {
    const key = candidateKey(p, idx);
    drafts[key] = {
      firstName: p.firstName,
      lastName: p.lastName,
      jerseyNumber: p.jerseyNumber !== null ? String(p.jerseyNumber) : "",
      role: "PLAYER",
    };
    if (!p.alreadyInRoster && p.appearances >= filterGuestThreshold) {
      selected.add(key);
    }
  });

  // Offizielle sind bewusst optional (standardmäßig abgewählt), damit Admins gezielt mitimportieren können.
  data.officials.forEach((o, idx) => {
    const key = candidateKey(o, idx);
    drafts[key] = {
      firstName: o.firstName,
      lastName: o.lastName,
      jerseyNumber: "",
      role: o.suggestedRole,
    };
  });

  return {
    selected,
    drafts,
    markAsMinor: data.defaultIsMinor,
  };
}

export function NuligaRosterImportDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  initialPreview = null,
  onImported,
  onOpenInvite,
}: NuligaRosterImportDialogProps) {
  const [sourceUrl, setSourceUrl] = useState(
    initialPreview?.resolvedTeamUrl ?? initialPreview?.resolvedGroupUrl ?? ""
  );
  const [preview, setPreview] =
    useState<NuligaRosterPreviewResponseDTO | null>(initialPreview);
  const [loadingPreview, setLoadingPreview] = useState(
    open && !initialPreview
  );
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() =>
    initialPreview ? buildInitialState(initialPreview).selected : new Set()
  );
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>(() =>
    initialPreview ? buildInitialState(initialPreview).drafts : {}
  );
  const [markAsMinor, setMarkAsMinor] = useState<boolean>(
    initialPreview?.defaultIsMinor ?? false
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const applyPreview = useCallback(
    (data: NuligaRosterPreviewResponseDTO) => {
      setPreview(data);
      if (data.resolvedTeamUrl) {
        setSourceUrl(data.resolvedTeamUrl);
      } else if (data.resolvedGroupUrl) {
        setSourceUrl((prev) => prev || data.resolvedGroupUrl || "");
      }
      const next = buildInitialState(data);
      setSelectedKeys(next.selected);
      setDrafts(next.drafts);
      setMarkAsMinor(next.markAsMinor);
      setEditingKey(null);
    },
    []
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
          `/api/v1/teams/${encodeURIComponent(teamId)}/members/nuliga-preview`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const body = await res.json();
        if (!res.ok) {
          setError(
            body?.error?.message ??
              "nuLiga-Spielberichte konnten für diese Mannschaft nicht geladen werden."
          );
          setPreview(null);
          return;
        }
        applyPreview(body as NuligaRosterPreviewResponseDTO);
      } catch {
        setError("Verbindung zu nuLiga fehlgeschlagen. Bitte erneut versuchen.");
        setPreview(null);
      } finally {
        setLoadingPreview(false);
      }
    },
    [teamId, applyPreview]
  );

  useEffect(() => {
    if (!open) return;
    if (initialPreview) {
      return;
    }
    let active = true;
    fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/members/nuliga-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    )
      .then(async (res) => {
        const body = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(
            body?.error?.message ??
              "nuLiga-Spielberichte konnten nicht geladen werden."
          );
          setPreview(null);
          return;
        }
        setError(null);
        applyPreview(body as NuligaRosterPreviewResponseDTO);
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
  }, [open, teamId, initialPreview, applyPreview]);

  function toggleRow(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function updateDraft(key: string, patch: Partial<CandidateDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? {
          firstName: "",
          lastName: "",
          jerseyNumber: "",
          role: "PLAYER",
        }),
        ...patch,
      },
    }));
  }

  function selectRegularPlayers() {
    if (!preview) return;
    const threshold = preview.reportsAnalyzed >= 3 ? 2 : 1;
    setSelectedKeys((prev) => {
      const next = new Set(
        Array.from(prev).filter((k) => k.startsWith("OFFICIAL:"))
      );
      preview.players.forEach((p, idx) => {
        if (!p.alreadyInRoster && p.appearances >= threshold) {
          next.add(candidateKey(p, idx));
        }
      });
      return next;
    });
  }

  function selectAllNewPlayers() {
    if (!preview) return;
    setSelectedKeys((prev) => {
      const next = new Set(
        Array.from(prev).filter((k) => k.startsWith("OFFICIAL:"))
      );
      preview.players.forEach((p, idx) => {
        if (!p.alreadyInRoster) {
          next.add(candidateKey(p, idx));
        }
      });
      return next;
    });
  }

  function clearPlayerSelection() {
    setSelectedKeys((prev) =>
      new Set(Array.from(prev).filter((k) => k.startsWith("OFFICIAL:")))
    );
  }

  function toggleAllOfficials() {
    if (!preview) return;
    const eligibleKeys = preview.officials
      .map((o, idx) => ({ o, key: candidateKey(o, idx) }))
      .filter(({ o }) => !o.alreadyInRoster)
      .map(({ key }) => key);

    const allSelected =
      eligibleKeys.length > 0 && eligibleKeys.every((k) => selectedKeys.has(k));

    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        eligibleKeys.forEach((k) => next.delete(k));
      } else {
        eligibleKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  }

  const selectionCounts = useMemo(() => {
    let players = 0;
    let officials = 0;
    for (const key of selectedKeys) {
      if (key.startsWith("PLAYER:")) players += 1;
      else if (key.startsWith("OFFICIAL:")) officials += 1;
    }
    return { players, officials, total: players + officials };
  }, [selectedKeys]);

  const allNewOfficialsSelected = useMemo(() => {
    if (!preview) return false;
    const eligible = preview.officials
      .map((o, idx) => ({ o, key: candidateKey(o, idx) }))
      .filter(({ o }) => !o.alreadyInRoster);
    return (
      eligible.length > 0 &&
      eligible.every(({ key }) => selectedKeys.has(key))
    );
  }, [preview, selectedKeys]);

  async function handleImport() {
    if (!preview || selectionCounts.total === 0) return;
    setImporting(true);
    setError(null);

    try {
      const allCandidates: Array<{
        candidate: NuligaRosterCandidateDTO;
        key: string;
      }> = [
        ...preview.players.map((candidate, idx) => ({
          candidate,
          key: candidateKey(candidate, idx),
        })),
        ...preview.officials.map((candidate, idx) => ({
          candidate,
          key: candidateKey(candidate, idx),
        })),
      ];

      const chosen = allCandidates
        .filter(({ key }) => selectedKeys.has(key))
        .map(({ candidate, key }) => {
          const d = drafts[key];
          const firstName = (d?.firstName ?? candidate.firstName).trim();
          const lastName = (d?.lastName ?? candidate.lastName).trim();
          const rawJersey = (d?.jerseyNumber ?? "").trim();
          const parsedJersey = rawJersey ? Number.parseInt(rawJersey, 10) : null;
          const jerseyNumber =
            parsedJersey !== null &&
            Number.isFinite(parsedJersey) &&
            parsedJersey >= 1 &&
            parsedJersey <= 99
              ? parsedJersey
              : null;
          const role: MemberRole = d?.role ?? candidate.suggestedRole;

          return {
            firstName,
            lastName,
            role,
            jerseyNumber: role === "PLAYER" ? jerseyNumber : null,
            isMinor: role === "PLAYER" ? markAsMinor : false,
          };
        })
        .filter((item) => item.firstName.length > 0 && item.lastName.length > 0);

      if (chosen.length === 0) {
        setError("Bitte prüfe, dass Vor- und Nachname ausgefüllt sind.");
        return;
      }

      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/members/nuliga-import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            members: chosen,
            updateExistingJerseyNumbers: true,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error?.message ?? "Import fehlgeschlagen.");
        return;
      }

      await onImported(body as NuligaRosterImportResultDTO);
      onOpenChange(false);
    } catch {
      setError("Netzwerkfehler beim Importieren des Kaders.");
    } finally {
      setImporting(false);
    }
  }

  const totalCandidates =
    (preview?.players.length ?? 0) + (preview?.officials.length ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 shrink-0 text-primary" />
            <span>Kader aus Spielberichten importieren – {teamName}</span>
          </DialogTitle>
          <DialogDescription>
            Übernimmt Spieler, Trikotnummern und optional Offizielle (A–D) aus
            den letzten nuLiga-Spielberichten. Beim späteren Team-Beitritt per
            Gruppenlink werden diese Profile automatisch verknüpft.
          </DialogDescription>
        </DialogHeader>

        {/* Optionale manuelle nuLiga-URL (andere Verbände, Vorsaison oder einzelner Spielbericht) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void fetchPreview(sourceUrl);
          }}
          className="flex flex-col sm:flex-row gap-2 sm:items-end"
        >
          <div className="space-y-1 flex-1 min-w-0 w-full">
            <Label htmlFor="nuliga-roster-url" className="text-xs">
              nuLiga-Mannschaftsseite oder Spielbericht-URL (optional – sonst
              automatisch aus Staffel)
            </Label>
            <Input
              id="nuliga-roster-url"
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
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {preview?.warning && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>{preview.warning}</p>
              {totalCandidates === 0 && onOpenInvite && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenInvite();
                  }}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Team per Link / QR-Code einladen
                </Button>
              )}
            </div>
          </div>
        )}

        {loadingPreview ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Analysiere die letzten nuLiga-Spielberichte…</span>
          </div>
        ) : preview && totalCandidates > 0 ? (
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-0.5">
            {/* Spieler-Sektion */}
            {preview.players.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <strong className="text-foreground">
                      {preview.players.length} Spieler
                    </strong>
                    {preview.reportsAnalyzed > 0
                      ? ` aus ${preview.reportsAnalyzed} Spielbericht${preview.reportsAnalyzed === 1 ? "" : "en"}`
                      : " aus Staffel-Statistik"}
                  </span>
                  <div className="flex items-center gap-1">
                    {preview.reportsAnalyzed >= 3 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={selectRegularPlayers}
                      >
                        Stammkader (≥2 Sp.)
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={selectAllNewPlayers}
                    >
                      Alle neuen
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={clearPlayerSelection}
                    >
                      Keine
                    </Button>
                  </div>
                </div>

                <div className="border border-border rounded-lg divide-y divide-border">
                  {preview.players.map((player, idx) => {
                    const key = candidateKey(player, idx);
                    const checked = selectedKeys.has(key);
                    const draft = drafts[key] ?? {
                      firstName: player.firstName,
                      lastName: player.lastName,
                      jerseyNumber:
                        player.jerseyNumber !== null
                          ? String(player.jerseyNumber)
                          : "",
                      role: "PLAYER" as MemberRole,
                    };
                    const isEditing = editingKey === key;
                    const isLikelyGuest =
                      !player.alreadyInRoster &&
                      preview.reportsAnalyzed >= 3 &&
                      player.appearances === 1;
                    const canBackfillJersey =
                      player.alreadyInRoster &&
                      player.existingMemberJerseyNumber === null &&
                      draft.jerseyNumber.trim().length > 0;

                    return (
                      <div
                        key={key}
                        className={`p-2.5 text-xs transition-colors ${
                          checked
                            ? "bg-primary/5"
                            : player.alreadyInRoster
                              ? "bg-muted/20 opacity-80"
                              : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              player.alreadyInRoster && !canBackfillJersey
                            }
                            onChange={() => toggleRow(key)}
                            aria-label={`${draft.firstName} ${draft.lastName} auswählen`}
                            className="h-4 w-4 accent-primary shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          />

                          {/* Kompakte editierbare Trikotnummer */}
                          <Input
                            type="number"
                            min={1}
                            max={99}
                            placeholder="#"
                            aria-label={`Trikotnummer für ${draft.firstName} ${draft.lastName}`}
                            value={draft.jerseyNumber}
                            onChange={(e) =>
                              updateDraft(key, { jerseyNumber: e.target.value })
                            }
                            className="h-7 w-14 px-1.5 text-center font-mono text-xs shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-foreground truncate">
                                {draft.firstName} {draft.lastName}
                              </span>
                              {preview.reportsAnalyzed > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 font-normal"
                                >
                                  {player.appearances}/{preview.reportsAnalyzed}{" "}
                                  Sp.
                                </Badge>
                              )}
                              {isLikelyGuest && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] py-0 text-amber-800 dark:text-amber-300"
                                >
                                  Nur 1 Einsatz (Aushilfe?)
                                </Badge>
                              )}
                              {player.alreadyInRoster && (
                                <Badge
                                  variant="secondary"
                                  className="gap-0.5 text-[10px] py-0"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  {canBackfillJersey
                                    ? "Im Kader (Trikot ergänzbar)"
                                    : "Bereits im Kader"}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {!player.alreadyInRoster && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() =>
                                setEditingKey(isEditing ? null : key)
                              }
                              aria-label={`Namen von ${draft.firstName} ${draft.lastName} bearbeiten`}
                              title="Vor-/Nachname anpassen"
                            >
                              {isEditing ? (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              ) : (
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </Button>
                          )}
                        </div>

                        {isEditing && (
                          <div className="mt-2 ml-6 grid grid-cols-2 gap-2">
                            <Input
                              aria-label="Vorname"
                              placeholder="Vorname"
                              value={draft.firstName}
                              onChange={(e) =>
                                updateDraft(key, { firstName: e.target.value })
                              }
                              className="h-7 text-xs"
                            />
                            <Input
                              aria-label="Nachname"
                              placeholder="Nachname"
                              value={draft.lastName}
                              onChange={(e) =>
                                updateDraft(key, { lastName: e.target.value })
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Optionale Offizielle (A, B, C, D) */}
            {preview.officials.length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <strong className="text-foreground">
                      Offizielle / Trainerbank (optional)
                    </strong>
                    <span>· {preview.officials.length} gefunden</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={toggleAllOfficials}
                  >
                    {allNewOfficialsSelected
                      ? "Offizielle abwählen"
                      : "Alle Offiziellen wählen"}
                  </Button>
                </div>

                <div className="border border-border rounded-lg divide-y divide-border bg-muted/15">
                  {preview.officials.map((official, idx) => {
                    const key = candidateKey(official, idx);
                    const checked = selectedKeys.has(key);
                    const draft = drafts[key] ?? {
                      firstName: official.firstName,
                      lastName: official.lastName,
                      jerseyNumber: "",
                      role: official.suggestedRole,
                    };
                    const isEditing = editingKey === key;

                    return (
                      <div
                        key={key}
                        className={`p-2.5 text-xs transition-colors ${
                          checked
                            ? "bg-primary/5"
                            : official.alreadyInRoster
                              ? "opacity-75"
                              : "hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={official.alreadyInRoster}
                            onChange={() => toggleRow(key)}
                            aria-label={`Offiziellen ${draft.firstName} ${draft.lastName} auswählen`}
                            className="h-4 w-4 accent-primary shrink-0 cursor-pointer disabled:cursor-not-allowed"
                          />

                          <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-primary/12 text-primary font-mono text-xs font-bold shrink-0">
                            {official.officialCode ?? "O"}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-semibold text-foreground truncate">
                                {draft.firstName} {draft.lastName}
                              </span>
                              {preview.reportsAnalyzed > 0 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] py-0 font-normal"
                                >
                                  {official.appearances}/
                                  {preview.reportsAnalyzed} Sp.
                                </Badge>
                              )}
                              {official.alreadyInRoster && (
                                <Badge
                                  variant="secondary"
                                  className="gap-0.5 text-[10px] py-0"
                                >
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                  Bereits im Kader
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <SelectNative
                              aria-label={`Rolle für ${draft.firstName} ${draft.lastName}`}
                              value={draft.role}
                              disabled={official.alreadyInRoster}
                              onChange={(e) =>
                                updateDraft(key, {
                                  role: e.target.value as MemberRole,
                                })
                              }
                              className="h-7 w-32 text-xs py-0"
                            >
                              {OFFICIAL_ROLE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </SelectNative>

                            {!official.alreadyInRoster && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0"
                                onClick={() =>
                                  setEditingKey(isEditing ? null : key)
                                }
                                aria-label={`Namen von ${draft.firstName} ${draft.lastName} bearbeiten`}
                                title="Vor-/Nachname anpassen"
                              >
                                {isEditing ? (
                                  <Check className="h-3.5 w-3.5 text-primary" />
                                ) : (
                                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="mt-2 ml-6 grid grid-cols-2 gap-2">
                            <Input
                              aria-label="Vorname"
                              placeholder="Vorname"
                              value={draft.firstName}
                              onChange={(e) =>
                                updateDraft(key, { firstName: e.target.value })
                              }
                              className="h-7 text-xs"
                            />
                            <Input
                              aria-label="Nachname"
                              placeholder="Nachname"
                              value={draft.lastName}
                              onChange={(e) =>
                                updateDraft(key, { lastName: e.target.value })
                              }
                              className="h-7 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Jugend-Option */}
            {preview.defaultIsMinor && (
              <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={markAsMinor}
                  onChange={(e) => setMarkAsMinor(e.target.checked)}
                  className="h-4 w-4 accent-primary shrink-0"
                />
                <span>
                  <strong className="text-foreground">Jugendmannschaft:</strong>{" "}
                  Importierte Spieler als minderjährig markieren (aktiviert
                  Eltern-Links im Kader).
                </span>
              </label>
            )}

            <p className="text-[11px] text-muted-foreground px-0.5">
              Position, Wurfhand &amp; Kontaktdaten ergänzen Spieler später
              selbst beim Beitritt. Nutze danach einfach den normalen
              Team-Einladungslink – vorbereitete Profile werden automatisch
              zugeordnet.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {selectionCounts.total > 0 ? (
              <>
                Ausgewählt:{" "}
                <strong className="text-foreground">
                  {selectionCounts.players} Spieler
                </strong>
                {selectionCounts.officials > 0 && (
                  <>
                    {" "}
                    +{" "}
                    <strong className="text-foreground">
                      {selectionCounts.officials} Offizielle
                    </strong>
                  </>
                )}
              </>
            ) : (
              "Keine Personen ausgewählt"
            )}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              disabled={importing || selectionCounts.total === 0}
              onClick={handleImport}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectionCounts.total === 1
                ? "1 Person übernehmen"
                : `${selectionCounts.total} Personen übernehmen`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
