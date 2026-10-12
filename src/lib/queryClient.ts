import { AppState } from "react-native";
import { focusManager, hydrate, QueryClient } from "@tanstack/react-query";
import { persistQueryClientSubscribe, type PersistedClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { rawStorage } from "./storage";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One shared cache for every screen's data, saved to disk. Opening the app
 * or a tab paints the last known data at once and refreshes it behind the
 * scenes — the network is never between the user and the screen.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Fresh for 30 s: hopping between tabs does not refetch.
      staleTime: 30_000,
      // Kept a week, so the saved copy survives restarts and offline days.
      gcTime: 7 * DAY_MS,
      // Offline the request fails fast and the cached data stays on screen.
      retry: 1,
      networkMode: "offlineFirst",
    },
    mutations: { networkMode: "offlineFirst" },
  },
});

const CACHE_KEY = "fnts.query-cache";
const PERSIST_MAX_AGE = 7 * DAY_MS;

const persister = createSyncStoragePersister({
  storage: rawStorage,
  key: CACHE_KEY,
  throttleTime: 1000,
});

/**
 * Restores the saved cache before anything renders. The storage is
 * synchronous, so this is done by the time the first screen asks for data —
 * no skeleton, no flash, even on a cold start with no signal.
 */
function restore() {
  try {
    const raw = rawStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as PersistedClient;
    if (Date.now() - saved.timestamp > PERSIST_MAX_AGE) return;
    hydrate(queryClient, saved.clientState);
  } catch {
    rawStorage.removeItem(CACHE_KEY);
  }
}

restore();
// From here on, every change to the cache is saved (throttled to once a second).
persistQueryClientSubscribe({ queryClient, persister });

// Coming back to the app counts as a focus: stale screens refresh.
focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => sub.remove();
});

/** Signing in or out: nothing from the previous account may survive. */
export function clearQueryCache() {
  queryClient.clear();
  persister.removeClient();
}
