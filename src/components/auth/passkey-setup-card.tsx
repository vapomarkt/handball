"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Fingerprint, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/infrastructure/auth/auth-client";

export function detectFriendlyDeviceName(): string {
  if (typeof navigator === "undefined") return "Mein Gerät";
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android-Handy";
  if (/Mac OS X|Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows-PC";
  if (/Linux/i.test(ua)) return "Linux-PC";
  return "Mein Gerät";
}

export async function isPasskeySupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.PublicKeyCredential) return false;
  try {
    if (
      typeof window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable === "function"
    ) {
      const available =
        await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    }
    return true;
  } catch {
    return true;
  }
}

interface PasskeySetupCardProps {
  onSuccess?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
  compact?: boolean;
}

export function PasskeySetupCard({
  onSuccess,
  onSkip,
  skipLabel = "Erstmal später",
  compact = false,
}: PasskeySetupCardProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [registering, setRegistering] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    isPasskeySupported().then((ok) => {
      if (active) setSupported(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleRegister() {
    setError(null);
    setRegistering(true);
    try {
      const deviceName = detectFriendlyDeviceName();
      const result = await authClient.passkey.addPasskey({
        name: deviceName,
      });

      if (result?.error) {
        setError(
          result.error.message ||
            "Passkey konnte nicht eingerichtet werden. Du kannst es jederzeit später im Profil nachholen."
        );
        return;
      }

      setDone(true);
      onSuccess?.();
    } catch {
      setError(
        "Passkey-Einrichtung wurde abgebrochen. Kein Problem – du kannst dich weiter per Login-PIN oder Passwort anmelden."
      );
    } finally {
      setRegistering(false);
    }
  }

  if (supported === false) {
    return null;
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Passkey erfolgreich aktiviert!</p>
          <p className="text-xs opacity-90">
            Beim nächsten Mal meldest du dich auf diesem Gerät mit einem Tipp per
            Fingerabdruck, Face ID oder Geräte-PIN an.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3"
          : "rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs"
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <Fingerprint className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">
            Beim nächsten Mal mit einem Tipp anmelden?
          </h3>
          <p className="text-sm text-muted-foreground">
            Nutze Fingerabdruck, Face ID oder deine Geräte-PIN – kein Passwort
            merken, kein Code abtippen.
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          type="button"
          onClick={handleRegister}
          disabled={registering || supported === null}
          className="flex-1 sm:flex-none"
        >
          {registering ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          Jetzt einrichten
        </Button>

        {onSkip && (
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={registering}
          >
            {skipLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
