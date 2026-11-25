"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Calendar,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Users,
  Wallet,
  Waypoints,
} from "lucide-react";
import { BrandLogo } from "@/components/branding/logo";
import { useAppContext } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import { SelectNative } from "@/components/ui/select-native";
import { MEMBER_ROLE_LABELS } from "@/domain/schemas/handball";
import { signOut } from "@/infrastructure/auth/auth-client";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { href: "/termine", label: "Termine", icon: Calendar },
  { href: "/team", label: "Team", icon: Users },
  { href: "/taktik", label: "Taktik", icon: Waypoints },
  { href: "/dienste", label: "Dienste", icon: ClipboardList },
  { href: "/kasse", label: "Kasse", icon: Wallet },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, loading, selectableTeams, activeTeam, setActiveTeamId } =
    useAppContext();

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
    <div className="flex min-h-screen flex-col md:flex-row bg-background">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex md:w-68 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card">
        <div className="flex h-16 items-center justify-between px-5 border-b border-border">
          <Link href="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <ThemeToggle />
        </div>

        {/* Team-Switcher */}
        {selectableTeams.length > 0 && activeTeam && (
          <div className="p-4 border-b border-border space-y-2">
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
              <span>{MEMBER_ROLE_LABELS[activeTeam.role]}</span>
              {activeTeam.leagueName && (
                <>
                  <span>·</span>
                  <span className="truncate">{activeTeam.leagueName}</span>
                </>
              )}
            </div>
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

        {/* User Footer */}
        {me && (
          <div className="border-t border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {me.user.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {me.user.email}
                </p>
              </div>
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
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-card/95 px-4 backdrop-blur-sm md:hidden">
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
          <SelectNative
            aria-label="Mannschaft wechseln"
            value={activeTeam.teamId}
            onChange={(e) => setActiveTeamId(e.target.value)}
            className="h-9 max-w-[200px] text-xs font-semibold"
          >
            {selectableTeams.map((t) => (
              <option key={t.teamId} value={t.teamId}>
                {t.teamName}
              </option>
            ))}
          </SelectNative>
        )}

        <div className="flex items-center gap-1">
          {activeTeam?.isClubAdmin && (
            <Link
              href="/verwaltung"
              aria-label="Verwaltung"
              title="Saison-Verwaltung"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                pathname === "/verwaltung"
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
            </Link>
          )}
          <ThemeToggle />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 md:pl-68 pb-20 md:pb-8">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab-Bar */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur-sm md:hidden"
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
              className={cn(
                "flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
