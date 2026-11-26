"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { OtpPinInput } from "@/components/auth/otp-pin-input";
import {
  isPasskeySupported,
  PasskeySetupCard,
} from "@/components/auth/passkey-setup-card";
import { BrandLogo } from "@/components/branding/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { QuickProfileForm } from "@/components/onboarding/quick-profile-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import {
  INVITE_TYPE_LABELS,
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
  type HandballPosition,
  type MemberRole,
  type ThrowingHand,
} from "@/domain/schemas/handball";
import type { InvitePreviewDTO } from "@/domain/schemas/invite";
import {
  authClient,
  signIn,
  signUp,
  useSession,
} from "@/infrastructure/auth/auth-client";
import { cn } from "@/lib/utils";

type FlowStep = "join" | "profile" | "passkey";
type InlineAuthMode = "otp" | "password-login" | "password-register";

const RELATIONSHIPS = [
  "Mutter",
  "Vater",
  "Elternteil",
  "Sorgeberechtigte Person",
  "Großeltern",
];

interface ClaimedMemberProfile {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  emergencyContact?: string | null;
  primaryPosition?: HandballPosition | null;
  throwingHand?: ThrowingHand | null;
}

interface ClaimedContext {
  teamId: string;
  role: MemberRole;
  memberId?: string;
  childMemberId?: string;
  childEmergencyContact?: string | null;
  memberProfile?: ClaimedMemberProfile;
}

function InviteClaimContent() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [preview, setPreview] = useState<InvitePreviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [step, setStep] = useState<FlowStep>("join");
  const [claimed, setClaimed] = useState<ClaimedContext | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Inline Auth-State (für nicht eingeloggte Nutzer – nahtlos ohne Seitenwechsel!)
  const [authMode, setAuthMode] = useState<InlineAuthMode>("otp");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relationship, setRelationship] = useState("Elternteil");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const token = params.token;

  useEffect(() => {
    let active = true;
    isPasskeySupported().then((ok) => {
      if (active) setPasskeyAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    async function loadPreview() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/invites/${encodeURIComponent(token)}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error?.message || "Einladung nicht gefunden.");
          return;
        }
        const inv: InvitePreviewDTO = data.invite;
        setPreview(inv);
        if (inv.type === "PROFILE_CLAIM" && inv.targetMemberFirstName) {
          setFirstName(inv.targetMemberFirstName);
        }
      } catch {
        setError("Einladung konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }
    if (token) void loadPreview();
  }, [token]);

  const executeClaim = useCallback(
    async (overrides?: {
      firstName?: string;
      lastName?: string;
      relationship?: string;
    }) => {
      setClaiming(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          relationship: overrides?.relationship ?? relationship,
        };
        const fn = (overrides?.firstName ?? firstName).trim();
        const ln = (overrides?.lastName ?? lastName).trim();
        if (fn) body.firstName = fn;
        if (ln) body.lastName = ln;

        const res = await fetch(
          `/api/v1/invites/${encodeURIComponent(token)}/claim`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const data = await res.json();
        if (!res.ok) {
          setError(
            data?.error?.message || "Einladung konnte nicht eingelöst werden."
          );
          return;
        }

        if (data.teamId && typeof window !== "undefined") {
          localStorage.setItem("throwoff_active_team_id", data.teamId);
        }

        setClaimed({
          teamId: data.teamId,
          role: (data.role ?? preview?.role ?? "PLAYER") as MemberRole,
          memberId: data.memberId,
          childMemberId: data.childMemberId,
          childEmergencyContact: data.childEmergencyContact ?? null,
          memberProfile: data.memberProfile,
        });
        setStep("profile");
      } catch {
        setError("Netzwerkfehler beim Einlösen.");
      } finally {
        setClaiming(false);
      }
    },
    [firstName, lastName, preview, relationship, token]
  );

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Bitte gib deine gültige E-Mail-Adresse ein.");
      return;
    }

    setError(null);
    setInfo(null);
    setAuthBusy(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });
      if (result.error) {
        setError(
          result.error.message || "Login-PIN konnte nicht gesendet werden."
        );
        return;
      }
      setOtp("");
      setOtpSent(true);
      setResendCooldown(45);
      setInfo(
        `Deine 6-stellige Login-PIN wurde an ${normalizedEmail} geschickt.`
      );
    } catch {
      setError("Netzwerkfehler beim Senden der Login-PIN.");
    } finally {
      setAuthBusy(false);
    }
  }

  const handleVerifyOtpAndClaim = useCallback(
    async (code: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || code.length !== 6) return;

      setError(null);
      setAuthBusy(true);
      try {
        const result = await authClient.signIn.emailOtp({
          email: normalizedEmail,
          otp: code,
        });
        if (result.error) {
          setError(
            result.error.message ||
              "Die PIN stimmt nicht oder ist abgelaufen."
          );
          return;
        }

        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        if (fullName) {
          await authClient.updateUser({ name: fullName }).catch(() => {});
        }

        await executeClaim();
      } catch {
        setError("Netzwerkfehler bei der Anmeldung.");
      } finally {
        setAuthBusy(false);
      }
    },
    [email, executeClaim, firstName, lastName]
  );

  async function handlePasswordAuthAndClaim(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setError(null);
    setAuthBusy(true);

    try {
      if (authMode === "password-register") {
        if (password.length < 8) {
          setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
          return;
        }
        const fullName =
          `${firstName.trim()} ${lastName.trim()}`.trim() ||
          normalizedEmail.split("@")[0] ||
          "Mitglied";
        const res = await signUp.email({
          name: fullName,
          email: normalizedEmail,
          password,
        });
        if (res.error) {
          setError(res.error.message || "Registrierung fehlgeschlagen.");
          return;
        }
      } else {
        const res = await signIn.email({
          email: normalizedEmail,
          password,
        });
        if (res.error) {
          setError(
            res.error.message ||
              "Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort."
          );
          return;
        }
      }

      await executeClaim();
    } catch {
      setError("Netzwerkfehler bei der Anmeldung.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handlePasskeyAuthAndClaim() {
    setError(null);
    setAuthBusy(true);
    try {
      const res = await authClient.signIn.passkey();
      if (res?.error) {
        setError(res.error.message || "Passkey-Anmeldung fehlgeschlagen.");
        return;
      }
      await executeClaim();
    } catch {
      setError("Passkey-Abfrage abgebrochen.");
    } finally {
      setAuthBusy(false);
    }
  }

  function finishToDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  async function handleAfterProfile() {
    await fetch("/api/v1/me/onboarding-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markOnboardingComplete: true }),
    }).catch(() => {});

    if (passkeyAvailable) {
      setStep("passkey");
    } else {
      finishToDashboard();
    }
  }

  async function handleSkipPasskey() {
    await fetch("/api/v1/me/onboarding-state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passkeyPromptDismissed: true }),
    }).catch(() => {});
    finishToDashboard();
  }

  // Namen aus Session für Schritt 2 vorbefüllen, falls noch leer
  const sessionNameParts = (session?.user?.name ?? "").trim().split(/\s+/);
  const initialFirst =
    firstName.trim() ||
    preview?.targetMemberFirstName ||
    sessionNameParts[0] ||
    "";
  const initialLast =
    lastName.trim() ||
    (sessionNameParts.length > 1 ? sessionNameParts.slice(1).join(" ") : "");

  return (
    <div className="min-h-screen flex flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Schritt-Anzeige sobald die Einladung gültig ist */}
        {preview?.isValid && (
          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5",
                step === "join"
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary/15 text-primary"
              )}
            >
              1. Beitreten
            </span>
            <span>→</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5",
                step === "profile"
                  ? "bg-primary text-primary-foreground"
                  : step === "passkey"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted"
              )}
            >
              2. Profil
            </span>
            {passkeyAvailable && (
              <>
                <span>→</span>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5",
                    step === "passkey"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  3. Schnell-Login
                </span>
              </>
            )}
          </div>
        )}

        <Card>
          {step === "join" && (
            <>
              <CardHeader>
                <CardTitle>Du wurdest eingeladen!</CardTitle>
                <CardDescription>
                  Tritt deinem Team in unter einer Minute bei – ganz ohne
                  kompliziertes Passwort.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading || sessionLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Prüfe Einladung…</span>
                  </div>
                ) : error && !preview ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200 flex items-start gap-2.5">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/register">Anderen Code eingeben</Link>
                    </Button>
                  </div>
                ) : preview ? (
                  <>
                    {/* Team- & Rollenkarte */}
                    <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">
                          {INVITE_TYPE_LABELS[preview.type]}
                        </Badge>
                        <Badge variant="outline">
                          {MEMBER_ROLE_LABELS[preview.role]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {preview.clubLogoUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={preview.clubLogoUrl}
                            alt={`Vereinslogo ${preview.clubName}`}
                            className="h-10 w-10 shrink-0 rounded-full object-contain bg-white p-0.5 border border-border"
                          />
                        )}
                        <div>
                          <p className="text-lg font-bold text-foreground leading-tight">
                            {preview.teamName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {preview.clubName} · Saison {preview.seasonName}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {MEMBER_ROLE_DESCRIPTIONS[preview.role]}
                      </p>
                      {preview.targetMemberFirstName && (
                        <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-foreground">
                          {preview.type === "GUARDIAN_LINK"
                            ? "Eltern-Zugang für: "
                            : "Dein vorbereitetes Profil: "}
                          <span className="font-bold text-primary">
                            {preview.targetMemberFirstName}
                          </span>
                        </div>
                      )}
                    </div>

                    {!preview.isValid && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
                        {preview.invalidReason ||
                          "Diese Einladung ist nicht mehr gültig."}
                      </div>
                    )}

                    {error && (
                      <div
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                      >
                        {error}
                      </div>
                    )}

                    {info && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                        {info}
                      </div>
                    )}

                    {preview.isValid &&
                      (session?.user ? (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Angemeldet als{" "}
                            <strong className="text-foreground">
                              {session.user.email}
                            </strong>
                          </p>

                          {preview.type === "GUARDIAN_LINK" && (
                            <div className="space-y-1.5">
                              <Label htmlFor="inv-rel">
                                Deine Beziehung zu{" "}
                                {preview.targetMemberFirstName ?? "deinem Kind"}
                              </Label>
                              <SelectNative
                                id="inv-rel"
                                value={relationship}
                                onChange={(e) =>
                                  setRelationship(e.target.value)
                                }
                              >
                                {RELATIONSHIPS.map((rel) => (
                                  <option key={rel} value={rel}>
                                    {rel}
                                  </option>
                                ))}
                              </SelectNative>
                            </div>
                          )}

                          <Button
                            type="button"
                            className="w-full h-11"
                            onClick={() => void executeClaim()}
                            disabled={claiming}
                          >
                            {claiming ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                            {preview.type === "PROFILE_CLAIM"
                              ? "Profil jetzt übernehmen"
                              : preview.type === "GUARDIAN_LINK"
                                ? "Eltern-Verknüpfung bestätigen"
                                : "Mannschaft beitreten"}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Passkey-Shortcut für bestehende Nutzer */}
                          {passkeyAvailable && !otpSent && (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={handlePasskeyAuthAndClaim}
                              disabled={authBusy || claiming}
                            >
                              <Fingerprint className="h-4 w-4 text-primary" />
                              Bereits Konto? Mit Passkey beitreten
                            </Button>
                          )}

                          {/* Modus-Wahl: Login-PIN (Standard!) vs. Passwort */}
                          <div className="grid grid-cols-2 rounded-xl bg-muted p-1 text-xs font-semibold">
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode("otp");
                                setError(null);
                                setInfo(null);
                              }}
                              className={cn(
                                "flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all cursor-pointer",
                                authMode === "otp"
                                  ? "bg-card text-foreground shadow-xs"
                                  : "text-muted-foreground"
                              )}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Login-PIN (einfach)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAuthMode("password-register");
                                setOtpSent(false);
                                setError(null);
                                setInfo(null);
                              }}
                              className={cn(
                                "flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all cursor-pointer",
                                authMode !== "otp"
                                  ? "bg-card text-foreground shadow-xs"
                                  : "text-muted-foreground"
                              )}
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              Mit Passwort
                            </button>
                          </div>

                          {authMode === "otp" ? (
                            !otpSent ? (
                              <form
                                onSubmit={handleSendOtp}
                                className="space-y-3"
                              >
                                <p className="text-xs text-muted-foreground">
                                  Gib einfach deine E-Mail ein – wir schicken
                                  dir eine{" "}
                                  <strong className="text-foreground">
                                    6-stellige Login-PIN
                                  </strong>
                                  . Du musst kein Passwort erfinden!
                                </p>

                                {preview.type !== "PROFILE_CLAIM" && (
                                  <div className="grid grid-cols-2 gap-2.5">
                                    <div className="space-y-1">
                                      <Label htmlFor="inv-first">Vorname</Label>
                                      <Input
                                        id="inv-first"
                                        placeholder="Vorname"
                                        value={firstName}
                                        onChange={(e) =>
                                          setFirstName(e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor="inv-last">Nachname</Label>
                                      <Input
                                        id="inv-last"
                                        placeholder="Nachname"
                                        value={lastName}
                                        onChange={(e) =>
                                          setLastName(e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                )}

                                {preview.type === "GUARDIAN_LINK" && (
                                  <div className="space-y-1">
                                    <Label htmlFor="inv-rel-guest">
                                      Beziehung zu{" "}
                                      {preview.targetMemberFirstName ??
                                        "deinem Kind"}
                                    </Label>
                                    <SelectNative
                                      id="inv-rel-guest"
                                      value={relationship}
                                      onChange={(e) =>
                                        setRelationship(e.target.value)
                                      }
                                    >
                                      {RELATIONSHIPS.map((rel) => (
                                        <option key={rel} value={rel}>
                                          {rel}
                                        </option>
                                      ))}
                                    </SelectNative>
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <Label htmlFor="inv-email">
                                    Deine E-Mail-Adresse *
                                  </Label>
                                  <Input
                                    id="inv-email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    placeholder="name@beispiel.de"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                  />
                                </div>

                                <Button
                                  type="submit"
                                  className="w-full h-11"
                                  disabled={authBusy}
                                >
                                  {authBusy && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                  6-stellige Login-PIN erhalten
                                </Button>
                              </form>
                            ) : (
                              <div className="space-y-4">
                                <div className="space-y-2 text-center">
                                  <p className="text-sm font-medium text-foreground">
                                    6-stellige PIN aus deiner E-Mail eingeben
                                  </p>
                                  <OtpPinInput
                                    value={otp}
                                    onChange={setOtp}
                                    onComplete={(code) =>
                                      void handleVerifyOtpAndClaim(code)
                                    }
                                    disabled={authBusy || claiming}
                                    idPrefix="invite-pin"
                                  />
                                </div>

                                <Button
                                  type="button"
                                  className="w-full h-11"
                                  disabled={
                                    authBusy || claiming || otp.length !== 6
                                  }
                                  onClick={() =>
                                    void handleVerifyOtpAndClaim(otp)
                                  }
                                >
                                  {(authBusy || claiming) && (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  )}
                                  PIN bestätigen &amp; beitreten
                                </Button>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOtpSent(false);
                                      setOtp("");
                                      setError(null);
                                      setInfo(null);
                                    }}
                                    className="underline hover:text-foreground cursor-pointer"
                                  >
                                    E-Mail ändern
                                  </button>
                                  <button
                                    type="button"
                                    disabled={resendCooldown > 0 || authBusy}
                                    onClick={() => void handleSendOtp()}
                                    className="font-medium text-primary hover:underline disabled:opacity-50 cursor-pointer"
                                  >
                                    {resendCooldown > 0
                                      ? `Erneut senden (${resendCooldown}s)`
                                      : "Code erneut senden"}
                                  </button>
                                </div>
                              </div>
                            )
                          ) : (
                            <form
                              onSubmit={handlePasswordAuthAndClaim}
                              className="space-y-3"
                            >
                              <div className="flex justify-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAuthMode("password-register")
                                  }
                                  className={cn(
                                    "font-semibold cursor-pointer",
                                    authMode === "password-register"
                                      ? "text-primary underline"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  Neues Konto
                                </button>
                                <span className="text-muted-foreground">·</span>
                                <button
                                  type="button"
                                  onClick={() => setAuthMode("password-login")}
                                  className={cn(
                                    "font-semibold cursor-pointer",
                                    authMode === "password-login"
                                      ? "text-primary underline"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  Bestehendes Konto
                                </button>
                              </div>

                              {authMode === "password-register" &&
                                preview.type !== "PROFILE_CLAIM" && (
                                  <div className="grid grid-cols-2 gap-2.5">
                                    <div className="space-y-1">
                                      <Label htmlFor="inv-pw-first">
                                        Vorname
                                      </Label>
                                      <Input
                                        id="inv-pw-first"
                                        required
                                        value={firstName}
                                        onChange={(e) =>
                                          setFirstName(e.target.value)
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label htmlFor="inv-pw-last">
                                        Nachname
                                      </Label>
                                      <Input
                                        id="inv-pw-last"
                                        required
                                        value={lastName}
                                        onChange={(e) =>
                                          setLastName(e.target.value)
                                        }
                                      />
                                    </div>
                                  </div>
                                )}

                              {preview.type === "GUARDIAN_LINK" && (
                                <div className="space-y-1">
                                  <Label htmlFor="inv-rel-pw">
                                    Beziehung zu{" "}
                                    {preview.targetMemberFirstName ??
                                      "deinem Kind"}
                                  </Label>
                                  <SelectNative
                                    id="inv-rel-pw"
                                    value={relationship}
                                    onChange={(e) =>
                                      setRelationship(e.target.value)
                                    }
                                  >
                                    {RELATIONSHIPS.map((rel) => (
                                      <option key={rel} value={rel}>
                                        {rel}
                                      </option>
                                    ))}
                                  </SelectNative>
                                </div>
                              )}

                              <div className="space-y-1">
                                <Label htmlFor="inv-pw-email">
                                  E-Mail-Adresse
                                </Label>
                                <Input
                                  id="inv-pw-email"
                                  type="email"
                                  required
                                  value={email}
                                  onChange={(e) => setEmail(e.target.value)}
                                />
                              </div>

                              <div className="space-y-1">
                                <Label htmlFor="inv-pw-pass">
                                  Passwort{" "}
                                  {authMode === "password-register" &&
                                    "(mind. 8 Zeichen)"}
                                </Label>
                                <Input
                                  id="inv-pw-pass"
                                  type="password"
                                  required
                                  minLength={
                                    authMode === "password-register" ? 8 : 1
                                  }
                                  value={password}
                                  onChange={(e) => setPassword(e.target.value)}
                                />
                              </div>

                              <Button
                                type="submit"
                                className="w-full h-11"
                                disabled={authBusy || claiming}
                              >
                                {(authBusy || claiming) && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                {authMode === "password-register"
                                  ? "Konto erstellen & beitreten"
                                  : "Anmelden & beitreten"}
                              </Button>
                            </form>
                          )}
                        </div>
                      ))}
                  </>
                ) : null}
              </CardContent>
            </>
          )}

          {step === "profile" && claimed && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  Du bist jetzt dabei!
                </div>
                <CardTitle>Profil kurz vervollständigen</CardTitle>
                <CardDescription>
                  Dauert nur 30 Sekunden – alle Angaben sind optional und
                  jederzeit änderbar.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuickProfileForm
                  initial={{
                    teamId: claimed.teamId,
                    role: claimed.role,
                    firstName:
                      claimed.memberProfile?.firstName ?? initialFirst,
                    lastName:
                      claimed.memberProfile?.lastName ?? initialLast,
                    phone: claimed.memberProfile?.phone ?? null,
                    emergencyContact:
                      claimed.memberProfile?.emergencyContact ?? null,
                    primaryPosition:
                      claimed.memberProfile?.primaryPosition ?? null,
                    throwingHand: claimed.memberProfile?.throwingHand ?? null,
                    childMemberId: claimed.childMemberId ?? null,
                    childFirstName: preview?.targetMemberFirstName ?? null,
                    childEmergencyContact:
                      claimed.childEmergencyContact ?? null,
                  }}
                  submitLabel="Speichern & weiter"
                  skipLabel="Erstmal überspringen"
                  onSaved={() => void handleAfterProfile()}
                  onSkip={() => void handleAfterProfile()}
                />
              </CardContent>
            </>
          )}

          {step === "passkey" && (
            <>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary text-xs font-semibold">
                  <Sparkles className="h-4 w-4" />
                  Fast geschafft
                </div>
                <CardTitle>Schneller anmelden</CardTitle>
                <CardDescription>
                  Optional: Richte Passkey auf diesem Gerät ein, damit du nie
                  wieder ein Passwort oder einen Code brauchst.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PasskeySetupCard
                  compact
                  onSuccess={() => {
                    setTimeout(() => finishToDashboard(), 700);
                  }}
                  onSkip={() => void handleSkipPasskey()}
                  skipLabel="Direkt zur App"
                />
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function InviteClaimPage() {
  return (
    <Suspense fallback={null}>
      <InviteClaimContent />
    </Suspense>
  );
}
