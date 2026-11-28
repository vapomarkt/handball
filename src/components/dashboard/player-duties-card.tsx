"use client";

import Link from "next/link";
import {
  ChevronRight,
  ClipboardList,
  Clock,
  Shirt,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatGermanDateTime } from "@/domain/date-time";
import { DUTY_CATEGORY_LABELS } from "@/domain/schemas/duty";
import type { PersonalDutyItem } from "@/domain/services/player-dashboard";

interface PlayerDutiesCardProps {
  duties: PersonalDutyItem[];
}

function formatDutyDate(iso: string) {
  return formatGermanDateTime(iso, { includeWeekday: true, includeUhr: true });
}

export function PlayerDutiesCard({ duties }: PlayerDutiesCardProps) {
  if (duties.length === 0) {
    return null;
  }

  const visible = duties.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-primary shrink-0" />
            <span>Deine anstehenden Dienste</span>
          </CardTitle>
          <Link
            href="/dienste"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
          >
            Alle Dienste
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-0 divide-y divide-border">
        {visible.map(({ duty, assignment, isLaundry, isSwapRequested }) => (
          <div key={assignment.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                  {isLaundry ? (
                    <Shirt className="h-4 w-4" />
                  ) : (
                    <ClipboardList className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {duty.title}
                    {isLaundry && duty.jerseySet
                      ? ` · ${duty.jerseySet.name} (${duty.jerseySet.colors})`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {duty.startAt && (
                      <span className="inline-flex items-center gap-1 font-medium text-foreground/85">
                        <Clock className="h-3 w-3 shrink-0" />
                        {formatDutyDate(duty.startAt)}
                      </span>
                    )}
                    <span>{DUTY_CATEGORY_LABELS[duty.category]}</span>
                    {duty.hoursCredit > 0 && (
                      <span>· {duty.hoursCredit} h</span>
                    )}
                  </p>
                </div>
              </div>

              {isSwapRequested && (
                <Badge
                  variant="outline"
                  className="shrink-0 border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  Tausch gesucht
                </Badge>
              )}
            </div>

            {isLaundry && duty.jerseySet?.careInstructions && (
              <p className="ml-10.5 rounded-lg bg-sky-50/80 dark:bg-sky-950/35 border border-sky-200/80 dark:border-sky-800/80 px-2.5 py-1.5 text-xs text-sky-950 dark:text-sky-100 flex items-start gap-1.5 whitespace-pre-line">
                <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-300" />
                <span>{duty.jerseySet.careInstructions}</span>
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
