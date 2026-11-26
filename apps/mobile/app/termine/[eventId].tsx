import { useMutation, useQuery } from "@tanstack/react-query";
import type { RsvpStatus } from "@throwoff/shared";
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  Body,
  Button,
  Card,
  ErrorState,
  Loading,
  Muted,
  Screen,
  Title,
  formatDateTime,
} from "../../src/components/ui";
import { useActiveTeam } from "../../src/lib/active-team";
import { api } from "../../src/lib/api";
import { queryClient, queryKeys } from "../../src/lib/query-client";
import { colors, radius, spacing } from "../../src/theme";

export default function EventDetailScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const { activeTeam, activeMemberId } = useActiveTeam();
  const teamId = activeTeam?.teamId ?? "";
  const [declineReason, setDeclineReason] = useState("");

  const eventQuery = useQuery({
    queryKey: queryKeys.event(teamId, eventId),
    queryFn: () => api.getEventDetail(teamId, eventId),
    enabled: Boolean(teamId && eventId),
    // Sofortige Anzeige aus dem (offline) gecachten Spielplan.
    placeholderData: () => {
      const list = queryClient.getQueryData<Awaited<ReturnType<typeof api.listTeamEvents>>>(
        queryKeys.events(teamId)
      );
      const event = list?.events.find((e) => e.id === eventId);
      return event ? { event } : undefined;
    },
  });

  const carpools = useQuery({
    queryKey: queryKeys.carpools(teamId, eventId),
    queryFn: () => api.listCarpools(teamId, eventId),
    enabled: Boolean(teamId && eventId),
  });

  const rsvp = useMutation({
    mutationFn: (status: Exclude<RsvpStatus, "PENDING">) =>
      api.upsertRsvp(teamId, eventId, {
        memberId: activeMemberId!,
        status,
        declineReasonCategory: status === "DECLINED" ? "OTHER" : null,
        declineReason: status === "DECLINED" ? declineReason || undefined : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.event(teamId, eventId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.events(teamId) });
    },
  });

  if (eventQuery.isPending) return <Loading />;
  if (!eventQuery.data) return <ErrorState error={eventQuery.error} />;

  const event = eventQuery.data.event;
  const mine = event.attendances.find((a) => a.memberId === activeMemberId);
  const offline = rsvp.isPaused;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Title>
            {event.isCancelled ? "ABGESAGT · " : ""}
            {event.title}
          </Title>
          <Muted>{formatDateTime(event.startAt)}</Muted>
          {event.meetingAt ? <Muted>Treffpunkt: {formatDateTime(event.meetingAt)}</Muted> : null}
          {event.venue ? (
            <Body>
              {event.venue.name}
              {event.venue.address ? `\n${event.venue.address}` : ""}
            </Body>
          ) : null}
          {event.venue?.resinPolicy === "RESIN_FORBIDDEN" ? (
            <Text style={{ color: colors.warning }}>Harzverbot in dieser Halle</Text>
          ) : null}
          {event.matchDetails ? (
            <Body>
              {event.matchDetails.isHome ? "Heimspiel" : "Auswärtsspiel"} gegen{" "}
              {event.matchDetails.opponentName}
              {event.matchDetails.jerseySet ? `\nTrikots: ${event.matchDetails.jerseySet.name}` : ""}
            </Body>
          ) : null}
          {event.description ? <Body>{event.description}</Body> : null}
        </Card>

        {activeMemberId && !event.isCancelled ? (
          <Card>
            <Title>Deine Rückmeldung</Title>
            <Muted>Aktuell: {mine?.status ?? "PENDING"}</Muted>
            <View style={styles.rsvpRow}>
              <View style={styles.flex}>
                <Button label="Zusage" onPress={() => rsvp.mutate("ACCEPTED")} loading={rsvp.isPending && rsvp.variables === "ACCEPTED"} />
              </View>
              <View style={styles.flex}>
                <Button label="Vielleicht" variant="secondary" onPress={() => rsvp.mutate("MAYBE")} />
              </View>
              <View style={styles.flex}>
                <Button label="Absage" variant="danger" onPress={() => rsvp.mutate("DECLINED")} />
              </View>
            </View>
            {event.requireDeclineReason ? (
              <TextInput
                style={styles.input}
                placeholder="Grund für Absage (optional)"
                placeholderTextColor={colors.textMuted}
                value={declineReason}
                onChangeText={setDeclineReason}
              />
            ) : null}
            {offline ? (
              <Text style={{ color: colors.warning }}>
                Offline – deine Rückmeldung wird gesendet, sobald du wieder Empfang hast.
              </Text>
            ) : null}
            {rsvp.isError ? (
              <Text style={{ color: colors.danger }}>{(rsvp.error as Error).message}</Text>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <Title>
            Rückmeldungen ✓ {event.summary.accepted} · ? {event.summary.maybe} · ✗ {event.summary.declined}
          </Title>
          {event.attendances.map((a) => (
            <Muted key={a.id}>
              {a.memberFirstName} {a.memberLastName}: {a.status}
            </Muted>
          ))}
        </Card>

        <Card>
          <Title>Fahrgemeinschaften</Title>
          {(carpools.data?.carpools ?? []).map((c) => (
            <View key={c.id} style={styles.carpool}>
              <Body>
                {c.driverFirstName} {c.driverLastName} · ab {c.departureLocation}
              </Body>
              <Muted>
                {c.departureTime ? `${formatDateTime(c.departureTime)} · ` : ""}
                {c.availableSeats}/{c.totalSeats} Plätze frei
              </Muted>
            </View>
          ))}
          {carpools.data?.carpools.length === 0 ? <Muted>Noch keine Fahrgemeinschaften.</Muted> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(4), gap: spacing(4) },
  rsvpRow: { flexDirection: "row", gap: spacing(2) },
  flex: { flex: 1 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing(3),
    minHeight: 44,
  },
  carpool: { gap: spacing(0.5) },
});
