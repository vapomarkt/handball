"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEMBER_ROLE_LABELS, type MemberRole } from "@/domain/schemas/handball";
import { getTourStepsForRole } from "@/domain/services/onboarding-state-service";
import { cn } from "@/lib/utils";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findVisibleTarget(targetId: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour-id="${targetId}"]`)
  );
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}

function AppTourOverlay({ role }: { role: MemberRole }) {
  const { closeTour, updateOnboardingState } = useAppContext();

  const [stepIndex, setStepIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(
    null
  );

  const steps = useMemo(() => getTourStepsForRole(role), [role]);
  const activeStep = steps[stepIndex] ?? steps[0] ?? null;

  // Ziel-Element asynchron über AnimationFrame vermessen (kein synchrones setState im Effect)
  useEffect(() => {
    if (!activeStep) return;

    const measure = () => {
      const el = findVisibleTarget(activeStep.targetId);
      if (!el) {
        setHighlightRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setHighlightRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const frameId = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [activeStep]);

  const finishTour = useCallback(
    async (disableForever: boolean) => {
      closeTour();
      await updateOnboardingState({
        completeTourForRole: role,
        ...(disableForever ? { tourDisabled: true } : {}),
      });
    },
    [role, closeTour, updateOnboardingState]
  );

  // Tastaturbedienung: Escape schließt, Pfeile navigieren
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        void finishTour(dontShowAgain);
      } else if (e.key === "ArrowRight") {
        if (stepIndex < steps.length - 1) {
          setStepIndex((i) => i + 1);
        } else {
          void finishTour(dontShowAgain);
        }
      } else if (e.key === "ArrowLeft" && stepIndex > 0) {
        setStepIndex((i) => i - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stepIndex, steps.length, finishTour, dontShowAgain]);

  if (!activeStep) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex >= steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-label="Kurze Einführung in ThrowOff"
      data-testid="app-tour-dialog"
    >
      {/* Dezenter, nicht aggressiver Hintergrund (Klick daneben schließt sauber) */}
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-[1px] pointer-events-auto transition-opacity"
        onClick={() => void finishTour(dontShowAgain)}
      />

      {/* Hervorhebung des aktiven Ziel-Elements */}
      {highlightRect && (
        <div
          aria-hidden="true"
          className="fixed rounded-xl ring-3 ring-primary ring-offset-2 ring-offset-background bg-primary/8 pointer-events-none transition-all duration-200 z-50"
          style={{
            top: Math.max(4, highlightRect.top - 4),
            left: Math.max(4, highlightRect.left - 4),
            width: highlightRect.width + 8,
            height: highlightRect.height + 8,
          }}
        />
      )}

      {/* Kompakte Tour-Karte: auf Mobile Bottom-Sheet über Tab-Bar, auf Desktop rechts unten */}
      <div className="fixed inset-x-3 bottom-[70px] md:inset-x-auto md:bottom-6 md:right-6 md:w-[390px] z-50 pointer-events-auto">
        <div className="rounded-2xl border border-primary/35 bg-card p-5 shadow-2xl space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              <Badge variant="secondary" className="text-[11px]">
                Kurztour · {MEMBER_ROLE_LABELS[role]}
              </Badge>
              <span className="text-xs font-medium text-muted-foreground">
                {stepIndex + 1}/{steps.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void finishTour(dontShowAgain)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              aria-label="Tour schließen"
              title="Tour überspringen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground">
              {activeStep.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {activeStep.description}
            </p>
          </div>

          {/* Fortschrittspunkte */}
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIndex(idx)}
                aria-label={`Schritt ${idx + 1}: ${s.title}`}
                className={cn(
                  "h-1.5 rounded-full transition-all cursor-pointer",
                  idx === stepIndex
                    ? "w-6 bg-primary"
                    : idx < stepIndex
                      ? "w-2.5 bg-primary/45"
                      : "w-2.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {/* Dauerhaft abschalten Checkbox */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none pt-0.5">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            <span>Tour nicht mehr automatisch anzeigen</span>
          </label>

          {/* Aktionsleiste */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void finishTour(true)}
              className="text-xs text-muted-foreground"
            >
              Überspringen
            </Button>

            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Zurück
                </Button>
              )}

              {isLast ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void finishTour(dontShowAgain)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Verstanden
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setStepIndex((i) => Math.min(steps.length - 1, i + 1))
                  }
                >
                  Weiter
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppTour() {
  const { activeTeam, tourActive } = useAppContext();
  if (!tourActive || !activeTeam) return null;
  return <AppTourOverlay key={activeTeam.role} role={activeTeam.role} />;
}
