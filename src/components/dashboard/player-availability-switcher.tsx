"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Ban, CheckCircle2, Loader2 } from "lucide-react";
import type { MeMembership } from "@/components/providers/app-context";
import {
  AVAILABILITY_STATUS_LABELS,
  HANDBALL_POSITION_LABELS,
  type AvailabilityStatus,
} from "@/domain/schemas/handball";
import { cn } from "@/lib/utils";

interface PlayerAvailabilitySwitcherProps {
  teamId: string;
  membership: MeMembership;
  onStatusSaved: () => Promise<void> | void;
}

const STATUS_OPTIONS: ReadonlyArray<{
  value: AvailabilityStatus;
  shortLabel: string;
  icon: typeof CheckCircle2;
  activeClass: string;
}> = [
  {
    value: "FIT",
    shortLabel: "Fit",
    icon: CheckCircle2,
    activeClass:
      "bg-emerald-600 text-white shadow-xs dark:bg-emerald-600 dark:text-white",
  },
  {
    value: "INJURED",
    shortLabel: "Verletzt",
    icon: Activity,
    activeClass:
      "bg-rose-600 text-white shadow-xs dark:bg-rose-600 dark:text-white",
  },
  {
    value: "UNAVAILABLE",
    shortLabel: "Abwesend",
    icon: Ban,
    activeClass:
      "bg-amber-600 text-white shadow-xs dark:bg-amber-600 dark:text-white",
  },
];

export function PlayerAvailabilitySwitcher({
  teamId,
  membership,
  onStatusSaved,
}: PlayerAvailabilitySwitcherProps) {
  const [optimisticStatus, setOptimisticStatus] =
    useState<AvailabilityStatus | null>(null);
  const [saving, setSaving] = useState<AvailabilityStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStatus = optimisticStatus ?? membership.availabilityStatus;

  async function handleSelect(nextStatus: AvailabilityStatus) {
    if (saving || nextStatus === currentStatus) return;
    setError(null);
    setOptimisticStatus(nextStatus);
    setSaving(nextStatus);
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          availabilityStatus: nextStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setOptimisticStatus(null);
        setError(
          data?.error?.message || "Status konnte nicht aktualisiert werden."
        );
        return;
      }
      await onStatusSaved();
      setOptimisticStatus(null);
    } catch {
      setOptimisticStatus(null);
      setError("Netzwerkfehler beim Aktualisieren des Status.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-2xs space-y-2">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/profil"
          className="group flex items-center gap-2.5 min-w-0"
          title="Mein Spielerprofil öffnen"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground font-mono text-sm font-bold">
            {membership.jerseyNumber ? `#${membership.jerseyNumber}` : "–"}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground leading-tight">
              Mein Status
            </p>
            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {membership.primaryPosition
                ? `${membership.primaryPosition} · ${HANDBALL_POSITION_LABELS[membership.primaryPosition].full}`
                : "Position im Profil ergänzen"}
            </p>
          </div>
        </Link>

        <div
          role="group"
          aria-label="Eigener Fitness- und Verfügbarkeitsstatus"
          className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 sm:inline-flex"
        >
          {STATUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = currentStatus === opt.value;
            const isSavingThis = saving === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                aria-label={`Status: ${AVAILABILITY_STATUS_LABELS[opt.value]}`}
                disabled={saving !== null}
                onClick={() => void handleSelect(opt.value)}
                className={cn(
                  "inline-flex min-h-11 sm:min-h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  active
                    ? opt.activeClass
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                )}
              >
                {isSavingThis ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{opt.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
