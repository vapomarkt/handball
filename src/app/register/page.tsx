"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  KeyRound,
  Loader2,
  Mail,
  Ticket,
} from "lucide-react";
import { OtpPinInput } from "@/components/auth/otp-pin-input";
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
import { authClient, signUp } from "@/infrastructure/auth/auth-client";
import { cn } from "@/lib/utils";

type StartPath = "choose" | "create";
type SignupMethod = "otp" | "password";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawNext = searchParams.get("next");
  const nextUrl =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/onboarding";
  const hasExplicitNext = Boolean(
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
  );

  const [path, setPath] = useState<StartPath>(
    hasExplicitNext ? "create" : "choose"
  );
  const [inviteInput, setInviteInput] = useState("");
  const [method, setMethod] = useState<SignupMethod>("otp");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleOpenInvite(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = normalizeInviteLookup(inviteInput);
    if (!cleaned) {
      setError("Bitte gib deinen 6-stelligen Code oder Einladungslink ein.");
      return;
    }
    router.push(`/invite/${encodeURIComponent(cleaned)}`);
  }

  async function handlePasswordRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await signUp.email({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (result.error) {
        setError(result.error.message || "Registrierung fehlgeschlagen.");
        return;
      }

      router.push(nextUrl);
      router.refresh();
    } catch {
      setError("Netzwerkfehler bei der Registrierung.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setError("Bitte gib deinen Vor- und Nachnamen ein.");
      return;
    }
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }

    setError(null);
    setInfo(null);
    setSubmitting(true);
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
        `Wir haben deine 6-stellige Login-PIN an ${normalizedEmail} geschickt.`
      );
    } catch {
      setError("Netzwerkfehler beim Senden der Login-PIN.");
    } finally {
      setSubmitting(false);
    }
  }

  const verifyOtpAndContinue = useCallback(
    async (code: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || code.length !== 6) return;

      setError(null);
      setSubmitting(true);
      try {
        const result = await authClient.signIn.emailOtp({
          email: normalizedEmail,
          otp: code,
        });
        if (result.error) {
          setError(
            result.error.message ||
              "Die PIN ist ungültig oder abgelaufen. Bitte prüfe den Code."
          );
          return;
        }

        // Anzeigenamen auf dem neu erstellten Konto speichern
        if (name.trim()) {
          await authClient.updateUser({ name: name.trim() }).catch(() => {});
        }

        router.push(nextUrl);
        router.refresh();
      } catch {
        setError("Netzwerkfehler bei der PIN-Bestätigung.");
      } finally {
        setSubmitting(false);
      }
    },
    [email, name, nextUrl, router]
  );

  return (
    <div className="min-h-screen flex flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-md space-y-4">
        {path === "choose" ? (
          <>
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                Wie möchtest du starten?
              </h1>
              <p className="text-sm text-muted-foreground">
                Wähle einfach aus, was auf dich zutrifft – in unter einer Minute
                bist du startklar.
              </p>
            </div>

            {/* Weg 1: Eingeladen (Spieler, Eltern, Betreuer, Co-Trainer, Helfer) */}
            <Card className="border-primary/35">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Ich wurde eingeladen
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Für Spieler, Eltern, Betreuer, Co-Trainer &amp; Helfer
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                  >
                    {error}
                  </div>
                )}
                <form onSubmit={handleOpenInvite} className="space-y-2.5">
                  <Label htmlFor="reg-invite-code" className="text-xs">
                    6-stelliger Team-Code oder Einladungslink
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="reg-invite-code"
                      placeholder="z. B. H7K-4P9"
                      value={inviteInput}
                      onChange={(e) => {
                        setInviteInput(e.target.value);
                        setError(null);
                      }}
                      className="font-mono uppercase"
                    />
                    <Button type="submit">
                      Weiter
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Den Code oder Link bekommst du von deinem Trainer oder
                    Betreuer (z. B. per WhatsApp).
                  </p>
                </form>
              </CardContent>
            </Card>

            {/* Weg 2: Neuen Verein oder Mannschaft gründen (Admin / Trainer) */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Verein oder neue Mannschaft starten
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Für Vereins-Admins &amp; Trainer, die neu einrichten
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    setError(null);
                    setPath("create");
                  }}
                >
                  <span>Kostenloses Konto anlegen</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              Du hast schon ein Konto?{" "}
              <Link
                href="/login"
                className="font-semibold text-primary hover:underline"
              >
                Anmelden
              </Link>
            </p>
          </>
        ) : (
          <Card>
            <CardHeader className="space-y-2">
              {!hasExplicitNext && (
                <button
                  type="button"
                  onClick={() => {
                    setPath("choose");
                    setError(null);
                    setInfo(null);
                  }}
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Zurück zur Auswahl
                </button>
              )}
              <CardTitle>Konto erstellen</CardTitle>
              <CardDescription>
                Starte direkt ohne Passwort-Stress per 6-stelliger Login-PIN
                oder klassisch mit Passwort.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="grid grid-cols-2 rounded-xl bg-muted p-1 text-xs font-semibold"
                role="tablist"
                aria-label="Registrierungsart wählen"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === "otp"}
                  onClick={() => {
                    setMethod("otp");
                    setOtpSent(false);
                    setOtp("");
                    setError(null);
                    setInfo(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all cursor-pointer",
                    method === "otp"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Login-PIN (empfohlen)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === "password"}
                  onClick={() => {
                    setMethod("password");
                    setError(null);
                    setInfo(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-2 transition-all cursor-pointer",
                    method === "password"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Mit Passwort
                </button>
              </div>

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

              {method === "otp" ? (
                !otpSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="register-name">Vor- und Nachname</Label>
                      <Input
                        id="register-name"
                        name="name"
                        required
                        placeholder="Max Mustermann"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="register-email">E-Mail-Adresse</Label>
                      <Input
                        id="register-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="max@verein.de"
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
                      6-stellige Login-PIN anfordern
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 text-center">
                      <p className="text-sm font-medium text-foreground">
                        Gib die 6-stellige PIN aus deiner E-Mail ein
                      </p>
                      <OtpPinInput
                        value={otp}
                        onChange={setOtp}
                        onComplete={(code) => void verifyOtpAndContinue(code)}
                        disabled={submitting}
                        idPrefix="register-pin"
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full"
                      disabled={submitting || otp.length !== 6}
                      onClick={() => void verifyOtpAndContinue(otp)}
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Bestätigen &amp; starten
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
                        E-Mail korrigieren
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
                )
              ) : (
                <form onSubmit={handlePasswordRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="register-name">Vor- und Nachname</Label>
                    <Input
                      id="register-name"
                      name="name"
                      required
                      placeholder="Max Mustermann"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-email">E-Mail-Adresse</Label>
                    <Input
                      id="register-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="max@verein.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="register-password">
                      Passwort (mind. 8 Zeichen)
                    </Label>
                    <Input
                      id="register-password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      placeholder="Mindestens 8 Zeichen"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitting}
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Konto anlegen
                  </Button>
                </form>
              )}

              <SocialAuthPlaceholder />

              <p className="pt-1 text-center text-sm text-muted-foreground">
                Bereits ein Konto?{" "}
                <Link
                  href={
                    nextUrl !== "/onboarding"
                      ? `/login?next=${encodeURIComponent(nextUrl)}`
                      : "/login"
                  }
                  className="font-semibold text-primary hover:underline"
                >
                  Anmelden
                </Link>
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
