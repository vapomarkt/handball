"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Fingerprint,
  KeyRound,
  Loader2,
  Mail,
  Ticket,
} from "lucide-react";
import { OtpPinInput } from "@/components/auth/otp-pin-input";
import { isPasskeySupported } from "@/components/auth/passkey-setup-card";
import { SocialAuthPlaceholder } from "@/components/auth/social-auth-placeholder";
import { BrandLogo } from "@/components/branding/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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
import { normalizeInviteLookup } from "@/domain/services/invite-service";
import { authClient, signIn } from "@/infrastructure/auth/auth-client";
import { cn } from "@/lib/utils";

const DEMO_ACCOUNTS = [
  {
    label: "Trainer · Hans-Peter Lehmann",
    email: "trainer@tus-jahn-hollenstedt.de",
  },
  { label: "Admin · Kay Kröpfl", email: "admin@tus-jahn-hollenstedt.de" },
  {
    label: "Betreuer · Petra Brandt",
    email: "betreuer@tus-jahn-hollenstedt.de",
  },
  {
    label: "Spieler · Jarle Hofmann (#9)",
    email: "spieler@tus-jahn-hollenstedt.de",
  },
  {
    label: "Eltern · Familie Hofmann",
    email: "eltern@tus-jahn-hollenstedt.de",
  },
];

type AuthMode = "password" | "otp" | "reset";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard";
  const initialMode: AuthMode =
    searchParams.get("mode") === "otp" ? "otp" : "password";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [newPassword, setNewPassword] = useState("");

  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const [showCodeBox, setShowCodeBox] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const finishLogin = useCallback(() => {
    router.push(nextUrl);
    router.refresh();
  }, [router, nextUrl]);

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      const result = await signIn.email({
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.error) {
        setError(
          result.error.message ||
            "Anmeldung fehlgeschlagen. Bitte prüfe E-Mail und Passwort."
        );
        return;
      }

      finishLogin();
    } catch {
      setError("Netzwerkfehler bei der Anmeldung.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Bitte gib zuerst deine gültige E-Mail-Adresse ein.");
      return;
    }

    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: mode === "reset" ? "forget-password" : "sign-in",
      });

      if (result.error) {
        setError(
          result.error.message ||
            "Login-PIN konnte nicht gesendet werden. Bitte prüfe deine E-Mail."
        );
        return;
      }

      setOtp("");
      setOtpSent(true);
      setResendCooldown(45);
      setInfo(
        `Wir haben eine 6-stellige PIN an ${normalizedEmail} geschickt. Schau kurz in dein Postfach (auch Spam).`
      );
    } catch {
      setError("Netzwerkfehler beim Senden der Login-PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  const verifyOtpSignIn = useCallback(
    async (codeToVerify: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || codeToVerify.length !== 6) return;

      setError(null);
      setSubmitting(true);
      try {
        const result = await authClient.signIn.emailOtp({
          email: normalizedEmail,
          otp: codeToVerify,
        });

        if (result.error) {
          setError(
            result.error.message ||
              "Die eingegebene PIN stimmt nicht oder ist abgelaufen."
          );
          return;
        }

        finishLogin();
      } catch {
        setError("Netzwerkfehler bei der PIN-Prüfung.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, finishLogin]
  );

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Bitte gib den vollständigen 6-stelligen Code aus deiner E-Mail ein.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Das neue Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result = await authClient.emailOtp.resetPassword({
        email: normalizedEmail,
        otp,
        password: newPassword,
      });

      if (result.error) {
        setError(
          result.error.message ||
            "Code ungültig oder abgelaufen. Bitte fordere einen neuen Code an."
        );
        return;
      }

      setMode("password");
      setPassword(newPassword);
      setOtp("");
      setOtpSent(false);
      setNewPassword("");
      setInfo("Passwort wurde aktualisiert! Du kannst dich jetzt anmelden.");
    } catch {
      setError("Netzwerkfehler beim Zurücksetzen.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasskeySignIn() {
    setError(null);
    setInfo(null);
    setPasskeyLoading(true);
    try {
      const result = await authClient.signIn.passkey();
      if (result?.error) {
        setError(
          result.error.message ||
            "Passkey-Anmeldung nicht erfolgreich. Nutze einfach deine Login-PIN oder dein Passwort."
        );
        return;
      }
      finishLogin();
    } catch {
      setError(
        "Passkey-Abfrage abgebrochen. Du kannst dich alternativ per Login-PIN oder Passwort anmelden."
      );
    } finally {
      setPasskeyLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setMode("password");
    setEmail(demoEmail);
    setPassword("ThrowOff2026!");
    setError(null);
    setInfo(null);
  }

  function handleJoinInvite(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = normalizeInviteLookup(inviteCode);
    if (!cleaned) return;
    router.push(`/invite/${encodeURIComponent(cleaned)}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="space-y-2">
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>
              Wähle einfach den Weg, der für dich am bequemsten ist – per
              Fingerabdruck/Passkey, 6-stelliger Login-PIN oder Passwort.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* 1-Klick Passkey-Anmeldung (falls Gerät unterstützt) */}
            {passkeyAvailable && mode !== "reset" && (
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 font-semibold border-primary/35 hover:bg-primary/5"
                  onClick={handlePasskeySignIn}
                  disabled={passkeyLoading || submitting}
                >
                  {passkeyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Fingerprint className="h-5 w-5 text-primary" />
                  )}
                  Mit Passkey / Fingerabdruck anmelden
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">
                      oder mit E-Mail
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Modus-Umschalter: Passwort vs. 6-stellige Login-PIN */}
            {mode !== "reset" && (
              <div
                className="grid grid-cols-2 rounded-xl bg-muted p-1 text-xs font-semibold"
                role="tablist"
                aria-label="Anmeldeart wählen"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "password"}
                  onClick={() => {
                    setMode("password");
                    setError(null);
                    setInfo(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all cursor-pointer",
                    mode === "password"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Passwort
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "otp"}
                  onClick={() => {
                    setMode("otp");
                    setOtpSent(false);
                    setOtp("");
                    setError(null);
                    setInfo(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all cursor-pointer",
                    mode === "otp"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Login-PIN (ohne Passwort)
                </button>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
              >
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                {info}
              </div>
            )}

            {/* MODUS 1: E-Mail & Passwort */}
            {mode === "password" && (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">E-Mail-Adresse</Label>
                  <Input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="email webauthn"
                    required
                    placeholder="name@verein.de"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Passwort</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("reset");
                        setOtpSent(false);
                        setOtp("");
                        setError(null);
                        setInfo(null);
                      }}
                      className="text-xs font-medium text-primary hover:underline cursor-pointer"
                    >
                      Passwort vergessen?
                    </button>
                  </div>
                  <Input
                    id="login-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Anmelden
                </Button>
              </form>
            )}

            {/* MODUS 2: 6-stellige Login-PIN per E-Mail */}
            {mode === "otp" && (
              <div className="space-y-4">
                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Kein Passwort im Kopf? Kein Problem – wir schicken dir eine{" "}
                      <strong className="text-foreground">
                        6-stellige Einmal-PIN
                      </strong>{" "}
                      an deine E-Mail-Adresse.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-otp-email">E-Mail-Adresse</Label>
                      <Input
                        id="login-otp-email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="name@verein.de"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitting}
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      6-stellige Login-PIN senden
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Gib die 6-stellige PIN ein
                      </p>
                      <OtpPinInput
                        value={otp}
                        onChange={setOtp}
                        onComplete={(code) => void verifyOtpSignIn(code)}
                        disabled={submitting}
                      />
                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      disabled={submitting || otp.length !== 6}
                      onClick={() => void verifyOtpSignIn(otp)}
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      PIN prüfen &amp; anmelden
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
                        className="hover:text-foreground underline cursor-pointer"
                      >
                        Andere E-Mail
                      </button>
                      <button
                        type="button"
                        disabled={resendCooldown > 0 || submitting}
                        onClick={() => void handleSendOtp()}
                        className="font-medium text-primary hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        {resendCooldown > 0
                          ? `Erneut senden (${resendCooldown}s)`
                          : "Code erneut senden"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MODUS 3: Passwort per E-Mail-PIN zurücksetzen */}
            {mode === "reset" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => {
                    setMode("password");
                    setOtpSent(false);
                    setError(null);
                    setInfo(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Zurück zur Anmeldung
                </button>

                {!otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <p className="text-sm font-semibold text-foreground">
                      Passwort zurücksetzen
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Wir schicken dir einen 6-stelligen Code per E-Mail, mit
                      dem du direkt ein neues Passwort setzen kannst.
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email">E-Mail-Adresse</Label>
                      <Input
                        id="reset-email"
                        type="email"
                        required
                        placeholder="name@verein.de"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitting}
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Code per E-Mail senden
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-medium text-foreground">
                        6-stelliger Bestätigungscode
                      </p>
                      <OtpPinInput
                        value={otp}
                        onChange={setOtp}
                        disabled={submitting}
                        idPrefix="reset-pin"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-new-password">
                        Neues Passwort (mind. 8 Zeichen)
                      </Label>
                      <Input
                        id="reset-new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={submitting || otp.length !== 6}
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Neues Passwort speichern
                    </Button>
                  </form>
                )}
              </div>
            )}

            <SocialAuthPlaceholder />

            <p className="pt-1 text-center text-sm text-muted-foreground">
              Noch kein Konto?{" "}
              <Link
                href={
                  nextUrl !== "/dashboard"
                    ? `/register?next=${encodeURIComponent(nextUrl)}`
                    : "/register"
                }
                className="font-semibold text-primary hover:underline"
              >
                Jetzt starten
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Direkt-Eingabe für 6-stelligen Einladungscode */}
        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCodeBox((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              Team-Code oder Einladungslink erhalten?
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {showCodeBox && (
            <CardContent className="border-t border-border pt-3.5 pb-4">
              <form onSubmit={handleJoinInvite} className="flex gap-2">
                <Input
                  placeholder="z. B. H7K-4P9 oder Link"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="font-mono uppercase"
                />
                <Button type="submit" variant="secondary">
                  Weiter
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Demo-Zugänge für TuS Jahn Hollenstedt */}
        <Card className="bg-muted/40">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/clubs/tus-jahn-hollenstedt.png"
                alt="Vereinslogo TuS Jahn Hollenstedt"
                className="h-8 w-8 shrink-0 rounded-full object-contain bg-white p-0.5 border border-border"
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Demo-Zugänge · TuS Jahn Hollenstedt
                </p>
                <p className="text-[11px] text-muted-foreground">
                  männliche D-Jugend · Regionsoberliga MJD Nord (Passwort:
                  ThrowOff2026!)
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc.email)}
                  className="rounded-lg border border-border bg-card px-2.5 py-2 text-left text-xs font-medium text-foreground hover:border-primary/60 hover:bg-muted transition-colors cursor-pointer"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
