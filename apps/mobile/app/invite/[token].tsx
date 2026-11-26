import { useMutation, useQuery } from "@tanstack/react-query";
import {
  INVITE_TYPE_LABELS,
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
} from "@throwoff/shared";
import { router, useLocalSearchParams } from "expo-router";
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
} from "../../src/components/ui";
import { api } from "../../src/lib/api";
import { authClient } from "../../src/lib/auth-client";
import { queryClient, queryKeys } from "../../src/lib/query-client";
import { colors, radius, spacing } from "../../src/theme";

/** Deep link: throwoff://invite/<token> oder 6-stelliger Kurzcode. */
export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api.getInvite(token),
    enabled: Boolean(token),
  });

  const claim = useMutation({
    mutationFn: () =>
      api.claimInvite(token, {
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me });
      router.replace("/(tabs)");
    },
  });

  async function handleSendOtp() {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes("@")) {
      setAuthError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setAuthError(null);
    setAuthInfo(null);
    setAuthLoading(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: normalized,
      type: "sign-in",
    });
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message ?? "Login-PIN konnte nicht gesendet werden.");
      return;
    }
    setOtp("");
    setOtpSent(true);
    setAuthInfo(`6-stellige Login-PIN wurde an ${normalized} geschickt.`);
  }

  async function handleVerifyOtpAndClaim() {
    const normalized = email.trim().toLowerCase();
    const cleanOtp = otp.replace(/\D/g, "");
    if (cleanOtp.length !== 6) {
      setAuthError("Bitte gib die vollständige 6-stellige PIN ein.");
      return;
    }
    setAuthError(null);
    setAuthLoading(true);
    const { error } = await authClient.signIn.emailOtp({
      email: normalized,
      otp: cleanOtp,
    });
    if (error) {
      setAuthLoading(false);
      setAuthError(error.message ?? "PIN ungültig oder abgelaufen.");
      return;
    }
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (fullName) {
      await authClient.updateUser({ name: fullName }).catch(() => undefined);
    }
    setAuthLoading(false);
    claim.mutate();
  }

  if (preview.isPending || sessionPending) return <Loading />;
  if (!preview.data) return <ErrorState error={preview.error} />;

  const invite = preview.data.invite;
  const roleLabel = MEMBER_ROLE_LABELS[invite.role] ?? invite.role;
  const roleDescription = MEMBER_ROLE_DESCRIPTIONS[invite.role];
  const typeLabel = INVITE_TYPE_LABELS[invite.type] ?? invite.type;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <Muted>{typeLabel}</Muted>
          <Title>
            {invite.clubName} · {invite.teamName}
          </Title>
          <Muted>
            Saison {invite.seasonName} · Rolle: {roleLabel}
          </Muted>
          {roleDescription ? <Body>{roleDescription}</Body> : null}
          {invite.targetMemberFirstName ? (
            <Body>
              {invite.type === "GUARDIAN_LINK"
                ? `Eltern-Zugang für: ${invite.targetMemberFirstName}`
                : `Vorbereitetes Profil: ${invite.targetMemberFirstName}`}
            </Body>
          ) : null}

          {!invite.isValid ? (
            <Text style={styles.error}>
              {invite.invalidReason ?? "Diese Einladung ist nicht mehr gültig."}
            </Text>
          ) : session?.user ? (
            <View style={styles.section}>
              <Muted>Angemeldet als {session.user.email}</Muted>
              <Button
                label="Einladung annehmen"
                onPress={() => claim.mutate()}
                loading={claim.isPending}
              />
            </View>
          ) : (
            <View style={styles.section}>
              <Muted>
                Gib deine E-Mail ein – wir schicken dir eine 6-stellige
                Login-PIN (kein Passwort nötig).
              </Muted>
              {!otpSent ? (
                <>
                  {invite.type !== "PROFILE_CLAIM" ? (
                    <View style={styles.row}>
                      <TextInput
                        style={[styles.input, styles.half]}
                        placeholder="Vorname"
                        placeholderTextColor={colors.textMuted}
                        value={firstName}
                        onChangeText={setFirstName}
                      />
                      <TextInput
                        style={[styles.input, styles.half]}
                        placeholder="Nachname"
                        placeholderTextColor={colors.textMuted}
                        value={lastName}
                        onChangeText={setLastName}
                      />
                    </View>
                  ) : null}
                  <TextInput
                    style={styles.input}
                    placeholder="Deine E-Mail-Adresse"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Button
                    label="6-stellige Login-PIN erhalten"
                    onPress={handleSendOtp}
                    loading={authLoading}
                    disabled={!email.trim()}
                  />
                </>
              ) : (
                <>
                  {authInfo ? <Text style={styles.info}>{authInfo}</Text> : null}
                  <TextInput
                    style={[styles.input, styles.pinInput]}
                    placeholder="123456"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={6}
                    value={otp}
                    onChangeText={(val) =>
                      setOtp(val.replace(/\D/g, "").slice(0, 6))
                    }
                  />
                  <Button
                    label="PIN bestätigen & beitreten"
                    onPress={handleVerifyOtpAndClaim}
                    loading={authLoading || claim.isPending}
                    disabled={otp.length !== 6}
                  />
                  <Button
                    label="E-Mail ändern"
                    variant="secondary"
                    onPress={() => {
                      setOtpSent(false);
                      setOtp("");
                      setAuthInfo(null);
                      setAuthError(null);
                    }}
                  />
                </>
              )}
            </View>
          )}

          {authError ? <Text style={styles.error}>{authError}</Text> : null}
          {claim.isError ? (
            <Text style={styles.error}>{(claim.error as Error).message}</Text>
          ) : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing(4) },
  section: { marginTop: spacing(3), gap: spacing(2.5) },
  row: { flexDirection: "row", gap: spacing(2) },
  half: { flex: 1 },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.text,
    paddingHorizontal: spacing(3.5),
    minHeight: 46,
    fontSize: 15,
  },
  pinInput: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
  },
  error: { color: colors.danger, fontSize: 14 },
  info: { color: colors.success, fontSize: 13 },
});
