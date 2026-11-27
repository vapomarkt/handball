"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Calendar,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreVertical,
  Plus,
  Settings,
  Shield,
  Sun,
  UserCircle2,
  Users,
  Wallet,
  Waypoints,
} from "lucide-react";
import { useTheme } from "next-themes";
import { BrandLogo } from "@/components/branding/logo";
import { AppTour } from "@/components/onboarding/app-tour";
import { useAppContext } from "@/components/providers/app-context";
import { CreateTeamDialog } from "@/components/team/create-team-dialog";
import { Button } from "@/components/ui/button";
import { SelectNative } from "@/components/ui/select-native";
import { MEMBER_ROLE_LABELS } from "@/domain/schemas/handball";
import { signOut } from "@/infrastructure/auth/auth-client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Übersicht",
    icon: LayoutDashboard,
    tourId: "nav-dashboard",
  },
  {
    href: "/termine",
    label: "Termine",
    icon: Calendar,
    tourId: "nav-termine",
  },
  {
    href: "/team",
    label: "Team",
    icon: Users,
    tourId: "nav-team",
  },
  {
    href: "/taktik",
    label: "Taktik",
    icon: Waypoints,
    tourId: "nav-taktik",
  },
  {
    href: "/dienste",
    label: "Dienste",
    icon: ClipboardList,
    tourId: "nav-dienste",
  },
  {
    href: "/kasse",
    label: "Kasse",
    icon: Wallet,
    tourId: "nav-kasse",
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const {
    me,
    loading,
    selectableTeams,
    activeTeam,
    setActiveTeamId,
    refreshMe,
    startTour,
  } = useAppContext();
  const [createTeamOpen, setCreateTeamOpen] = useState(false);

  const canAddTeam = Boolean(
    activeTeam && (activeTeam.isClubAdmin || activeTeam.role === "COACH")
  );

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  if (loading && !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo size="lg" />
          <p className="text-sm text-muted-foreground">Lade Team-Daten…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-clip md:flex-row bg-background">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex md:w-68 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card">
        <div className="flex h-16 items-center justify-between px-5 border-b border-border">
          <Link href="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={startTour}
              aria-label="Kurztour starten"
              title="Kurztour starten"
            >
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Team-Switcher */}
        {selectableTeams.length > 0 && activeTeam && (
          <div
            data-tour-id="team-switcher"
            className="p-4 border-b border-border space-y-2"
          >
            <div className="flex items-center gap-2.5">
              {activeTeam.clubLogoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={activeTeam.clubLogoUrl}
                  alt={`Vereinslogo ${activeTeam.clubName}`}
                  className="h-9 w-9 shrink-0 rounded-full object-contain bg-white p-0.5 border border-border shadow-xs"
                />
              )}
              <div className="min-w-0">
                <label
                  htmlFor="desktop-team-switcher"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Aktive Mannschaft
                </label>
                <p className="truncate text-xs font-semibold text-foreground">
                  {activeTeam.clubName}
                </p>
              </div>
            </div>
            <SelectNative
              id="desktop-team-switcher"
              value={activeTeam.teamId}
              onChange={(e) => setActiveTeamId(e.target.value)}
              className="h-10 text-sm font-medium"
            >
              {selectableTeams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName} – {t.clubName}
                </option>
              ))}
            </SelectNative>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
              <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="shrink-0">
                {MEMBER_ROLE_LABELS[activeTeam.role]}
                {activeTeam.isClubAdmin && activeTeam.role !== "CLUB_ADMIN"
                  ? " · Vereins-Admin"
                  : ""}
              </span>
              {activeTeam.leagueName && (
                <>
                  <span>·</span>
                  <span className="truncate">{activeTeam.leagueName}</span>
                </>
              )}
            </div>
            {canAddTeam && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateTeamOpen(true)}
                className="w-full h-8 text-xs justify-center"
              >
                <Plus className="h-3.5 w-3.5" />
                Weitere Mannschaft
              </Button>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3" aria-label="Hauptnavigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour-id={item.tourId}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {activeTeam?.isClubAdmin && (
            <div className="pt-3 mt-3 border-t border-border">
              <Link
                href="/verwaltung"
                data-tour-id="nav-verwaltung"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors",
                  pathname === "/verwaltung" ||
                    pathname.startsWith("/verwaltung/")
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Settings className="h-5 w-5 shrink-0" />
                <span>Verwaltung</span>
              </Link>
            </div>
          )}
        </nav>

        {/* User Footer -> direkt zum Profil */}
        {me && (
          <div className="border-t border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <Link
                href="/profil"
                data-tour-id="nav-profil"
                className={cn(
                  "flex items-center gap-2.5 min-w-0 flex-1 rounded-lg px-2 py-1.5 transition-colors",
                  pathname === "/profil"
                    ? "bg-primary/12 text-primary"
                    : "hover:bg-muted"
                )}
                title="Profil, Passkeys & Tour-Einstellungen"
              >
                <UserCircle2 className="h-7 w-7 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {me.user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Profil &amp; Sicherheit
                  </p>
                </div>
              </Link>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                aria-label="Abmelden"
                title="Abmelden"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Top Header */}
      <header className="sticky top-0 z-30 flex h-14 w-full min-w-0 items-center justify-between gap-1.5 sm:gap-2 border-b border-border bg-card/95 px-2.5 sm:px-4 backdrop-blur-sm md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          {activeTeam?.clubLogoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={activeTeam.clubLogoUrl}
              alt={`Vereinslogo ${activeTeam.clubName}`}
              className="h-8 w-8 rounded-full object-contain bg-white p-0.5 border border-border"
            />
          ) : (
            <BrandLogo size="sm" showWordmark={false} />
          )}
        </Link>

        {selectableTeams.length > 0 && activeTeam && (
          <div className="flex min-w-0 flex-1 items-center gap-1 max-w-[220px] sm:max-w-[280px]">
            <SelectNative
              data-tour-id="team-switcher"
              aria-label="Mannschaft wechseln"
              value={activeTeam.teamId}
              onChange={(e) => setActiveTeamId(e.target.value)}
              className="h-9 min-w-0 flex-1 px-2 text-xs font-semibold"
            >
              {selectableTeams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                </option>
              ))}
            </SelectNative>
            {canAddTeam && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setCreateTeamOpen(true)}
                aria-label="Weitere Mannschaft anlegen"
                title="Weitere Mannschaft anlegen"
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center gap-0.5 shrink-0">
          {activeTeam?.isClubAdmin && (
            <Link
              href="/verwaltung"
              data-tour-id="nav-verwaltung"
              aria-label="Verwaltung"
              title="Vereins- & Saison-Verwaltung"
              className={cn(
                "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                pathname === "/verwaltung"
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
          <Link
            href="/profil"
            data-tour-id="nav-profil"
            aria-label="Mein Profil"
            title="Profil & Sicherheit"
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
              pathname === "/profil"
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <UserCircle2 className="h-4 w-4" />
          </Link>

          {/* Auf größeren Mobilgeräten (sm..md) direkt sichtbar */}
          <div className="hidden sm:flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={startTour}
              aria-label="Kurztour starten"
              title="Kurztour starten"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <ThemeToggle className="h-9 w-9" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={handleLogout}
              aria-label="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Auf Smartphones (< sm) kompakt im Mehr-Menü, damit der Header nie überläuft */}
          <div className="sm:hidden">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  aria-label="Weitere Optionen"
                  title="Weitere Optionen"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 min-w-[200px] rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-xl"
                >
                  <DropdownMenu.Item
                    onSelect={() => startTour()}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus:bg-muted"
                  >
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <span>Kurztour starten</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() =>
                      setTheme(resolvedTheme === "dark" ? "light" : "dark")
                    }
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium outline-none hover:bg-muted focus:bg-muted"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Moon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>
                      {resolvedTheme === "dark" ? "Heller Modus" : "Dunkelmodus"}
                    </span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item
                    onSelect={() => void handleLogout()}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Abmelden</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 w-full md:pl-68 pb-20 md:pb-8">
        <div className="mx-auto w-full min-w-0 max-w-5xl px-3.5 py-4 sm:px-6 sm:py-5 lg:px-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab-Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-6 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
        aria-label="Mobile Navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={item.tourId}
              className={cn(
                "flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[10px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Rollenspezifische, abschaltbare App-Kurztour */}
      <AppTour />

      {/* Weitere Mannschaft im Verein anlegen */}
      {canAddTeam && activeTeam && (
        <CreateTeamDialog
          open={createTeamOpen}
          onOpenChange={setCreateTeamOpen}
          clubId={activeTeam.clubId}
          clubName={activeTeam.clubName}
          defaultSeasonName={activeTeam.seasonName}
          onCreated={async () => {
            await refreshMe();
          }}
          onSwitchToTeam={(teamId) => {
            setActiveTeamId(teamId);
            router.push("/team");
          }}
        />
      )}
    </div>
  );
}
