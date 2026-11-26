import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Loading } from "../src/components/ui";
import { ActiveTeamProvider } from "../src/lib/active-team";
import { authClient } from "../src/lib/auth-client";
import {
  registerForPushNotifications,
  subscribeToNotificationTaps,
} from "../src/lib/notifications";
import {
  PERSIST_MAX_AGE,
  queryClient,
  queryPersister,
} from "../src/lib/query-client";
import { colors } from "../src/theme";

function AuthGate() {
  const { data: session, isPending } = authClient.useSession();
  const segments = useSegments();
  const inAuthGroup = segments[0] === "(auth)";
  const isLoggedIn = Boolean(session?.user);

  useEffect(() => {
    if (!isLoggedIn) return;
    registerForPushNotifications().catch((err) =>
      console.warn("[push] Registrierung fehlgeschlagen", err)
    );
    return subscribeToNotificationTaps();
  }, [isLoggedIn]);

  if (isPending) return <Loading />;
  if (!isLoggedIn && !inAuthGroup) return <Redirect href="/(auth)/login" />;
  if (isLoggedIn && inAuthGroup) return <Redirect href="/(tabs)" />;

  const stack = (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="termine/[eventId]" options={{ title: "Termin" }} />
      <Stack.Screen name="invite/[token]" options={{ title: "Einladung" }} />
    </Stack>
  );

  return isLoggedIn ? <ActiveTeamProvider>{stack}</ActiveTeamProvider> : stack;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: PERSIST_MAX_AGE }}
      >
        <StatusBar style="light" />
        <AuthGate />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
