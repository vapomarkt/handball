import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Card, ErrorState, Loading, Muted, Screen, Title } from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { queryClient, queryKeys } from "../../src/lib/query-client";
import { colors, spacing } from "../../src/theme";

/** Deep link: throwoff://invite/<token> (z. B. aus WhatsApp-Einladung des Trainers). */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.getInvite(token),
    enabled: Boolean(token),
  });

  const claim = useMutation({
    mutationFn: () => api.claimInvite(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      router.replace("/(tabs)");
    },
  });

  if (preview.isPending) return <Loading />;
  if (!preview.data) return <ErrorState error={preview.error} />;

  const invite = preview.data.invite;

  return (
    <Screen>
      <View style={styles.content}>
        <Card>
          <Title>
            {invite.clubName} · {invite.teamName}
          </Title>
          <Muted>
            Saison {invite.seasonName} · Rolle: {invite.role}
          </Muted>
          {invite.isValid ? (
            <Button label="Einladung annehmen" onPress={() => claim.mutate()} loading={claim.isPending} />
          ) : (
            <Text style={{ color: colors.danger }}>
              {invite.invalidReason ?? "Diese Einladung ist nicht mehr gültig."}
            </Text>
          )}
          {claim.isError ? (
            <Text style={{ color: colors.danger }}>{(claim.error as Error).message}</Text>
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(4) },
});
