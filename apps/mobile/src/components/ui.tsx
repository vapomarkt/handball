import NetInfo from "@react-native-community/netinfo";
import { useIsRestoring } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewProps,
} from "react-native";
import { colors, radius, spacing } from "../theme";

export function Screen({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.screen, style]} {...rest}>
      <OfflineBanner />
      {children}
    </View>
  );
}

export function Card({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  ...rest
}: PressableProps & {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
}) {
  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "danger"
        ? colors.danger
        : colors.surfaceAlt;
  const fg = variant === "primary" ? colors.primaryText : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: pressed || disabled ? 0.7 : 1 },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Muted>{text}</Muted>
    </View>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  const message =
    error instanceof Error ? error.message : "Unbekannter Fehler.";
  return (
    <View style={styles.center}>
      <Text style={{ color: colors.danger }}>{message}</Text>
    </View>
  );
}

/** Zeigt an, wenn die App offline ist und zwischengespeicherte Daten angezeigt werden. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const restoring = useIsRestoring();

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(state.isConnected === false);
      }),
    []
  );

  if (!offline && !restoring) return null;
  return (
    <View style={styles.offline}>
      <Text style={styles.offlineText}>
        {restoring
          ? "Lade gespeicherte Daten …"
          : "Offline – du siehst zwischengespeicherte Daten."}
      </Text>
    </View>
  );
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing(4),
    gap: spacing(1.5),
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 14 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  button: {
    minHeight: 44,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(4),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: { fontSize: 15, fontWeight: "700" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(6),
  },
  offline: {
    backgroundColor: colors.warning,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(4),
  },
  offlineText: { color: colors.primaryText, fontWeight: "600", fontSize: 13 },
});
