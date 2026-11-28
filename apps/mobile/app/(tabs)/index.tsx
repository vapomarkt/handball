import { useMutation, useQuery } from "@tanstack/react-query";
import {
  applyOptimisticRsvpToEvents,
  buildVenueMapsHref,
  DUTY_CATEGORY_LABELS,
  EVENT_TYPE_LABELS,
  formatCentsEur,
  formatGermanTime,
  formatMemberRoles,
  getDashboardAnnouncements,
  getMemberRsvpStatus,
  getOpenUnvotedPolls,
  getPersonalUpcomingDuties,
  getUpcomingEvents,
  HANDBALL_POSITION_LABELS,
  hasMemberRole,
  isAnyMemberNominated,
  isEventRsvpLocked,
  isStaffMember,
  RSVP_STATUS_LABELS,
  type AvailabilityStatus,
  type EventDTO,
  type MePayloadDTO,
  type RsvpStatus,
  type TeamPollDTO,
} from "@throwoff/shared";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Body,
  Button,
  Card,
  EmptyState,
  Loading,
  Muted,
  Screen,
  Title,
  formatDateTime,
} from "../../src/components/ui";
import { useActiveTeam } from "../../src/lib/active-team";
import { api } from "../../src/lib/api";
import { authClient } from "../../src/lib/auth-client";
import { unregisterPushNotifications } from "../../src/lib/notifications";
import { queryClient, queryKeys } from "../../src/lib/query-client";
import { colors, radius, spacing } from "../../src/theme";

const STATUS_OPTIONS: ReadonlyArray<{
  value: AvailabilityStatus;
  label: string;
  activeBg: string;
}> = [
  { value: "FIT", label: "Fit", activeBg: colors.success },
  { value: "INJURED", label: "Verletzt", activeBg: colors.danger },
  { value: "UNAVAILABLE", label: "Abwesend", activeBg: colors.warning },
];

type RsvpFilter = "ALL" | "OPEN";

function formatTimeOnly(iso: string) {
  return formatGermanTime(iso, { includeUhr: true });
}

export default function DashboardScreen() {
  const {
    me,
    loading,
    teams,
    activeTeam,
    activeMembership,
    rsvpTargets,
    setActiveTeamId,
  } = useActiveTeam();
  const teamId = activeTeam?.teamId;
  const clubId = activeTeam?.clubId;
  const isStaff = isStaffMember(activeTeam);

  const [filter, setFilter] = useState<RsvpFilter>("ALL");
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [declineTargetKey, setDeclineTargetKey] = useState<string | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [rsvpError, setRsvpError] = useState<string | null>(null);
  const [recentlyVotedPolls, setRecentlyVotedPolls] = useState<
    Record<string, TeamPollDTO>
  >({});

  const eventsQuery = useQuery({
    queryKey: queryKeys.events(teamId ?? "-"),
    queryFn: () => api.listTeamEvents(teamId!),
    enabled: Boolean(teamId),
  });
  const announcementsQuery = useQuery({
    queryKey: queryKeys.announcements(teamId ?? "-"),
    queryFn: () => api.listAnnouncements(teamId!),
    enabled: Boolean(teamId),
  });
  const pollsQuery = useQuery({
    queryKey: queryKeys.polls(teamId ?? "-"),
    queryFn: () => api.listPolls(teamId!),
    enabled: Boolean(teamId),
  });
  const dutiesQuery = useQuery({
    queryKey: queryKeys.teamDuties(clubId ?? "-", teamId ?? "-"),
    queryFn: () => api.listClubDuties(clubId!, { teamId: teamId! }),
    enabled: Boolean(clubId && teamId),
  });
  const cashboxQuery = useQuery({
    queryKey: queryKeys.cashbox(teamId ?? "-"),
    queryFn: () => api.getCashboxOverview(teamId!),
    enabled: Boolean(teamId),
  });

  const availabilityMutation = useMutation({
    mutationFn: (availabilityStatus: AvailabilityStatus) =>
      api.updateMyProfile({ teamId: teamId!, availabilityStatus }),
    onMutate: async (nextStatus) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.me });
      const previous = queryClient.getQueryData<MePayloadDTO>(queryKeys.me);
      if (previous && teamId) {
        queryClient.setQueryData<MePayloadDTO>(queryKeys.me, {
          ...previous,
          memberships: previous.memberships.map((m) =>
            m.team.id === teamId ? { ...m, availabilityStatus: nextStatus } : m
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.me, ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  const rsvpMutation = useMutation({
    mutationFn: (vars: {
      eventId: string;
      memberId: string;
      status: Exclude<RsvpStatus, "PENDING">;
      declineReason?: string;
    }) =>
      api.upsertRsvp(teamId!, vars.eventId, {
        memberId: vars.memberId,
        status: vars.status,
        declineReasonCategory: vars.status === "DECLINED" ? "OTHER" : null,
        declineReason:
          vars.status === "DECLINED" && vars.declineReason?.trim()
            ? vars.declineReason.trim()
            : null,
      }),
    onMutate: async (vars) => {
      setRsvpError(null);
      if (!teamId) return { previous: undefined };
      const key = queryKeys.events(teamId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<{ events: EventDTO[] }>(key);
      if (previous) {
        queryClient.setQueryData<{ events: EventDTO[] }>(key, {
          events: applyOptimisticRsvpToEvents(previous.events, {
            eventId: vars.eventId,
            memberId: vars.memberId,
            status: vars.status,
          }),
        });
      }
      return { previous };
    },
    onSuccess: (data, vars) => {
      if (!teamId) return;
      setDeclineTargetKey(null);
      setDeclineNote("");
      const key = queryKeys.events(teamId);
      const current = queryClient.getQueryData<{ events: EventDTO[] }>(key);
      if (current && data?.attendance) {
        queryClient.setQueryData<{ events: EventDTO[] }>(key, {
          events: applyOptimisticRsvpToEvents(current.events, {
            eventId: vars.eventId,
            memberId: vars.memberId,
            status: data.attendance.status,
            attendance: data.attendance,
          }),
        });
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.event(teamId, vars.eventId),
      });
    },
    onError: (err, _vars, ctx) => {
      if (teamId && ctx?.previous) {
        queryClient.setQueryData(queryKeys.events(teamId), ctx.previous);
      }
      setRsvpError(
        err instanceof Error
          ? err.message
          : "Rückmeldung konnte nicht gespeichert werden."
      );
    },
  });

  const voteMutation = useMutation({
    mutationFn: (vars: { pollId: string; optionId: string }) =>
      api.votePoll(teamId!, vars.pollId, vars.optionId),
    onSuccess: (data) => {
      if (data?.poll) {
        setRecentlyVotedPolls((prev) => ({
          ...prev,
          [data.poll.id]: data.poll,
        }));
      }
      if (teamId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.polls(teamId),
        });
      }
    },
  });

  const [nowMs] = useState(() => Date.now());

  const activeTarget = useMemo(
    () =>
      rsvpTargets.find((t) => t.memberId === selectedTargetId) ??
      rsvpTargets[0] ??
      null,
    [rsvpTargets, selectedTargetId]
  );

  const upcomingEvents = useMemo(
    () => getUpcomingEvents(eventsQuery.data?.events ?? [], nowMs),
    [eventsQuery.data?.events, nowMs]
  );

  const nextEvent = upcomingEvents[0] ?? null;
  const followUpEvents = useMemo(
    () => upcomingEvents.slice(1),
    [upcomingEvents]
  );
  const openFollowUpEvents = useMemo(() => {
    if (!activeTarget) return [];
    return followUpEvents.filter(
      (ev) => getMemberRsvpStatus(ev, activeTarget.memberId) === "PENDING"
    );
  }, [followUpEvents, activeTarget]);

  const personalDuties = useMemo(() => {
    if (!me) return [];
    const linkedChildIds = new Set(
      me.guardianLinks.map((g) => g.childMemberId)
    );
    return getPersonalUpcomingDuties(dutiesQuery.data?.duties ?? [], {
      userId: me.user.id,
      memberId: activeMembership?.memberId,
      linkedChildIds,
      nowMs,
    });
  }, [dutiesQuery.data?.duties, me, activeMembership, nowMs]);

  const openPolls = useMemo(
    () => getOpenUnvotedPolls(pollsQuery.data?.polls ?? []),
    [pollsQuery.data?.polls]
  );

  const displayedPolls = useMemo(() => {
    const list: TeamPollDTO[] = [];
    const seen = new Set<string>();
    for (const p of openPolls.slice(0, 2)) {
      seen.add(p.id);
      list.push(recentlyVotedPolls[p.id] ?? p);
    }
    for (const [id, voted] of Object.entries(recentlyVotedPolls)) {
      if (!seen.has(id) && list.length < 2) {
        seen.add(id);
        list.push(voted);
      }
    }
    return list;
  }, [openPolls, recentlyVotedPolls]);

  const highlightedAnnouncements = useMemo(
    () =>
      getDashboardAnnouncements(announcementsQuery.data?.announcements ?? [], 2),
    [announcementsQuery.data?.announcements]
  );

  if (loading) return <Loading />;
  if (!activeTeam) {
    return (
      <Screen>
        <EmptyState text="Du bist noch keinem Team zugeordnet. Nutze einen Einladungslink deines Trainers." />
      </Screen>
    );
  }

  const myOpenFinesCents = cashboxQuery.data?.summary.myOpenFinesCents ?? 0;
  const myOpenFinesCount = cashboxQuery.data?.summary.myOpenFinesCount ?? 0;
  const visibleFollowUpEvents = (
    filter === "OPEN" ? openFollowUpEvents : followUpEvents
  ).slice(0, 6);
  const nextEventMapsHref = nextEvent
    ? buildVenueMapsHref(nextEvent.venue)
    : null;
  const nextEventNominated = nextEvent
    ? isAnyMemberNominated(
        nextEvent,
        rsvpTargets.map((t) => t.memberId)
      )
    : false;

  async function logout() {
    await unregisterPushNotifications().catch(() => undefined);
    await authClient.signOut();
    queryClient.clear();
  }

  function handleQuickRsvp(
    event: EventDTO,
    memberId: string,
    status: Exclude<RsvpStatus, "PENDING">
  ) {
    const key = `${event.id}:${memberId}`;
    if (status === "DECLINED" && event.requireDeclineReason) {
      if (declineTargetKey === key) {
        setDeclineTargetKey(null);
      } else {
        setDeclineTargetKey(key);
        setDeclineNote("");
      }
      return;
    }
    rsvpMutation.mutate({ eventId: event.id, memberId, status });
  }

  function renderRsvpButtons(
    event: EventDTO,
    memberId: string,
    memberLabel?: string
  ) {
    const currentStatus = getMemberRsvpStatus(event, memberId);
    const locked = isEventRsvpLocked(event, isStaff, nowMs);
    const key = `${event.id}:${memberId}`;
    const showDeclineInput = declineTargetKey === key;

    return (
      <View key={key} style={styles.rsvpBlock}>
        {memberLabel ? (
          <Text style={styles.rsvpTargetLabel}>
            Rückmeldung für {memberLabel}
          </Text>
        ) : null}

        {locked ? (
          <Muted>
            Frist abgelaufen · {RSVP_STATUS_LABELS[currentStatus]}
          </Muted>
        ) : (
          <View style={styles.rsvpButtonRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: currentStatus === "ACCEPTED" }}
              onPress={() => handleQuickRsvp(event, memberId, "ACCEPTED")}
              style={[
                styles.rsvpPill,
                currentStatus === "ACCEPTED" && styles.rsvpAccepted,
              ]}
            >
              <Text
                style={[
                  styles.rsvpPillText,
                  currentStatus === "ACCEPTED" && styles.rsvpPillTextActive,
                ]}
              >
                ✓ Ja
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: currentStatus === "MAYBE" }}
              onPress={() => handleQuickRsvp(event, memberId, "MAYBE")}
              style={[
                styles.rsvpPill,
                currentStatus === "MAYBE" && styles.rsvpMaybe,
              ]}
            >
              <Text
                style={[
                  styles.rsvpPillText,
                  currentStatus === "MAYBE" && styles.rsvpPillTextActive,
                ]}
              >
                ? Evtl.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: currentStatus === "DECLINED" }}
              onPress={() => handleQuickRsvp(event, memberId, "DECLINED")}
              style={[
                styles.rsvpPill,
                currentStatus === "DECLINED" && styles.rsvpDeclined,
              ]}
            >
              <Text
                style={[
                  styles.rsvpPillText,
                  currentStatus === "DECLINED" && styles.rsvpPillTextActive,
                ]}
              >
                ✕ Nein
              </Text>
            </Pressable>
          </View>
        )}

        {showDeclineInput ? (
          <View style={styles.declineBox}>
            <TextInput
              style={styles.declineInput}
              placeholder="Kurzer Absagegrund (Pflichtfeld)"
              placeholderTextColor={colors.textMuted}
              value={declineNote}
              onChangeText={setDeclineNote}
            />
            <View style={styles.declineActions}>
              <Pressable
                onPress={() => setDeclineTargetKey(null)}
                style={styles.declineCancel}
              >
                <Text style={styles.rsvpPillText}>Abbrechen</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  rsvpMutation.mutate({
                    eventId: event.id,
                    memberId,
                    status: "DECLINED",
                    declineReason: declineNote || "Absage",
                  })
                }
                style={styles.declineConfirm}
              >
                <Text style={styles.rsvpPillTextActive}>Absagen</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isRefetching}
            onRefresh={() => void queryClient.invalidateQueries()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header & Team-Switcher */}
        <Muted>
          Hallo {me?.user.name} · {formatMemberRoles(activeTeam.roles)}
        </Muted>

        {teams.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {teams.map((t) => (
                <Pressable
                  key={t.teamId}
                  onPress={() => setActiveTeamId(t.teamId)}
                  style={[
                    styles.chip,
                    t.teamId === teamId && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      t.teamId === teamId && { color: colors.primaryText },
                    ]}
                  >
                    {t.teamName}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Title>
            {activeTeam.clubName} · {activeTeam.teamName}
          </Title>
        )}

        {/* Fitness-Status-Umschalter für Spieler */}
        {activeMembership && hasMemberRole(activeTeam, "PLAYER") ? (
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusLabel}>
                Mein Status
                {activeMembership.jerseyNumber
                  ? ` · #${activeMembership.jerseyNumber}`
                  : ""}
                {activeMembership.primaryPosition
                  ? ` · ${HANDBALL_POSITION_LABELS[activeMembership.primaryPosition].short}`
                  : ""}
              </Text>
            </View>
            <View style={styles.rsvpButtonRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = activeMembership.availabilityStatus === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => availabilityMutation.mutate(opt.value)}
                    style={[
                      styles.rsvpPill,
                      active && {
                        backgroundColor: opt.activeBg,
                        borderColor: opt.activeBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rsvpPillText,
                        active && styles.rsvpPillTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        ) : null}

        {/* Offene Kassenstrafen (nur sichtbar wenn > 0 €) */}
        {myOpenFinesCents > 0 ? (
          <View style={styles.finesBanner}>
            <Text style={styles.finesText}>
              💰 Mannschaftskasse: {myOpenFinesCount}{" "}
              {myOpenFinesCount === 1 ? "offene Strafe" : "offene Strafen"} ·{" "}
              {formatCentsEur(myOpenFinesCents)}
            </Text>
          </View>
        ) : null}

        {/* Hero: Nächster Termin mit Treffpunkt, Maps-Link & 1-Klick-RSVP */}
        {nextEvent ? (
          <Card style={styles.heroCard}>
            <Pressable
              onPress={() => router.push(`/termine/${nextEvent.id}`)}
              style={styles.heroHeader}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.heroEyebrow}>NÄCHSTER TERMIN</Text>
                <View style={styles.badgeRow}>
                  <Text style={styles.metaBadge}>
                    {nextEvent.matchDetails
                      ? nextEvent.matchDetails.isHome
                        ? "Heimspiel"
                        : "Auswärtsspiel"
                      : EVENT_TYPE_LABELS[nextEvent.type]}
                  </Text>
                  {nextEventNominated ? (
                    <Text style={styles.nominatedBadge}>Nominiert</Text>
                  ) : null}
                </View>
              </View>
              <Title>{nextEvent.title}</Title>
              <Body>{formatDateTime(nextEvent.startAt)}</Body>
              {nextEvent.meetingAt ? (
                <Muted>Treffpunkt: {formatTimeOnly(nextEvent.meetingAt)}</Muted>
              ) : null}
              {nextEvent.venue ? (
                <View style={styles.venueRow}>
                  <Muted>{nextEvent.venue.name}</Muted>
                  {nextEventMapsHref ? (
                    <Pressable
                      onPress={() => void Linking.openURL(nextEventMapsHref)}
                    >
                      <Text style={styles.linkText}>Route ↗</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
              {activeTeam.usesResin &&
              nextEvent.venue?.resinPolicy === "RESIN_FORBIDDEN" ? (
                <Text style={styles.warningText}>Harzverbot in dieser Halle</Text>
              ) : null}
              {nextEvent.matchDetails?.jerseyColor ? (
                <Muted>Trikot: {nextEvent.matchDetails.jerseyColor}</Muted>
              ) : null}
            </Pressable>

            {rsvpTargets.length > 0 ? (
              <View style={styles.heroRsvpWrap}>
                {rsvpTargets.map((t) =>
                  renderRsvpButtons(
                    nextEvent,
                    t.memberId,
                    t.isOwn ? undefined : t.label
                  )
                )}
              </View>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Title>Kein anstehender Termin</Title>
            <Muted>
              Sobald neue Trainings oder Spiele angelegt sind, erscheinen sie
              hier.
            </Muted>
          </Card>
        )}

        {rsvpError ? <Text style={styles.errorText}>{rsvpError}</Text> : null}

        {/* Kommende Termine & Schnell-RSVP (1-Klick pro Zeile) */}
        {rsvpTargets.length > 0 && followUpEvents.length > 0 && activeTarget ? (
          <Card>
            <View style={styles.rowBetween}>
              <Title>Kommende Termine</Title>
              <Text style={styles.openCountText}>
                {openFollowUpEvents.length > 0
                  ? `${openFollowUpEvents.length} offen`
                  : "Alles beantwortet"}
              </Text>
            </View>

            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setFilter("ALL")}
                style={[
                  styles.filterTab,
                  filter === "ALL" && styles.filterTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === "ALL" && styles.filterTabTextActive,
                  ]}
                >
                  Alle ({followUpEvents.length})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setFilter("OPEN")}
                style={[
                  styles.filterTab,
                  filter === "OPEN" && styles.filterTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === "OPEN" && styles.filterTabTextActive,
                  ]}
                >
                  Offen ({openFollowUpEvents.length})
                </Text>
              </Pressable>
            </View>

            {rsvpTargets.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chipRow}>
                  {rsvpTargets.map((t) => (
                    <Pressable
                      key={t.memberId}
                      onPress={() => setSelectedTargetId(t.memberId)}
                      style={[
                        styles.chip,
                        t.memberId === activeTarget.memberId &&
                          styles.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          t.memberId === activeTarget.memberId && {
                            color: colors.primaryText,
                          },
                        ]}
                      >
                        {t.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            ) : null}

            {visibleFollowUpEvents.length === 0 ? (
              <Muted>Alle kommenden Termine sind beantwortet 👍</Muted>
            ) : (
              visibleFollowUpEvents.map((ev) => (
                <View key={ev.id} style={styles.eventRow}>
                  <Pressable
                    onPress={() => router.push(`/termine/${ev.id}`)}
                    style={styles.eventRowHeader}
                  >
                    <Text style={styles.eventRowTitle}>
                      {ev.type === "MATCH" && ev.matchDetails
                        ? `${ev.matchDetails.isHome ? "Heim" : "Ausw."} · ${ev.matchDetails.opponentName}`
                        : ev.title}
                    </Text>
                    <Muted>
                      {formatDateTime(ev.startAt)}
                      {ev.venue ? ` · ${ev.venue.name}` : ""}
                    </Muted>
                  </Pressable>
                  {renderRsvpButtons(ev, activeTarget.memberId)}
                </View>
              ))
            )}

            <Pressable
              onPress={() => router.push("/termine")}
              style={styles.footerLink}
            >
              <Text style={styles.linkText}>Alle Termine öffnen ›</Text>
            </Pressable>
          </Card>
        ) : null}

        {/* Alle eigenen anstehenden Dienste */}
        {personalDuties.length > 0 ? (
          <Card>
            <View style={styles.rowBetween}>
              <Title>Deine anstehenden Dienste</Title>
              <Pressable onPress={() => router.push("/dienste")}>
                <Text style={styles.linkText}>Alle ›</Text>
              </Pressable>
            </View>
            {personalDuties
              .slice(0, 4)
              .map(({ duty, assignment, isLaundry, isSwapRequested }) => (
                <Pressable
                  key={assignment.id}
                  onPress={() => router.push("/dienste")}
                  style={styles.dutyItem}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.newsTitle}>{duty.title}</Text>
                    {isSwapRequested ? (
                      <Text style={styles.warningText}>Tausch gesucht</Text>
                    ) : null}
                  </View>
                  <Muted>
                    {duty.startAt ? `${formatDateTime(duty.startAt)} · ` : ""}
                    {DUTY_CATEGORY_LABELS[duty.category]}
                    {duty.hoursCredit > 0 ? ` · ${duty.hoursCredit} h` : ""}
                  </Muted>
                  {isLaundry && duty.jerseySet?.careInstructions ? (
                    <Text style={styles.careText}>
                      ✨ {duty.jerseySet.careInstructions}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
          </Card>
        ) : null}

        {/* Offene Umfragen mit 1-Klick-Abstimmen */}
        {displayedPolls.length > 0 ? (
          <Card>
            <Title>Offene Umfragen</Title>
            {displayedPolls.map((poll) => {
              const hasVoted = poll.options.some((o) => o.votedByMe);
              return (
                <View key={poll.id} style={styles.pollBlock}>
                  <Text style={styles.newsTitle}>{poll.question}</Text>
                  <Muted>
                    {poll.allowMultiple ? "Mehrfachauswahl" : "Einfachauswahl"}{" "}
                    · {poll.totalVotes}{" "}
                    {poll.totalVotes === 1 ? "Stimme" : "Stimmen"}
                  </Muted>
                  {poll.options.map((opt) => {
                    const pct =
                      poll.totalVotes > 0
                        ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                        : 0;
                    return (
                      <Pressable
                        key={opt.id}
                        disabled={voteMutation.isPending}
                        onPress={() =>
                          voteMutation.mutate({
                            pollId: poll.id,
                            optionId: opt.id,
                          })
                        }
                        style={[
                          styles.pollOption,
                          opt.votedByMe && styles.pollOptionVoted,
                        ]}
                      >
                        <Text style={styles.pollOptionText}>
                          {opt.votedByMe ? "✓ " : ""}
                          {opt.label}
                        </Text>
                        {hasVoted ? (
                          <Muted>
                            {pct}% ({opt.voteCount})
                          </Muted>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </Card>
        ) : null}

        {/* Team-News (nur anzeigen wenn vorhanden) */}
        {highlightedAnnouncements.length > 0 ? (
          <Card>
            <Title>Team-News</Title>
            {highlightedAnnouncements.map((a) => (
              <View key={a.id} style={styles.news}>
                <Text style={styles.newsTitle}>
                  {a.isPinned ? "📌 " : ""}
                  {a.title}
                </Text>
                <Muted>
                  {a.authorName} · {formatDateTime(a.createdAt)}
                </Muted>
                <Body>{a.body}</Body>
              </View>
            ))}
          </Card>
        ) : null}

        <Button label="Abmelden" variant="secondary" onPress={logout} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(4), gap: spacing(3.5) },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  chipRow: { flexDirection: "row", gap: spacing(2) },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "600", fontSize: 13 },
  statusCard: { gap: spacing(2) },
  statusHeader: { flexDirection: "row", justifyContent: "space-between" },
  statusLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  finesBanner: {
    backgroundColor: "rgba(234, 179, 8, 0.14)",
    borderColor: "rgba(234, 179, 8, 0.45)",
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
  },
  finesText: { color: "#fde047", fontSize: 13, fontWeight: "700" },
  heroCard: { borderColor: "rgba(249, 115, 22, 0.45)", gap: spacing(3) },
  heroHeader: { gap: spacing(1) },
  heroEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  badgeRow: { flexDirection: "row", gap: spacing(1.5) },
  metaBadge: {
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.75),
    borderRadius: radius.sm,
    fontSize: 11,
    fontWeight: "600",
    overflow: "hidden",
  },
  nominatedBadge: {
    color: "#86efac",
    backgroundColor: "rgba(34, 197, 94, 0.16)",
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(0.75),
    borderRadius: radius.sm,
    fontSize: 11,
    fontWeight: "700",
    overflow: "hidden",
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(2.5),
  },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  warningText: { color: colors.warning, fontSize: 12, fontWeight: "600" },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  heroRsvpWrap: { gap: spacing(2.5), paddingTop: spacing(1) },
  rsvpBlock: { gap: spacing(1.5) },
  rsvpTargetLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  rsvpButtonRow: { flexDirection: "row", gap: spacing(2) },
  rsvpPill: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(2),
  },
  rsvpAccepted: { backgroundColor: colors.success, borderColor: colors.success },
  rsvpMaybe: { backgroundColor: colors.warning, borderColor: colors.warning },
  rsvpDeclined: { backgroundColor: colors.danger, borderColor: colors.danger },
  rsvpPillText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  rsvpPillTextActive: {
    color: colors.primaryText,
    fontSize: 13,
    fontWeight: "800",
  },
  declineBox: {
    gap: spacing(2),
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2.5),
  },
  declineInput: {
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 14,
  },
  declineActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing(2),
  },
  declineCancel: {
    minHeight: 38,
    paddingHorizontal: spacing(3),
    justifyContent: "center",
  },
  declineConfirm: {
    minHeight: 38,
    paddingHorizontal: spacing(3),
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
    justifyContent: "center",
  },
  openCountText: { color: colors.warning, fontSize: 12, fontWeight: "700" },
  filterRow: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing(1),
    gap: spacing(1),
  },
  filterTab: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  filterTabActive: { backgroundColor: colors.surfaceAlt },
  filterTabText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  filterTabTextActive: { color: colors.text, fontWeight: "700" },
  eventRow: {
    gap: spacing(2),
    paddingVertical: spacing(2.5),
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  eventRowHeader: { gap: spacing(0.5) },
  eventRowTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  footerLink: {
    paddingTop: spacing(2),
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "flex-end",
  },
  dutyItem: {
    gap: spacing(1),
    paddingVertical: spacing(2),
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  careText: { color: "#7dd3fc", fontSize: 12, lineHeight: 18 },
  pollBlock: {
    gap: spacing(1.5),
    paddingTop: spacing(2),
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pollOption: {
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(2),
  },
  pollOptionVoted: {
    borderColor: colors.success,
    backgroundColor: "rgba(34, 197, 94, 0.14)",
  },
  pollOptionText: { color: colors.text, fontSize: 14, fontWeight: "600", flex: 1 },
  news: {
    gap: spacing(1),
    paddingVertical: spacing(2),
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  newsTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
});
