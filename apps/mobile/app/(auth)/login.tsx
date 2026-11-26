import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Muted } from "../../src/components/ui";
import { authClient } from "../../src/lib/auth-client";
import { queryClient } from "../../src/lib/query-client";
import { colors, radius, spacing } from "../../src/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Anmeldung fehlgeschlagen.");
      return;
    }
    queryClient.clear();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>ThrowOff</Text>
          <Muted>Dein Handball-Team in der Hosentasche.</Muted>
        </View>

        <TextInput
          style={styles.input}
          placeholder="E-Mail"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Passwort"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label="Anmelden"
          onPress={onSubmit}
          loading={loading}
          disabled={!email || !password}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing(6),
    gap: spacing(3),
  },
  header: { marginBottom: spacing(6), gap: spacing(1) },
  brand: { color: colors.primary, fontSize: 34, fontWeight: "800" },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing(4),
    minHeight: 48,
    fontSize: 16,
  },
  error: { color: colors.danger },
});
