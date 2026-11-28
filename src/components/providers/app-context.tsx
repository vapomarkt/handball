"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getPrimaryMemberRole,
  normalizeMemberRoles,
  type AvailabilityStatus,
  type HandballPosition,
  type MemberRole,
  type ThrowingHand,
} from "@/domain/schemas/handball";
import type { GuardianLinkDTO } from "@/domain/schemas/invite";
import type { LeagueAgeGroup } from "@/domain/schemas/league-catalog";
import {
  DEFAULT_ONBOARDING_STATE,
  type AuthMethodsSummaryDTO,
  type UpdateOnboardingStateInput,
  type UserOnboardingStateDTO,
} from "@/domain/schemas/onboarding-state";
import { shouldAutoStartTour } from "@/domain/services/onboarding-state-service";

export interface MeMembership {
  memberId: string;
  role: MemberRole;
  roles?: MemberRole[];
  isClubAdmin?: boolean;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  primaryPosition: HandballPosition | null;
  secondaryPosition?: HandballPosition | null;
  throwingHand?: ThrowingHand | null;
  availabilityStatus: AvailabilityStatus;
  phone?: string | null;
  emergencyContact?: string | null;
  injuryNote?: string | null;
  club: {
    id: string;
    name: string;
    shortName: string | null;
    slug: string;
    logoUrl: string | null;
  };
  team: {
    id: string;
    name: string;
    category: string;
    ageGroup: LeagueAgeGroup | null;
    gender: "MALE" | "FEMALE" | "MIXED";
    usesResin: boolean;
    leagueName: string | null;
    leagueGroupTeamId?: string | null;
    seasonId?: string;
    seasonName: string;
  };
}

export interface MeGuardianLink extends GuardianLinkDTO {
  childEmergencyContact?: string | null;
  childInjuryNote?: string | null;
  childJerseyNumber?: number | null;
  childPrimaryPosition?: HandballPosition | null;
}

export interface SelectableTeam {
  teamId: string;
  teamName: string;
  ageGroup: LeagueAgeGroup | null;
  usesResin: boolean;
  leagueName: string | null;
  hasLeagueLink: boolean;
  seasonId?: string;
  seasonName: string;
  clubId: string;
  clubName: string;
  clubLogoUrl: string | null;
  role: MemberRole;
  roles: MemberRole[];
  isClubAdmin: boolean;
}

export interface MePayload {
  user: {
    id: string;
    email: string;
    name: string;
  };
  onboardingState?: UserOnboardingStateDTO;
  authMethods?: AuthMethodsSummaryDTO;
  memberships: MeMembership[];
  adminClubTeams: Array<{
    id: string;
    name: string;
    category: string;
    ageGroup: LeagueAgeGroup | null;
    gender: "MALE" | "FEMALE" | "MIXED";
    usesResin: boolean;
    leagueName: string | null;
    leagueGroupTeamId?: string | null;
    seasonId?: string;
    seasonName: string;
    club: {
      id: string;
      name: string;
      shortName: string | null;
      slug: string;
      logoUrl: string | null;
    };
  }>;
  guardianLinks: MeGuardianLink[];
}

interface AppContextValue {
  me: MePayload | null;
  loading: boolean;
  selectableTeams: SelectableTeam[];
  activeTeam: SelectableTeam | null;
  onboardingState: UserOnboardingStateDTO;
  authMethods: AuthMethodsSummaryDTO;
  tourActive: boolean;
  startTour: () => void;
  closeTour: () => void;
  updateOnboardingState: (
    patch: UpdateOnboardingStateInput
  ) => Promise<UserOnboardingStateDTO | null>;
  setActiveTeamId: (teamId: string) => void;
  refreshMe: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = "throwoff_active_team_id";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [tourActive, setTourActive] = useState(false);
  const autoPromptedRolesRef = useRef<Set<string>>(new Set());

  const [activeTeamId, setActiveTeamIdState] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
  );

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/me", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (!res.ok) {
        setMe(null);
        return;
      }
      const data: MePayload = await res.json();
      setMe(data);

      if (
        data.memberships.length === 0 &&
        data.adminClubTeams.length === 0 &&
        data.guardianLinks.length === 0
      ) {
        router.replace("/onboarding");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/me", { cache: "no-store" })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setMe(null);
          return;
        }
        const data: MePayload = await res.json();
        if (!active) return;
        setMe(data);
        if (
          data.memberships.length === 0 &&
          data.adminClubTeams.length === 0 &&
          data.guardianLinks.length === 0
        ) {
          router.replace("/onboarding");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [router]);

  const selectableTeams = useMemo<SelectableTeam[]>(() => {
    if (!me) return [];
    const map = new Map<string, SelectableTeam>();
    const adminClubIds = new Set(
      me.memberships
        .filter((m) =>
          normalizeMemberRoles({
            roles: m.roles,
            role: m.role,
            isClubAdmin: m.isClubAdmin,
          }).includes("CLUB_ADMIN")
        )
        .map((m) => m.club.id)
    );

    for (const m of me.memberships) {
      const isAdmin = adminClubIds.has(m.club.id);
      const roles = normalizeMemberRoles({
        roles: m.roles,
        role: m.role,
        isClubAdmin: isAdmin || m.isClubAdmin,
      });
      map.set(m.team.id, {
        teamId: m.team.id,
        teamName: m.team.name,
        ageGroup: m.team.ageGroup ?? null,
        usesResin: m.team.usesResin ?? true,
        leagueName: m.team.leagueName,
        hasLeagueLink: Boolean(m.team.leagueGroupTeamId),
        seasonId: m.team.seasonId,
        seasonName: m.team.seasonName,
        clubId: m.club.id,
        clubName: m.club.name,
        clubLogoUrl: m.club.logoUrl ?? null,
        role: getPrimaryMemberRole(roles, m.role),
        roles,
        isClubAdmin: isAdmin,
      });
    }

    for (const t of me.adminClubTeams) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          teamId: t.id,
          teamName: t.name,
          ageGroup: t.ageGroup ?? null,
          usesResin: t.usesResin ?? true,
          leagueName: t.leagueName,
          hasLeagueLink: Boolean(t.leagueGroupTeamId),
          seasonId: t.seasonId,
          seasonName: t.seasonName,
          clubId: t.club.id,
          clubName: t.club.name,
          clubLogoUrl: t.club.logoUrl ?? null,
          role: "CLUB_ADMIN",
          roles: ["CLUB_ADMIN"],
          isClubAdmin: true,
        });
      }
    }

    return Array.from(map.values());
  }, [me]);

  const setActiveTeamId = useCallback((teamId: string) => {
    setActiveTeamIdState(teamId);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, teamId);
    }
  }, []);

  const activeTeam = useMemo(
    () =>
      selectableTeams.find((t) => t.teamId === activeTeamId) ??
      selectableTeams[0] ??
      null,
    [selectableTeams, activeTeamId]
  );

  const onboardingState = useMemo<UserOnboardingStateDTO>(
    () => me?.onboardingState ?? DEFAULT_ONBOARDING_STATE,
    [me?.onboardingState]
  );

  const authMethods = useMemo<AuthMethodsSummaryDTO>(
    () => me?.authMethods ?? { hasPassword: true, passkeyCount: 0 },
    [me?.authMethods]
  );

  const updateOnboardingState = useCallback(
    async (
      patch: UpdateOnboardingStateInput
    ): Promise<UserOnboardingStateDTO | null> => {
      try {
        const res = await fetch("/api/v1/me/onboarding-state", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const nextState: UserOnboardingStateDTO | undefined =
          data.onboardingState;
        if (nextState) {
          setMe((prev) =>
            prev ? { ...prev, onboardingState: nextState } : prev
          );
          return nextState;
        }
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  // Sanfter automatischer Tour-Start beim ersten Besuch (nicht auf /profil, nie wenn tourDisabled)
  useEffect(() => {
    if (loading || !me || !activeTeam) return;
    if (pathname === "/profil") return;
    if (!shouldAutoStartTour(onboardingState, activeTeam.role)) return;
    const key = `${me.user.id}:${activeTeam.role}`;
    if (autoPromptedRolesRef.current.has(key)) return;

    autoPromptedRolesRef.current.add(key);
    const timer = setTimeout(() => {
      setTourActive(true);
    }, 350);
    return () => clearTimeout(timer);
  }, [loading, me, activeTeam, onboardingState, pathname]);

  const startTour = useCallback(() => {
    setTourActive(true);
  }, []);

  const closeTour = useCallback(() => {
    setTourActive(false);
  }, []);

  return (
    <AppContext.Provider
      value={{
        me,
        loading,
        selectableTeams,
        activeTeam,
        onboardingState,
        authMethods,
        tourActive,
        startTour,
        closeTour,
        updateOnboardingState,
        setActiveTeamId,
        refreshMe: fetchMe,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext muss innerhalb von AppProvider genutzt werden.");
  }
  return ctx;
}
