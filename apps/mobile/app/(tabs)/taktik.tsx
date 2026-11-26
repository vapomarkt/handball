import { useQuery } from "@tanstack/react-query";
import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Body, Card, EmptyState, ErrorState, Loading, Muted, Screen } from "../../src/components/ui";
import { useActiveTeam } from "../../src/lib/active-team";
import { api } from "../../src/lib/api";
import { queryKeys } from "../../src/lib/query-client";
import { colors, spacing } from "../../src/theme";

/**
 * MVP: Spielzug-Bibliothek (offline lesbar in der Halle).
 * Die interaktive Taktiktafel (boardData-Animation) folgt als nativer Canvas-Screen.
 */
export default function TaktikScreen() {
  const { activeTeam } = useActiveTeam();
  const teamId = activeTeam?.teamId;
  const query = useQuery({
    queryKey: queryKeys.tactics(teamId ?? "-"),
    queryFn: () => api.listTactics(teamId!),
    enabled: Boolean(teamId),
  });

  if (!teamId) return <EmptyState text="Kein Team ausgewählt." />;
  if (query.isPending) return <Loading />;
  if (query.isError && !query.data) return <ErrorState error={query.error} />;

  return (
    <Screen>
      <FlatList
        data={query.data?.plays ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={<EmptyState text="Noch keine Spielzüge freigegeben." />}
        renderItem={({ item }) => (
          <Card>
            <Text style={styles.category}>{item.category}</Text>
            <Text style={styles.title}>{item.title}</Text>
            {item.description ? <Body>{item.description}</Body> : null}
            {item.tags.length > 0 ? (
              <View style={styles.tags}>
                {item.tags.map((t) => (
                  <Muted key={t}>#{t}</Muted>
                ))}
              </View>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing(4), gap: spacing(3) },
  category: { color: colors.primary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing(2) },
});
