import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck, Users, Waypoints } from "lucide-react";
import { BrandLogo } from "@/components/branding/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BRANDING } from "@/config/branding";
import { getOptionalViewerContext } from "@/infrastructure/auth/session";

async function AuthenticatedRedirect() {
  const viewer = await getOptionalViewerContext();
  if (viewer) {
    if (
      viewer.memberships.length > 0 ||
      viewer.linkedChildMemberIds.length > 0
    ) {
      redirect("/dashboard");
    }
    redirect("/onboarding");
  }
  return null;
}

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Suspense fallback={null}>
        <AuthenticatedRedirect />
      </Suspense>
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <BrandLogo size="md" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Anmelden</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Kostenlos starten</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl space-y-6">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              Für Handball-Teams, Trainer, Eltern & Vereine
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {BRANDING.appName} bringt deinen Handballverein auf ein Spielfeld.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              Schluss mit Zettelwirtschaft zwischen Messenger, Excel und
              Taktik-Apps. Organisiere Kader, Handball-Positionen,
              Eltern-Kind-Profile und Mannschaften in einer schnellen,
              DSGVO-sicheren Plattform – optimiert für die Sporthalle.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button size="lg" asChild>
                <Link href="/register">
                  Team oder Verein anlegen
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Bereits registriert? Anmelden</Link>
              </Button>
            </div>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-5 space-y-2.5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold">
                  Handball-Kader & Positionen
                </h2>
                <p className="text-sm text-muted-foreground">
                  TW, LA, RL, RM, RR, RA, KM, Wurfhand, Trikotnummern und
                  entkoppelte Profile mit 1-Klick-Übernahme per Einladungslink.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-2.5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold">
                  Eltern-Kind-Logik & DSGVO
                </h2>
                <p className="text-sm text-muted-foreground">
                  Eltern verwalten Jugendspieler ohne eigenen Kinder-Login.
                  Notfallkontakte, Passnummern und Verletzungsnotizen bleiben
                  serverseitig geschützt.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 space-y-2.5">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Waypoints className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold">
                  Multi-Team & Vereinsstruktur
                </h2>
                <p className="text-sm text-muted-foreground">
                  Starte schlank mit einer Mannschaft oder verwalte den ganzen
                  Verein mit Herren, Damen und Jugendteams unter einem Dach.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
