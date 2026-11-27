import {
  AlertTriangle,
  Bus,
  CircleX,
  Equal,
  Home,
  Pencil,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  EVENT_TYPE_LABELS,
  formatMatchScore,
  formatOfficialMatchScore,
  getMatchOutcome,
  hasOfficialScoreDiscrepancy,
  MATCH_OUTCOME_LABELS,
  type EventType,
  type MatchDetailsDTO,
} from "@/domain/schemas/event";
import { cn } from "@/lib/utils";

export function MatchLocationBadge({
  isHome,
  labelMode = "short",
  className,
}: {
  isHome: boolean;
  labelMode?: "short" | "long";
  className?: string;
}) {
  const label = isHome
    ? labelMode === "long"
      ? "Heimspiel"
      : "Heim"
    : labelMode === "long"
      ? "Auswärtsspiel"
      : "Auswärts";

  return (
    <Badge
      variant="outline"
      data-match-location={isHome ? "home" : "away"}
      className={cn(
        "gap-1.5 border-transparent px-2.5 py-0.5 font-bold shadow-xs",
        isHome
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {isHome ? (
        <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Bus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}

export function EventTypeBadge({
  type,
  className,
}: {
  type: EventType;
  className?: string;
}) {
  if (type === "MATCH") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "border-border/80 bg-muted/40 font-medium text-muted-foreground",
          className
        )}
      >
        {EVENT_TYPE_LABELS[type]}
      </Badge>
    );
  }

  if (type === "TOURNAMENT") {
    return (
      <Badge variant="position" className={cn("font-sans", className)}>
        {EVENT_TYPE_LABELS[type]}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className={className}>
      {EVENT_TYPE_LABELS[type]}
    </Badge>
  );
}

export function MatchResultBadge({
  matchDetails,
  className,
}: {
  matchDetails: Pick<
    MatchDetailsDTO,
    | "isHome"
    | "homeScoreFull"
    | "awayScoreFull"
    | "homeScoreHalf"
    | "awayScoreHalf"
  >;
  className?: string;
}) {
  const outcome = getMatchOutcome(matchDetails);
  const scoreText = formatMatchScore(matchDetails);
  if (!outcome || !scoreText) return null;

  const badgeVariant =
    outcome === "WIN"
      ? "fit"
      : outcome === "LOSS"
        ? "injured"
        : "unavailable";

  return (
    <Badge
      variant={badgeVariant}
      data-match-outcome={outcome}
      className={cn("gap-1.5 font-semibold", className)}
    >
      {outcome === "WIN" ? (
        <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : outcome === "LOSS" ? (
        <CircleX className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Equal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{MATCH_OUTCOME_LABELS[outcome]}</span>
      <span aria-hidden="true" className="opacity-60">
        ·
      </span>
      <span className="font-mono font-bold">{scoreText}</span>
    </Badge>
  );
}

export function MatchScoreStatusBadges({
  matchDetails,
}: {
  matchDetails: Pick<
    MatchDetailsDTO,
    | "homeScoreFull"
    | "awayScoreFull"
    | "homeScoreHalf"
    | "awayScoreHalf"
    | "scoreManuallyEdited"
    | "officialHomeScoreFull"
    | "officialAwayScoreFull"
    | "officialHomeScoreHalf"
    | "officialAwayScoreHalf"
  >;
}) {
  const hasScore =
    matchDetails.homeScoreFull !== null && matchDetails.awayScoreFull !== null;
  if (!hasScore) return null;

  const discrepancy = hasOfficialScoreDiscrepancy(matchDetails);
  const officialFull = formatOfficialMatchScore(matchDetails);
  const officialShort =
    matchDetails.officialHomeScoreFull !== null &&
    matchDetails.officialAwayScoreFull !== null
      ? `${matchDetails.officialHomeScoreFull}:${matchDetails.officialAwayScoreFull}`
      : null;

  if (!matchDetails.scoreManuallyEdited && !discrepancy) {
    return null;
  }

  return (
    <>
      {matchDetails.scoreManuallyEdited && (
        <Badge
          variant="outline"
          data-score-manually-edited="true"
          title="Dieser Spielstand wurde manuell eingetragen bzw. korrigiert."
          className="gap-1 border-sky-300 bg-sky-50 font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-200"
        >
          <Pencil className="h-3 w-3 shrink-0" aria-hidden="true" />
          Manuell korrigiert
        </Badge>
      )}
      {discrepancy && officialShort && (
        <Badge
          variant="outline"
          data-score-discrepancy="true"
          title={`Abweichung zum offiziell gemeldeten Liga-Ergebnis: ${officialFull ?? officialShort}`}
          className="gap-1.5 border-amber-400 bg-amber-100 font-bold text-amber-950 ring-1 ring-amber-400/50 dark:border-amber-500/80 dark:bg-amber-950/90 dark:text-amber-200 dark:ring-amber-500/40"
        >
          <AlertTriangle
            className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>Abweichung · Offiziell</span>
          <span className="font-mono">{officialShort}</span>
        </Badge>
      )}
    </>
  );
}
