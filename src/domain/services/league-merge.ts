import {
  ExistingSyncedMatch,
  MatchScoresSnapshot,
  NormalizedLeagueMatch,
  ScoreSyncUpdate,
} from "../adapters/league-provider";
import { formatGermanDateTime, GERMAN_TIME_ZONE } from "../date-time";
import { SyncChangeType } from "../schemas/league";

export interface MatchMergeAction {
  kind: "CREATE" | "UPDATE" | "UNCHANGED";
  incoming: NormalizedLeagueMatch;
  existing?: ExistingSyncedMatch;
  changeType?: SyncChangeType;
  summary?: string;
  scoreSyncUpdate?: ScoreSyncUpdate | null;
}

function formatDeDateTime(d: Date): string {
  return formatGermanDateTime(d, {
    includeUhr: true,
    timeZone: GERMAN_TIME_ZONE,
  });
}

export function formatScoreSummary(scores: MatchScoresSnapshot): string {
  const full = `${scores.homeScoreFull}:${scores.awayScoreFull}`;
  if (scores.homeScoreHalf !== null && scores.awayScoreHalf !== null) {
    return `${full} (HZ ${scores.homeScoreHalf}:${scores.awayScoreHalf})`;
  }
  return full;
}

export interface ScoreCompareState {
  homeScoreFull?: number | null;
  awayScoreFull?: number | null;
  homeScoreHalf?: number | null;
  awayScoreHalf?: number | null;
  scoreManuallyEdited?: boolean;
  officialHomeScoreFull?: number | null;
  officialAwayScoreFull?: number | null;
  officialHomeScoreHalf?: number | null;
  officialAwayScoreHalf?: number | null;
}

/**
 * Vergleicht ein eingehendes offizielles Liga-Ergebnis mit dem lokal gespeicherten Stand.
 * - Fehlt lokal ein Endstand, wird das offizielle Ergebnis nachgetragen (`applyToDisplayed: true`).
 * - Wurde lokal manuell korrigiert (oder existiert ein abweichender lokaler Stand ohne offiziellen Ursprung),
 *   bleibt der angezeigte Spielstand 100% geschützt (`applyToDisplayed: false`), aber das offizielle Ergebnis
 *   wird in `official*` gespeichert, damit Abweichungen markiert werden können (`discrepancyDetected: true`).
 * - Idempotent: Gibt `null` zurück, sobald nichts mehr zu aktualisieren ist.
 */
export function resolveScoreSyncUpdate(
  existing: ScoreCompareState,
  incoming: {
    homeScoreFull?: number | null;
    awayScoreFull?: number | null;
    homeScoreHalf?: number | null;
    awayScoreHalf?: number | null;
  }
): ScoreSyncUpdate | null {
  if (
    incoming.homeScoreFull === null ||
    incoming.homeScoreFull === undefined ||
    incoming.awayScoreFull === null ||
    incoming.awayScoreFull === undefined
  ) {
    return null;
  }

  const officialScores: MatchScoresSnapshot = {
    homeScoreFull: incoming.homeScoreFull,
    awayScoreFull: incoming.awayScoreFull,
    homeScoreHalf:
      incoming.homeScoreHalf !== undefined ? incoming.homeScoreHalf : null,
    awayScoreHalf:
      incoming.awayScoreHalf !== undefined ? incoming.awayScoreHalf : null,
  };

  const existingHasFull =
    existing.homeScoreFull !== null &&
    existing.homeScoreFull !== undefined &&
    existing.awayScoreFull !== null &&
    existing.awayScoreFull !== undefined;
  const existingHasHalf =
    existing.homeScoreHalf !== null &&
    existing.homeScoreHalf !== undefined &&
    existing.awayScoreHalf !== null &&
    existing.awayScoreHalf !== undefined;
  const incomingHasHalf =
    officialScores.homeScoreHalf !== null &&
    officialScores.awayScoreHalf !== null;

  const existingHadOfficial =
    existing.officialHomeScoreFull !== null &&
    existing.officialHomeScoreFull !== undefined &&
    existing.officialAwayScoreFull !== null &&
    existing.officialAwayScoreFull !== undefined;

  const officialChanged =
    existing.officialHomeScoreFull !== officialScores.homeScoreFull ||
    existing.officialAwayScoreFull !== officialScores.awayScoreFull ||
    (incomingHasHalf &&
      (existing.officialHomeScoreHalf !== officialScores.homeScoreHalf ||
        existing.officialAwayScoreHalf !== officialScores.awayScoreHalf));

  // Fall 1: Lokal liegt noch kein Endstand vor -> automatisch nachtragen
  if (!existingHasFull) {
    return {
      officialScores,
      applyToDisplayed: true,
      clearManualFlag: true,
      discrepancyDetected: false,
    };
  }

  const fullMatches =
    existing.homeScoreFull === officialScores.homeScoreFull &&
    existing.awayScoreFull === officialScores.awayScoreFull;
  const halfMatches =
    !incomingHasHalf ||
    !existingHasHalf ||
    (existing.homeScoreHalf === officialScores.homeScoreHalf &&
      existing.awayScoreHalf === officialScores.awayScoreHalf);

  // Fall 2: Lokal und offiziell stimmen überein (ggf. fehlenden Halbzeitstand ergänzen / offizielle Werte speichern)
  if (fullMatches && halfMatches) {
    const needsHalfBackfill = !existingHasHalf && incomingHasHalf;
    const needsClearManual = Boolean(existing.scoreManuallyEdited);
    if (!needsHalfBackfill && !officialChanged && !needsClearManual) {
      return null;
    }
    return {
      officialScores,
      applyToDisplayed: needsHalfBackfill,
      clearManualFlag: needsClearManual,
      discrepancyDetected: false,
    };
  }

  // Fall 3: Spielstand stammte bereits offiziell aus der Liga und wurde NIE manuell korrigiert -> offizielle Korrektur übernehmen
  if (existingHadOfficial && !existing.scoreManuallyEdited) {
    if (!officialChanged) return null;
    return {
      officialScores,
      applyToDisplayed: true,
      clearManualFlag: true,
      discrepancyDetected: false,
    };
  }

  // Fall 4: Manuell korrigierter (oder lokal abweichend gepflegter) Spielstand -> lokal schützen, offiziellen Stand sichern & Abweichung markieren!
  if (!officialChanged) {
    return null;
  }

  return {
    officialScores,
    applyToDisplayed: false,
    clearManualFlag: false,
    discrepancyDetected: true,
  };
}

/**
 * Vergleicht eingehende Liga-Spiele mit bestehenden synchronisierten Events über `externalId`.
 * Erkennt Neuanlagen, Spielverlegungen, Hallenwechsel, Spielabsagen, automatisch nachgetragene
 * Ergebnisse sowie Abweichungen zwischen manuell korrigierten und offiziell gemeldeten Ergebnissen.
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
    const scoreSyncUpdate = resolveScoreSyncUpdate(existing, incoming);

    if (!timeChanged && !venueChanged && !cancelledChanged && !scoreSyncUpdate) {
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

    if (scoreSyncUpdate) {
      if (scoreSyncUpdate.discrepancyDetected) {
        const localSummary = formatScoreSummary({
          homeScoreFull: existing.homeScoreFull!,
          awayScoreFull: existing.awayScoreFull!,
          homeScoreHalf: existing.homeScoreHalf ?? null,
          awayScoreHalf: existing.awayScoreHalf ?? null,
        });
        parts.push(
          `Abweichung zum offiziellen Ergebnis (${incoming.title}): Lokal ${localSummary} vs. Offiziell ${formatScoreSummary(scoreSyncUpdate.officialScores)}`
        );
      } else if (scoreSyncUpdate.applyToDisplayed) {
        parts.push(
          `Ergebnis nachgetragen (${incoming.title}): ${formatScoreSummary(scoreSyncUpdate.officialScores)}`
        );
      } else {
        parts.push(
          `Offizielles Ergebnis bestätigt (${incoming.title}): ${formatScoreSummary(scoreSyncUpdate.officialScores)}`
        );
      }
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
      scoreSyncUpdate,
    });
  }

  return actions;
}
