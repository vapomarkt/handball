import {
  ExistingSyncedMatch,
  NormalizedLeagueMatch,
} from "../adapters/league-provider";
import { SyncChangeType } from "../schemas/league";

export interface MatchMergeAction {
  kind: "CREATE" | "UPDATE" | "UNCHANGED";
  incoming: NormalizedLeagueMatch;
  existing?: ExistingSyncedMatch;
  changeType?: SyncChangeType;
  summary?: string;
}

function formatDeDateTime(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${h}:${m}`;
}

/**
 * Vergleicht eingehende Liga-Spiele mit bestehenden synchronisierten Events über `externalId`.
 * Erkennt Neuanlagen, Spielverlegungen, Hallenwechsel und Spielabsagen.
 * Lokale Anreicherungen (Treffpunkt, Trikotfarbe, Kader-Nominierung, Fahrgemeinschaften,
 * manuelle Notizen, Harz-Regelung der Halle) sind bewusst NICHT Teil dieses Merge-Plans
 * und werden beim Re-Sync niemals überschrieben.
 */
export function computeLeagueMergePlan(
  existingMatches: ExistingSyncedMatch[],
  incomingMatches: NormalizedLeagueMatch[]
): MatchMergeAction[] {
  const existingByExtId = new Map<string, ExistingSyncedMatch>();
  for (const ex of existingMatches) {
    existingByExtId.set(ex.externalId, ex);
  }

  const actions: MatchMergeAction[] = [];

  for (const incoming of incomingMatches) {
    const existing = existingByExtId.get(incoming.externalId);
    if (!existing) {
      actions.push({
        kind: "CREATE",
        incoming,
        changeType: "CREATED",
        summary: `Neues Spiel importiert: ${incoming.title} (${formatDeDateTime(incoming.startAt)})`,
      });
      continue;
    }

    const timeChanged =
      existing.startAt.getTime() !== incoming.startAt.getTime();
    const oldVenue = (existing.venueName ?? "").trim();
    const newVenue = (incoming.venueName ?? "").trim();
    const venueChanged = newVenue.length > 0 && oldVenue !== newVenue;
    const cancelledChanged = existing.isCancelled !== incoming.isCancelled;

    if (!timeChanged && !venueChanged && !cancelledChanged) {
      actions.push({
        kind: "UNCHANGED",
        incoming,
        existing,
      });
      continue;
    }

    let changeType: SyncChangeType = "UPDATED";
    const parts: string[] = [];

    if (cancelledChanged && incoming.isCancelled) {
      changeType = "CANCELLED";
      parts.push(`Spiel abgesagt: ${incoming.title}`);
    } else if (timeChanged) {
      changeType = "RESCHEDULED";
      parts.push(
        `Spielverlegung (${incoming.title}): ${formatDeDateTime(existing.startAt)} → ${formatDeDateTime(incoming.startAt)}`
      );
      if (venueChanged) {
        parts.push(`Halle: ${oldVenue || "–"} → ${newVenue}`);
      }
    } else if (venueChanged) {
      changeType = "VENUE_CHANGED";
      parts.push(
        `Hallenwechsel (${incoming.title}): ${oldVenue || "–"} → ${newVenue}`
      );
    } else {
      parts.push(`Aktualisiert: ${incoming.title}`);
    }

    actions.push({
      kind: "UPDATE",
      incoming,
      existing,
      changeType,
      summary: parts.join(" · "),
    });
  }

  return actions;
}
