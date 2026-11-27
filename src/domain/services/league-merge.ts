import {
  ExistingSyncedMatch,
  MatchScoresSnapshot,
  NormalizedLeagueMatch,
} from "../adapters/league-provider";
import { SyncChangeType } from "../schemas/league";

export interface MatchMergeAction {
  kind: "CREATE" | "UPDATE" | "UNCHANGED";
  incoming: NormalizedLeagueMatch;
  existing?: ExistingSyncedMatch;
  changeType?: SyncChangeType;
  summary?: string;
  backfillScores?: MatchScoresSnapshot | null;
}

function formatDeDateTime(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${h}:${m}`;
}

export function formatScoreSummary(scores: MatchScoresSnapshot): string {
  const full = `${scores.homeScoreFull}:${scores.awayScoreFull}`;
  if (scores.homeScoreHalf !== null && scores.awayScoreHalf !== null) {
    return `${full} (HZ ${scores.homeScoreHalf}:${scores.awayScoreHalf})`;
  }
  return full;
}

function resolveBackfillScores(
  existing: ExistingSyncedMatch,
  incoming: NormalizedLeagueMatch
): MatchScoresSnapshot | null {
  if (
    incoming.homeScoreFull === null ||
    incoming.homeScoreFull === undefined ||
    incoming.awayScoreFull === null ||
    incoming.awayScoreFull === undefined
  ) {
    return null;
  }

  const existingHasFull =
    existing.homeScoreFull !== null &&
    existing.homeScoreFull !== undefined &&
    existing.awayScoreFull !== null &&
    existing.awayScoreFull !== undefined;

  if (!existingHasFull) {
    return {
      homeScoreFull: incoming.homeScoreFull,
      awayScoreFull: incoming.awayScoreFull,
      homeScoreHalf:
        incoming.homeScoreHalf !== undefined ? incoming.homeScoreHalf : null,
      awayScoreHalf:
        incoming.awayScoreHalf !== undefined ? incoming.awayScoreHalf : null,
    };
  }

  // Wenn Endstand übereinstimmt, aber der Halbzeitstand bisher fehlte, ergänzen wir nur den Halbzeitstand.
  const existingHasHalf =
    existing.homeScoreHalf !== null &&
    existing.homeScoreHalf !== undefined &&
    existing.awayScoreHalf !== null &&
    existing.awayScoreHalf !== undefined;
  const incomingHasHalf =
    incoming.homeScoreHalf !== null &&
    incoming.homeScoreHalf !== undefined &&
    incoming.awayScoreHalf !== null &&
    incoming.awayScoreHalf !== undefined;

  if (
    !existingHasHalf &&
    incomingHasHalf &&
    existing.homeScoreFull === incoming.homeScoreFull &&
    existing.awayScoreFull === incoming.awayScoreFull
  ) {
    return {
      homeScoreFull: existing.homeScoreFull!,
      awayScoreFull: existing.awayScoreFull!,
      homeScoreHalf: incoming.homeScoreHalf!,
      awayScoreHalf: incoming.awayScoreHalf!,
    };
  }

  return null;
}

/**
 * Vergleicht eingehende Liga-Spiele mit bestehenden synchronisierten Events über `externalId`.
 * Erkennt Neuanlagen, Spielverlegungen, Hallenwechsel, Spielabsagen sowie automatisch
 * nachgetragene Spielergebnisse.
 * Lokale Anreicherungen (Treffpunkt, Trikotfarbe, Kader-Nominierung, Fahrgemeinschaften,
 * manuelle Notizen, Harz-Regelung der Halle sowie bereits manuell erfasste Endstände)
 * werden beim Re-Sync niemals überschrieben.
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
      const hasScore =
        incoming.homeScoreFull !== null &&
        incoming.homeScoreFull !== undefined &&
        incoming.awayScoreFull !== null &&
        incoming.awayScoreFull !== undefined;
      const scoreSuffix = hasScore
        ? ` · Ergebnis: ${formatScoreSummary({
            homeScoreFull: incoming.homeScoreFull!,
            awayScoreFull: incoming.awayScoreFull!,
            homeScoreHalf: incoming.homeScoreHalf ?? null,
            awayScoreHalf: incoming.awayScoreHalf ?? null,
          })}`
        : "";
      actions.push({
        kind: "CREATE",
        incoming,
        changeType: "CREATED",
        summary: `Neues Spiel importiert: ${incoming.title} (${formatDeDateTime(incoming.startAt)})${scoreSuffix}`,
      });
      continue;
    }

    const timeChanged =
      existing.startAt.getTime() !== incoming.startAt.getTime();
    const oldVenue = (existing.venueName ?? "").trim();
    const newVenue = (incoming.venueName ?? "").trim();
    const venueChanged = newVenue.length > 0 && oldVenue !== newVenue;
    const cancelledChanged = existing.isCancelled !== incoming.isCancelled;
    const backfillScores = resolveBackfillScores(existing, incoming);

    if (!timeChanged && !venueChanged && !cancelledChanged && !backfillScores) {
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
    }

    if (backfillScores) {
      parts.push(
        `Ergebnis nachgetragen (${incoming.title}): ${formatScoreSummary(backfillScores)}`
      );
    }

    if (parts.length === 0) {
      parts.push(`Aktualisiert: ${incoming.title}`);
    }

    actions.push({
      kind: "UPDATE",
      incoming,
      existing,
      changeType,
      summary: parts.join(" · "),
      backfillScores,
    });
  }

  return actions;
}
