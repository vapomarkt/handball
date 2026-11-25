"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Shield,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import { BrandLogo } from "@/components/branding/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { LeagueSelector } from "@/components/leagues/league-selector";
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
  GERMAN_AGE_GROUPS,
  getAgeGroupPrefix,
  suggestTeamName,
} from "@/domain/data/german-leagues";
import { TeamGender } from "@/domain/schemas/handball";
import { LeagueAgeGroup, LeagueDTO } from "@/domain/schemas/league-catalog";
import { cn } from "@/lib/utils";

type WizardStep = 1 | 2 | 3;

const WIZARD_STEPS: Array<{
  step: WizardStep;
  label: string;
  shortLabel: string;
  icon: typeof Building2;
}> = [
  { step: 1, label: "Verein & Profil", shortLabel: "Verein", icon: Building2 },
  { step: 2, label: "Mannschaft", shortLabel: "Team", icon: Users },
  { step: 3, label: "Liga wählen", shortLabel: "Liga", icon: Trophy },
];

const GENDER_LABELS: Record<TeamGender, { adult: string; youth: string }> = {
  MALE: { adult: "Herren", youth: "Männlich" },
  FEMALE: { adult: "Damen", youth: "Weiblich" },
  MIXED: { adult: "Gemischt", youth: "Gemischt" },
};

function getQuickTeamNameSuggestions(
  ageGroup: LeagueAgeGroup,
  gender: TeamGender
): string[] {
  const base = suggestTeamName(ageGroup, gender);
  if (ageGroup === "ADULT") {
    const prefix = gender === "FEMALE" ? "Damen" : "Herren";
    return [`${prefix} 1`, `${prefix} 2`, `${prefix} 3`];
  }
  if (ageGroup === "YOUTH_F_MINI") {
    return ["Minis", "Minis 1", "F-Jugend"];
  }
  if (ageGroup === "SENIOR") {
    return [base, `${base} 2`, "Ü32-Team"];
  }
  const shortPrefix = base.replace("-Jugend", "");
  return [base, `${shortPrefix}1-Jugend`, `${shortPrefix}2-Jugend`];
}

export default function OnboardingPage() {
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>(1);
  const [showInviteBox, setShowInviteBox] = useState(false);

  // Schritt 1: Verein & Profil
  const [clubName, setClubName] = useState("");
  const [city, setCity] = useState("");
  const [seasonName, setSeasonName] = useState("2026/27");
  const [creatorFirstName, setCreatorFirstName] = useState("");
  const [creatorLastName, setCreatorLastName] = useState("");
  const [creatorRole, setCreatorRole] = useState<"COACH" | "CLUB_ADMIN">(
    "CLUB_ADMIN"
  );

  // Schritt 2: Mannschaft & Altersklasse
  const [ageGroup, setAgeGroup] = useState<LeagueAgeGroup>("ADULT");
  const [gender, setGender] = useState<TeamGender>("MALE");
  const [teamName, setTeamName] = useState("Herren 1");
  const [teamNameTouched, setTeamNameTouched] = useState(false);

  // Schritt 3: Liga aus Katalog (kein Freitext!)
  const [selectedLeague, setSelectedLeague] = useState<LeagueDTO | null>(null);

  // Einladungscode
  const [inviteCode, setInviteCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeAgeGroupMeta = useMemo(
    () => GERMAN_AGE_GROUPS.find((g) => g.value === ageGroup) ?? GERMAN_AGE_GROUPS[0],
    [ageGroup]
  );

  const adultAgeGroups = useMemo(
    () => GERMAN_AGE_GROUPS.filter((g) => g.section === "Erwachsene"),
    []
  );
  const youthAgeGroups = useMemo(
    () => GERMAN_AGE_GROUPS.filter((g) => g.section === "Jugend"),
    []
  );

  const quickSuggestions = useMemo(
    () => getQuickTeamNameSuggestions(ageGroup, gender),
    [ageGroup, gender]
  );

  function handleSelectAgeGroup(nextAgeGroup: LeagueAgeGroup) {
    const meta =
      GERMAN_AGE_GROUPS.find((g) => g.value === nextAgeGroup) ??
      GERMAN_AGE_GROUPS[0];
    const nextGender = meta.allowedGenders.includes(gender)
      ? gender
      : meta.defaultGender;

    setAgeGroup(nextAgeGroup);
    setGender(nextGender);
    setSelectedLeague(null);
    setError(null);

    if (!teamNameTouched) {
      setTeamName(suggestTeamName(nextAgeGroup, nextGender));
    }
  }

  function handleSelectGender(nextGender: TeamGender) {
    setGender(nextGender);
    setSelectedLeague(null);
    setError(null);

    if (!teamNameTouched) {
      setTeamName(suggestTeamName(ageGroup, nextGender));
    }
  }

  function validateStep1(): boolean {
    if (clubName.trim().length < 2) {
      setError("Bitte gib deinen Vereinsnamen ein (mind. 2 Zeichen).");
      return false;
    }
    if (seasonName.trim().length < 3) {
      setError("Bitte gib eine gültige Saison an (z. B. 2026/27).");
      return false;
    }
    if (!creatorFirstName.trim() || !creatorLastName.trim()) {
      setError("Bitte gib deinen Vor- und Nachnamen an.");
      return false;
    }
    setError(null);
    return true;
  }

  function validateStep2(): boolean {
    if (teamName.trim().length < 2) {
      setError("Bitte gib einen Mannschaftsnamen ein (mind. 2 Zeichen).");
      return false;
    }
    setError(null);
    return true;
  }

  function handleNextStep() {
    if (step === 1) {
      if (validateStep1()) setStep(2);
    } else if (step === 2) {
      if (validateStep2()) setStep(3);
    }
  }

  function handleStepJump(target: WizardStep) {
    if (target < step) {
      setError(null);
      setStep(target);
      return;
    }
    if (target === 2 && validateStep1()) {
      setStep(2);
    } else if (target === 3 && validateStep1() && validateStep2()) {
      setStep(3);
    }
  }

  async function handleCreateClubTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLeague) {
      setError("Bitte wähle eine Liga aus dem Katalog aus.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubName: clubName.trim(),
          city: city.trim() || undefined,
          seasonName: seasonName.trim(),
          teamName: teamName.trim(),
          category: activeAgeGroupMeta.defaultCategory,
          gender,
          leagueId: selectedLeague.id,
          creatorFirstName: creatorFirstName.trim(),
          creatorLastName: creatorLastName.trim(),
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

      <div className="mx-auto w-full max-w-2xl space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Willkommen bei ThrowOff
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Richte in 3 kurzen Schritten deinen Verein & deine erste Mannschaft
            ein.
          </p>
        </div>

        {/* Kompakte Einladungscode-Option (aufklappbar, lenkt nicht vom Wizard ab) */}
        <Card className="overflow-hidden">
          <button
            type="button"
            onClick={() => setShowInviteBox((prev) => !prev)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
            aria-expanded={showInviteBox}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Ticket className="h-4 w-4 text-primary" />
              Du hast bereits einen Einladungslink oder Code?
            </span>
            {showInviteBox ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showInviteBox && (
            <CardContent className="border-t border-border pt-4">
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
          )}
        </Card>

        {/* Visueller 3-Schritte-Fortschrittsbalken */}
        <nav aria-label="Registrierungsfortschritt" className="px-1">
          <ol className="grid grid-cols-3 gap-2 sm:gap-3">
            {WIZARD_STEPS.map((item) => {
              const Icon = item.icon;
              const isCompleted = step > item.step;
              const isCurrent = step === item.step;
              return (
                <li key={item.step}>
                  <button
                    type="button"
                    onClick={() => handleStepJump(item.step)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                      isCurrent
                        ? "border-primary bg-primary/10 text-foreground shadow-xs"
                        : isCompleted
                          ? "border-primary/30 bg-card text-foreground hover:bg-muted/50"
                          : "border-border bg-card/60 text-muted-foreground hover:bg-muted/40"
                    )}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                        isCompleted
                          ? "bg-primary text-primary-foreground"
                          : isCurrent
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Schritt {item.step}
                      </p>
                      <p className="truncate text-xs font-semibold sm:text-sm">
                        <span className="sm:hidden">{item.shortLabel}</span>
                        <span className="hidden sm:inline">{item.label}</span>
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Hauptkarte des Wizards */}
        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && "Verein & dein Profil"}
              {step === 2 && "Deine Mannschaft"}
              {step === 3 && "Liga & Spielklasse wählen"}
            </CardTitle>
            <CardDescription>
              {step === 1 &&
                "Auch für den Einzelteam-Start: Ein schlanker Verein wird automatisch im Hintergrund angelegt."}
              {step === 2 &&
                "Wähle Altersklasse und Geschlecht – wir filtern danach automatisch die passenden deutschen Handballligen."}
              {step === 3 &&
                "Wähle zuerst deinen Landesverband (oder die DHB-Bundesebene) und anschließend deine Spielklasse."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleCreateClubTeam} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
                >
                  {error}
                </div>
              )}

              {/* SCHRITT 1: Verein & Profil */}
              {step === 1 && (
                <div className="space-y-4">
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
                        placeholder="z. B. Hannover"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="sm:max-w-[200px] space-y-1.5">
                    <Label htmlFor="ob-season">Aktuelle Saison *</Label>
                    <Input
                      id="ob-season"
                      required
                      value={seasonName}
                      onChange={(e) => setSeasonName(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 pt-4 border-t border-border">
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-first">Dein Vorname *</Label>
                      <Input
                        id="ob-first"
                        required
                        placeholder="z. B. Max"
                        value={creatorFirstName}
                        onChange={(e) => setCreatorFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ob-last">Dein Nachname *</Label>
                      <Input
                        id="ob-last"
                        required
                        placeholder="z. B. Mustermann"
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
                          setCreatorRole(
                            e.target.value as "COACH" | "CLUB_ADMIN"
                          )
                        }
                      >
                        <option value="CLUB_ADMIN">
                          Vereins-Admin & Trainer
                        </option>
                        <option value="COACH">Trainer:in</option>
                      </SelectNative>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button type="button" onClick={handleNextStep}>
                      Weiter zur Mannschaft
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* SCHRITT 2: Altersklasse, Geschlecht & Mannschaftsname */}
              {step === 2 && (
                <div className="space-y-5">
                  {/* Altersklasse: Erwachsene */}
                  <div className="space-y-2">
                    <Label>Erwachsene</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {adultAgeGroups.map((item) => {
                        const active = ageGroup === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => handleSelectAgeGroup(item.value)}
                            className={cn(
                              "flex items-center justify-between rounded-xl border px-3.5 py-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {item.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {item.subtitle}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border"
                              )}
                            >
                              {active && <Check className="h-3 w-3" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Altersklasse: Jugend A bis Minis */}
                  <div className="space-y-2">
                    <Label>Jugend</Label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {youthAgeGroups.map((item) => {
                        const active = ageGroup === item.value;
                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => handleSelectAgeGroup(item.value)}
                            className={cn(
                              "flex flex-col rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active
                                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                                : "border-border bg-card hover:border-primary/50 hover:bg-muted/40"
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-sm font-semibold text-foreground">
                                {item.shortLabel}
                              </span>
                              {active && (
                                <Check className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                            <span className="mt-0.5 text-xs text-muted-foreground">
                              {item.subtitle}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Geschlecht */}
                  <div className="space-y-2">
                    <Label>Geschlecht</Label>
                    <div
                      className={cn(
                        "grid gap-2",
                        activeAgeGroupMeta.allowedGenders.length === 1
                          ? "grid-cols-1"
                          : activeAgeGroupMeta.allowedGenders.length === 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      )}
                    >
                      {activeAgeGroupMeta.allowedGenders.map((g) => {
                        const active = gender === g;
                        const label =
                          ageGroup === "ADULT"
                            ? GENDER_LABELS[g].adult
                            : GENDER_LABELS[g].youth;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => handleSelectGender(g)}
                            className={cn(
                              "flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-muted/40"
                            )}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mannschaftsname + Schnellvorschläge */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label htmlFor="ob-team">Mannschaftsname *</Label>
                    <Input
                      id="ob-team"
                      required
                      placeholder="z. B. Herren 1 oder mD-Jugend"
                      value={teamName}
                      onChange={(e) => {
                        setTeamName(e.target.value);
                        setTeamNameTouched(true);
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-xs text-muted-foreground">
                        Vorschläge:
                      </span>
                      {quickSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            setTeamName(suggestion);
                            setTeamNameTouched(true);
                          }}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                            teamName === suggestion
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                          )}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        setStep(1);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Zurück
                    </Button>
                    <Button type="button" onClick={handleNextStep}>
                      Weiter zur Liga-Auswahl
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* SCHRITT 3: Mehrstufige Liga-Auswahl & Zusammenfassung */}
              {step === 3 && (
                <div className="space-y-5">
                  <LeagueSelector
                    ageGroup={ageGroup}
                    gender={gender}
                    selectedLeague={selectedLeague}
                    onSelect={(league) => {
                      setSelectedLeague(league);
                      setError(null);
                    }}
                  />

                  {/* Kompakte Zusammenfassung vor dem Anlegen */}
                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      Zusammenfassung
                    </div>
                    <div className="grid gap-1.5 text-sm sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Verein: </span>
                        <span className="font-semibold text-foreground">
                          {clubName}
                          {city ? ` (${city})` : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Saison: </span>
                        <span className="font-semibold text-foreground">
                          {seasonName}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Mannschaft:{" "}
                        </span>
                        <span className="font-semibold text-foreground">
                          {teamName}
                        </span>{" "}
                        <Badge variant="outline" className="ml-1 text-[11px]">
                          {getAgeGroupPrefix(ageGroup, gender)}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Liga: </span>
                        <span className="font-semibold text-foreground">
                          {selectedLeague
                            ? selectedLeague.displayName
                            : "Noch nicht ausgewählt"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setError(null);
                        setStep(2);
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Zurück
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitting || !selectedLeague}
                      className="min-w-[200px]"
                    >
                      {submitting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Verein & Mannschaft anlegen
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
