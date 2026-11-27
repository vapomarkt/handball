"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Circle,
  CopyPlus,
  Crosshair,
  Hand,
  Maximize2,
  Minimize2,
  MoveRight,
  Pause,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  Shield,
  SkipBack,
  SkipForward,
  SquareDashed,
  Target,
  Trash2,
  Triangle,
  Undo2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type CourtMode,
  type DrawingKind,
  type TacticBoardData,
  type TacticDrawing,
  type TacticKeyframe,
  type TacticToken,
  type TokenKind,
} from "@/domain/schemas/tactic";
import {
  createFormationPreset,
  interpolateKeyframeTokens,
  type HandballPresetType,
} from "@/domain/services/tactic-presets";
import { cn } from "@/lib/utils";

type BoardTool = "SELECT" | DrawingKind;

interface HandballCourtBoardProps {
  courtMode: CourtMode;
  boardData: TacticBoardData;
  editable: boolean;
  onChange?: (next: { courtMode: CourtMode; boardData: TacticBoardData }) => void;
}

const TOOL_BUTTONS: Array<{
  id: BoardTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "SELECT", label: "Bewegen", icon: Hand },
  { id: "RUN", label: "Laufweg", icon: MoveRight },
  { id: "PASS", label: "Passweg", icon: ArrowUpRight },
  { id: "SCREEN", label: "Sperre", icon: Shield },
  { id: "SHOT", label: "Wurf", icon: Target },
  { id: "ZONE", label: "Zone", icon: SquareDashed },
];

function clampCoord(val: number): number {
  return Math.max(15, Math.min(985, Math.round(val)));
}

/**
 * Maßstabsgetreues Handballfeld-SVG (Halbfeld & Ganzfeld)
 * mit 6m-Torraum, 4m-TW-Linie, 7m-Linie, 9m-Freiwurflinie und Mittellinie.
 */
function HandballCourtBackground({ courtMode }: { courtMode: CourtMode }) {
  if (courtMode === "FULL_COURT") {
    return (
      <g>
        {/* Hallenboden */}
        <rect x="0" y="0" width="1000" height="1000" fill="#134e6f" />
        <rect
          x="35"
          y="40"
          width="930"
          height="920"
          fill="#1b6b93"
          stroke="#ffffff"
          strokeWidth="4"
        />

        {/* Mittellinie & Anwurfpunkt */}
        <line
          x1="500"
          y1="40"
          x2="500"
          y2="960"
          stroke="#ffffff"
          strokeWidth="3.5"
        />
        <circle cx="500" cy="500" r="8" fill="#ffffff" />

        {/* Linker 6m-Torraum */}
        <path
          d="M 35 280 A 185 185 0 0 1 220 465 L 220 535 A 185 185 0 0 1 35 720 Z"
          fill="#d95d24"
          fillOpacity="0.88"
          stroke="#ffffff"
          strokeWidth="3.5"
        />
        {/* Linke 9m-Freiwurflinie (gestrichelt) */}
        <path
          d="M 35 190 A 275 275 0 0 1 310 465 L 310 535 A 275 275 0 0 1 35 810"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeDasharray="14 10"
        />
        {/* Linke 7m-Linie & 4m-TW-Linie */}
        <line x1="255" y1="478" x2="255" y2="522" stroke="#ffffff" strokeWidth="4" />
        <line x1="155" y1="490" x2="155" y2="510" stroke="#ffffff" strokeWidth="3" />
        {/* Linkes Tor */}
        <rect
          x="12"
          y="440"
          width="23"
          height="120"
          fill="#0f172a"
          fillOpacity="0.55"
          stroke="#ffffff"
          strokeWidth="4"
        />

        {/* Rechter 6m-Torraum */}
        <path
          d="M 965 280 A 185 185 0 0 0 780 465 L 780 535 A 185 185 0 0 0 965 720 Z"
          fill="#d95d24"
          fillOpacity="0.88"
          stroke="#ffffff"
          strokeWidth="3.5"
        />
        {/* Rechte 9m-Freiwurflinie */}
        <path
          d="M 965 190 A 275 275 0 0 0 690 465 L 690 535 A 275 275 0 0 0 965 810"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeDasharray="14 10"
        />
        {/* Rechte 7m-Linie & 4m-TW-Linie */}
        <line x1="745" y1="478" x2="745" y2="522" stroke="#ffffff" strokeWidth="4" />
        <line x1="845" y1="490" x2="845" y2="510" stroke="#ffffff" strokeWidth="3" />
        {/* Rechtes Tor */}
        <rect
          x="965"
          y="440"
          width="23"
          height="120"
          fill="#0f172a"
          fillOpacity="0.55"
          stroke="#ffffff"
          strokeWidth="4"
        />
      </g>
    );
  }

  // HALF_COURT (Angriff/Abwehr – Tor oben, Mittellinie unten)
  return (
    <g>
      {/* Außenbereich & Spielfeld */}
      <rect x="0" y="0" width="1000" height="1000" fill="#134e6f" />
      <rect
        x="40"
        y="70"
        width="920"
        height="870"
        fill="#1b6b93"
        stroke="#ffffff"
        strokeWidth="4.5"
      />

      {/* 9m-Freiwurflinie (gestrichelt) */}
      <path
        d="M 105 70 A 355 355 0 0 0 430 425 L 570 425 A 355 355 0 0 0 895 70"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeDasharray="18 12"
      />

      {/* 6m-Torraum (ausgefüllt in Hallen-Terracotta) */}
      <path
        d="M 210 70 A 240 240 0 0 0 430 310 L 570 310 A 240 240 0 0 0 790 70 Z"
        fill="#d95d24"
        fillOpacity="0.9"
        stroke="#ffffff"
        strokeWidth="4.5"
      />

      {/* 4m-Torwartgrenzlinie */}
      <line
        x1="482"
        y1="220"
        x2="518"
        y2="220"
        stroke="#ffffff"
        strokeWidth="3.5"
      />

      {/* 7m-Strafwurflinie */}
      <line
        x1="470"
        y1="355"
        x2="530"
        y2="355"
        stroke="#ffffff"
        strokeWidth="5"
      />

      {/* Tor oben (3m skaliert) mit Netzstruktur */}
      <rect
        x="430"
        y="34"
        width="140"
        height="36"
        fill="#0f172a"
        fillOpacity="0.65"
        stroke="#ffffff"
        strokeWidth="5"
      />
      <line
        x1="430"
        y1="52"
        x2="570"
        y2="52"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <line
        x1="465"
        y1="34"
        x2="465"
        y2="70"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <line
        x1="500"
        y1="34"
        x2="500"
        y2="70"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <line
        x1="535"
        y1="34"
        x2="535"
        y2="70"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />

      {/* Mittellinie & Anwurfpunkt unten */}
      <line
        x1="40"
        y1="940"
        x2="960"
        y2="940"
        stroke="#ffffff"
        strokeWidth="4.5"
      />
      <circle cx="500" cy="940" r="8" fill="#ffffff" />

      {/* Dezente Abstands-Beschriftung */}
      <text
        x="500"
        y="300"
        textAnchor="middle"
        fill="#ffffff"
        fillOpacity="0.6"
        fontSize="18"
        fontWeight="700"
      >
        6m
      </text>
      <text
        x="500"
        y="416"
        textAnchor="middle"
        fill="#ffffff"
        fillOpacity="0.55"
        fontSize="18"
        fontWeight="700"
      >
        9m
      </text>
    </g>
  );
}

/**
 * Zeichnet Laufwege, Passwege, Sperren (T-Symbol), Würfe und Zonen.
 */
function DrawingElement({
  drawing,
  isPreview = false,
}: {
  drawing: TacticDrawing;
  isPreview?: boolean;
}) {
  const opacity = isPreview ? 0.65 : 0.95;

  if (drawing.kind === "ZONE") {
    const x = Math.min(drawing.x1, drawing.x2);
    const y = Math.min(drawing.y1, drawing.y2);
    const w = Math.max(12, Math.abs(drawing.x2 - drawing.x1));
    const h = Math.max(12, Math.abs(drawing.y2 - drawing.y1));
    return (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="14"
        fill={drawing.color || "#facc15"}
        fillOpacity={isPreview ? 0.2 : 0.28}
        stroke={drawing.color || "#fde047"}
        strokeWidth="3.5"
        strokeDasharray="10 6"
      />
    );
  }

  if (drawing.kind === "SCREEN") {
    // Authentisches Sperre-/Block-T-Symbol senkrecht zur Richtung
    const dx = drawing.x2 - drawing.x1;
    const dy = drawing.y2 - drawing.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = -dy / len;
    const uy = dx / len;
    const barHalf = 22;
    return (
      <g opacity={opacity}>
        <line
          x1={drawing.x1}
          y1={drawing.y1}
          x2={drawing.x2}
          y2={drawing.y2}
          stroke="#fde047"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <line
          x1={drawing.x2 - ux * barHalf}
          y1={drawing.y2 - uy * barHalf}
          x2={drawing.x2 + ux * barHalf}
          y2={drawing.y2 + uy * barHalf}
          stroke="#fde047"
          strokeWidth="8"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (drawing.kind === "PASS") {
    return (
      <line
        x1={drawing.x1}
        y1={drawing.y1}
        x2={drawing.x2}
        y2={drawing.y2}
        stroke="#fef08a"
        strokeWidth="5"
        strokeDasharray="14 10"
        strokeLinecap="round"
        markerEnd="url(#arrow-pass)"
        opacity={opacity}
      />
    );
  }

  if (drawing.kind === "SHOT") {
    return (
      <line
        x1={drawing.x1}
        y1={drawing.y1}
        x2={drawing.x2}
        y2={drawing.y2}
        stroke="#ef4444"
        strokeWidth="8"
        strokeLinecap="round"
        markerEnd="url(#arrow-shot)"
        opacity={opacity}
      />
    );
  }

  // RUN (Laufweg – durchgezogener weißer Pfeil)
  return (
    <line
      x1={drawing.x1}
      y1={drawing.y1}
      x2={drawing.x2}
      y2={drawing.y2}
      stroke="#ffffff"
      strokeWidth="6"
      strokeLinecap="round"
      markerEnd="url(#arrow-run)"
      opacity={opacity}
    />
  );
}

export function HandballCourtBoard({
  courtMode,
  boardData,
  editable,
  onChange,
}: HandballCourtBoardProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [tool, setTool] = useState<BoardTool>("SELECT");
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState<0.5 | 1 | 1.5>(1);
  const [fullscreen, setFullscreen] = useState(false);

  // Dragging & drawing refs/state
  const [draggingTokenId, setDraggingTokenId] = useState<string | null>(null);
  const [draftDrawing, setDraftDrawing] = useState<TacticDrawing | null>(null);
  const [animatedTokens, setAnimatedTokens] = useState<TacticToken[] | null>(
    null
  );
  const [animSegmentIdx, setAnimSegmentIdx] = useState(0);

  const safeIdx = Math.min(activeFrameIdx, boardData.keyframes.length - 1);
  const currentFrame: TacticKeyframe = boardData.keyframes[safeIdx];

  const emitChange = useCallback(
    (nextMode: CourtMode, nextData: TacticBoardData) => {
      onChange?.({ courtMode: nextMode, boardData: nextData });
    },
    [onChange]
  );

  // 60fps Keyframe-Animation via requestAnimationFrame
  useEffect(() => {
    if (!isPlaying || boardData.keyframes.length < 2) {
      return;
    }

    let rafId = 0;
    let segmentIndex = safeIdx >= boardData.keyframes.length - 1 ? 0 : safeIdx;
    let segmentStart = performance.now();

    const tick = (now: number) => {
      const fromFrame = boardData.keyframes[segmentIndex];
      const toFrame = boardData.keyframes[segmentIndex + 1];
      if (!fromFrame || !toFrame) {
        setIsPlaying(false);
        setAnimatedTokens(null);
        return;
      }

      const duration = Math.max(300, fromFrame.durationMs / speed);
      const progress = (now - segmentStart) / duration;

      if (progress >= 1) {
        const nextSeg = segmentIndex + 1;
        if (nextSeg >= boardData.keyframes.length - 1) {
          if (loop) {
            segmentIndex = 0;
            segmentStart = now;
            setAnimSegmentIdx(0);
            setAnimatedTokens(
              interpolateKeyframeTokens(
                boardData.keyframes[0],
                boardData.keyframes[1],
                0
              )
            );
          } else {
            setActiveFrameIdx(boardData.keyframes.length - 1);
            setIsPlaying(false);
            setAnimatedTokens(null);
            return;
          }
        } else {
          segmentIndex = nextSeg;
          segmentStart = now;
          setAnimSegmentIdx(segmentIndex);
        }
      } else {
        setAnimSegmentIdx(segmentIndex);
        setAnimatedTokens(
          interpolateKeyframeTokens(fromFrame, toFrame, progress)
        );
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, boardData.keyframes, speed, loop, safeIdx]);

  const toSvgCoords = (e: React.PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 500, y: 500 };
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1000;
    const y = ((e.clientY - rect.top) / rect.height) * 1000;
    return { x: clampCoord(x), y: clampCoord(y) };
  };

  const updateCurrentFrame = (
    updater: (frame: TacticKeyframe) => TacticKeyframe
  ) => {
    const nextFrames = boardData.keyframes.map((f, idx) =>
      idx === safeIdx ? updater(f) : f
    );
    emitChange(courtMode, { ...boardData, keyframes: nextFrames });
  };

  const handleBoardPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable || isPlaying || tool === "SELECT") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toSvgCoords(e);
    setDraftDrawing({
      id: `dr-${Date.now()}`,
      kind: tool,
      x1: x,
      y1: y,
      x2: x,
      y2: y,
    });
  };

  const handleBoardPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!editable || isPlaying) return;
    if (draggingTokenId) {
      const { x, y } = toSvgCoords(e);
      updateCurrentFrame((frame) => ({
        ...frame,
        tokens: frame.tokens.map((t) =>
          t.id === draggingTokenId ? { ...t, x, y } : t
        ),
      }));
      return;
    }
    if (draftDrawing) {
      const { x, y } = toSvgCoords(e);
      setDraftDrawing((prev) => (prev ? { ...prev, x2: x, y2: y } : null));
    }
  };

  const handleBoardPointerUp = () => {
    if (draggingTokenId) {
      setDraggingTokenId(null);
      return;
    }
    if (draftDrawing) {
      const dist = Math.hypot(
        draftDrawing.x2 - draftDrawing.x1,
        draftDrawing.y2 - draftDrawing.y1
      );
      if (dist > 14) {
        updateCurrentFrame((frame) => ({
          ...frame,
          drawings: [...frame.drawings, draftDrawing],
        }));
      }
      setDraftDrawing(null);
    }
  };

  const handleAddToken = (kind: TokenKind) => {
    if (!editable) return;
    const count = currentFrame.tokens.filter((t) => t.kind === kind).length + 1;
    const label =
      kind === "ATTACKER"
        ? `A${count}`
        : kind === "DEFENDER"
          ? `${count}`
          : kind === "GOALKEEPER"
            ? "TW"
            : "";
    const newToken: TacticToken = {
      id: `${kind.toLowerCase()}-${Date.now()}`,
      kind,
      label,
      x: 500,
      y: 500,
    };
    updateCurrentFrame((frame) => ({
      ...frame,
      tokens: [...frame.tokens, newToken],
    }));
  };

  const handleDuplicateKeyframe = () => {
    if (!editable || boardData.keyframes.length >= 16) return;
    const cloned: TacticKeyframe = {
      id: `kf-${Date.now()}`,
      label: `${boardData.keyframes.length + 1}. Schritt`,
      notes: "",
      durationMs: 1400,
      tokens: currentFrame.tokens.map((t) => ({ ...t })),
      drawings: [],
    };
    const nextFrames = [...boardData.keyframes, cloned];
    emitChange(courtMode, { ...boardData, keyframes: nextFrames });
    setActiveFrameIdx(nextFrames.length - 1);
  };

  const handleDeleteKeyframe = () => {
    if (!editable || boardData.keyframes.length <= 1) return;
    const nextFrames = boardData.keyframes.filter((_, idx) => idx !== safeIdx);
    emitChange(courtMode, { ...boardData, keyframes: nextFrames });
    setActiveFrameIdx(Math.max(0, safeIdx - 1));
  };

  const handleApplyPreset = (preset: HandballPresetType) => {
    if (!editable) return;
    setIsPlaying(false);
    setAnimatedTokens(null);
    const created = createFormationPreset(preset);
    emitChange(created.courtMode, created.boardData);
    setActiveFrameIdx(0);
  };

  const displayedTokens =
    isPlaying && animatedTokens ? animatedTokens : currentFrame.tokens;
  const displayedFrame =
    isPlaying && boardData.keyframes[animSegmentIdx]
      ? boardData.keyframes[animSegmentIdx]
      : currentFrame;

  return (
    <div
      className={cn(
        "space-y-3",
        fullscreen &&
          "fixed inset-0 z-50 bg-background p-4 sm:p-6 overflow-y-auto flex flex-col"
      )}
    >
      {/* Obere Toolbar: Werkzeuge, Vorlagen & Feldmodus */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {editable &&
            TOOL_BUTTONS.map((btn) => {
              const Icon = btn.icon;
              const active = tool === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setTool(btn.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/50 text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{btn.label}</span>
                </button>
              );
            })}

          {editable && (
            <>
              <div className="h-5 w-px bg-border mx-1" />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() =>
                  updateCurrentFrame((f) => ({
                    ...f,
                    drawings: f.drawings.slice(0, -1),
                  }))
                }
                disabled={currentFrame.drawings.length === 0}
                title="Letzte Zeichnung rückgängig"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() =>
                  updateCurrentFrame((f) => ({ ...f, drawings: [] }))
                }
                disabled={currentFrame.drawings.length === 0}
                title="Alle Pfeile in diesem Schritt löschen"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {editable && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() =>
                  emitChange(
                    courtMode === "HALF_COURT" ? "FULL_COURT" : "HALF_COURT",
                    boardData
                  )
                }
              >
                {courtMode === "HALF_COURT" ? "→ Ganzfeld" : "→ Halbfeld"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => handleAddToken("ATTACKER")}
                title="Angreifer hinzufügen"
              >
                <Plus className="h-3 w-3" /> Angr.
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => handleAddToken("DEFENDER")}
                title="Abwehrspieler hinzufügen"
              >
                <Plus className="h-3 w-3" /> Abw.
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => handleAddToken("CONE")}
                title="Hütchen hinzufügen"
              >
                <Triangle className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                onClick={() => handleAddToken("BALL")}
                title="Ball hinzufügen"
              >
                <Circle className="h-3 w-3" />
              </Button>
            </>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 px-2"
            onClick={() => setFullscreen((f) => !f)}
            aria-label="Präsentationsmodus umschalten"
            title="Präsentationsmodus (Vollbild)"
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Formations-Vorlagen (1-Klick für Trainer) */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-muted-foreground mr-1">
            Vorlagen:
          </span>
          {(
            [
              ["6_0", "6:0-Abwehr"],
              ["5_1", "5:1-Abwehr"],
              ["3_2_1", "3:2:1-Abwehr"],
              ["7_6", "7-gegen-6"],
              ["FAST_BREAK", "Gegenstoß (Ganzfeld)"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => handleApplyPreset(id)}
              className="rounded-md border border-border bg-card px-2.5 py-1 font-medium hover:border-primary hover:text-primary transition-colors cursor-pointer"
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Interaktives SVG-Handballfeld */}
      <div
        className={cn(
          "relative mx-auto w-full overflow-hidden rounded-2xl border border-border shadow-md select-none touch-none",
          fullscreen ? "max-w-3xl flex-1" : "max-w-2xl"
        )}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 1000 1000"
          className="block h-auto w-full aspect-square"
          data-testid="handball-tactics-svg"
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={handleBoardPointerUp}
          onPointerCancel={handleBoardPointerUp}
        >
          <defs>
            <marker
              id="arrow-run"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ffffff" />
            </marker>
            <marker
              id="arrow-pass"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#fef08a" />
            </marker>
            <marker
              id="arrow-shot"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
            </marker>
          </defs>

          <HandballCourtBackground courtMode={courtMode} />

          {/* Gespeicherte Zeichnungen des aktuellen Keyframes */}
          {displayedFrame.drawings.map((d) => (
            <DrawingElement key={d.id} drawing={d} />
          ))}

          {/* Live-Zeichnungsvorschau */}
          {draftDrawing && <DrawingElement drawing={draftDrawing} isPreview />}

          {/* Spieler-, Torwart-, Abwehr-, Ball- & Hütchen-Tokens */}
          {displayedTokens.map((token) => {
            const isDraggable = editable && tool === "SELECT" && !isPlaying;

            if (token.kind === "BALL") {
              return (
                <g
                  key={token.id}
                  transform={`translate(${token.x}, ${token.y})`}
                  className={isDraggable ? "cursor-grab active:cursor-grabbing" : ""}
                  onPointerDown={(e) => {
                    if (!isDraggable) return;
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingTokenId(token.id);
                  }}
                >
                  <circle
                    r="15"
                    fill="#facc15"
                    stroke="#0f172a"
                    strokeWidth="3.5"
                  />
                  <circle r="5" fill="#0f172a" fillOpacity="0.4" />
                </g>
              );
            }

            if (token.kind === "CONE") {
              return (
                <g
                  key={token.id}
                  transform={`translate(${token.x}, ${token.y})`}
                  className={isDraggable ? "cursor-grab active:cursor-grabbing" : ""}
                  onPointerDown={(e) => {
                    if (!isDraggable) return;
                    e.stopPropagation();
                    svgRef.current?.setPointerCapture(e.pointerId);
                    setDraggingTokenId(token.id);
                  }}
                >
                  <polygon
                    points="0,-18 16,14 -16,14"
                    fill="#fb923c"
                    stroke="#ffffff"
                    strokeWidth="3"
                  />
                </g>
              );
            }

            const fill =
              token.kind === "ATTACKER"
                ? "#d95d24"
                : token.kind === "GOALKEEPER"
                  ? "#0d9488"
                  : "#0f172a";

            return (
              <g
                key={token.id}
                transform={`translate(${token.x}, ${token.y})`}
                className={isDraggable ? "cursor-grab active:cursor-grabbing" : ""}
                data-testid={`tactic-token-${token.id}`}
                onPointerDown={(e) => {
                  if (!isDraggable) return;
                  e.stopPropagation();
                  svgRef.current?.setPointerCapture(e.pointerId);
                  setDraggingTokenId(token.id);
                }}
              >
                <circle
                  r="26"
                  fill={fill}
                  stroke="#ffffff"
                  strokeWidth="4"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#ffffff"
                  fontSize="19"
                  fontWeight="800"
                  style={{ pointerEvents: "none" }}
                >
                  {token.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Animations-Steuerung & Keyframe-Timeline */}
      <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Playback Controls */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setIsPlaying(false);
                setAnimatedTokens(null);
                setActiveFrameIdx((i) => Math.max(0, i - 1));
              }}
              disabled={safeIdx === 0 && !isPlaying}
              aria-label="Vorheriger Schritt"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isPlaying) {
                  setIsPlaying(false);
                  setAnimatedTokens(null);
                } else if (boardData.keyframes.length >= 2) {
                  setIsPlaying(true);
                }
              }}
              disabled={boardData.keyframes.length < 2}
              data-testid="tactic-play-button"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Abspielen
                </>
              )}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setIsPlaying(false);
                setAnimatedTokens(null);
                setActiveFrameIdx((i) =>
                  Math.min(boardData.keyframes.length - 1, i + 1)
                );
              }}
              disabled={safeIdx >= boardData.keyframes.length - 1 && !isPlaying}
              aria-label="Nächster Schritt"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              size="sm"
              variant={loop ? "secondary" : "ghost"}
              onClick={() => setLoop((l) => !l)}
              title="Endlosschleife"
              className="h-9 px-2.5 text-xs"
            >
              <Repeat className="h-3.5 w-3.5" />
            </Button>

            <button
              type="button"
              onClick={() =>
                setSpeed((s) => (s === 0.5 ? 1 : s === 1 ? 1.5 : 0.5))
              }
              className="rounded-md border border-border px-2 py-1 text-xs font-mono font-bold hover:bg-muted cursor-pointer"
              title="Animationsgeschwindigkeit"
            >
              {speed}×
            </button>
          </div>

          {/* Keyframe-Aktionen für Trainer */}
          {editable && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDuplicateKeyframe}
                disabled={boardData.keyframes.length >= 16}
              >
                <CopyPlus className="h-3.5 w-3.5" />
                Schritt hinzufügen
              </Button>
              {boardData.keyframes.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={handleDeleteKeyframe}
                  aria-label="Aktuellen Schritt löschen"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Keyframe-Pills */}
        <div className="flex flex-wrap gap-1.5">
          {boardData.keyframes.map((kf, idx) => {
            const active = isPlaying
              ? idx === animSegmentIdx
              : idx === safeIdx;
            return (
              <button
                key={kf.id}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setAnimatedTokens(null);
                  setActiveFrameIdx(idx);
                }}
                className={cn(
                  "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                  active
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {kf.label}
              </button>
            );
          })}
        </div>

        {/* Coaching-Notiz zum aktuellen Schritt */}
        {editable ? (
          <div className="grid gap-2 sm:grid-cols-3 pt-1">
            <Input
              aria-label="Schritt-Titel"
              value={currentFrame.label}
              onChange={(e) =>
                updateCurrentFrame((f) => ({ ...f, label: e.target.value }))
              }
              placeholder="Schritt-Titel"
              className="h-9 text-xs font-semibold"
            />
            <Input
              aria-label="Coaching-Hinweis zum Schritt"
              value={currentFrame.notes ?? ""}
              onChange={(e) =>
                updateCurrentFrame((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Coaching-Hinweis für diesen Schritt…"
              className="h-9 text-xs sm:col-span-2"
            />
          </div>
        ) : (
          displayedFrame.notes && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
              <Badge variant="secondary" className="shrink-0">
                <Crosshair className="h-3 w-3 mr-1" />
                {displayedFrame.label}
              </Badge>
              <p className="text-foreground">{displayedFrame.notes}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
