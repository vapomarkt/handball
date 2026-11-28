"use client";

import { useState } from "react";
import { Check, HelpCircle, Loader2, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import {
  DECLINE_REASON_CATEGORY_LABELS,
  RSVP_STATUS_LABELS,
  type DeclineReasonCategory,
  type EventAttendanceResponseDTO,
} from "@/domain/schemas/event";
import type { RsvpStatus } from "@/domain/schemas/handball";
import { isEventRsvpLocked } from "@/domain/services/player-dashboard";
import { cn } from "@/lib/utils";

interface RsvpControlsProps {
  teamId: string;
  eventId: string;
  memberId: string;
  memberLabel?: string;
  currentStatus: RsvpStatus;
  requireDeclineReason: boolean;
  rsvpDeadlineAt?: string | null;
  isCancelled?: boolean;
  isStaff?: boolean;
  disabled?: boolean;
  size?: "default" | "compact";
  onOptimisticStatus?: (status: RsvpStatus) => void;
  onRollbackStatus?: () => void;
  onUpdated: (attendance?: EventAttendanceResponseDTO) => void;
}

const CATEGORIES = Object.keys(
  DECLINE_REASON_CATEGORY_LABELS
) as DeclineReasonCategory[];

export function RsvpControls({
  teamId,
  eventId,
  memberId,
  memberLabel,
  currentStatus,
  requireDeclineReason,
  rsvpDeadlineAt = null,
  isCancelled = false,
  isStaff = false,
  disabled = false,
  size = "default",
  onOptimisticStatus,
  onRollbackStatus,
  onUpdated,
}: RsvpControlsProps) {
  const [submitting, setSubmitting] = useState<RsvpStatus | null>(null);
  const [showDeclineBox, setShowDeclineBox] = useState(false);
  const [category, setCategory] = useState<DeclineReasonCategory>("WORK");
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deadlineLocked = isEventRsvpLocked(
    { isCancelled, rsvpDeadlineAt },
    isStaff
  );
  const isDisabled = disabled || deadlineLocked || submitting !== null;
  const isCompact = size === "compact";

  async function sendRsvp(
    status: RsvpStatus,
    declineCat?: DeclineReasonCategory | null,
    declineNote?: string | null
  ) {
    setError(null);
    setSubmitting(status);
    onOptimisticStatus?.(status);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/rsvp`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId,
            status,
            declineReasonCategory:
              status === "DECLINED" ? (declineCat ?? null) : null,
            declineReason: status === "DECLINED" ? (declineNote ?? null) : null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        onRollbackStatus?.();
        setError(data?.error?.message || "Rückmeldung fehlgeschlagen.");
        return;
      }
      setShowDeclineBox(false);
      onUpdated(data?.attendance as EventAttendanceResponseDTO | undefined);
    } catch {
      onRollbackStatus?.();
      setError("Netzwerkfehler bei der Rückmeldung.");
    } finally {
      setSubmitting(null);
    }
  }

  function handleDeclineClick() {
    if (showDeclineBox) {
      setShowDeclineBox(false);
      return;
    }
    setShowDeclineBox(true);
  }

  return (
    <div
      className={cn(isCompact ? "space-y-1.5" : "space-y-2")}
      onClick={(e) => e.stopPropagation()}
    >
      {memberLabel && (
        <p className="text-xs font-semibold text-muted-foreground">
          Rückmeldung für <span className="text-foreground">{memberLabel}</span>
        </p>
      )}

      {deadlineLocked && !isCancelled ? (
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Frist abgelaufen ·{" "}
            <strong className="font-semibold text-foreground">
              {RSVP_STATUS_LABELS[currentStatus]}
            </strong>
          </span>
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center gap-1.5",
            isCompact ? "grid grid-cols-3 sm:flex" : "flex-wrap"
          )}
        >
          <Button
            type="button"
            size="sm"
            variant={currentStatus === "ACCEPTED" ? "default" : "outline"}
            disabled={isDisabled}
            aria-pressed={currentStatus === "ACCEPTED"}
            title="Zugesagt"
            onClick={() => void sendRsvp("ACCEPTED")}
            className={cn(
              isCompact && "min-h-11 sm:min-h-9 px-2.5 text-xs",
              currentStatus === "ACCEPTED" &&
                "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
            )}
          >
            {submitting === "ACCEPTED" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <Check className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{isCompact ? "Ja" : "Zugesagt"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={currentStatus === "MAYBE" ? "default" : "outline"}
            disabled={isDisabled}
            aria-pressed={currentStatus === "MAYBE"}
            title="Vielleicht"
            onClick={() => void sendRsvp("MAYBE")}
            className={cn(
              isCompact && "min-h-11 sm:min-h-9 px-2.5 text-xs",
              currentStatus === "MAYBE" &&
                "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
            )}
          >
            {submitting === "MAYBE" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{isCompact ? "Evtl." : "Vielleicht"}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant={currentStatus === "DECLINED" ? "destructive" : "outline"}
            disabled={isDisabled}
            aria-pressed={currentStatus === "DECLINED"}
            title="Absagen"
            onClick={handleDeclineClick}
            className={cn(isCompact && "min-h-11 sm:min-h-9 px-2.5 text-xs")}
          >
            {submitting === "DECLINED" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{isCompact ? "Nein" : "Absagen"}</span>
          </Button>
        </div>
      )}

      {showDeclineBox && !deadlineLocked && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Absagegrund ({requireDeclineReason ? "Pflichtfeld" : "optional"} –
            DSGVO-geschützt, nur für Trainer sichtbar):
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <SelectNative
              aria-label="Absagegrund-Kategorie"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as DeclineReasonCategory)
              }
              className="h-9 text-xs"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {DECLINE_REASON_CATEGORY_LABELS[c]}
                </option>
              ))}
            </SelectNative>
            <Input
              aria-label="Absagegrund-Details"
              placeholder="Kurze Notiz (optional)"
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowDeclineBox(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={submitting !== null}
              onClick={() =>
                void sendRsvp("DECLINED", category, reasonText || null)
              }
            >
              Absage bestätigen
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
