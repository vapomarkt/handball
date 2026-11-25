"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
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
import { signIn } from "@/infrastructure/auth/auth-client";

const DEMO_ACCOUNTS = [
  { label: "Trainer (Herren 1 & mC)", email: "trainer@tsv-musterstadt.de" },
  { label: "Vereins-Admin", email: "admin@tsv-musterstadt.de" },
  { label: "Spieler (Herren 1)", email: "spieler@tsv-musterstadt.de" },
  { label: "Elternteil (mC-Jugend)", email: "eltern@tsv-musterstadt.de" },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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

      router.push(nextUrl);
      router.refresh();
    } catch {
      setError("Netzwerkfehler bei der Anmeldung.");
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("ThrowOff2026!");
    setError(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-md space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>
              Melde dich mit deinem Konto an, um auf dein Team zuzugreifen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="login-email">E-Mail-Adresse</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@verein.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password">Passwort</Label>
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

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Noch kein Konto?{" "}
              <Link
                href={
                  nextUrl !== "/dashboard"
                    ? `/register?next=${encodeURIComponent(nextUrl)}`
                    : "/register"
                }
                className="font-semibold text-primary hover:underline"
              >
                Jetzt registrieren
              </Link>
            </p>
          </CardContent>
        </Card>

        {/* Demo-Zugänge für TSV Musterstadt */}
        <Card className="bg-muted/40">
          <CardContent className="p-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Demo-Zugänge · TSV Musterstadt (Passwort: ThrowOff2026!)
            </p>
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
