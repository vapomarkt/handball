"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronsUpDown,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  MoreHorizontal,
  Plus,
  Settings,
  Sun,
  UserCircle2,
  Users,
  Waypoints,
} from "lucide-react";
import { useTheme } from "next-themes";
import { BrandLogo } from "@/components/branding/logo";
import { AppTour } from "@/components/onboarding/app-tour";
import { useAppContext } from "@/components/providers/app-context";
import { CreateTeamDialog } from "@/components/team/create-team-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MEMBER_ROLE_LABELS } from "@/domain/schemas/handball";
import { signOut } from "@/infrastructure/auth/auth-client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const PRIMARY_MOBILE_TABS = [
  {
    href: "/dashboard",
    label: "Start",
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
    href: "/dienste",
    label: "Dienste",
    icon: ClipboardList,
    tourId: "nav-dienste",
  },
] as const;

const MORE_ROUTES = ["/kasse", "/taktik", "/verwaltung", "/profil"];

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
  const [moreOpen, setMoreOpen] = useState(false);

  const isStaff = Boolean(
    activeTeam &&
      (activeTeam.isClubAdmin ||
        activeTeam.role === "CLUB_ADMIN" ||
        activeTeam.role === "COACH" ||
        activeTeam.role === "ASSISTANT_COACH" ||
        activeTeam.role === "TEAM_MANAGER")
  );

  const canAddTeam = Boolean(
    activeTeam && (activeTeam.isClubAdmin || activeTeam.role === "COACH")
  );

  const tacticsLabel = isStaff ? "Taktik & Training" : "Playbook";
  const isMoreActive = MORE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  async function handleLogout() {
    setMoreOpen(false);
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
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card">
        <div className="flex h-15 items-center justify-between px-4 border-b border-border">
          <Link href="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <ThemeToggle />
        </div>

        {/* Kompakter Team-Switcher (Dropdown inkl. 'Weitere Mannschaft' für Staff/Admin) */}
        {selectableTeams.length > 0 && activeTeam && (
          <div
            data-tour-id="team-switcher"
            className="p-3 border-b border-border"
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Aktive Mannschaft wechseln"
                  className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-background/60 px-2.5 py-2 text-left transition-colors hover:bg-muted/70 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {activeTeam.clubLogoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={activeTeam.clubLogoUrl}
                      alt={`Vereinslogo ${activeTeam.clubName}`}
                      className="h-8 w-8 shrink-0 rounded-full object-contain bg-white p-0.5 border border-border"
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                      {activeTeam.teamName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold leading-tight text-foreground">
                      {activeTeam.teamName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {activeTeam.clubName} · {MEMBER_ROLE_LABELS[activeTeam.role]}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel>Mannschaft wählen</DropdownMenuLabel>
                {selectableTeams.map((t) => {
                  const selected = t.teamId === activeTeam.teamId;
                  return (
                    <DropdownMenuItem
                      key={t.teamId}
                      onSelect={() => setActiveTeamId(t.teamId)}
                      className="justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {t.teamName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t.clubName} · {MEMBER_ROLE_LABELS[t.role]}
                        </p>
                      </div>
                      {selected && (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
                {canAddTeam && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setCreateTeamOpen(true)}>
                      <Plus className="h-4 w-4 text-primary" />
                      <span>Weitere Mannschaft anlegen</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Hauptnavigation – klar gruppiert */}
        <nav
          className="flex-1 overflow-y-auto p-3 space-y-5"
          aria-label="Hauptnavigation"
        >
          <div className="space-y-1">
            {PRIMARY_MOBILE_TABS.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour-id={item.tourId}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <Link
              href="/kasse"
              data-tour-id="nav-kasse"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                pathname === "/kasse" || pathname.startsWith("/kasse/")
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Megaphone className="h-4 w-4 shrink-0" />
              <span>Pinnwand &amp; Kasse</span>
            </Link>
          </div>

          <div className="space-y-1 border-t border-border pt-3">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {isStaff ? "Trainer & Verein" : "Team-Wissen"}
            </p>
            <Link
              href="/taktik"
              data-tour-id="nav-taktik"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                pathname === "/taktik" || pathname.startsWith("/taktik/")
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Waypoints className="h-4 w-4 shrink-0" />
              <span>{tacticsLabel}</span>
            </Link>

            {activeTeam?.isClubAdmin && (
              <Link
                href="/verwaltung"
                data-tour-id="nav-verwaltung"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                  pathname === "/verwaltung" ||
                    pathname.startsWith("/verwaltung/")
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span>Verwaltung</span>
              </Link>
            )}
          </div>
        </nav>

        {/* User Footer */}
        {me && (
          <div className="border-t border-border p-3">
            <div className="flex items-center justify-between gap-1">
              <Link
                href="/profil"
                data-tour-id="nav-profil"
                className={cn(
                  "flex items-center gap-2.5 min-w-0 flex-1 rounded-lg px-2 py-1.5 transition-colors",
                  pathname === "/profil"
                    ? "bg-primary/12 text-primary"
                    : "hover:bg-muted"
                )}
                title="Profil & Sicherheit"
              >
                <UserCircle2 className="h-6 w-6 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {me.user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    Profil &amp; Sicherheit
                  </p>
                </div>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Konto-Optionen"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="top">
                  <DropdownMenuItem onSelect={startTour}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <span>Kurztour starten</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    destructive
                    onSelect={() => void handleLogout()}
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Abmelden</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </aside>

      {/* Ruhiger Mobile Top-Header (max. 2 Elemente: Team-Switcher + Profil) */}
      <header className="sticky top-0 z-30 flex h-14 w-full min-w-0 items-center justify-between gap-2 border-b border-border bg-card/95 px-3 backdrop-blur-sm md:hidden">
        {selectableTeams.length > 0 && activeTeam ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                data-tour-id="team-switcher"
                aria-label="Mannschaft wechseln"
                className="flex min-w-0 max-w-[calc(100%-3rem)] items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {activeTeam.clubLogoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activeTeam.clubLogoUrl}
                    alt={`Vereinslogo ${activeTeam.clubName}`}
                    className="h-8 w-8 shrink-0 rounded-full object-contain bg-white p-0.5 border border-border"
                  />
                ) : (
                  <BrandLogo size="sm" showWordmark={false} />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold leading-tight text-foreground">
                    {activeTeam.teamName}
                  </p>
                  <p className="truncate text-[11px] leading-tight text-muted-foreground">
                    {activeTeam.clubName}
                  </p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Mannschaft wählen</DropdownMenuLabel>
              {selectableTeams.map((t) => {
                const selected = t.teamId === activeTeam.teamId;
                return (
                  <DropdownMenuItem
                    key={t.teamId}
                    onSelect={() => setActiveTeamId(t.teamId)}
                    className="justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {t.teamName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.clubName} · {MEMBER_ROLE_LABELS[t.role]}
                      </p>
                    </div>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                );
              })}
              {canAddTeam && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setCreateTeamOpen(true)}>
                    <Plus className="h-4 w-4 text-primary" />
                    <span>Weitere Mannschaft anlegen</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
            <BrandLogo size="sm" />
          </Link>
        )}

        <Link
          href="/profil"
          data-tour-id="nav-profil"
          aria-label="Mein Profil"
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors",
            pathname === "/profil"
              ? "bg-primary/12 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <UserCircle2 className="h-5 w-5" />
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 w-full md:pl-64 pb-20 md:pb-8">
        <div className="mx-auto w-full min-w-0 max-w-5xl px-3.5 py-4 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab-Bar (streng max. 5 Tabs) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
        aria-label="Mobile Navigation"
      >
        {PRIMARY_MOBILE_TABS.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour-id={item.tourId}
              className={cn(
                "flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition-colors",
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

        <button
          type="button"
          data-tour-id="nav-more"
          onClick={() => setMoreOpen(true)}
          aria-label="Mehr Bereiche und Einstellungen"
          className={cn(
            "flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-semibold transition-colors cursor-pointer",
            isMoreActive || moreOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Menu className="h-5 w-5 shrink-0" />
          <span className="max-w-full truncate leading-tight">Mehr</span>
        </button>
      </nav>

      {/* Mobile 'Mehr'-Menü (Dialog) */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Weitere Bereiche</DialogTitle>
            {activeTeam && (
              <DialogDescription>
                {activeTeam.teamName} · {MEMBER_ROLE_LABELS[activeTeam.role]}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-1.5">
            <Link
              href="/kasse"
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                pathname === "/kasse"
                  ? "bg-primary/12 text-primary"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <Megaphone className="h-4 w-4 shrink-0 text-primary" />
              <span>Pinnwand &amp; Kasse</span>
            </Link>

            <Link
              href="/taktik"
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                pathname === "/taktik"
                  ? "bg-primary/12 text-primary"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <Waypoints className="h-4 w-4 shrink-0 text-primary" />
              <span>{tacticsLabel}</span>
            </Link>

            {activeTeam?.isClubAdmin && (
              <Link
                href="/verwaltung"
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                  pathname === "/verwaltung"
                    ? "bg-primary/12 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
              >
                <Settings className="h-4 w-4 shrink-0 text-primary" />
                <span>Vereins-Verwaltung</span>
              </Link>
            )}

            <div className="my-2 h-px bg-border" />

            <Link
              href="/profil"
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                pathname === "/profil"
                  ? "bg-primary/12 text-primary"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <UserCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Profil &amp; Sicherheit</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                startTour();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              <HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Kurztour starten</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted cursor-pointer"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span>
                {resolvedTheme === "dark" ? "Heller Modus" : "Dunkelmodus"}
              </span>
            </button>

            <div className="my-2 h-px bg-border" />

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 cursor-pointer"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Abmelden</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
