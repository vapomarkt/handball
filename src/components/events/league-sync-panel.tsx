"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  History,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unlink,
} from "lucide-react";
import {
  HvnbTeamPicker,
  SelectedHvnbTeam,
} from "@/components/leagues/hvnb-team-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import {
  SYNC_CHANGE_TYPE_LABELS,
  type LeagueImportSourceDTO,
  type LeagueSyncChangeLogDTO,
} from "@/domain/schemas/league";

interface LeagueSyncPanelProps {
  teamId: string;
  clubName: string;
  isStaff: boolean;
  onImported: () => void;
}

const SAMPLE_CSV = `Datum;Uhrzeit;Heim;Gast;Halle
13.12.2026;10:00;TuS Jahn Hollenstedt;JSG Fredenbeck/Stade/Harsefeld (S);Hollenstedt, Max-Schmeling-Hallen (Halle 1) (603110)
19.12.2026;13:00;mJSG Buxtehude/ Beckdorf (Bux);TuS Jahn Hollenstedt;Buxtehude, Halle Nord - NEU (Halle 4+5) (608165)`;

export function LeagueSyncPanel({
  teamId,
  clubName,
  isStaff,
  onImported,
}: LeagueSyncPanelProps) {
  const [sources, setSources] = useState<LeagueImportSourceDTO[]>([]);
  const [logs, setLogs] = useState<LeagueSyncChangeLogDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // HVNB Direktverknüpfung
  const [selectedHvnb, setSelectedHvnb] = useState<SelectedHvnbTeam | null>(
    null
  );
  const [autoImportSchedule, setAutoImportSchedule] = useState(true);
  const [seedGroupOpponents, setSeedGroupOpponents] = useState(true);
  const [linkingHvnb, setLinkingHvnb] = useState(false);
  const [editingHvnbLink, setEditingHvnbLink] = useState(false);
  const [showManualImport, setShowManualImport] = useState(false);

  // iCal Source Form
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [teamNameMatch, setTeamNameMatch] = useState(clubName);
  const [addingSource, setAddingSource] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // CSV Import Form
  const [csvContent, setCsvContent] = useState("");
  const [delimiter, setDelimiter] = useState<";" | ",">(";");
  const [dateColumn, setDateColumn] = useState("Datum");
  const [timeColumn, setTimeColumn] = useState("Uhrzeit");
  const [homeTeamColumn, setHomeTeamColumn] = useState("Heim");
  const [awayTeamColumn, setAwayTeamColumn] = useState("Gast");
  const [venueColumn, setVenueColumn] = useState("Halle");
  const [csvTeamMatch, setCsvTeamMatch] = useState(clubName);
  const [importingCsv, setImportingCsv] = useState(false);

  const activeHvnbSource =
    sources.find(
      (s) => s.provider === "HVNB_NULIGA" || Boolean(s.leagueGroupTeamId)
    ) ?? null;

  const loadData = useCallback(async () => {
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(
          `/api/v1/teams/${encodeURIComponent(teamId)}/league-sources`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/v1/teams/${encodeURIComponent(teamId)}/league-changelog`,
          { cache: "no-store" }
        ),
      ]);
      if (sRes.ok) setSources((await sRes.json()).sources ?? []);
      if (lRes.ok) setLogs((await lRes.json()).logs ?? []);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/league-sources`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/league-changelog`, {
        cache: "no-store",
      }),
    ])
      .then(async ([sRes, lRes]) => {
        if (!active) return;
        if (sRes.ok) setSources((await sRes.json()).sources ?? []);
        if (lRes.ok) setLogs((await lRes.json()).logs ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId]);

  async function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setAddingSource(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/league-sources`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "ICAL_URL",
            name: sourceName,
            sourceUrl,
            teamNameMatch: teamNameMatch || null,
            isEnabled: true,
            syncIntervalMinutes: 60,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Quelle konnte nicht gespeichert werden.");
        return;
      }
      setSourceName("");
      setSourceUrl("");
      setMessage(
        "iCal-Quelle angelegt. Der pg-boss Worker synchronisiert sie ab sofort stündlich."
      );
      await loadData();
    } finally {
      setAddingSource(false);
    }
  }

  async function handleTriggerSync(sourceId: string) {
    setError(null);
    setMessage(null);
    setSyncingId(sourceId);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/league-sources/${encodeURIComponent(sourceId)}/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Sync fehlgeschlagen.");
        await loadData();
        return;
      }
      const s = data.summary;
      const resultSuffix =
        s.resultsUpdatedCount && s.resultsUpdatedCount > 0
          ? `, ${s.resultsUpdatedCount} ${s.resultsUpdatedCount === 1 ? "Ergebnis" : "Ergebnisse"} nachgetragen`
          : "";
      setMessage(
        `Sync abgeschlossen: ${s.createdCount} neu, ${s.updatedCount} geändert, ${s.unchangedCount} unverändert${resultSuffix}.`
      );
      await loadData();
      onImported();
    } finally {
      setSyncingId(null);
    }
  }

  async function handleDeleteSource(sourceId: string) {
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/league-sources/${encodeURIComponent(sourceId)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadData();
  }

  async function handleCsvImport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setImportingCsv(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/league-import/csv`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceName: "CSV Spielplan-Import",
            teamNameMatch: csvTeamMatch,
            csvContent,
            mapping: {
              delimiter,
              dateColumn,
              timeColumn: timeColumn || null,
              homeTeamColumn,
              awayTeamColumn,
              venueColumn: venueColumn || null,
            },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "CSV-Import fehlgeschlagen.");
        return;
      }
      const s = data.summary;
      setMessage(
        `CSV-Import erfolgreich: ${s.createdCount} neue Spiele, ${s.updatedCount} aktualisiert, ${s.unchangedCount} unverändert.`
      );
      setCsvContent("");
      await loadData();
      onImported();
    } finally {
      setImportingCsv(false);
    }
  }

  async function handleLinkHvnb() {
    if (!selectedHvnb) return;
    setError(null);
    setMessage(null);
    setLinkingHvnb(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/league-link`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueGroupTeamId: selectedHvnb.team.id,
            autoImportSchedule,
            seedGroupOpponents,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "HVNB-Verknüpfung konnte nicht gespeichert werden."
        );
        return;
      }

      const parts: string[] = [
        `Mit HVNB verknüpft: ${data.officialTeamName} (${data.groupName}).`,
      ];
      if (data.syncSummary) {
        parts.push(
          `Spielplan importiert: ${data.syncSummary.createdCount} neu, ${data.syncSummary.updatedCount} aktualisiert.`
        );
      } else if (data.syncWarning) {
        parts.push(data.syncWarning);
      }
      if (data.seededOpponentsCount > 0) {
        parts.push(
          `${data.seededOpponentsCount} Staffel-Gegner fürs Scouting angelegt.`
        );
      }

      setMessage(parts.join(" "));
      setSelectedHvnb(null);
      setEditingHvnbLink(false);
      await loadData();
      onImported();
    } finally {
      setLinkingHvnb(false);
    }
  }

  async function handleUnlinkHvnb() {
    setError(null);
    setMessage(null);
    setLinkingHvnb(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/league-link`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error?.message || "Verknüpfung konnte nicht gelöst werden.");
        return;
      }
      setMessage("HVNB-Verknüpfung gelöst.");
      setSelectedHvnb(null);
      setEditingHvnbLink(false);
      await loadData();
    } finally {
      setLinkingHvnb(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Hinweis Schutz lokaler Anreicherungen */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
        <div>
          <p className="font-bold">Schutz lokaler Team-Daten beim Re-Sync</p>
          <p className="mt-0.5">
            Automatische & manuelle Liga-Syncs aktualisieren Anwurfzeit, Halle,
            Spielstatus sowie fehlende Ergebnisse vergangener Spiele. Lokale
            Anreicherungen (Treffpunktzeit, Trikotfarbe, Spieltagskader,
            Fahrgemeinschaften, Notizen, Harz-Regelung und bereits manuell
            erfasste Endstände) werden niemals überschrieben.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* HVNB Direkt-Verknüpfung (1-Klick für Niedersachsen & Bremen) */}
      {isStaff && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-4 w-4 text-primary" />
                  HVNB Mannschaft verknüpfen (Niedersachsen & Bremen)
                </CardTitle>
                <CardDescription>
                  Ordne deine Mannschaft direkt ihrer offiziellen HVNB-Staffel
                  zu – der Spielplan wird automatisch importiert und stündlich
                  aktuell gehalten.
                </CardDescription>
              </div>
              <Badge variant="secondary">Empfohlen · HVNB</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeHvnbSource && !editingHvnbLink ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">
                      {activeHvnbSource.teamNameMatch || clubName}
                    </span>
                    <Badge variant="fit">HVNB verbunden</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeHvnbSource.name}
                  </p>
                  {activeHvnbSource.lastSyncedAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Letzter Sync:{" "}
                      {new Date(activeHvnbSource.lastSyncedAt).toLocaleString(
                        "de-DE"
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(activeHvnbSource.sourceUrl ||
                    activeHvnbSource.leagueGroupTeamId) && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={syncingId === activeHvnbSource.id}
                      onClick={() => handleTriggerSync(activeHvnbSource.id)}
                    >
                      {syncingId === activeHvnbSource.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      {activeHvnbSource.sourceUrl
                        ? "Spielplan & Ergebnisse syncen"
                        : "Ergebnisse abrufen"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingHvnbLink(true)}
                  >
                    Ändern
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={linkingHvnb}
                    onClick={handleUnlinkHvnb}
                    className="text-destructive hover:text-destructive"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    Trennen
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <HvnbTeamPicker
                  clubName={clubName}
                  selected={selectedHvnb}
                  onSelect={setSelectedHvnb}
                  autoImportSchedule={autoImportSchedule}
                  onAutoImportScheduleChange={setAutoImportSchedule}
                  seedGroupOpponents={seedGroupOpponents}
                  onSeedGroupOpponentsChange={setSeedGroupOpponents}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!selectedHvnb || linkingHvnb}
                    onClick={handleLinkHvnb}
                  >
                    {linkingHvnb ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" />
                    )}
                    Mannschaft verknüpfen & Spielplan importieren
                  </Button>
                  {editingHvnbLink && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingHvnbLink(false);
                        setSelectedHvnb(null);
                      }}
                    >
                      Abbrechen
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aktive Sync-Quellen (HVNB & iCal) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            Verbundene Spielplan-Quellen (Stündlicher pg-boss Auto-Sync)
          </CardTitle>
          <CardDescription>
            Alle aktiven HVNB-, nuLiga- und handball.net-Feeds dieser Mannschaft.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade Quellen…</p>
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Liga-Importquellen hinterlegt.
            </p>
          ) : (
            <div className="space-y-2">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{src.name}</span>
                      <Badge variant="outline">
                        {src.provider === "HVNB_NULIGA"
                          ? "HVNB Auto"
                          : src.provider}
                      </Badge>
                      <Badge
                        variant={
                          src.lastSyncStatus === "SUCCESS"
                            ? "fit"
                            : src.lastSyncStatus === "ERROR"
                              ? "injured"
                              : "secondary"
                        }
                      >
                        {src.lastSyncStatus === "SUCCESS"
                          ? "Synchronisiert"
                          : src.lastSyncStatus === "ERROR"
                            ? "Fehler"
                            : "Neu"}
                      </Badge>
                    </div>
                    {src.sourceUrl && (
                      <p className="truncate text-xs font-mono text-muted-foreground">
                        {src.sourceUrl}
                      </p>
                    )}
                    {src.lastSyncError && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {src.lastSyncError}
                      </p>
                    )}
                  </div>

                  {isStaff && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {((src.provider === "ICAL_URL" && src.sourceUrl) ||
                        (src.provider === "HVNB_NULIGA" &&
                          (src.sourceUrl || src.leagueGroupTeamId))) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={syncingId === src.id}
                            onClick={() => handleTriggerSync(src.id)}
                          >
                            {syncingId === src.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            Jetzt syncen
                          </Button>
                        )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteSource(src.id)}
                        aria-label={`Quelle ${src.name} entfernen`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Erweitert: Manuelle iCal-URL & CSV-Import (aufklappbar, nur Staff) */}
      {isStaff && (
        <Card>
          <button
            type="button"
            onClick={() => setShowManualImport((prev) => !prev)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
            aria-expanded={showManualImport}
          >
            <div>
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                Erweitert: Manuelle iCal-URL & CSV-Import
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Für andere Verbände oder falls deine Staffel noch nicht im
                HVNB-Verzeichnis gelistet ist.
              </p>
            </div>
            {showManualImport ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </button>

          {showManualImport && (
            <CardContent className="space-y-6 border-t border-border pt-5">
              <form
                onSubmit={handleAddSource}
                className="rounded-xl border border-border bg-muted/30 p-4 space-y-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Neue iCal-URL verbinden
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="ls-name" className="text-xs">
                      Bezeichnung *
                    </Label>
                    <Input
                      id="ls-name"
                      required
                      placeholder="z. B. nuLiga Verbandsliga"
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ls-url" className="text-xs">
                      iCal / .ics URL *
                    </Label>
                    <Input
                      id="ls-url"
                      type="url"
                      required
                      placeholder="https://.../spielplan.ics"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ls-match" className="text-xs">
                      Vereinsname (Heim/Auswärts)
                    </Label>
                    <Input
                      id="ls-match"
                      value={teamNameMatch}
                      onChange={(e) => setTeamNameMatch(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={addingSource}>
                  {addingSource ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  iCal-Feed hinzufügen
                </Button>
              </form>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      CSV Spielplan-Import (mit Spalten-Mapping)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Importiere exportierte Spielpläne (z. B. aus nuLiga oder
                      Excel) mit flexibler Spaltenzuordnung.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCsvContent(SAMPLE_CSV)}
                  >
                    Beispiel-CSV einfügen
                  </Button>
                </div>
                <form onSubmit={handleCsvImport} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="csv-team" className="text-xs">
                    Eigener Vereins-/Teamname *
                  </Label>
                  <Input
                    id="csv-team"
                    required
                    value={csvTeamMatch}
                    onChange={(e) => setCsvTeamMatch(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="csv-delim" className="text-xs">
                    Trennzeichen
                  </Label>
                  <SelectNative
                    id="csv-delim"
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value as ";" | ",")}
                    className="h-9 text-xs"
                  >
                    <option value=";">Semikolon (;) – Excel DE</option>
                    <option value=",">Komma (,)</option>
                  </SelectNative>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="csv-date" className="text-xs">
                    Spalte: Datum *
                  </Label>
                  <Input
                    id="csv-date"
                    required
                    value={dateColumn}
                    onChange={(e) => setDateColumn(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="csv-time" className="text-xs">
                    Spalte: Uhrzeit
                  </Label>
                  <Input
                    id="csv-time"
                    value={timeColumn}
                    onChange={(e) => setTimeColumn(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="csv-home" className="text-xs">
                    Spalte: Heimteam *
                  </Label>
                  <Input
                    id="csv-home"
                    required
                    value={homeTeamColumn}
                    onChange={(e) => setHomeTeamColumn(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="csv-away" className="text-xs">
                    Spalte: Gastteam *
                  </Label>
                  <Input
                    id="csv-away"
                    required
                    value={awayTeamColumn}
                    onChange={(e) => setAwayTeamColumn(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="csv-venue" className="text-xs">
                    Spalte: Halle
                  </Label>
                  <Input
                    id="csv-venue"
                    value={venueColumn}
                    onChange={(e) => setVenueColumn(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="csv-raw" className="text-xs">
                  CSV-Inhalt *
                </Label>
                <textarea
                  id="csv-raw"
                  required
                  rows={4}
                  placeholder="Datum;Uhrzeit;Heim;Gast;Halle&#10;14.12.2026;19:00;TSV Musterstadt;SG Beispiel;Sporthalle Süd"
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <Button type="submit" size="sm" disabled={importingCsv}>
                {importingCsv && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                CSV importieren & abgleichen
              </Button>
            </form>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Änderungsprotokoll (LeagueSyncChangeLog) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Liga-Änderungsprotokoll ({logs.length})
          </CardTitle>
          <CardDescription>
            Erkannte neue Spiele, Spielverlegungen und Hallenwechsel aus allen
            Sync-Läufen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine protokollierten Änderungen vorhanden.
            </p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col gap-1 rounded-lg border border-border p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        log.changeType === "CREATED"
                          ? "fit"
                          : log.changeType === "CANCELLED"
                            ? "injured"
                            : "unavailable"
                      }
                    >
                      {SYNC_CHANGE_TYPE_LABELS[log.changeType]}
                    </Badge>
                    {log.sourceName && (
                      <span className="text-xs text-muted-foreground">
                        {log.sourceName}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.detectedAt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-xs font-medium text-foreground">
                  {log.summary}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
