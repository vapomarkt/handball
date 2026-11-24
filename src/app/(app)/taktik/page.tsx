"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  Lock,
  Plus,
  Save,
  Share2,
  Shield,
  Trash2,
  Waypoints,
} from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
import { ScoutingPanel } from "@/components/scouting/scouting-panel";
import { HandballCourtBoard } from "@/components/tactics/handball-court-board";
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
  COURT_MODE_LABELS,
  TACTIC_CATEGORY_LABELS,
  type CourtMode,
  type TacticBoardData,
  type TacticCategory,
  type TacticPlayDTO,
} from "@/domain/schemas/tactic";
import { createFormationPreset } from "@/domain/services/tactic-presets";

type ActiveTab = "playbook" | "scouting";

const CATEGORIES = Object.keys(TACTIC_CATEGORY_LABELS) as TacticCategory[];

export default function TaktikUndScoutingPage() {
  const { me, activeTeam } = useAppContext();

  const [tab, setTab] = useState<ActiveTab>("playbook");
  const [plays, setPlays] = useState<TacticPlayDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | TacticCategory>(
    "ALL"
  );

  // Aktiver Spielzug im Editor / Viewer
  const [selectedPlayId, setSelectedPlayId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("Neuer Spielzug");
  const [draftDesc, setDraftDesc] = useState("");
  const [draftCategory, setDraftCategory] =
    useState<TacticCategory>("TRIGGER_PLAY");
  const [draftShared, setDraftShared] = useState(false);
  const [draftCourtMode, setDraftCourtMode] = useState<CourtMode>("HALF_COURT");
  const [draftBoard, setDraftBoard] = useState<TacticBoardData>(
    () => createFormationPreset("6_0").boardData
  );
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isStaff =
    activeTeam?.role === "CLUB_ADMIN" ||
    activeTeam?.role === "COACH" ||
    activeTeam?.role === "ASSISTANT_COACH";

  const selectPlayIntoEditor = useCallback((play: TacticPlayDTO) => {
    setSelectedPlayId(play.id);
    setIsCreatingNew(false);
    setDraftTitle(play.title);
    setDraftDesc(play.description ?? "");
    setDraftCategory(play.category);
    setDraftShared(play.isSharedWithTeam);
    setDraftCourtMode(play.courtMode);
    setDraftBoard(play.boardData);
    setStatusMsg(null);
  }, []);

  const loadPlays = useCallback(async (): Promise<TacticPlayDTO[]> => {
    if (!activeTeam) return [];
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/tactics`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const list: TacticPlayDTO[] = (await res.json()).plays ?? [];
        setPlays(list);
        return list;
      }
    } finally {
      setLoading(false);
    }
    return [];
  }, [activeTeam]);

  useEffect(() => {
    if (!activeTeam) return;
    let active = true;
    fetch(`/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/tactics`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!active || !res.ok) return;
        const list: TacticPlayDTO[] = (await res.json()).plays ?? [];
        setPlays(list);
        if (list.length > 0) {
          selectPlayIntoEditor(list[0]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeTeam, selectPlayIntoEditor]);

  const filteredPlays = useMemo(() => {
    if (categoryFilter === "ALL") return plays;
    return plays.filter((p) => p.category === categoryFilter);
  }, [plays, categoryFilter]);

  function startNewPlay() {
    const preset = createFormationPreset("6_0");
    setSelectedPlayId(null);
    setIsCreatingNew(true);
    setDraftTitle("Neue Auslösehandlung");
    setDraftDesc("");
    setDraftCategory("TRIGGER_PLAY");
    setDraftShared(false);
    setDraftCourtMode(preset.courtMode);
    setDraftBoard(preset.boardData);
    setStatusMsg(null);
  }

  async function handleSavePlay() {
    if (!activeTeam) return;
    setSaving(true);
    setStatusMsg(null);
    try {
      const url =
        isCreatingNew || !selectedPlayId
          ? `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/tactics`
          : `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/tactics/${encodeURIComponent(selectedPlayId)}`;

      const res = await fetch(url, {
        method: isCreatingNew || !selectedPlayId ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          description: draftDesc || null,
          category: draftCategory,
          courtMode: draftCourtMode,
          boardData: draftBoard,
          isSharedWithTeam: draftShared,
        }),
      });
      if (res.ok) {
        const { play } = await res.json();
        await loadPlays();
        selectPlayIntoEditor(play);
        setStatusMsg("Spielzug im Playbook gespeichert.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlay(playId: string) {
    if (!activeTeam) return;
    if (!window.confirm("Diesen Spielzug wirklich aus dem Playbook löschen?"))
      return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/tactics/${encodeURIComponent(playId)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      const next = await loadPlays();
      if (next.length > 0) selectPlayIntoEditor(next[0]);
      else startNewPlay();
    }
  }

  function handleJumpToPlay(playId: string) {
    const found = plays.find((p) => p.id === playId);
    if (found) {
      selectPlayIntoEditor(found);
      setTab("playbook");
    }
  }

  if (!activeTeam || !me) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            {activeTeam.clubName} · {activeTeam.teamName}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Taktikboard & Gegner-Scouting
          </h1>
          <p className="text-sm text-muted-foreground">
            Animiertes Handball-Playbook (Halbfeld & Ganzfeld) und
            Gegner-Dossiers mit Wurfzonen-Heatmap
          </p>
        </div>

        {isStaff && tab === "playbook" && (
          <Button onClick={startNewPlay}>
            <Plus className="h-4 w-4" />
            Neuer Spielzug
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setTab("playbook")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            tab === "playbook"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <Waypoints className="h-4 w-4" />
          Taktikboard & Playbook ({plays.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("scouting")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold cursor-pointer ${
            tab === "scouting"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-muted-foreground hover:bg-muted border border-border"
          }`}
        >
          <Shield className="h-4 w-4" />
          Gegner-Scouting & Matchplan
        </button>
      </div>

      {/* TAB 1: INTERAKTIVES TAKTIKBOARD & PLAYBOOK */}
      {tab === "playbook" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Playbook-Liste (links) */}
          <div className="lg:col-span-4 space-y-3">
            <SelectNative
              aria-label="Kategorie filtern"
              value={categoryFilter}
              onChange={(e) =>
                setCategoryFilter(e.target.value as "ALL" | TacticCategory)
              }
              className="h-9 text-xs"
            >
              <option value="ALL">Alle Kategorien ({plays.length})</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TACTIC_CATEGORY_LABELS[c]}
                </option>
              ))}
            </SelectNative>

            {loading ? (
              <p className="text-sm text-muted-foreground">Lade Playbook…</p>
            ) : filteredPlays.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-xs text-muted-foreground">
                  Keine Spielzüge in dieser Kategorie.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredPlays.map((play) => {
                  const active =
                    !isCreatingNew && selectedPlayId === play.id;
                  return (
                    <div
                      key={play.id}
                      data-testid={`tactic-card-${play.id}`}
                      onClick={() => selectPlayIntoEditor(play)}
                      className={`rounded-xl border p-3.5 cursor-pointer transition-colors space-y-1.5 ${
                        active
                          ? "border-primary bg-primary/8 shadow-xs"
                          : "border-border bg-card hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="font-bold text-sm leading-snug">
                          {play.title}
                        </h2>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlay(play.id);
                            }}
                            aria-label={`Spielzug ${play.title} löschen`}
                            className="text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary">
                          {TACTIC_CATEGORY_LABELS[play.category]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {play.boardData.keyframes.length} Schritte
                        </Badge>
                        {play.isSharedWithTeam ? (
                          <Badge variant="fit" className="text-[10px]">
                            Freigegeben
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] gap-0.5">
                            <Lock className="h-2.5 w-2.5" />
                            Entwurf
                          </Badge>
                        )}
                      </div>
                      {play.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {play.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Interaktives Taktikboard (rechts) */}
          <div className="lg:col-span-8 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                {isStaff ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="tp-play-title" className="text-xs">
                          Spielzug-Name
                        </Label>
                        <Input
                          id="tp-play-title"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          className="h-9 text-sm font-semibold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="tp-play-cat" className="text-xs">
                          Kategorie
                        </Label>
                        <SelectNative
                          id="tp-play-cat"
                          value={draftCategory}
                          onChange={(e) =>
                            setDraftCategory(e.target.value as TacticCategory)
                          }
                          className="h-9 text-xs"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {TACTIC_CATEGORY_LABELS[c]}
                            </option>
                          ))}
                        </SelectNative>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={draftShared}
                          onChange={(e) => setDraftShared(e.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <Share2 className="h-3.5 w-3.5 text-primary" />
                        <span>Für die Mannschaft freigeben</span>
                      </label>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSavePlay}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {isCreatingNew
                          ? "Neu im Playbook speichern"
                          : "Änderungen speichern"}
                      </Button>
                    </div>

                    {statusMsg && (
                      <p className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {statusMsg}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Badge variant="secondary">
                        {TACTIC_CATEGORY_LABELS[draftCategory]}
                      </Badge>
                      <Badge variant="outline">
                        {COURT_MODE_LABELS[draftCourtMode]}
                      </Badge>
                    </div>
                    <CardTitle>{draftTitle}</CardTitle>
                    {draftDesc && (
                      <CardDescription className="mt-1">
                        {draftDesc}
                      </CardDescription>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <HandballCourtBoard
                  key={selectedPlayId ?? "new-play"}
                  courtMode={draftCourtMode}
                  boardData={draftBoard}
                  editable={isStaff}
                  onChange={({ courtMode, boardData }) => {
                    setDraftCourtMode(courtMode);
                    setDraftBoard(boardData);
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: GEGNER-SCOUTING & MATCHPLAN */}
      {tab === "scouting" && (
        <ScoutingPanel
          teamId={activeTeam.teamId}
          isStaff={isStaff}
          plays={plays}
          onOpenTacticPlay={handleJumpToPlay}
        />
      )}
    </div>
  );
}
