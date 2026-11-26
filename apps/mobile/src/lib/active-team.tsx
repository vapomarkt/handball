import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deriveSelectableTeams,
  type MePayloadDTO,
  type SelectableTeamDTO,
} from "@throwoff/shared";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { api } from "./api";
import { queryKeys } from "./query-client";

const STORAGE_KEY = "throwoff_active_team_id";

interface ActiveTeamContextValue {
  me: MePayloadDTO | undefined;
  loading: boolean;
  teams: SelectableTeamDTO[];
  activeTeam: SelectableTeamDTO | null;
  /** memberId of the viewer in the active team (for RSVP/duty claims). */
  activeMemberId: string | null;
  setActiveTeamId: (teamId: string) => void;
}

const ActiveTeamContext = createContext<ActiveTeamContextValue | null>(null);

export function ActiveTeamProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: queryKeys.me, queryFn: () => api.getMe() });
  const [storedTeamId, setStoredTeamId] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(setStoredTeamId);
  }, []);

  const teams = useMemo(
    () => (meQuery.data ? deriveSelectableTeams(meQuery.data) : []),
    [meQuery.data]
  );

  const activeTeam =
    teams.find((t) => t.teamId === storedTeamId) ?? teams[0] ?? null;

  const activeMemberId =
    meQuery.data?.memberships.find((m) => m.team.id === activeTeam?.teamId)
      ?.memberId ?? null;

  // Offline-Vorrat: Spielplan, Kader & Taktiken des aktiven Teams vorab laden.
  useEffect(() => {
    if (!activeTeam) return;
    const teamId = activeTeam.teamId;
    void queryClient.prefetchQuery({
      queryKey: queryKeys.events(teamId),
      queryFn: () => api.listTeamEvents(teamId),
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.members(teamId),
      queryFn: () => api.listTeamMembers(teamId),
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.tactics(teamId),
      queryFn: () => api.listTactics(teamId),
    });
  }, [activeTeam, queryClient]);

  const setActiveTeamId = useCallback((teamId: string) => {
    setStoredTeamId(teamId);
    void AsyncStorage.setItem(STORAGE_KEY, teamId);
  }, []);

  return (
    <ActiveTeamContext.Provider
      value={{
        me: meQuery.data,
        loading: meQuery.isPending,
        teams,
        activeTeam,
        activeMemberId,
        setActiveTeamId,
      }}
    >
      {children}
    </ActiveTeamContext.Provider>
  );
}

export function useActiveTeam(): ActiveTeamContextValue {
  const ctx = useContext(ActiveTeamContext);
  if (!ctx) throw new Error("useActiveTeam must be used inside ActiveTeamProvider");
  return ctx;
}
