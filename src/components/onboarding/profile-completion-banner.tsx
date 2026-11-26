"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles, X } from "lucide-react";
import { useAppContext } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculateProfileCompleteness } from "@/domain/services/onboarding-state-service";
import { QuickProfileForm } from "./quick-profile-form";

export function ProfileCompletionBanner() {
  const {
    me,
    activeTeam,
    onboardingState,
    updateOnboardingState,
    refreshMe,
  } = useAppContext();

  const [dialogOpen, setDialogOpen] = useState(false);

  if (!me || !activeTeam) return null;
  if (onboardingState.profilePromptDismissed) return null;

  const myMembership = me.memberships.find(
    (m) => m.team.id === activeTeam.teamId
  );
  if (!myMembership) return null;

  const teamChildren = me.guardianLinks.filter(
    (g) => g.teamId === activeTeam.teamId
  );

  const completeness = calculateProfileCompleteness(
    myMembership.role,
    {
      firstName: myMembership.firstName,
      lastName: myMembership.lastName,
      phone: myMembership.phone,
      emergencyContact: myMembership.emergencyContact,
      primaryPosition: myMembership.primaryPosition,
      throwingHand: myMembership.throwingHand,
    },
    teamChildren.map((c) => ({
      firstName: c.childFirstName,
      emergencyContact: c.childEmergencyContact,
    }))
  );

  if (completeness.isComplete) return null;

  const firstChild = teamChildren[0] ?? null;

  return (
    <>
      <Card className="border-primary/30 bg-primary/[0.04]">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <p className="text-sm font-bold text-foreground">
                Dein Profil ist zu {completeness.percentage} % vollständig
              </p>
            </div>
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Noch offen:{" "}
              <span className="font-medium text-foreground">
                {completeness.missingFields.map((f) => f.label).join(", ")}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              onClick={() => setDialogOpen(true)}
            >
              <CheckCircle2 className="h-4 w-4" />
              In 30 Sek. ergänzen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() =>
                void updateOnboardingState({ profilePromptDismissed: true })
              }
              aria-label="Profil-Hinweis ausblenden"
              title="Ausblenden"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Profil schnell vervollständigen</DialogTitle>
            <DialogDescription>
              Ergänze deine wichtigsten Angaben – dauert unter 30 Sekunden.
            </DialogDescription>
          </DialogHeader>
          <QuickProfileForm
            initial={{
              teamId: activeTeam.teamId,
              role: myMembership.role,
              firstName: myMembership.firstName,
              lastName: myMembership.lastName,
              phone: myMembership.phone,
              emergencyContact: myMembership.emergencyContact,
              primaryPosition: myMembership.primaryPosition,
              throwingHand: myMembership.throwingHand ?? null,
              childMemberId: firstChild?.childMemberId ?? null,
              childFirstName: firstChild?.childFirstName ?? null,
              childEmergencyContact: firstChild?.childEmergencyContact ?? null,
            }}
            submitLabel="Speichern"
            skipLabel="Abbrechen"
            onSaved={() => {
              setDialogOpen(false);
              void refreshMe();
            }}
            onSkip={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
