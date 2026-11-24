"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Ticket } from "lucide-react";
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
import { SelectNative } from "@/components/ui/select-native";

export default function OnboardingPage() {
  const router = useRouter();

  const [clubName, setClubName] = useState("");
  const [city, setCity] = useState("");
  const [seasonName, setSeasonName] = useState("2026/27");
  const [teamName, setTeamName] = useState("Herren 1");
  const [category, setCategory] = useState("Aktive");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "MIXED">("MALE");
  const [leagueName, setLeagueName] = useState("");
  const [creatorFirstName, setCreatorFirstName] = useState("");
  const [creatorLastName, setCreatorLastName] = useState("");
  const [creatorRole, setCreatorRole] = useState<"COACH" | "CLUB_ADMIN">(
    "CLUB_ADMIN"
  );
  const [inviteCode, setInviteCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreateClubTeam(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubName,
          city: city || undefined,
          seasonName,
          teamName,
          category,
          gender,
          leagueName: leagueName || undefined,
          creatorFirstName,
          creatorLastName,
          creatorRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message || "Onboarding fehlgeschlagen.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Netzwerkfehler beim Anlegen.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleJoinInvite(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = inviteCode.trim().split("/").pop();
    if (!cleaned) return;
    router.push(`/invite/${encodeURIComponent(cleaned)}`);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between pb-6">
        <Link href="/">
          <BrandLogo size="md" />
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Willkommen bei Anwurf
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lege in einem Schritt deinen Verein & deine erste Mannschaft an –
            oder tritt über einen Einladungslink bei.
          </p>
        </div>

        {/* Option 1: Einladungscode einlösen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ticket className="h-4 w-4 text-primary" />
              Du hast bereits einen Einladungslink oder Code?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinInvite} className="flex gap-2">
              <Input
                placeholder="Einladungscode oder vollständigen Link einfügen"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
              <Button type="submit" variant="secondary">
                Weiter
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Option 2: Verein & erste Mannschaft anlegen */}
        <Card>
          <CardHeader>
            <CardTitle>Verein & erste Mannschaft starten</CardTitle>
            <CardDescription>
              Auch für den Einzelteam-Start: Ein schlanker Verein wird im
              Hintergrund automatisch angelegt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClubTeam} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {error}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-club">Vereinsname *</Label>
                  <Input
                    id="ob-club"
                    required
                    placeholder="z. B. SG Handball Nord"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-city">Ort / Stadt</Label>
                  <Input
                    id="ob-city"
                    placeholder="z. B. Musterstadt"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-team">Mannschaft *</Label>
                  <Input
                    id="ob-team"
                    required
                    placeholder="z. B. Herren 1"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-season">Saison *</Label>
                  <Input
                    id="ob-season"
                    required
                    value={seasonName}
                    onChange={(e) => setSeasonName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-league">Liga / Staffel</Label>
                  <Input
                    id="ob-league"
                    placeholder="z. B. Landesliga"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-category">Bereich</Label>
                  <SelectNative
                    id="ob-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Aktive">Aktive</option>
                    <option value="Jugend">Jugend</option>
                    <option value="Senioren">Senioren</option>
                  </SelectNative>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-gender">Geschlecht</Label>
                  <SelectNative
                    id="ob-gender"
                    value={gender}
                    onChange={(e) =>
                      setGender(e.target.value as "MALE" | "FEMALE" | "MIXED")
                    }
                  >
                    <option value="MALE">Männlich / Herren</option>
                    <option value="FEMALE">Weiblich / Damen</option>
                    <option value="MIXED">Gemischt</option>
                  </SelectNative>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 pt-2 border-t border-border">
                <div className="space-y-1.5">
                  <Label htmlFor="ob-first">Dein Vorname *</Label>
                  <Input
                    id="ob-first"
                    required
                    value={creatorFirstName}
                    onChange={(e) => setCreatorFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-last">Dein Nachname *</Label>
                  <Input
                    id="ob-last"
                    required
                    value={creatorLastName}
                    onChange={(e) => setCreatorLastName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ob-role">Deine Rolle</Label>
                  <SelectNative
                    id="ob-role"
                    value={creatorRole}
                    onChange={(e) =>
                      setCreatorRole(e.target.value as "COACH" | "CLUB_ADMIN")
                    }
                  >
                    <option value="CLUB_ADMIN">Vereins-Admin & Trainer</option>
                    <option value="COACH">Trainer:in</option>
                  </SelectNative>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Verein & Mannschaft anlegen
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
