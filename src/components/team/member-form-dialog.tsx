"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  AVAILABILITY_STATUS_LABELS,
  COMMON_TEAM_ROLES,
  HANDBALL_POSITION_LABELS,
  MEMBER_ROLE_LABELS,
  THROWING_HAND_LABELS,
  type AvailabilityStatus,
  type HandballPosition,
  type MemberRole,
  type ThrowingHand,
} from "@/domain/schemas/handball";
import type { TeamMemberResponseDTO } from "@/domain/schemas/member";

interface MemberFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  mode: "create" | "edit-full" | "edit-self";
  member?: TeamMemberResponseDTO | null;
  onSaved: () => void;
}

const POSITIONS = Object.keys(HANDBALL_POSITION_LABELS) as HandballPosition[];
const ROLES = Object.keys(MEMBER_ROLE_LABELS) as MemberRole[];

export function MemberFormDialog({
  open,
  onOpenChange,
  teamId,
  mode,
  member,
  onSaved,
}: MemberFormDialogProps) {
  const isCreate = mode === "create";
  const isFull = mode === "create" || mode === "edit-full";
  const initial = !isCreate && member ? member : null;

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [role, setRole] = useState<MemberRole>(initial?.role ?? "PLAYER");
  const [jerseyNumber, setJerseyNumber] = useState(
    initial && initial.jerseyNumber !== null ? String(initial.jerseyNumber) : ""
  );
  const [primaryPosition, setPrimaryPosition] = useState<string>(
    initial?.primaryPosition ?? ""
  );
  const [secondaryPosition, setSecondaryPosition] = useState<string>(
    initial?.secondaryPosition ?? ""
  );
  const [throwingHand, setThrowingHand] = useState<string>(
    initial ? (initial.throwingHand ?? "") : "RIGHT"
  );
  const [availabilityStatus, setAvailabilityStatus] =
    useState<AvailabilityStatus>(initial?.availabilityStatus ?? "FIT");
  const [teamRoles, setTeamRoles] = useState<string[]>(
    initial?.teamRoles ?? []
  );
  const [isMinor, setIsMinor] = useState(initial?.isMinor ?? false);

  // DSGVO-geschützte Felder
  const [passNumber, setPassNumber] = useState(
    initial?.canViewSensitive ? (initial.passNumber ?? "") : ""
  );
  const [emergencyContact, setEmergencyContact] = useState(
    initial?.canViewSensitive ? (initial.emergencyContact ?? "") : ""
  );
  const [injuryNote, setInjuryNote] = useState(
    initial?.canViewSensitive ? (initial.injuryNote ?? "") : ""
  );
  const [phone, setPhone] = useState(
    initial?.canViewSensitive ? (initial.phone ?? "") : ""
  );
  const [email, setEmail] = useState(
    initial?.canViewSensitive ? (initial.email ?? "") : ""
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleTeamRole(r: string) {
    setTeamRoles((prev) =>
      prev.includes(r) ? prev.filter((item) => item !== r) : [...prev, r]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload = isFull
        ? {
            firstName,
            lastName,
            role,
            jerseyNumber: jerseyNumber ? Number(jerseyNumber) : null,
            primaryPosition: (primaryPosition || null) as HandballPosition | null,
            secondaryPosition: (secondaryPosition ||
              null) as HandballPosition | null,
            throwingHand: (throwingHand || null) as ThrowingHand | null,
            availabilityStatus,
            teamRoles,
            isMinor,
            passNumber: passNumber || null,
            emergencyContact: emergencyContact || null,
            injuryNote: injuryNote || null,
            phone: phone || null,
            email: email || null,
          }
        : {
            throwingHand: (throwingHand || null) as ThrowingHand | null,
            availabilityStatus,
            emergencyContact: emergencyContact || null,
            injuryNote: injuryNote || null,
            phone: phone || null,
            email: email || null,
          };

      const url = isCreate
        ? `/api/v1/teams/${encodeURIComponent(teamId)}/members`
        : `/api/v1/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(member!.id)}`;

      const res = await fetch(url, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Speichern fehlgeschlagen.");
        return;
      }

      onSaved();
      onOpenChange(false);
    } catch {
      setError("Netzwerkfehler beim Speichern.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isCreate
              ? "Neues Kader-Profil anlegen"
              : `${member?.firstName} ${member?.lastName} bearbeiten`}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Lege Spieler:innen bereits vor der Registrierung an. Das Profil kann später per Claim-Link übernommen werden."
              : isFull
                ? "Bearbeite sportliche Daten, Positionen und geschützte Kontaktdaten."
                : "Aktualisiere Verfügbarkeit, Wurfhand und geschützte Notfalldaten."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          )}

          {isFull && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="m-first">Vorname *</Label>
                  <Input
                    id="m-first"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-last">Nachname *</Label>
                  <Input
                    id="m-last"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-role">Rolle</Label>
                  <SelectNative
                    id="m-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as MemberRole)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {MEMBER_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </SelectNative>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="m-jersey">Trikotnummer</Label>
                  <Input
                    id="m-jersey"
                    type="number"
                    min={1}
                    max={99}
                    placeholder="1–99"
                    value={jerseyNumber}
                    onChange={(e) => setJerseyNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="m-hand">Wurfhand</Label>
                  <SelectNative
                    id="m-hand"
                    value={throwingHand}
                    onChange={(e) => setThrowingHand(e.target.value)}
                  >
                    <option value="">Keine Angabe</option>
                    {(Object.keys(THROWING_HAND_LABELS) as ThrowingHand[]).map(
                      (h) => (
                        <option key={h} value={h}>
                          {THROWING_HAND_LABELS[h]}
                        </option>
                      )
                    )}
                  </SelectNative>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="m-pos1">Hauptposition</Label>
                  <SelectNative
                    id="m-pos1"
                    value={primaryPosition}
                    onChange={(e) => setPrimaryPosition(e.target.value)}
                  >
                    <option value="">Keine</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos} – {HANDBALL_POSITION_LABELS[pos].full}
                      </option>
                    ))}
                  </SelectNative>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="m-pos2">Nebenposition</Label>
                  <SelectNative
                    id="m-pos2"
                    value={secondaryPosition}
                    onChange={(e) => setSecondaryPosition(e.target.value)}
                  >
                    <option value="">Keine</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos} – {HANDBALL_POSITION_LABELS[pos].full}
                      </option>
                    ))}
                  </SelectNative>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="m-avail">Verfügbarkeit</Label>
                  <SelectNative
                    id="m-avail"
                    value={availabilityStatus}
                    onChange={(e) =>
                      setAvailabilityStatus(
                        e.target.value as AvailabilityStatus
                      )
                    }
                  >
                    {(
                      Object.keys(
                        AVAILABILITY_STATUS_LABELS
                      ) as AvailabilityStatus[]
                    ).map((s) => (
                      <option key={s} value={s}>
                        {AVAILABILITY_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </SelectNative>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Team-Ämter</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_TEAM_ROLES.map((tr) => {
                    const active = teamRoles.includes(tr);
                    return (
                      <button
                        key={tr}
                        type="button"
                        onClick={() => toggleTeamRole(tr)}
                        className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {tr}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isMinor}
                  onChange={(e) => setIsMinor(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>Minderjähriges Jugendmitglied (Eltern-Verknüpfung)</span>
              </label>
            </>
          )}

          {!isFull && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-self-avail">Verfügbarkeit</Label>
                <SelectNative
                  id="m-self-avail"
                  value={availabilityStatus}
                  onChange={(e) =>
                    setAvailabilityStatus(e.target.value as AvailabilityStatus)
                  }
                >
                  {(
                    Object.keys(
                      AVAILABILITY_STATUS_LABELS
                    ) as AvailabilityStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {AVAILABILITY_STATUS_LABELS[s]}
                    </option>
                  ))}
                </SelectNative>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-self-hand">Wurfhand</Label>
                <SelectNative
                  id="m-self-hand"
                  value={throwingHand}
                  onChange={(e) => setThrowingHand(e.target.value)}
                >
                  <option value="">Keine Angabe</option>
                  {(Object.keys(THROWING_HAND_LABELS) as ThrowingHand[]).map(
                    (h) => (
                      <option key={h} value={h}>
                        {THROWING_HAND_LABELS[h]}
                      </option>
                    )
                  )}
                </SelectNative>
              </div>
            </div>
          )}

          {/* DSGVO-geschützte Felder */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-primary" />
              <span>
                DSGVO-geschützte Daten (nur für Trainer, Vereins-Admin, Spieler
                selbst & verknüpfte Eltern sichtbar)
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {isFull && (
                <div className="space-y-1.5">
                  <Label htmlFor="m-pass">Spielberechtigung / Passnummer</Label>
                  <Input
                    id="m-pass"
                    placeholder="z. B. DHB-2026-10499"
                    value={passNumber}
                    onChange={(e) => setPassNumber(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="m-emergency">Notfallkontakt</Label>
                <Input
                  id="m-emergency"
                  placeholder="Name & Telefonnummer"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="m-phone">Telefon</Label>
                <Input
                  id="m-phone"
                  placeholder="+49 …"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-email">E-Mail (optional)</Label>
                <Input
                  id="m-email"
                  type="email"
                  placeholder="spieler@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-injury">Verletzungs- / Gesundheitsnotiz</Label>
              <Input
                id="m-injury"
                placeholder="z. B. Bänderdehnung, nur für Trainer sichtbar"
                value={injuryNote}
                onChange={(e) => setInjuryNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreate ? "Profil anlegen" : "Änderungen speichern"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
