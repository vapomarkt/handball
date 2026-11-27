"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crosshair,
  Download,
  ExternalLink,
  Flame,
  Loader2,
  Lock,
  Plus,
  Share2,
  Shield,
  Trash2,
  UserPlus,
  Video,
  Waypoints,
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
import type { EventDTO } from "@/domain/schemas/event";
import {
  HANDBALL_POSITION_LABELS,
  THROWING_HAND_LABELS,
  type HandballPosition,
  type ThrowingHand,
} from "@/domain/schemas/handball";
import {
  COMMON_ATTACK_SYSTEMS,
  COMMON_DEFENSE_SYSTEMS,
  DEFAULT_SHOT_ZONES,
  THREAT_LEVEL_LABELS,
  type OpponentDTO,
  type ShotZones,
  type ThreatLevel,
} from "@/domain/schemas/scouting";
import type { TacticPlayDTO } from "@/domain/schemas/tactic";
import { NuligaPlayerImportDialog } from "./nuliga-player-import-dialog";
import { ShotZoneGoal } from "./shot-zone-goal";

interface ScoutingPanelProps {
  teamId: string;
  isStaff: boolean;
  plays: TacticPlayDTO[];
  onOpenTacticPlay: (playId: string) => void;
}

const POSITIONS = Object.keys(HANDBALL_POSITION_LABELS) as HandballPosition[];

export function ScoutingPanel({
  teamId,
  isStaff,
  plays,
  onOpenTacticPlay,
}: ScoutingPanelProps) {
  const [opponents, setOpponents] = useState<OpponentDTO[]>([]);
  const [events, setEvents] = useState<EventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOpponentId, setSelectedOpponentId] = useState<string | null>(
    null
  );

  // New Opponent Dialog
  const [oppDialogOpen, setOppDialogOpen] = useState(false);
  const [oppName, setOppName] = useState("");
  const [oppLeague, setOppLeague] = useState("");
  const [oppExternalUrl, setOppExternalUrl] = useState("");
  const [oppDef, setOppDef] = useState<string[]>(["6:0 kompakt"]);
  const [oppAtt, setOppAtt] = useState<string[]>(["Kreuzung Rückraum"]);
  const [oppStrengths, setOppStrengths] = useState("");
  const [oppWeaknesses, setOppWeaknesses] = useState("");
  const [oppTransition, setOppTransition] = useState("");
  const [savingOpp, setSavingOpp] = useState(false);

  // nuLiga Key Player Import Dialog
  const [nuligaImportOpen, setNuligaImportOpen] = useState(false);

  // New Key Player Dialog
  const [playerDialogOpen, setPlayerDialogOpen] = useState(false);
  const [pName, setPName] = useState("");
  const [pJersey, setPJersey] = useState("");
  const [pPos, setPPos] = useState<string>("RL");
  const [pHand, setPHand] = useState<string>("RIGHT");
  const [pThreat, setPThreat] = useState<ThreatLevel>("HIGH");
  const [pSevenM, setPSevenM] = useState(false);
  const [pFeint, setPFeint] = useState("");
  const [pNotes, setPNotes] = useState("");
  const [pZones, setPZones] = useState<ShotZones>(DEFAULT_SHOT_ZONES);
  const [savingPlayer, setSavingPlayer] = useState(false);

  // New Scouting Note Dialog
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [nTitle, setNTitle] = useState("");
  const [nContent, setNContent] = useState("");
  const [nVideo, setNVideo] = useState("");
  const [nEventId, setNEventId] = useState("");
  const [nPlayId, setNPlayId] = useState("");
  const [nShared, setNShared] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [oRes, eRes] = await Promise.all([
        fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/opponents`, {
          cache: "no-store",
        }),
        fetch(
          `/api/v1/teams/${encodeURIComponent(teamId)}/events?type=MATCH`,
          { cache: "no-store" }
        ),
      ]);
      if (oRes.ok) {
        const list: OpponentDTO[] = (await oRes.json()).opponents ?? [];
        setOpponents(list);
      }
      if (eRes.ok) {
        setEvents((await eRes.json()).events ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/opponents`, {
        cache: "no-store",
      }),
      fetch(`/api/v1/teams/${encodeURIComponent(teamId)}/events?type=MATCH`, {
        cache: "no-store",
      }),
    ])
      .then(async ([oRes, eRes]) => {
        if (!active) return;
        if (oRes.ok) setOpponents((await oRes.json()).opponents ?? []);
        if (eRes.ok) setEvents((await eRes.json()).events ?? []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId]);

  const activeOpponent =
    opponents.find((o) => o.id === selectedOpponentId) ?? opponents[0] ?? null;

  function toggleChip(
    list: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    val: string
  ) {
    setter(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);
  }

  async function handleCreateOpponent(e: React.FormEvent) {
    e.preventDefault();
    setSavingOpp(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/opponents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: oppName,
            leagueName: oppLeague || null,
            externalUrl: oppExternalUrl || null,
            defenseSystems: oppDef,
            attackSystems: oppAtt,
            strengths: oppStrengths || null,
            weaknesses: oppWeaknesses || null,
            transitionNotes: oppTransition || null,
          }),
        }
      );
      if (res.ok) {
        const { opponent } = await res.json();
        setOppName("");
        setOppLeague("");
        setOppExternalUrl("");
        setOppStrengths("");
        setOppWeaknesses("");
        setOppTransition("");
        setOppDialogOpen(false);
        await loadData();
        setSelectedOpponentId(opponent.id);
      }
    } finally {
      setSavingOpp(false);
    }
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOpponent) return;
    setSavingPlayer(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/opponents/${encodeURIComponent(activeOpponent.id)}/players`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pName,
            jerseyNumber: pJersey ? Number(pJersey) : null,
            position: (pPos || null) as HandballPosition | null,
            throwingHand: (pHand || null) as ThrowingHand | null,
            isSevenMeterShooter: pSevenM,
            threatLevel: pThreat,
            feintPreference: pFeint || null,
            notes: pNotes || null,
            shotZones: pZones,
          }),
        }
      );
      if (res.ok) {
        setPName("");
        setPJersey("");
        setPFeint("");
        setPNotes("");
        setPZones(DEFAULT_SHOT_ZONES);
        setPlayerDialogOpen(false);
        await loadData();
      }
    } finally {
      setSavingPlayer(false);
    }
  }

  async function handleDeletePlayer(playerId: string) {
    if (!activeOpponent) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/opponents/${encodeURIComponent(activeOpponent.id)}/players/${encodeURIComponent(playerId)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadData();
  }

  async function handleCreateNote(e: React.FormEvent) {
    e.preventDefault();
    if (!activeOpponent) return;
    setSavingNote(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/scouting-notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opponentId: activeOpponent.id,
            title: nTitle,
            content: nContent,
            videoUrl: nVideo || null,
            eventId: nEventId || null,
            tacticPlayId: nPlayId || null,
            isSharedWithTeam: nShared,
          }),
        }
      );
      if (res.ok) {
        setNTitle("");
        setNContent("");
        setNVideo("");
        setNEventId("");
        setNPlayId("");
        setNShared(false);
        setNoteDialogOpen(false);
        await loadData();
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function handleToggleNoteShare(noteId: string, current: boolean) {
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/scouting-notes/${encodeURIComponent(noteId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSharedWithTeam: !current }),
      }
    );
    if (res.ok) await loadData();
  }

  return (
    <div className="space-y-6">
      {/* Gegner-Auswahl & Neu-Button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {opponents.map((opp) => (
            <button
              key={opp.id}
              type="button"
              onClick={() => setSelectedOpponentId(opp.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
                activeOpponent?.id === opp.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {opp.name}
            </button>
          ))}
        </div>

        {isStaff && (
          <Button size="sm" onClick={() => setOppDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Gegner-Dossier anlegen
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Lade Gegner-Dossiers…</p>
      ) : !activeOpponent ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Noch keine Gegner-Dossiers angelegt.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Dossier-Übersicht */}
          <Card data-testid={`opponent-dossier-${activeOpponent.id}`}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    {activeOpponent.name}
                  </CardTitle>
                  {activeOpponent.leagueName && (
                    <CardDescription>{activeOpponent.leagueName}</CardDescription>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeOpponent.defenseSystems.map((s) => (
                    <Badge key={s} variant="secondary">
                      Abwehr: {s}
                    </Badge>
                  ))}
                  {activeOpponent.attackSystems.map((s) => (
                    <Badge key={s} variant="outline">
                      Angriff: {s}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3 text-xs">
              {activeOpponent.strengths && (
                <div className="rounded-lg border border-red-200/70 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/30 p-3 space-y-1">
                  <p className="font-bold text-red-800 dark:text-red-300">
                    Stärken des Gegners
                  </p>
                  <p className="text-foreground">{activeOpponent.strengths}</p>
                </div>
              )}
              {activeOpponent.weaknesses && (
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/30 p-3 space-y-1">
                  <p className="font-bold text-emerald-800 dark:text-emerald-300">
                    Unsere Chancen / Schwächen
                  </p>
                  <p className="text-foreground">{activeOpponent.weaknesses}</p>
                </div>
              )}
              {activeOpponent.transitionNotes && (
                <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
                  <p className="font-bold text-foreground">Umschaltverhalten</p>
                  <p className="text-muted-foreground">
                    {activeOpponent.transitionNotes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schlüsselspieler-Karten mit 3x3 Wurfzonen-Heatmap */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold flex items-center gap-1.5">
                <Crosshair className="h-4 w-4 text-primary" />
                Schlüsselspieler & Wurfzonen ({activeOpponent.keyPlayers.length})
              </h2>
              {isStaff && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setNuligaImportOpen(true)}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Aus nuLiga importieren
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPlayerDialogOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Schlüsselspieler hinzufügen
                  </Button>
                </div>
              )}
            </div>

            {activeOpponent.keyPlayers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Schlüsselspieler erfasst.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {activeOpponent.keyPlayers.map((player) => (
                  <Card key={player.id}>
                    <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground font-mono text-xs font-bold">
                            {player.jerseyNumber
                              ? `#${player.jerseyNumber}`
                              : "–"}
                          </span>
                          <h3 className="font-bold text-sm break-words">{player.name}</h3>
                          {player.position && (
                            <Badge variant="position">{player.position}</Badge>
                          )}
                          {player.isSevenMeterShooter && (
                            <Badge variant="injured" className="gap-1">
                              <Flame className="h-3 w-3" />
                              7m-Schütze
                              {player.sevenMeterGoals !== null
                                ? ` (${player.sevenMeterGoals}${player.sevenMeterAttempts ? `/${player.sevenMeterAttempts}` : ""})`
                                : ""}
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {player.throwingHand && (
                            <span>
                              Wurfhand:{" "}
                              <strong className="text-foreground">
                                {THROWING_HAND_LABELS[player.throwingHand]}
                              </strong>
                            </span>
                          )}
                          <Badge
                            variant={
                              player.threatLevel === "HIGH"
                                ? "injured"
                                : player.threatLevel === "MEDIUM"
                                  ? "unavailable"
                                  : "secondary"
                            }
                          >
                            {THREAT_LEVEL_LABELS[player.threatLevel]}
                          </Badge>
                          {player.goalsTotal !== null && (
                            <Badge variant="outline" className="font-normal">
                              nuLiga: {player.goalsTotal} Tore
                              {player.gamesPlayed
                                ? ` · ${player.gamesPlayed} Sp. (Ø ${(player.goalsTotal / player.gamesPlayed).toFixed(1).replace(".", ",")})`
                                : ""}
                            </Badge>
                          )}
                        </div>

                        {player.feintPreference && (
                          <p className="text-xs text-foreground rounded bg-muted/40 p-2">
                            <strong className="text-primary">Täuschung:</strong>{" "}
                            {player.feintPreference}
                          </p>
                        )}
                        {player.notes && (
                          <p className="text-xs text-muted-foreground">
                            {player.notes}
                          </p>
                        )}

                        {isStaff && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive"
                            onClick={() => handleDeletePlayer(player.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Entfernen
                          </Button>
                        )}
                      </div>

                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Wurfzonen-Heatmap
                        </span>
                        <ShotZoneGoal zones={player.shotZones} compact />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Hinspiel-, Video-Notizen & Matchplan-Verknüpfung */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold flex items-center gap-1.5">
                <Video className="h-4 w-4 text-primary shrink-0" />
                Matchplan, Hinspiel- &amp; Video-Notizen (
                {activeOpponent.scoutingNotes.length})
              </h2>
              {isStaff && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNoteDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Notiz / Matchplan anlegen
                </Button>
              )}
            </div>

            {activeOpponent.scoutingNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine freigegebenen Matchplan-Notizen für diesen Gegner.
              </p>
            ) : (
              <div className="space-y-2.5">
                {activeOpponent.scoutingNotes.map((note) => (
                  <Card key={note.id} data-testid={`scouting-note-${note.id}`}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <h3 className="font-bold text-sm">{note.title}</h3>
                            {note.isSharedWithTeam ? (
                              <Badge variant="fit">Fürs Team freigegeben</Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <Lock className="h-3 w-3" />
                                Nur Trainerteam
                              </Badge>
                            )}
                            {note.eventTitle && (
                              <Badge variant="outline">
                                Spiel: {note.eventTitle}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {isStaff && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              handleToggleNoteShare(
                                note.id,
                                note.isSharedWithTeam
                              )
                            }
                          >
                            <Share2 className="h-3 w-3" />
                            {note.isSharedWithTeam
                              ? "Auf Trainer-only"
                              : "Für Team freigeben"}
                          </Button>
                        )}
                      </div>

                      <p className="text-sm text-foreground whitespace-pre-line">
                        {note.content}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {note.tacticPlayId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => onOpenTacticPlay(note.tacticPlayId!)}
                          >
                            <Waypoints className="h-3.5 w-3.5" />
                            Verknüpften Spielzug öffnen:{" "}
                            {note.tacticPlayTitle ?? "Taktikboard"}
                          </Button>
                        )}
                        {note.videoUrl && (
                          <a
                            href={note.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            Video-Analyse öffnen
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialog: Gegner-Dossier anlegen */}
      <Dialog open={oppDialogOpen} onOpenChange={setOppDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neues Gegner-Dossier anlegen</DialogTitle>
            <DialogDescription>
              Erfasse Abwehr-/Angriffssysteme, Umschaltverhalten, Stärken &
              Schwächen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateOpponent} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="op-name">Gegnername *</Label>
                <Input
                  id="op-name"
                  required
                  value={oppName}
                  onChange={(e) => setOppName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="op-league">Liga / Staffel</Label>
                <Input
                  id="op-league"
                  value={oppLeague}
                  onChange={(e) => setOppLeague(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="op-nuliga-url">
                nuLiga Team- oder Staffelseite (optional)
              </Label>
              <Input
                id="op-nuliga-url"
                type="url"
                placeholder="https://hvnb-handball.liga.nu/..."
                value={oppExternalUrl}
                onChange={(e) => setOppExternalUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Abwehrsysteme</Label>
              <div className="flex flex-wrap gap-1">
                {COMMON_DEFENSE_SYSTEMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleChip(oppDef, setOppDef, s)}
                    className={`rounded border px-2 py-0.5 text-xs cursor-pointer ${
                      oppDef.includes(s)
                        ? "border-primary bg-primary/15 text-primary font-semibold"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Angriffssysteme</Label>
              <div className="flex flex-wrap gap-1">
                {COMMON_ATTACK_SYSTEMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleChip(oppAtt, setOppAtt, s)}
                    className={`rounded border px-2 py-0.5 text-xs cursor-pointer ${
                      oppAtt.includes(s)
                        ? "border-primary bg-primary/15 text-primary font-semibold"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="op-str">Stärken</Label>
              <Input
                id="op-str"
                value={oppStrengths}
                onChange={(e) => setOppStrengths(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="op-weak">Schwächen</Label>
              <Input
                id="op-weak"
                value={oppWeaknesses}
                onChange={(e) => setOppWeaknesses(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="op-trans">Umschaltverhalten</Label>
              <Input
                id="op-trans"
                value={oppTransition}
                onChange={(e) => setOppTransition(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOppDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingOpp}>
                {savingOpp && <Loader2 className="h-4 w-4 animate-spin" />}
                Dossier anlegen
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Schlüsselspieler inkl. interaktiver Wurfzonen-Heatmap */}
      <Dialog open={playerDialogOpen} onOpenChange={setPlayerDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schlüsselspieler hinzufügen</DialogTitle>
            <DialogDescription>
              Klicke auf die Torzonen, um bevorzugte Wurfecken (0–100%)
              einzutragen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPlayer} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="kp-name">Name *</Label>
                <Input
                  id="kp-name"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kp-num">Nr.</Label>
                <Input
                  id="kp-num"
                  type="number"
                  min={1}
                  max={99}
                  value={pJersey}
                  onChange={(e) => setPJersey(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="kp-pos">Position</Label>
                <SelectNative
                  id="kp-pos"
                  value={pPos}
                  onChange={(e) => setPPos(e.target.value)}
                >
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="space-y-1">
                <Label htmlFor="kp-hand">Wurfhand</Label>
                <SelectNative
                  id="kp-hand"
                  value={pHand}
                  onChange={(e) => setPHand(e.target.value)}
                >
                  <option value="RIGHT">Rechts</option>
                  <option value="LEFT">Links</option>
                  <option value="BOTH">Beidhändig</option>
                </SelectNative>
              </div>
              <div className="space-y-1">
                <Label htmlFor="kp-threat">Gefahr</Label>
                <SelectNative
                  id="kp-threat"
                  value={pThreat}
                  onChange={(e) => setPThreat(e.target.value as ThreatLevel)}
                >
                  <option value="HIGH">Hoch</option>
                  <option value="MEDIUM">Mittel</option>
                  <option value="LOW">Niedrig</option>
                </SelectNative>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="kp-feint">Täuschung / Wurfverhalten</Label>
              <Input
                id="kp-feint"
                placeholder="z. B. geht immer über rechts"
                value={pFeint}
                onChange={(e) => setPFeint(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>Interaktive 3×3 Tor-Wurfzonen (klicken zum Ändern)</Label>
              <div className="pt-1">
                <ShotZoneGoal zones={pZones} editable onChange={setPZones} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={pSevenM}
                onChange={(e) => setPSevenM(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>7m-Schütze</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlayerDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingPlayer}>
                {savingPlayer && <Loader2 className="h-4 w-4 animate-spin" />}
                Speichern
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Matchplan / Scouting-Notiz */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Matchplan / Scouting-Notiz anlegen</DialogTitle>
            <DialogDescription>
              Verknüpfe Hinspiel- & Video-Notizen direkt mit einem Spieltermin
              und einem Spielzug aus dem Playbook.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateNote} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sn-title">Titel *</Label>
              <Input
                id="sn-title"
                required
                value={nTitle}
                onChange={(e) => setNTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sn-ev">Spieltermin verknüpfen</Label>
                <SelectNative
                  id="sn-ev"
                  value={nEventId}
                  onChange={(e) => setNEventId(e.target.value)}
                >
                  <option value="">Kein Spieltermin</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.title}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sn-play">Spielzug verknüpfen</Label>
                <SelectNative
                  id="sn-play"
                  value={nPlayId}
                  onChange={(e) => setNPlayId(e.target.value)}
                >
                  <option value="">Kein Spielzug</option>
                  {plays.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </SelectNative>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="sn-vid">Video-Link (optional)</Label>
              <Input
                id="sn-vid"
                type="url"
                placeholder="https://..."
                value={nVideo}
                onChange={(e) => setNVideo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sn-content">Inhalt *</Label>
              <textarea
                id="sn-content"
                required
                rows={4}
                value={nContent}
                onChange={(e) => setNContent(e.target.value)}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={nShared}
                onChange={(e) => setNShared(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span>Für die Mannschaft freigeben (sonst Trainer-only)</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNoteDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={savingNote}>
                {savingNote && <Loader2 className="h-4 w-4 animate-spin" />}
                Notiz speichern
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Schlüsselspieler aus nuLiga importieren */}
      {activeOpponent && (
        <NuligaPlayerImportDialog
          key={`${activeOpponent.id}-${nuligaImportOpen}`}
          open={nuligaImportOpen}
          onOpenChange={setNuligaImportOpen}
          teamId={teamId}
          opponent={activeOpponent}
          onImported={loadData}
        />
      )}
    </div>
  );
}
