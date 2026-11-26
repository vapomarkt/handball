import { useQuery } from "@tanstack/react-query";
import type { EventDTO } from "@throwoff/shared";
import { router } from "expo-router";
import React from "react";
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
  MATCH: "Spiel",
  TOURNAMENT: "Turnier",
  CLUB_EVENT: "Verein",
};

const STATUS_LABEL = {
  ACCEPTED: { text: "Zugesagt", color: colors.success },
  DECLINED: { text: "Abgesagt", color: colors.danger },
  MAYBE: { text: "Vielleicht", color: colors.warning },
  PENDING: { text: "Offen", color: colors.textMuted },
} as const;

export default function TermineScreen() {
  const { activeTeam, activeMemberId } = useActiveTeam();
  const teamId = activeTeam?.teamId;
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
    .filter((e) => new Date(e.startAt).getTime() >= since)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <Screen>
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
        ListEmptyComponent={<EmptyState text="Keine anstehenden Termine." />}
        renderItem={({ item }) => {
          const mine = item.attendances.find((a) => a.memberId === activeMemberId);
          const status = STATUS_LABEL[mine?.status ?? "PENDING"];
          return (
            <Pressable
              onPress={() => router.push(`/termine/${item.id}`)}
              style={[styles.row, item.isCancelled && styles.cancelled]}
            >
              <View style={styles.rowMain}>
                <Text style={styles.type}>{TYPE_LABEL[item.type]}</Text>
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
  cancelled: { opacity: 0.55 },
  rowMain: { flex: 1, gap: spacing(1) },
  rowSide: { alignItems: "flex-end", gap: spacing(1) },
  type: { color: colors.primary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  status: { fontWeight: "700" },
});
