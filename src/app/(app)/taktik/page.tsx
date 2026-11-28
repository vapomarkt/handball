"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Dumbbell,
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
import { TrainingPanel } from "@/components/training/training-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CARD_ACTION_LAYER_CLASS,
  CARD_OVERLAY_TRIGGER_CLASS,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CardListSkeleton, EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { SelectNative } from "@/components/ui/select-native";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  COURT_MODE_LABELS,
  TACTIC_CATEGORY_LABELS,
  type CourtMode,
  type TacticBoardData,
  type TacticCategory,
  type TacticPlayDTO,
} from "@/domain/schemas/tactic";
import { createFormationPreset } from "@/domain/services/tactic-presets";

type ActiveTab = "playbook" | "scouting" | "plans" | "drills";

const CATEGORIES = Object.keys(TACTIC_CATEGORY_LABELS) as TacticCategory[];

export default function TaktikUndTrainingPage() {
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
  const [deletePlayTarget, setDeletePlayTarget] =
    useState<TacticPlayDTO | null>(null);

  const isCoachingStaff = Boolean(
    activeTeam?.isClubAdmin ||
      activeTeam?.role === "CLUB_ADMIN" ||
      activeTeam?.role === "COACH" ||
      activeTeam?.role === "ASSISTANT_COACH"
  );

  const isTeamStaff = Boolean(
    isCoachingStaff || activeTeam?.role === "TEAM_MANAGER"
  );

  const effectiveTab: ActiveTab =
    !isTeamStaff && (tab === "plans" || tab === "drills") ? "playbook" : tab;

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

  async function confirmDeletePlay() {
    if (!activeTeam || !deletePlayTarget) return;
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(activeTeam.teamId)}/tactics/${encodeURIComponent(deletePlayTarget.id)}`,
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
    <div className="space-y-5">
      {/* Kompakter, rollenadaptiver Header */}
      <PageHeader
        title={isTeamStaff ? "Taktik & Training" : "Playbook"}
        subtitle={
          isTeamStaff
            ? `${activeTeam.teamName} · Spielzüge, Scouting & Trainingsplanung`
            : `Freigegebene Spielzüge · ${activeTeam.teamName}`
        }
        actions={
          isCoachingStaff && effectiveTab === "playbook" ? (
            <Button onClick={startNewPlay}>
              <Plus className="h-4 w-4" />
              Neuer Spielzug
            </Button>
          ) : undefined
        }
      />

      {/* Ruhige Segmented Tabs – fachlich sauber vereint, Trainingsplanung nur für Staff */}
      <Tabs
        value={effectiveTab}
        onValueChange={(v) => setTab(v as ActiveTab)}
      >
        <TabsList>
          <TabsTrigger value="playbook">
            <Waypoints className="h-4 w-4" />
            Playbook ({plays.length})
          </TabsTrigger>
          <TabsTrigger value="scouting">
            <Shield className="h-4 w-4" />
            {isTeamStaff ? "Scouting" : "Matchplan"}
          </TabsTrigger>
          {isTeamStaff && (
            <TabsTrigger value="plans">
              <Dumbbell className="h-4 w-4" />
              Trainingsplaner
            </TabsTrigger>
          )}
          {isTeamStaff && (
            <TabsTrigger value="drills">
              <BookOpen className="h-4 w-4" />
              Übungsbibliothek
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* TAB 1: INTERAKTIVES TAKTIKBOARD & PLAYBOOK */}
      {effectiveTab === "playbook" && (
        <>
          {!loading && plays.length === 0 && !isCoachingStaff ? (
            <EmptyState
              icon={<Waypoints className="h-5 w-5" />}
              title="Noch keine freigegebenen Spielzüge"
              description="Sobald deine Trainer Spielzüge im Playbook freigeben, kannst du sie hier animiert ansehen."
            />
          ) : (
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Playbook-Liste (links) */}
              <div className="lg:col-span-4 min-w-0 space-y-3">
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
                  <CardListSkeleton count={3} />
                ) : filteredPlays.length === 0 ? (
                  <EmptyState
                    title="Keine Spielzüge"
                    description="In dieser Kategorie sind aktuell keine Spielzüge vorhanden."
                  />
                ) : (
                  <div className="space-y-2">
                    {filteredPlays.map((play) => {
                      const active =
                        !isCreatingNew && selectedPlayId === play.id;
                      return (
                        <Card
                          key={play.id}
                          interactive
                          data-testid={`tactic-card-${play.id}`}
                          className={cn(
                            "p-3.5 space-y-1.5",
                            active && "border-primary bg-primary/5"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h2 className="font-bold text-sm leading-snug">
                              <button
                                type="button"
                                aria-pressed={active}
                                onClick={() => selectPlayIntoEditor(play)}
                                className={cn(
                                  CARD_OVERLAY_TRIGGER_CLASS,
                                  "transition-colors group-hover:text-primary"
                                )}
                              >
                                {play.title}
                              </button>
                            </h2>
                            {isCoachingStaff && (
                              <button
                                type="button"
                                onClick={() => setDeletePlayTarget(play)}
                                aria-label={`Spielzug ${play.title} löschen`}
                                className={cn(
                                  CARD_ACTION_LAYER_CLASS,
                                  "text-muted-foreground hover:text-destructive cursor-pointer p-1"
                                )}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Max. 2 Badges + ruhige Metazeile */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="secondary">
                              {TACTIC_CATEGORY_LABELS[play.category]}
                            </Badge>
                            {isCoachingStaff && !play.isSharedWithTeam && (
                              <Badge
                                variant="outline"
                                className="text-[11px] gap-0.5"
                              >
                                <Lock className="h-2.5 w-2.5" />
                                Entwurf
                              </Badge>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              {play.boardData.keyframes.length} Schritte
                            </span>
                          </div>
                          {play.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {play.description}
                            </p>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Interaktives Taktikboard (rechts) */}
              <div className="lg:col-span-8 min-w-0 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    {isCoachingStaff ? (
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
                                setDraftCategory(
                                  e.target.value as TacticCategory
                                )
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
                            variant="outline"
                            onClick={handleSavePlay}
                            disabled={saving}
                          >
                            {saving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 text-primary" />
                            )}
                            {isCreatingNew
                              ? "Im Playbook speichern"
                              : "Speichern"}
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
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
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
                      editable={isCoachingStaff}
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
        </>
      )}

      {/* TAB 2: GEGNER-SCOUTING & MATCHPLAN */}
      {effectiveTab === "scouting" && (
        <ScoutingPanel
          teamId={activeTeam.teamId}
          isStaff={isCoachingStaff}
          plays={plays}
          onOpenTacticPlay={handleJumpToPlay}
        />
      )}

      {/* TAB 3 & 4: TRAININGSPLANER & ÜBUNGSBIBLIOTHEK (fachlich sauber vereint) */}
      {effectiveTab === "plans" && isTeamStaff && (
        <TrainingPanel
          teamId={activeTeam.teamId}
          mode="plans"
          isStaff={isCoachingStaff}
        />
      )}
      {effectiveTab === "drills" && isTeamStaff && (
        <TrainingPanel
          teamId={activeTeam.teamId}
          mode="drills"
          isStaff={isCoachingStaff}
        />
      )}

      <ConfirmDialog
        open={deletePlayTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeletePlayTarget(null);
        }}
        title="Spielzug löschen?"
        description={
          deletePlayTarget
            ? `Spielzug „${deletePlayTarget.title}“ wirklich aus dem Playbook löschen?`
            : undefined
        }
        confirmLabel="Spielzug löschen"
        onConfirm={confirmDeletePlay}
      />
    </div>
  );
}
