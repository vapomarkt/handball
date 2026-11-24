"use client";

import { useState } from "react";
import { Check, HelpCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import {
  DECLINE_REASON_CATEGORY_LABELS,
  type DeclineReasonCategory,
} from "@/domain/schemas/event";
import type { RsvpStatus } from "@/domain/schemas/handball";
import { cn } from "@/lib/utils";

interface RsvpControlsProps {
  teamId: string;
  eventId: string;
  memberId: string;
  memberLabel?: string;
  currentStatus: RsvpStatus;
  requireDeclineReason: boolean;
  disabled?: boolean;
  onUpdated: () => void;
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
  disabled = false,
  onUpdated,
}: RsvpControlsProps) {
  const [submitting, setSubmitting] = useState<RsvpStatus | null>(null);
  const [showDeclineBox, setShowDeclineBox] = useState(false);
  const [category, setCategory] = useState<DeclineReasonCategory>("WORK");
  const [reasonText, setReasonText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function sendRsvp(
    status: RsvpStatus,
    declineCat?: DeclineReasonCategory | null,
    declineNote?: string | null
  ) {
    setError(null);
    setSubmitting(status);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/rsvp`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberId,
            status,
            declineReasonCategory: status === "DECLINED" ? (declineCat ?? null) : null,
            declineReason: status === "DECLINED" ? (declineNote ?? null) : null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Rückmeldung fehlgeschlagen.");
        return;
      }
      setShowDeclineBox(false);
      onUpdated();
    } catch {
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
    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
      {memberLabel && (
        <p className="text-xs font-semibold text-muted-foreground">
          Rückmeldung für <span className="text-foreground">{memberLabel}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant={currentStatus === "ACCEPTED" ? "default" : "outline"}
          disabled={disabled || submitting !== null}
          onClick={() => sendRsvp("ACCEPTED")}
          className={cn(
            currentStatus === "ACCEPTED" &&
              "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
          )}
        >
          {submitting === "ACCEPTED" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Zugesagt
        </Button>

        <Button
          type="button"
          size="sm"
          variant={currentStatus === "MAYBE" ? "default" : "outline"}
          disabled={disabled || submitting !== null}
          onClick={() => sendRsvp("MAYBE")}
          className={cn(
            currentStatus === "MAYBE" &&
              "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
          )}
        >
          {submitting === "MAYBE" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <HelpCircle className="h-3.5 w-3.5" />
          )}
          Vielleicht
        </Button>

        <Button
          type="button"
          size="sm"
          variant={currentStatus === "DECLINED" ? "destructive" : "outline"}
          disabled={disabled || submitting !== null}
          onClick={handleDeclineClick}
        >
          {submitting === "DECLINED" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          Absagen
        </Button>
      </div>

      {showDeclineBox && (
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
              onClick={() => sendRsvp("DECLINED", category, reasonText || null)}
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
