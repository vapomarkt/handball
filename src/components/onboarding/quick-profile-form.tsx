"use client";

import { useState } from "react";
import { Check, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  HANDBALL_POSITION_LABELS,
  hasMemberRole,
  THROWING_HAND_LABELS,
  type HandballPosition,
  type MemberRole,
  type ThrowingHand,
} from "@/domain/schemas/handball";
import { normalizePhoneNumber } from "@/domain/schemas/phone";
import { cn } from "@/lib/utils";

const POSITIONS = Object.keys(HANDBALL_POSITION_LABELS) as HandballPosition[];
const THROWING_HANDS: ThrowingHand[] = ["RIGHT", "LEFT", "BOTH"];

export interface QuickProfileInitialValues {
  teamId?: string;
  role: MemberRole;
  roles?: MemberRole[];
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  emergencyContact?: string | null;
  primaryPosition?: HandballPosition | null;
  throwingHand?: ThrowingHand | null;
  childMemberId?: string | null;
  childFirstName?: string | null;
  childEmergencyContact?: string | null;
}

interface QuickProfileFormProps {
  initial: QuickProfileInitialValues;
  submitLabel?: string;
  skipLabel?: string;
  onSaved: () => void;
  onSkip?: () => void;
}

export function QuickProfileForm({
  initial,
  submitLabel = "Speichern & weiter",
  skipLabel = "Später ergänzen",
  onSaved,
  onSkip,
}: QuickProfileFormProps) {
  const isPlayer = hasMemberRole(initial, "PLAYER");
  const isParent = hasMemberRole(initial, "PARENT");

  const [firstName, setFirstName] = useState(initial.firstName ?? "");
  const [lastName, setLastName] = useState(initial.lastName ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [emergencyContact, setEmergencyContact] = useState(
    isParent && initial.childMemberId
      ? (initial.childEmergencyContact ?? initial.emergencyContact ?? "")
      : (initial.emergencyContact ?? "")
  );
  const [primaryPosition, setPrimaryPosition] =
    useState<HandballPosition | null>(initial.primaryPosition ?? null);
  const [throwingHand, setThrowingHand] = useState<ThrowingHand | null>(
    initial.throwingHand ?? null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedPhone = normalizePhoneNumber(phone);
    if (!normalizedPhone.ok) {
      setError(normalizedPhone.error);
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        teamId: initial.teamId,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        phone: normalizedPhone.e164,
      };

      if (isPlayer) {
        payload.primaryPosition = primaryPosition;
        payload.throwingHand = throwingHand;
        payload.emergencyContact = emergencyContact.trim() || null;
      } else if (isParent) {
        payload.emergencyContact = emergencyContact.trim() || null;
        if (initial.childMemberId) {
          payload.childMemberId = initial.childMemberId;
          payload.childEmergencyContact = emergencyContact.trim() || null;
        }
      }

      const res = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(
          data?.error?.message || "Profil konnte nicht gespeichert werden."
        );
        return;
      }

      onSaved();
    } catch {
      setError("Netzwerkfehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="qp-first">Vorname *</Label>
          <Input
            id="qp-first"
            required
            placeholder="z. B. Lena"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="qp-last">Nachname *</Label>
          <Input
            id="qp-last"
            required
            placeholder="z. B. Meyer"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      {isPlayer && (
        <>
          <div className="space-y-2">
            <Label>Deine Hauptposition (optional)</Label>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {POSITIONS.map((pos) => {
                const active = primaryPosition === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPrimaryPosition(active ? null : pos)}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border py-2 px-1 text-xs font-bold transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-xs"
                        : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/40"
                    )}
                    title={HANDBALL_POSITION_LABELS[pos].full}
                  >
                    <span>{pos}</span>
                  </button>
                );
              })}
            </div>
            {primaryPosition && (
              <p className="text-xs text-muted-foreground">
                Ausgewählt:{" "}
                <strong className="text-foreground">
                  {HANDBALL_POSITION_LABELS[primaryPosition].full}
                </strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Wurfhand (optional)</Label>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {THROWING_HANDS.map((hand) => {
                const active = throwingHand === hand;
                return (
                  <button
                    key={hand}
                    type="button"
                    onClick={() => setThrowingHand(active ? null : hand)}
                    className={cn(
                      "flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl border px-1.5 text-xs font-semibold transition-all cursor-pointer",
                      active
                        ? "border-primary bg-primary/12 text-primary"
                        : "border-border bg-card text-foreground hover:border-primary/40"
                    )}
                  >
                    {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                    <span className="truncate">{THROWING_HAND_LABELS[hand]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="qp-phone">Telefonnummer (optional)</Label>
        <PhoneInput id="qp-phone" value={phone} onChange={setPhone} />
      </div>

      {(isPlayer || isParent) && (
        <div className="space-y-1.5">
          <Label htmlFor="qp-emergency">
            {isParent && initial.childFirstName
              ? `Notfallkontakt für ${initial.childFirstName} (optional)`
              : "Notfallkontakt (optional)"}
          </Label>
          <Input
            id="qp-emergency"
            placeholder="z. B. Mama / Papa + Telefonnummer"
            value={emergencyContact}
            onChange={(e) => setEmergencyContact(e.target.value)}
          />
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
            DSGVO-geschützt: Telefon &amp; Notfallkontakt sehen nur Trainer und
            Betreuer.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        {onSkip ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={saving}
          >
            {skipLabel}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
