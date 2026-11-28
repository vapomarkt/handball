"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  Check,
  ChevronRight,
  Loader2,
  Megaphone,
  Pin,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatGermanDate } from "@/domain/date-time";
import type {
  TeamAnnouncementDTO,
  TeamPollDTO,
} from "@/domain/schemas/community";
import { cn } from "@/lib/utils";

interface TeamPulseSectionProps {
  teamId: string;
  announcements: TeamAnnouncementDTO[];
  openPolls: TeamPollDTO[];
  onPollUpdated: (updatedPoll: TeamPollDTO) => void;
}

function formatNewsDate(iso: string) {
  return formatGermanDate(iso);
}

export function TeamPulseSection({
  teamId,
  announcements,
  openPolls,
  onPollUpdated,
}: TeamPulseSectionProps) {
  const [votingKey, setVotingKey] = useState<string | null>(null);
  const [recentlyVotedPolls, setRecentlyVotedPolls] = useState<
    Record<string, TeamPollDTO>
  >({});
  const [pollError, setPollError] = useState<string | null>(null);

  // Zeige noch offene Umfragen sowie gerade eben auf dieser Seite beantwortete (für sofortiges Feedback)
  const displayedPolls: TeamPollDTO[] = [];
  const seenIds = new Set<string>();
  for (const p of openPolls.slice(0, 2)) {
    seenIds.add(p.id);
    displayedPolls.push(recentlyVotedPolls[p.id] ?? p);
  }
  for (const [id, votedPoll] of Object.entries(recentlyVotedPolls)) {
    if (!seenIds.has(id) && displayedPolls.length < 2) {
      seenIds.add(id);
      displayedPolls.push(votedPoll);
    }
  }

  if (announcements.length === 0 && displayedPolls.length === 0) {
    return null;
  }

  async function handleVote(pollId: string, optionId: string) {
    const key = `${pollId}:${optionId}`;
    setVotingKey(key);
    setPollError(null);
    try {
      const res = await fetch(
        `/api/v1/teams/${encodeURIComponent(teamId)}/polls/${encodeURIComponent(pollId)}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId }),
        }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPollError(
          data?.error?.message || "Abstimmung konnte nicht gespeichert werden."
        );
        return;
      }
      if (data?.poll) {
        const updated = data.poll as TeamPollDTO;
        setRecentlyVotedPolls((prev) => ({ ...prev, [updated.id]: updated }));
        onPollUpdated(updated);
      }
    } catch {
      setPollError("Netzwerkfehler bei der Abstimmung.");
    } finally {
      setVotingKey(null);
    }
  }

  const showTwoColumns = displayedPolls.length > 0 && announcements.length > 0;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        showTwoColumns && "md:grid-cols-2"
      )}
    >
      {displayedPolls.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-primary shrink-0" />
                <span>Offene Umfragen</span>
              </CardTitle>
              <Link
                href="/kasse"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
              >
                Alle
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {displayedPolls.map((poll) => {
              const hasVoted = poll.options.some((o) => o.votedByMe);
              return (
                <div key={poll.id} className="space-y-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {poll.question}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {poll.allowMultiple
                        ? "Mehrfachauswahl möglich"
                        : "Einfachauswahl"}{" "}
                      · {poll.totalVotes}{" "}
                      {poll.totalVotes === 1 ? "Stimme" : "Stimmen"}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {poll.options.map((opt) => {
                      const pct =
                        poll.totalVotes > 0
                          ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                          : 0;
                      const isVoting = votingKey === `${poll.id}:${opt.id}`;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={votingKey !== null}
                          onClick={() => void handleVote(poll.id, opt.id)}
                          className={cn(
                            "relative w-full min-h-11 overflow-hidden rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70",
                            opt.votedByMe
                              ? "border-emerald-500/70 bg-emerald-50/70 text-foreground dark:bg-emerald-950/35"
                              : "border-border bg-background hover:border-primary/40 hover:bg-muted/40 text-foreground"
                          )}
                        >
                          {hasVoted && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                "absolute inset-y-0 left-0 transition-all",
                                opt.votedByMe
                                  ? "bg-emerald-500/15"
                                  : "bg-muted/70"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          )}
                          <span className="relative flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              {isVoting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-primary" />
                              ) : opt.votedByMe ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              ) : null}
                              <span className="truncate font-semibold">
                                {opt.label}
                              </span>
                            </span>
                            {hasVoted && (
                              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                                {pct}% ({opt.voteCount})
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {pollError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {pollError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {announcements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Megaphone className="h-4 w-4 text-primary shrink-0" />
                <span>Team-News</span>
              </CardTitle>
              <Link
                href="/kasse"
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 shrink-0"
              >
                Zur Pinnwand
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border">
            {announcements.map((ann) => (
              <Link
                key={ann.id}
                href="/kasse"
                className="group block py-2.5 first:pt-0 last:pb-0 space-y-1"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {ann.isPinned && (
                    <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {ann.title}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                  {ann.body}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {ann.authorName} · {formatNewsDate(ann.createdAt)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
