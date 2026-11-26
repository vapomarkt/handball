import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
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

export default function DashboardScreen() {
  const { me, loading, teams, activeTeam, activeMemberId, setActiveTeamId } =
    useActiveTeam();
  const teamId = activeTeam?.teamId;

  const events = useQuery({
    queryKey: queryKeys.events(teamId ?? "-"),
    queryFn: () => api.listTeamEvents(teamId!),
    enabled: Boolean(teamId),
  });
  const announcements = useQuery({
    queryKey: queryKeys.announcements(teamId ?? "-"),
    queryFn: () => api.listAnnouncements(teamId!),
    enabled: Boolean(teamId),
  });

  if (loading) return <Loading />;
  if (!activeTeam) {
    return (
      <Screen>
        <EmptyState text="Du bist noch keinem Team zugeordnet. Nutze einen Einladungslink deines Trainers." />
      </Screen>
    );
  }

  const now = Date.now();
  const upcoming = (events.data?.events ?? [])
    .filter((e) => new Date(e.startAt).getTime() >= now && !e.isCancelled)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const openRsvps = upcoming.filter(
    (e) =>
      !e.attendances.some(
        (a) => a.memberId === activeMemberId && a.status !== "PENDING"
      )
  );

  async function logout() {
    await unregisterPushNotifications().catch(() => undefined);
    await authClient.signOut();
    queryClient.clear();
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={events.isRefetching}
            onRefresh={() => void queryClient.invalidateQueries()}
            tintColor={colors.primary}
          />
        }
      >
        <Muted>Hallo {me?.user.name}</Muted>

        {teams.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.teamRow}>
              {teams.map((t) => (
                <Pressable
                  key={t.teamId}
                  onPress={() => setActiveTeamId(t.teamId)}
                  style={[
                    styles.teamChip,
                    t.teamId === teamId && styles.teamChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.teamChipText,
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

        <Card>
          <Title>Offene Rückmeldungen ({openRsvps.length})</Title>
          {openRsvps.slice(0, 3).map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/termine/${e.id}`)}
            >
              <Body>
                {formatDateTime(e.startAt)} · {e.title}
              </Body>
            </Pressable>
          ))}
          {openRsvps.length === 0 ? <Muted>Alles erledigt 👍</Muted> : null}
        </Card>

        <Card>
          <Title>Nächste Termine</Title>
          {upcoming.slice(0, 5).map((e) => (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/termine/${e.id}`)}
            >
              <Body>
                {formatDateTime(e.startAt)} · {e.title}
              </Body>
            </Pressable>
          ))}
          {upcoming.length === 0 ? <Muted>Keine anstehenden Termine.</Muted> : null}
        </Card>

        <Card>
          <Title>Team-News</Title>
          {(announcements.data?.announcements ?? []).slice(0, 5).map((a) => (
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
          {announcements.data?.announcements.length === 0 ? (
            <Muted>Keine Ankündigungen.</Muted>
          ) : null}
        </Card>

        <Button label="Abmelden" variant="secondary" onPress={logout} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(4), gap: spacing(4) },
  teamRow: { flexDirection: "row", gap: spacing(2) },
  teamChip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
  },
  teamChipActive: { backgroundColor: colors.primary },
  teamChipText: { color: colors.text, fontWeight: "600" },
  news: {
    gap: spacing(1),
    paddingVertical: spacing(2),
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  newsTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
});
