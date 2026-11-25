"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { BrandLogo } from "@/components/branding/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  INVITE_TYPE_LABELS,
  MEMBER_ROLE_LABELS,
} from "@/domain/schemas/handball";
import type { InvitePreviewDTO } from "@/domain/schemas/invite";
import { useSession } from "@/infrastructure/auth/auth-client";

function InviteClaimContent() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  const [preview, setPreview] = useState<InvitePreviewDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(false);

  const token = params.token;

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
        setPreview(data.invite);
      } catch {
        setError("Einladung konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }
    if (token) loadPreview();
  }, [token]);

  async function handleClaim() {
    setClaiming(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/invites/${encodeURIComponent(token)}/claim`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Einladung konnte nicht eingelöst werden.");
        return;
      }

      if (data.teamId && typeof window !== "undefined") {
        localStorage.setItem("throwoff_active_team_id", data.teamId);
      }
      setSuccess(true);
      setTimeout(() => {
        router.push("/team");
        router.refresh();
      }, 900);
    } catch {
      setError("Netzwerkfehler beim Einlösen.");
    } finally {
      setClaiming(false);
    }
  }

  const nextParam = encodeURIComponent(`/invite/${token}`);

  return (
    <div className="min-h-screen flex flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-md items-center justify-between pb-6">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Team-Einladung</CardTitle>
            <CardDescription>
              Übernehme dein Kader-Profil oder tritt der Mannschaft bei.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || sessionLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Prüfe Einladungslink…</span>
              </div>
            ) : error && !preview ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200 flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : preview ? (
              <>
                <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">
                      {INVITE_TYPE_LABELS[preview.type]}
                    </Badge>
                    <Badge variant="outline">
                      {MEMBER_ROLE_LABELS[preview.role]}
                    </Badge>
                  </div>
                  <p className="text-lg font-bold text-foreground">
                    {preview.teamName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {preview.clubName} · Saison {preview.seasonName}
                  </p>
                  {preview.targetMemberFirstName && (
                    <p className="text-sm font-medium text-foreground pt-1">
                      Kader-Profil:{" "}
                      <span className="text-primary">
                        {preview.targetMemberFirstName}
                      </span>
                    </p>
                  )}
                </div>

                {!preview.isValid && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
                    {preview.invalidReason || "Diese Einladung ist nicht mehr gültig."}
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                  >
                    {error}
                  </div>
                )}

                {success ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200 flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <span>
                      Erfolgreich verknüpft! Du wirst zum Kader weitergeleitet…
                    </span>
                  </div>
                ) : preview.isValid ? (
                  session?.user ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Angemeldet als{" "}
                        <strong className="text-foreground">
                          {session.user.email}
                        </strong>
                      </p>
                      <Button
                        type="button"
                        className="w-full"
                        onClick={handleClaim}
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
                    <div className="space-y-2.5">
                      <p className="text-sm text-muted-foreground">
                        Melde dich an oder erstelle ein kostenloses Konto, um
                        diese Einladung anzunehmen.
                      </p>
                      <Button className="w-full" asChild>
                        <Link href={`/register?next=${nextParam}`}>
                          Neues Konto erstellen & annehmen
                        </Link>
                      </Button>
                      <Button variant="outline" className="w-full" asChild>
                        <Link href={`/login?next=${nextParam}`}>
                          Mit bestehendem Konto anmelden
                        </Link>
                      </Button>
                    </div>
                  )
                ) : null}
              </>
            ) : null}
          </CardContent>
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
