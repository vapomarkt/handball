"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  History,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
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
14.12.2026;19:00;TSV Musterstadt;HSG Oberland;Sporthalle Musterstadt-Süd
21.12.2026;17:30;TV Waldstadt;TSV Musterstadt;Waldsporthalle`;

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
      setMessage(
        `Sync abgeschlossen: ${s.createdCount} neu, ${s.updatedCount} geändert, ${s.unchangedCount} unverändert.`
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

  return (
    <div className="space-y-6">
      {/* Hinweis Schutz lokaler Anreicherungen */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
        <div>
          <p className="font-bold">Schutz lokaler Team-Daten beim Re-Sync</p>
          <p className="mt-0.5">
            Automatische & manuelle Liga-Syncs aktualisieren ausschließlich
            Anwurfzeit, Halle und Spielstatus über die externe ID. Lokale
            Anreicherungen (Treffpunktzeit, Trikotfarbe, Spieltagskader,
            Fahrgemeinschaften, Notizen und die Harz-Regelung einer Halle) werden
            niemals überschrieben.
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

      {/* iCal Auto-Sync Quellen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            iCal-Kalenderfeeds (Stündlicher pg-boss Auto-Sync)
          </CardTitle>
          <CardDescription>
            Verbinde deinen nuLiga- oder handball.net-.ics-Feed für automatische
            Spielverlegungs-Erkennung.
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
                      <Badge variant="outline">{src.provider}</Badge>
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
                      {src.provider === "ICAL_URL" && (
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

          {isStaff && (
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
          )}
        </CardContent>
      </Card>

      {/* CSV-Import mit Spalten-Mapping (nur Staff) */}
      {isStaff && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  CSV Spielplan-Import (mit Spalten-Mapping)
                </CardTitle>
                <CardDescription>
                  Importiere exportierte Spielpläne (z. B. aus nuLiga oder Excel)
                  mit flexibler Spaltenzuordnung.
                </CardDescription>
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
          </CardHeader>
          <CardContent>
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
          </CardContent>
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
