"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Fingerprint,
  HelpCircle,
  KeyRound,
  Loader2,
  Mail,
  Shield,
  Sparkles,
  Trash2,
  UserCircle2,
  Users,
} from "lucide-react";
import {
  detectFriendlyDeviceName,
  isPasskeySupported,
} from "@/components/auth/passkey-setup-card";
import { QuickProfileForm } from "@/components/onboarding/quick-profile-form";
import { useAppContext } from "@/components/providers/app-context";
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
import {
  MEMBER_ROLE_DESCRIPTIONS,
  MEMBER_ROLE_LABELS,
} from "@/domain/schemas/handball";
import { calculateProfileCompleteness } from "@/domain/services/onboarding-state-service";
import { authClient } from "@/infrastructure/auth/auth-client";

interface PasskeyItem {
  id: string;
  name?: string | null;
  deviceType?: string;
  createdAt?: Date | string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    me,
    activeTeam,
    onboardingState,
    authMethods,
    updateOnboardingState,
    startTour,
    refreshMe,
  } = useAppContext();

  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  // Passkeys
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [deletingPasskeyId, setDeletingPasskeyId] = useState<string | null>(
    null
  );
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // Passwort setzen / ändern
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Eltern: Kinder-Notfallkontakt schnell speichern (Draft-Overrides ohne Effect)
  const [childSavingId, setChildSavingId] = useState<string | null>(null);
  const [childContacts, setChildContacts] = useState<Record<string, string>>(
    {}
  );

  const loadPasskeys = useCallback(async () => {
    try {
      const result = await authClient.passkey.listUserPasskeys();
      if (result?.data && Array.isArray(result.data)) {
        setPasskeys(result.data as PasskeyItem[]);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPasskeys(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    isPasskeySupported().then((ok) => {
      if (active) setPasskeySupported(ok);
    });
    authClient.passkey
      .listUserPasskeys()
      .then((result) => {
        if (active && result?.data && Array.isArray(result.data)) {
          setPasskeys(result.data as PasskeyItem[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingPasskeys(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!me || !activeTeam) {
    return null;
  }

  const myMembership = me.memberships.find(
    (m) => m.team.id === activeTeam.teamId
  );

  const teamChildren = me.guardianLinks.filter(
    (g) => g.teamId === activeTeam.teamId
  );

  const completeness = calculateProfileCompleteness(
    myMembership?.role ?? activeTeam.role,
    myMembership
      ? {
          firstName: myMembership.firstName,
          lastName: myMembership.lastName,
          phone: myMembership.phone,
          emergencyContact: myMembership.emergencyContact,
          primaryPosition: myMembership.primaryPosition,
          throwingHand: myMembership.throwingHand,
        }
      : null,
    teamChildren.map((c) => ({
      firstName: c.childFirstName,
      emergencyContact: c.childEmergencyContact,
    }))
  );

  async function handleAddPasskey() {
    setSecurityError(null);
    setSecurityNotice(null);
    setAddingPasskey(true);
    try {
      const result = await authClient.passkey.addPasskey({
        name: detectFriendlyDeviceName(),
      });
      if (result?.error) {
        setSecurityError(
          result.error.message || "Passkey konnte nicht hinzugefügt werden."
        );
        return;
      }
      setSecurityNotice("Neuer Passkey erfolgreich gespeichert!");
      await Promise.all([loadPasskeys(), refreshMe()]);
    } catch {
      setSecurityError("Passkey-Einrichtung wurde abgebrochen.");
    } finally {
      setAddingPasskey(false);
    }
  }

  async function handleDeletePasskey(id: string) {
    setSecurityError(null);
    setSecurityNotice(null);
    setDeletingPasskeyId(id);
    try {
      const res = await authClient.passkey.deletePasskey({ id });
      if (res?.error) {
        setSecurityError(
          res.error.message || "Passkey konnte nicht entfernt werden."
        );
        return;
      }
      setSecurityNotice("Passkey entfernt.");
      await Promise.all([loadPasskeys(), refreshMe()]);
    } catch {
      setSecurityError("Fehler beim Entfernen des Passkeys.");
    } finally {
      setDeletingPasskeyId(null);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSecurityError(null);
    setSecurityNotice(null);

    if (newPassword.length < 8) {
      setSecurityError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }

    setSavingPassword(true);
    try {
      if (!authMethods.hasPassword) {
        const res = await fetch("/api/v1/me/password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        });
        const data = await res.json();
        if (!res.ok) {
          setSecurityError(
            data?.error?.message || "Passwort konnte nicht gesetzt werden."
          );
          return;
        }
        setNewPassword("");
        setSecurityNotice("Passwort wurde erfolgreich eingerichtet.");
        await refreshMe();
      } else {
        const res = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: false,
        });
        if (res.error) {
          setSecurityError(
            res.error.message ||
              "Passwort konnte nicht geändert werden. Prüfe dein aktuelles Passwort."
          );
          return;
        }
        setCurrentPassword("");
        setNewPassword("");
        setSecurityNotice("Dein Passwort wurde erfolgreich aktualisiert.");
      }
    } catch {
      setSecurityError("Netzwerkfehler beim Speichern des Passworts.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSaveChildEmergency(childMemberId: string) {
    setChildSavingId(childMemberId);
    try {
      const res = await fetch("/api/v1/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childMemberId,
          childEmergencyContact: (childContacts[childMemberId] ?? "").trim() || null,
        }),
      });
      if (res.ok) {
        setProfileNotice("Notfallkontakt für dein Kind wurde gespeichert.");
        await refreshMe();
      }
    } finally {
      setChildSavingId(null);
    }
  }

  async function handleToggleAutoTour(enabled: boolean) {
    await updateOnboardingState({ tourDisabled: !enabled });
  }

  async function handleRestartTour() {
    await updateOnboardingState({ resetTour: true });
    router.push("/dashboard");
    setTimeout(() => startTour(), 120);
  }

  const nameParts = me.user.name.trim().split(/\s+/);
  const fallbackFirst = myMembership?.firstName ?? nameParts[0] ?? "";
  const fallbackLast =
    myMembership?.lastName ??
    (nameParts.length > 1 ? nameParts.slice(1).join(" ") : "");

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <UserCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Mein Profil &amp; Sicherheit
            </h1>
            <p className="text-sm text-muted-foreground">
              {me.user.email} ·{" "}
              <strong className="text-foreground">
                {MEMBER_ROLE_LABELS[activeTeam.role]}
              </strong>{" "}
              ({activeTeam.teamName})
            </p>
          </div>
        </div>
        <Badge
          variant={completeness.isComplete ? "secondary" : "outline"}
          className="w-fit"
        >
          Profil {completeness.percentage} % vollständig
        </Badge>
      </div>

      {/* 1. Profil-Karte */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Persönliche Daten</CardTitle>
          <CardDescription>
            {MEMBER_ROLE_DESCRIPTIONS[activeTeam.role]}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profileNotice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{profileNotice}</span>
            </div>
          )}

          <QuickProfileForm
            key={`${activeTeam.teamId}-${myMembership?.memberId ?? "none"}`}
            initial={{
              teamId: activeTeam.teamId,
              role: myMembership?.role ?? activeTeam.role,
              firstName: fallbackFirst,
              lastName: fallbackLast,
              phone: myMembership?.phone ?? null,
              emergencyContact: myMembership?.emergencyContact ?? null,
              primaryPosition: myMembership?.primaryPosition ?? null,
              throwingHand: myMembership?.throwingHand ?? null,
              childMemberId: teamChildren[0]?.childMemberId ?? null,
              childFirstName: teamChildren[0]?.childFirstName ?? null,
              childEmergencyContact:
                teamChildren[0]?.childEmergencyContact ?? null,
            }}
            submitLabel="Profil speichern"
            onSaved={() => {
              setProfileNotice("Dein Profil wurde gespeichert.");
              void refreshMe();
            }}
          />
        </CardContent>
      </Card>

      {/* Eltern: Verknüpfte Kinder */}
      {me.guardianLinks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Meine verknüpften Kinder</CardTitle>
            </div>
            <CardDescription>
              Halte die Notfallkontakte aktuell – nur Trainer und Betreuer
              können sie einsehen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {me.guardianLinks.map((child) => (
              <div
                key={child.id}
                className="rounded-xl border border-border p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {child.childJerseyNumber
                        ? `#${child.childJerseyNumber} `
                        : ""}
                      {child.childFirstName} {child.childLastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {child.teamName} · {child.relationship}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    aria-label={`Notfallkontakt für ${child.childFirstName}`}
                    placeholder="Notfallkontakt (Name & Telefon)"
                    value={
                      childContacts[child.childMemberId] ??
                      child.childEmergencyContact ??
                      ""
                    }
                    onChange={(e) =>
                      setChildContacts((prev) => ({
                        ...prev,
                        [child.childMemberId]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={childSavingId === child.childMemberId}
                    onClick={() =>
                      void handleSaveChildEmergency(child.childMemberId)
                    }
                  >
                    {childSavingId === child.childMemberId && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Speichern
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 2. Anmeldung & Sicherheit (Passkeys, Login-PIN, Passwort) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Anmeldung &amp; Sicherheit</CardTitle>
          </div>
          <CardDescription>
            Melde dich bequem per Passkey (Face ID / Fingerabdruck), 6-stelliger
            Login-PIN per E-Mail oder klassischem Passwort an.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {securityError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
            >
              {securityError}
            </div>
          )}

          {securityNotice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
              {securityNotice}
            </div>
          )}

          {/* Login-PIN Status */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 flex items-start gap-3">
            <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">
                6-stellige Login-PIN per E-Mail · Immer aktiv
              </p>
              <p className="text-xs text-muted-foreground">
                Du kannst dir auf der Anmeldeseite jederzeit eine 6-stellige PIN
                an <strong>{me.user.email}</strong> schicken lassen.
              </p>
            </div>
          </div>

          {/* Passkeys */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  Passkeys (Fingerabdruck / Face ID)
                </h3>
              </div>
              {passkeySupported && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddPasskey}
                  disabled={addingPasskey}
                >
                  {addingPasskey ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Fingerprint className="h-3.5 w-3.5 text-primary" />
                  )}
                  Passkey hinzufügen
                </Button>
              )}
            </div>

            {loadingPasskeys ? (
              <p className="text-xs text-muted-foreground">Lade Passkeys…</p>
            ) : passkeys.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {passkeySupported
                  ? "Noch kein Passkey eingerichtet. Mit einem Passkey meldest du dich künftig mit einem Tipp an."
                  : "Dieses Gerät oder dieser Browser unterstützt derzeit keine Passkeys."}
              </p>
            ) : (
              <div className="space-y-2">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        {pk.name || "Gespeicherter Passkey"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pk.deviceType ? `${pk.deviceType}` : "WebAuthn"}
                        {pk.createdAt
                          ? ` · Eingerichtet am ${new Date(pk.createdAt).toLocaleDateString("de-DE")}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => void handleDeletePasskey(pk.id)}
                      disabled={deletingPasskeyId === pk.id}
                      aria-label="Passkey entfernen"
                      title="Passkey entfernen"
                    >
                      {deletingPasskeyId === pk.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Passwort setzen oder ändern */}
          <form
            onSubmit={handlePasswordSubmit}
            className="space-y-3 border-t border-border pt-4"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">
                {authMethods.hasPassword
                  ? "Passwort ändern"
                  : "Optionales Passwort festlegen"}
              </h3>
            </div>
            {!authMethods.hasPassword && (
              <p className="text-xs text-muted-foreground">
                Du bist ohne Passwort per Login-PIN gestartet. Wenn du möchtest,
                kannst du hier zusätzlich ein Passwort festlegen.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {authMethods.hasPassword && (
                <div className="space-y-1.5">
                  <Label htmlFor="pw-current">Aktuelles Passwort</Label>
                  <Input
                    id="pw-current"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">
                  Neues Passwort (mind. 8 Zeichen)
                </Label>
                <Input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={savingPassword}
            >
              {savingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {authMethods.hasPassword
                ? "Passwort aktualisieren"
                : "Passwort festlegen"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 3. Hilfe & App-Tour */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Hilfe &amp; App-Tour</CardTitle>
          </div>
          <CardDescription>
            Bestimme selbst, ob dir die kurze Einführung angezeigt wird.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-border p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!onboardingState.tourDisabled}
              onChange={(e) => void handleToggleAutoTour(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
            />
            <span className="space-y-0.5">
              <span className="block text-sm font-semibold text-foreground">
                Kurze App-Tour beim ersten Start (oder neuen Rollen) automatisch
                anzeigen
              </span>
              <span className="block text-xs text-muted-foreground">
                Deaktiviere diesen Haken, wenn du die App bereits kennst und
                keine automatischen Tipps mehr sehen möchtest.
              </span>
            </span>
          </label>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRestartTour()}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Kurztour für „{MEMBER_ROLE_LABELS[activeTeam.role]}“ jetzt starten
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
