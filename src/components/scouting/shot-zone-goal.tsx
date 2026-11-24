"use client";

import { type ShotZones } from "@/domain/schemas/scouting";
import { cn } from "@/lib/utils";

interface ShotZoneGoalProps {
  zones: ShotZones;
  editable?: boolean;
  onChange?: (next: ShotZones) => void;
  compact?: boolean;
}

const GRID_KEYS: Array<Array<keyof ShotZones>> = [
  ["topLeft", "topCenter", "topRight"],
  ["midLeft", "midCenter", "midRight"],
  ["botLeft", "botCenter", "botRight"],
];

function getHeatClass(val: number): string {
  if (val >= 75) return "bg-red-600/85 text-white border-red-700";
  if (val >= 50) return "bg-orange-500/80 text-white border-orange-600";
  if (val >= 25) return "bg-amber-400/75 text-slate-950 border-amber-500";
  if (val > 0) return "bg-amber-200/70 text-slate-900 border-amber-300";
  return "bg-muted/60 text-muted-foreground border-border";
}

export function ShotZoneGoal({
  zones,
  editable = false,
  onChange,
  compact = false,
}: ShotZoneGoalProps) {
  function cycleZone(key: keyof ShotZones) {
    if (!editable || !onChange) return;
    const current = zones[key] ?? 0;
    const nextVal =
      current < 25 ? 25 : current < 50 ? 50 : current < 75 ? 75 : current < 100 ? 100 : 0;
    onChange({ ...zones, [key]: nextVal });
  }

  return (
    <div className={cn("inline-block", compact ? "w-36" : "w-52")}>
      {/* Rot-Weißer Handball-Torrahmen */}
      <div className="rounded-t-md border-t-4 border-x-4 border-red-600 bg-card p-1 shadow-2xs">
        <div className="grid grid-cols-3 gap-1">
          {GRID_KEYS.flat().map((key) => {
            const val = zones[key] ?? 0;
            return (
              <button
                key={key}
                type="button"
                disabled={!editable}
                onClick={() => cycleZone(key)}
                title={`${key}: ${val}%`}
                className={cn(
                  "flex items-center justify-center rounded border font-mono font-bold transition-colors",
                  compact ? "h-7 text-[10px]" : "h-10 text-xs",
                  getHeatClass(val),
                  editable && "cursor-pointer hover:ring-2 hover:ring-primary"
                )}
              >
                {val > 0 ? `${val}%` : "–"}
              </button>
            );
          })}
        </div>
      </div>
      <div className="h-1 w-full bg-slate-300 dark:bg-slate-700 rounded-b-xs" />
    </div>
  );
}
