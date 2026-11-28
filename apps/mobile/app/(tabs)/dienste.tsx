import { useMutation, useQuery } from "@tanstack/react-query";
import { DUTY_CATEGORY_LABELS } from "@throwoff/shared";
import React from "react";
import { FlatList, RefreshControl, StyleSheet, Text } from "react-native";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  Muted,
  Screen,
  formatDateTime,
} from "../../src/components/ui";
import { useActiveTeam } from "../../src/lib/active-team";
import { api } from "../../src/lib/api";
import { queryClient, queryKeys } from "../../src/lib/query-client";
import { colors, spacing } from "../../src/theme";

export default function DiensteScreen() {
  const { activeTeam, activeMemberId } = useActiveTeam();
  const clubId = activeTeam?.clubId;

  const query = useQuery({
    queryKey: queryKeys.duties(clubId ?? "-"),
    queryFn: () => api.listClubDuties(clubId!),
    enabled: Boolean(clubId),
  });

  const claim = useMutation({
    mutationFn: (dutyId: string) => api.claimDuty(clubId!, dutyId, activeMemberId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.duties(clubId!) }),
  });

  if (!clubId) return <EmptyState text="Kein Verein ausgewählt." />;
  if (query.isPending) return <Loading />;
  if (query.isError && !query.data) return <ErrorState error={query.error} />;

  const duties = [...(query.data?.duties ?? [])].sort((a, b) =>
    (a.startAt ?? "").localeCompare(b.startAt ?? "")
  );

  return (
    <Screen>
      <FlatList
        data={duties}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.primary} />
        }
        ListEmptyComponent={<EmptyState text="Keine offenen Dienste." />}
        renderItem={({ item }) => {
          const mine = item.assignments.some((a) => a.assignedMemberId === activeMemberId);
          return (
            <Card>
              <Text style={styles.category}>
                {DUTY_CATEGORY_LABELS[item.category] ?? item.category}
              </Text>
              <Text style={styles.title}>{item.title}</Text>
              {item.startAt ? <Muted>{formatDateTime(item.startAt)}</Muted> : null}
              <Muted>
                {item.openSlots} von {item.slotsNeeded} Plätzen frei · +{item.hoursCredit} Std.
              </Muted>
              {mine ? (
                <Text style={{ color: colors.success, fontWeight: "700" }}>Du bist eingetragen</Text>
              ) : item.openSlots > 0 && activeMemberId ? (
                <Button
                  label="Dienst übernehmen"
                  variant="secondary"
                  onPress={() => claim.mutate(item.id)}
                  loading={claim.isPending && claim.variables === item.id}
                />
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing(4), gap: spacing(3) },
  category: { color: colors.primary, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
});
