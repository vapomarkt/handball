"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type {
  AvailabilityStatus,
  HandballPosition,
  MemberRole,
} from "@/domain/schemas/handball";
import type { GuardianLinkDTO } from "@/domain/schemas/invite";

export interface MeMembership {
  memberId: string;
  role: MemberRole;
  firstName: string;
  lastName: string;
  jerseyNumber: number | null;
  primaryPosition: HandballPosition | null;
  availabilityStatus: AvailabilityStatus;
  club: {
    id: string;
    name: string;
    shortName: string | null;
    slug: string;
  };
  team: {
    id: string;
    name: string;
    category: string;
    gender: "MALE" | "FEMALE" | "MIXED";
    leagueName: string | null;
    seasonName: string;
  };
}

export interface SelectableTeam {
  teamId: string;
  teamName: string;
  leagueName: string | null;
  seasonName: string;
  clubId: string;
  clubName: string;
  role: MemberRole;
  isClubAdmin: boolean;
}

export interface MePayload {
  user: {
    id: string;
    email: string;
    name: string;
  };
  memberships: MeMembership[];
  adminClubTeams: Array<{
    id: string;
    name: string;
    category: string;
    gender: "MALE" | "FEMALE" | "MIXED";
    leagueName: string | null;
    seasonName: string;
    club: {
      id: string;
      name: string;
      shortName: string | null;
      slug: string;
    };
  }>;
  guardianLinks: GuardianLinkDTO[];
}

interface AppContextValue {
  me: MePayload | null;
  loading: boolean;
  selectableTeams: SelectableTeam[];
  activeTeam: SelectableTeam | null;
  setActiveTeamId: (teamId: string) => void;
  refreshMe: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = "throwoff_active_team_id";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loading, setLoading] = useState(true);
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
        .filter((m) => m.role === "CLUB_ADMIN")
        .map((m) => m.club.id)
    );

    for (const m of me.memberships) {
      map.set(m.team.id, {
        teamId: m.team.id,
        teamName: m.team.name,
        leagueName: m.team.leagueName,
        seasonName: m.team.seasonName,
        clubId: m.club.id,
        clubName: m.club.name,
        role: m.role,
        isClubAdmin: adminClubIds.has(m.club.id),
      });
    }

    for (const t of me.adminClubTeams) {
      if (!map.has(t.id)) {
        map.set(t.id, {
          teamId: t.id,
          teamName: t.name,
          leagueName: t.leagueName,
          seasonName: t.seasonName,
          clubId: t.club.id,
          clubName: t.club.name,
          role: "CLUB_ADMIN",
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

  return (
    <AppContext.Provider
      value={{
        me,
        loading,
        selectableTeams,
        activeTeam,
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
