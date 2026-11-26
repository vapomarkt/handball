import { normalizeInviteLookup } from "@throwoff/shared";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Card, Muted } from "../../src/components/ui";
import { authClient } from "../../src/lib/auth-client";
import { queryClient } from "../../src/lib/query-client";
import { colors, radius, spacing } from "../../src/theme";

type AuthMode = "otp" | "password";

export default function LoginScreen() {
  const [mode, setMode] = useState<AuthMode>("otp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [showInviteBox, setShowInviteBox] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPasswordSubmit() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Anmeldung fehlgeschlagen.");
      return;
    }
    queryClient.clear();
  }

  async function onSendOtp() {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: otpError } = await authClient.emailOtp.sendVerificationOtp({
      email: normalized,
      type: "sign-in",
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message ?? "Login-PIN konnte nicht gesendet werden.");
      return;
    }
    setOtp("");
    setOtpSent(true);
    setInfo(`Wir haben eine 6-stellige Login-PIN an ${normalized} geschickt.`);
  }

  async function onVerifyOtp() {
    const normalized = email.trim().toLowerCase();
    const cleanOtp = otp.replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setError("Bitte gib die vollständige 6-stellige PIN ein.");
      return;
    }
    setError(null);
    setLoading(true);
    const { error: verifyError } = await authClient.signIn.emailOtp({
      email: normalized,
      otp: cleanOtp,
    });
    setLoading(false);
    if (verifyError) {
      setError(
        verifyError.message ?? "Die PIN stimmt nicht oder ist abgelaufen."
      );
      return;
    }
    queryClient.clear();
  }

  function onOpenInvite() {
    const lookup = normalizeInviteLookup(inviteCode);
    if (!lookup) {
      setError("Bitte gib deinen 6-stelligen Team-Code oder Einladungslink ein.");
      return;
    }
    setError(null);
    router.push(`/invite/${encodeURIComponent(lookup)}`);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.brand}>ThrowOff</Text>
            <Muted>Dein Handball-Team in der Hosentasche.</Muted>
          </View>

          <View style={styles.segmented}>
            <Pressable
              onPress={() => {
                setMode("otp");
                setError(null);
              }}
              style={[styles.tab, mode === "otp" && styles.tabActive]}
            >
              <Text
                style={[styles.tabText, mode === "otp" && styles.tabTextActive]}
              >
                Login-PIN (E-Mail)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMode("password");
                setError(null);
              }}
              style={[styles.tab, mode === "password" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  mode === "password" && styles.tabTextActive,
                ]}
              >
                Passwort
              </Text>
            </Pressable>
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

          {mode === "password" ? (
            <>
              <TextInput
                style={styles.input}
                placeholder="Passwort"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoComplete="password"
                textContentType="password"
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={onPasswordSubmit}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label="Anmelden"
                onPress={onPasswordSubmit}
                loading={loading}
                disabled={!email || !password}
              />
            </>
          ) : !otpSent ? (
            <>
              <Muted>
                Wir schicken dir eine 6-stellige Login-PIN per E-Mail – ganz
                ohne Passwort.
              </Muted>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label="6-stellige Login-PIN anfordern"
                onPress={onSendOtp}
                loading={loading}
                disabled={!email.trim()}
              />
            </>
          ) : (
            <>
              {info ? <Text style={styles.info}>{info}</Text> : null}
              <TextInput
                style={[styles.input, styles.pinInput]}
                placeholder="123456"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
                value={otp}
                onChangeText={(val) => setOtp(val.replace(/\D/g, "").slice(0, 6))}
                onSubmitEditing={onVerifyOtp}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label="PIN bestätigen & anmelden"
                onPress={onVerifyOtp}
                loading={loading}
                disabled={otp.length !== 6}
              />
              <Button
                label="Andere E-Mail / neu senden"
                variant="secondary"
                onPress={() => {
                  setOtpSent(false);
                  setOtp("");
                  setInfo(null);
                  setError(null);
                }}
              />
            </>
          )}

          <Card>
            <Pressable
              onPress={() => setShowInviteBox((prev) => !prev)}
              style={styles.inviteHeader}
            >
              <Text style={styles.inviteTitle}>
                Ich habe einen Team-Einladungscode
              </Text>
              <Muted>{showInviteBox ? "▲" : "▼"}</Muted>
            </Pressable>
            {showInviteBox ? (
              <View style={styles.inviteBody}>
                <TextInput
                  style={styles.input}
                  placeholder="z. B. H7K-4P9 oder Link"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  onSubmitEditing={onOpenInvite}
                />
                <Button
                  label="Einladung öffnen"
                  variant="secondary"
                  onPress={onOpenInvite}
                  disabled={!inviteCode.trim()}
                />
              </View>
            ) : null}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing(6),
    gap: spacing(3),
  },
  header: { marginBottom: spacing(4), gap: spacing(1) },
  brand: { color: colors.primary, fontSize: 34, fontWeight: "800" },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(1),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  tab: {
    flex: 1,
    paddingVertical: spacing(2.5),
    borderRadius: radius.sm,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontWeight: "600",
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.primaryText,
  },
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
  pinInput: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
  },
  error: { color: colors.danger, fontSize: 14 },
  info: { color: colors.success, fontSize: 13 },
  inviteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  inviteTitle: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  inviteBody: {
    marginTop: spacing(2),
    gap: spacing(2),
  },
});
