"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
  RESIN_POLICY_LABELS,
  type ResinPolicy,
  type VenueDTO,
} from "@/domain/schemas/event";

interface VenueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clubId: string;
  venue?: VenueDTO | null;
  onSaved: () => void;
}

const RESIN_POLICIES = Object.keys(RESIN_POLICY_LABELS) as ResinPolicy[];

export function VenueFormDialog({
  open,
  onOpenChange,
  clubId,
  venue,
  onSaved,
}: VenueFormDialogProps) {
  const isEdit = Boolean(venue);

  const [name, setName] = useState(venue?.name ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [mapsUrl, setMapsUrl] = useState(venue?.mapsUrl ?? "");
  const [resinPolicy, setResinPolicy] = useState<ResinPolicy>(
    venue?.resinPolicy ?? "UNKNOWN"
  );
  const [notes, setNotes] = useState(venue?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/v1/clubs/${encodeURIComponent(clubId)}/venues/${encodeURIComponent(venue!.id)}`
        : `/api/v1/clubs/${encodeURIComponent(clubId)}/venues`;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: address || null,
          mapsUrl: mapsUrl || null,
          resinPolicy,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Halle konnte nicht gespeichert werden.");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Halle bearbeiten" : "Neue Halle anlegen"}
          </DialogTitle>
          <DialogDescription>
            Hinterlege Adresse, Maps-Link und die verbindliche
            Harz-/Haftmittel-Regelung.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="v-name">Hallenname *</Label>
            <Input
              id="v-name"
              required
              placeholder="z. B. Sporthalle Musterstadt-Süd"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-resin">Harz- / Haftmittel-Regelung</Label>
            <SelectNative
              id="v-resin"
              value={resinPolicy}
              onChange={(e) => setResinPolicy(e.target.value as ResinPolicy)}
            >
              {RESIN_POLICIES.map((p) => (
                <option key={p} value={p}>
                  {RESIN_POLICY_LABELS[p]}
                </option>
              ))}
            </SelectNative>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-address">Adresse</Label>
            <Input
              id="v-address"
              placeholder="Straße Nr., PLZ Ort"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-maps">Google Maps / Navigations-Link</Label>
            <Input
              id="v-maps"
              type="url"
              placeholder="https://maps.google.com/..."
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="v-notes">Hallennotizen</Label>
            <Input
              id="v-notes"
              placeholder="z. B. Kabinenschlüssel, Parkmöglichkeiten, Harzverbot-Hinweis"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
              {isEdit ? "Speichern" : "Halle anlegen"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
