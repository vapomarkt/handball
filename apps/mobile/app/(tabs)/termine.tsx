import { useQuery } from "@tanstack/react-query";
import {
  formatMatchScore,
  formatOfficialMatchScore,
  getMatchOutcome,
  hasOfficialScoreDiscrepancy,
  MATCH_OUTCOME_LABELS,
  type EventDTO,
  type MatchOutcome,
} from "@throwoff/shared";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import {
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
  formatDateTime,
} from "../../src/components/ui";
import { useActiveTeam } from "../../src/lib/active-team";
import { api } from "../../src/lib/api";
import { queryKeys } from "../../src/lib/query-client";
import { colors, radius, spacing } from "../../src/theme";

const TYPE_LABEL: Record<EventDTO["type"], string> = {
  TRAINING: "Training",
  MATCH: "Punktspiel",
  TOURNAMENT: "Turnier",
  CLUB_EVENT: "Verein",
};

const STATUS_LABEL = {
  ACCEPTED: { text: "Zugesagt", color: colors.success },
  DECLINED: { text: "Abgesagt", color: colors.danger },
  MAYBE: { text: "Vielleicht", color: colors.warning },
  PENDING: { text: "Offen", color: colors.textMuted },
} as const;

const OUTCOME_COLORS: Record<MatchOutcome, { bg: string; text: string }> = {
  WIN: { bg: "rgba(34, 197, 94, 0.18)", text: colors.success },
  LOSS: { bg: "rgba(239, 68, 68, 0.18)", text: colors.danger },
  DRAW: { bg: "rgba(245, 158, 11, 0.18)", text: colors.warning },
};

export default function TermineScreen() {
  const { activeTeam, activeMemberId } = useActiveTeam();
  const teamId = activeTeam?.teamId;
  const [showPast, setShowPast] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.events(teamId ?? "-"),
    queryFn: () => api.listTeamEvents(teamId!),
    enabled: Boolean(teamId),
  });

  if (!teamId) return <EmptyState text="Kein Team ausgewählt." />;
  if (query.isPending) return <Loading />;
  if (query.isError && !query.data) return <ErrorState error={query.error} />;

  const since = Date.now() - 1000 * 60 * 60 * 6;
  const events = (query.data?.events ?? [])
    .filter((e) => (showPast ? true : new Date(e.startAt).getTime() >= since))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <Screen>
      <View style={styles.filterBar}>
        <Pressable
          onPress={() => setShowPast(false)}
          style={[styles.filterPill, !showPast && styles.filterPillActive]}
        >
          <Text style={[styles.filterText, !showPast && styles.filterTextActive]}>
            Anstehend
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowPast(true)}
          style={[styles.filterPill, showPast && styles.filterPillActive]}
        >
          <Text style={[styles.filterText, showPast && styles.filterTextActive]}>
            Alle inkl. Vergangene
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState text="Keine passenden Termine." />}
        renderItem={({ item }) => {
          const mine = item.attendances.find((a) => a.memberId === activeMemberId);
          const status = STATUS_LABEL[mine?.status ?? "PENDING"];
          const md = item.matchDetails;
          const outcome = md ? getMatchOutcome(md) : null;
          const scoreText = md ? formatMatchScore(md) : null;
          const discrepancy = md ? hasOfficialScoreDiscrepancy(md) : false;
          const officialScore = md ? formatOfficialMatchScore(md) : null;

          return (
            <Pressable
              onPress={() => router.push(`/termine/${item.id}`)}
              style={[
                styles.row,
                md && (md.isHome ? styles.rowHome : styles.rowAway),
                item.isCancelled && styles.cancelled,
              ]}
            >
              <View style={styles.rowMain}>
                <View style={styles.badgeRow}>
                  {md ? (
                    <View
                      style={[
                        styles.locationBadge,
                        md.isHome ? styles.homeBadge : styles.awayBadge,
                      ]}
                    >
                      <Text style={styles.locationBadgeText}>
                        {md.isHome ? "🏠 Heim" : "🚌 Auswärts"}
                      </Text>
                    </View>
                  ) : null}
                  {outcome && scoreText ? (
                    <View
                      style={[
                        styles.outcomeBadge,
                        { backgroundColor: OUTCOME_COLORS[outcome].bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.outcomeBadgeText,
                          { color: OUTCOME_COLORS[outcome].text },
                        ]}
                      >
                        {MATCH_OUTCOME_LABELS[outcome]} · {scoreText}
                      </Text>
                    </View>
                  ) : null}
                  {md?.scoreManuallyEdited && scoreText ? (
                    <View style={styles.manualBadge}>
                      <Text style={styles.manualBadgeText}>
                        ✎ Manuell korrigiert
                      </Text>
                    </View>
                  ) : null}
                  {discrepancy && officialScore ? (
                    <View style={styles.discrepancyBadge}>
                      <Text style={styles.discrepancyBadgeText}>
                        ⚠ Abweichung · Offiziell {officialScore}
                      </Text>
                    </View>
                  ) : null}
                  <Text
                    style={
                      item.type === "MATCH" ? styles.typeSubtle : styles.type
                    }
                  >
                    {TYPE_LABEL[item.type]}
                  </Text>
                </View>
                <Text style={styles.title}>
                  {item.isCancelled ? "ABGESAGT · " : ""}
                  {item.title}
                </Text>
                <Muted>
                  {formatDateTime(item.startAt)}
                  {item.venue ? ` · ${item.venue.name}` : ""}
                </Muted>
              </View>
              <View style={styles.rowSide}>
                <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
                <Muted>
                  ✓ {item.summary.accepted} · ✗ {item.summary.declined}
                </Muted>
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: "row",
    gap: spacing(2),
    paddingHorizontal: spacing(4),
    paddingTop: spacing(3),
  },
  filterPill: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
  },
  filterPillActive: {
    borderColor: colors.primary,
    backgroundColor: "rgba(217, 93, 36, 0.16)",
  },
  filterText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: colors.primary },
  list: { padding: spacing(4), gap: spacing(3) },
  row: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(4),
    gap: spacing(3),
  },
  rowHome: { borderLeftWidth: 4, borderLeftColor: colors.primary },
  rowAway: { borderLeftWidth: 4, borderLeftColor: colors.textMuted },
  cancelled: { opacity: 0.55 },
  rowMain: { flex: 1, gap: spacing(1) },
  rowSide: { alignItems: "flex-end", gap: spacing(1) },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing(1.5),
  },
  locationBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  homeBadge: { backgroundColor: colors.primary },
  awayBadge: { backgroundColor: colors.surfaceAlt },
  locationBadgeText: { color: colors.text, fontSize: 11, fontWeight: "700" },
  outcomeBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  outcomeBadgeText: { fontSize: 11, fontWeight: "700" },
  manualBadge: {
    borderRadius: radius.sm,
    backgroundColor: "rgba(56, 189, 248, 0.16)",
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  manualBadgeText: { color: "#7dd3fc", fontSize: 11, fontWeight: "600" },
  discrepancyBadge: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: spacing(2),
    paddingVertical: 2,
  },
  discrepancyBadgeText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "700",
  },
  type: { color: colors.primary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  typeSubtle: { color: colors.textMuted, fontSize: 11, fontWeight: "600" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  status: { fontWeight: "700" },
});
