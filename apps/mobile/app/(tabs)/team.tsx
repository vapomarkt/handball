import { useQuery } from "@tanstack/react-query";
import { MEMBER_ROLE_LABELS } from "@throwoff/shared";
import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState, ErrorState, Loading, Muted, Screen } from "../../src/components/ui";
import { useActiveTeam } from "../../src/lib/active-team";
import { api } from "../../src/lib/api";
import { queryKeys } from "../../src/lib/query-client";
import { colors, radius, spacing } from "../../src/theme";

const AVAILABILITY_COLOR = {
  FIT: colors.success,
  INJURED: colors.danger,
  UNAVAILABLE: colors.warning,
} as const;

export default function TeamScreen() {
  const { activeTeam } = useActiveTeam();
  const teamId = activeTeam?.teamId;
  const query = useQuery({
    queryKey: queryKeys.members(teamId ?? "-"),
    queryFn: () => api.listTeamMembers(teamId!),
    enabled: Boolean(teamId),
  });

  if (!teamId) return <EmptyState text="Kein Team ausgewählt." />;
  if (query.isPending) return <Loading />;
  if (query.isError && !query.data) return <ErrorState error={query.error} />;

  const members = [...(query.data?.members ?? [])].sort(
    (a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999)
  );

  return (
    <Screen>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={<EmptyState text="Noch keine Kadermitglieder." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.number}>{item.jerseyNumber ?? "–"}</Text>
            <View style={styles.flex}>
              <Text style={styles.name}>
                {item.firstName} {item.lastName}
              </Text>
              <Muted>
                {[
                  item.role !== "PLAYER"
                    ? (MEMBER_ROLE_LABELS[item.role] ?? item.role)
                    : null,
                  item.primaryPosition,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Spieler"}
              </Muted>
            </View>
            {item.availabilityStatus !== "FIT" ? (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: AVAILABILITY_COLOR[item.availabilityStatus] },
                ]}
              />
            ) : null}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing(4), gap: spacing(2) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3),
  },
  number: { color: colors.primary, fontSize: 20, fontWeight: "800", width: 36, textAlign: "center" },
  flex: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: "600" },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
