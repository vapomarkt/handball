import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { ThrowOffApiError } from "@throwoff/shared";

const ONE_DAY = 1000 * 60 * 60 * 24;

// React Query pausiert Requests automatisch, solange das Gerät offline ist.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  })
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "offlineFirst",
      staleTime: 1000 * 60,
      gcTime: ONE_DAY * 7,
      retry: (failureCount, error) => {
        if (
          error instanceof ThrowOffApiError &&
          [401, 403, 404].includes(error.httpStatus)
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      networkMode: "offlineFirst",
    },
  },
});

/**
 * Offline-Cache (Halle ohne Empfang): Spielplan, Kader & Taktiken werden in AsyncStorage
 * persistiert und beim nächsten App-Start sofort angezeigt.
 * Speicher-Engine ist bewusst austauschbar (später z. B. react-native-mmkv).
 */
export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "throwoff-query-cache-v1",
  throttleTime: 1000,
});

export const PERSIST_MAX_AGE = ONE_DAY * 7;

/** Query keys shared across screens. */
export const queryKeys = {
  me: ["me"] as const,
  events: (teamId: string) => ["teams", teamId, "events"] as const,
  event: (teamId: string, eventId: string) =>
    ["teams", teamId, "events", eventId] as const,
  carpools: (teamId: string, eventId: string) =>
    ["teams", teamId, "events", eventId, "carpools"] as const,
  members: (teamId: string) => ["teams", teamId, "members"] as const,
  tactics: (teamId: string) => ["teams", teamId, "tactics"] as const,
  announcements: (teamId: string) =>
    ["teams", teamId, "announcements"] as const,
  polls: (teamId: string) => ["teams", teamId, "polls"] as const,
  duties: (clubId: string) => ["clubs", clubId, "duties"] as const,
};
