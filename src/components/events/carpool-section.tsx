"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, Loader2, MapPin, Plus, Trash2, UserCheck, X } from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { formatDepartureTime } from "@/domain/date-time";
import type { CarpoolDTO } from "@/domain/schemas/carpool";
import { getEffectiveRoles } from "@/domain/schemas/handball";

interface CarpoolSectionProps {
  teamId: string;
  eventId: string;
  isStaff: boolean;
}

export function CarpoolSection({
  teamId,
  eventId,
  isStaff,
}: CarpoolSectionProps) {
  const { me } = useAppContext();
  const [carpools, setCarpools] = useState<CarpoolDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showOfferForm, setShowOfferForm] = useState(false);
  const [departureLocation, setDepartureLocation] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [totalSeats, setTotalSeats] = useState("3");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Eigene & verknüpfte Kinder-Profile für Buchung/Angebot
  const myTeamMember = me?.memberships.find((m) => m.team.id === teamId) ?? null;
  const linkedChildrenInTeam =
    me?.guardianLinks.filter((g) => g.teamId === teamId) ?? [];

  const myRoles = getEffectiveRoles(myTeamMember);
  const isOnlyParent = myRoles.length === 1 && myRoles[0] === "PARENT";
  const bookableTargets: Array<{ memberId: string; label: string }> = [];
  if (myTeamMember && !isOnlyParent) {
    bookableTargets.push({
      memberId: myTeamMember.memberId,
      label: `${myTeamMember.firstName} ${myTeamMember.lastName} (Ich)`,
    });
  }
  for (const c of linkedChildrenInTeam) {
    bookableTargets.push({
      memberId: c.childMemberId,
      label: `${c.childFirstName} ${c.childLastName} (Kind)`,
    });
  }

  const [selectedPassengerId, setSelectedPassengerId] = useState(
    bookableTargets[0]?.memberId ?? ""
  );

  const loadCarpools = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setCarpools(data.carpools ?? []);
      }
      setError(null);
    } catch {
      setError("Fahrgemeinschaften konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [teamId, eventId]);

  useEffect(() => {
    let active = true;
    fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (res.ok && active) {
          const data = await res.json();
          setCarpools(data.carpools ?? []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [teamId, eventId]);

  async function handleOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!myTeamMember) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            driverMemberId: myTeamMember.memberId,
            departureLocation,
            departureTime: departureTime || null,
            totalSeats: Number(totalSeats),
            notes: notes || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Fahrt konnte nicht angelegt werden.");
        return;
      }
      setDepartureLocation("");
      setDepartureTime("");
      setNotes("");
      setShowOfferForm(false);
      await loadCarpools();
    } catch {
      setError("Netzwerkfehler beim Anlegen der Fahrt.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBook(carpoolId: string) {
    const targetId = selectedPassengerId || bookableTargets[0]?.memberId;
    if (!targetId) return;
    setError(null);
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools/${encodeURIComponent(carpoolId)}/bookings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passengerMemberId: targetId }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error?.message || "Buchung fehlgeschlagen.");
      return;
    }
    await loadCarpools();
  }

  async function handleCancelBooking(carpoolId: string, bookingId: string) {
    setError(null);
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools/${encodeURIComponent(carpoolId)}/bookings/${encodeURIComponent(bookingId)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadCarpools();
  }

  async function handleDeleteCarpool(carpoolId: string) {
    const res = await fetch(
      `/api/v1/teams/${encodeURIComponent(teamId)}/events/${encodeURIComponent(eventId)}/carpools/${encodeURIComponent(carpoolId)}`,
      { method: "DELETE" }
    );
    if (res.ok) await loadCarpools();
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Car className="h-4 w-4 text-primary" />
          Fahrgemeinschaften ({carpools.length})
        </h3>
        {myTeamMember && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowOfferForm((prev) => !prev)}
          >
            <Plus className="h-3.5 w-3.5" />
            Fahrt anbieten
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {showOfferForm && myTeamMember && (
        <form
          onSubmit={handleOffer}
          className="rounded-lg border border-border bg-muted/30 p-3 space-y-2.5"
        >
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cp-loc" className="text-xs">
                Abfahrtsort *
              </Label>
              <Input
                id="cp-loc"
                required
                placeholder="z. B. Parkplatz Sporthalle Süd"
                value={departureLocation}
                onChange={(e) => setDepartureLocation(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cp-time" className="text-xs">
                Abfahrtszeit
              </Label>
              <Input
                id="cp-time"
                placeholder="z. B. 16:15 Uhr"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="cp-seats" className="text-xs">
                Freie Plätze *
              </Label>
              <Input
                id="cp-seats"
                type="number"
                min={1}
                max={9}
                required
                value={totalSeats}
                onChange={(e) => setTotalSeats(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="cp-notes" className="text-xs">
                Hinweis (optional)
              </Label>
              <Input
                id="cp-notes"
                placeholder="z. B. Platz für Sporttaschen"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowOfferForm(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Plätze anbieten
            </Button>
          </div>
        </form>
      )}

      {bookableTargets.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <Label htmlFor="cp-target" className="shrink-0 text-xs">
            Buchen für:
          </Label>
          <SelectNative
            id="cp-target"
            value={selectedPassengerId}
            onChange={(e) => setSelectedPassengerId(e.target.value)}
            className="h-8 text-xs max-w-xs"
          >
            {bookableTargets.map((t) => (
              <option key={t.memberId} value={t.memberId}>
                {t.label}
              </option>
            ))}
          </SelectNative>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Lade Fahrgemeinschaften…</p>
      ) : carpools.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Fahrgemeinschaften für diesen Termin angeboten.
        </p>
      ) : (
        <div className="space-y-2">
          {carpools.map((cp) => {
            const targetId = selectedPassengerId || bookableTargets[0]?.memberId;
            const myBooking = targetId
              ? cp.bookings.find((b) => b.passengerMemberId === targetId)
              : null;
            const isDriver =
              me && cp.driverUserId !== null && cp.driverUserId === me.user.id;

            return (
              <div
                key={cp.id}
                data-testid={`carpool-card-${cp.id}`}
                className="rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-bold text-sm text-foreground">
                      Fahrer: {cp.driverFirstName} {cp.driverLastName}
                    </p>
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3 w-3 text-primary" />
                      {cp.departureLocation}
                      {cp.departureTime
                        ? ` · ${formatDepartureTime(cp.departureTime)}`
                        : ""}
                    </p>
                    {cp.notes && (
                      <p className="text-muted-foreground">{cp.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={cp.availableSeats > 0 ? "fit" : "secondary"}
                    >
                      {cp.availableSeats} / {cp.totalSeats} frei
                    </Badge>
                    {(isDriver || isStaff) && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteCarpool(cp.id)}
                        aria-label="Fahrgemeinschaft löschen"
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Mitfahrer-Liste */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/60">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground">Mitfahrer:</span>
                    {cp.bookings.length === 0 ? (
                      <span className="text-muted-foreground">Noch niemand</span>
                    ) : (
                      cp.bookings.map((b) => (
                        <Badge
                          key={b.id}
                          variant="outline"
                          className="gap-1 font-normal"
                        >
                          <UserCheck className="h-3 w-3 text-emerald-600" />
                          {b.passengerFirstName} {b.passengerLastName}
                          {(b.bookedByUserId === me?.user.id || isStaff) && (
                            <button
                              type="button"
                              onClick={() => handleCancelBooking(cp.id, b.id)}
                              className="ml-0.5 text-muted-foreground hover:text-destructive cursor-pointer"
                              aria-label="Platz stornieren"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))
                    )}
                  </div>

                  {targetId && !isDriver && (
                    myBooking ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleCancelBooking(cp.id, myBooking.id)}
                      >
                        Platz stornieren
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={cp.availableSeats <= 0}
                        onClick={() => handleBook(cp.id)}
                      >
                        Mitfahrplatz buchen
                      </Button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
