import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
import { api } from "./api";
import { queryClient } from "./queryClient";
import type { Habit, HistoryDay, PlanDay, TodayResponse, UserInfo } from "./types";

/** Every piece of server data the app shows, under one key each. */
export const keys = {
  habits: ["habits"] as const,
  today: ["today"] as const,
  history: (days: number) => ["history", days] as const,
  /** null = the user's logical today, whatever date that is. */
  plan: (date: string | null) => ["plan", date ?? "today"] as const,
  me: ["me"] as const,
};

export const fetchHabits = () => api<Habit[]>("/api/habits");
export const fetchToday = () => api<TodayResponse>("/api/checkins/today");
export const fetchMe = () => api<UserInfo>("/api/users/me");

export const useHabits = () => useQuery({ queryKey: keys.habits, queryFn: fetchHabits });
export const useToday = () => useQuery({ queryKey: keys.today, queryFn: fetchToday });
export const useHistory = (days = 30) =>
  useQuery({ queryKey: keys.history(days), queryFn: () => api<HistoryDay[]>(`/api/checkins/history?days=${days}`) });
export const usePlanDay = (date: string | null) =>
  useQuery({
    queryKey: keys.plan(date),
    queryFn: () => api<PlanDay>(`/api/plan${date ? `?date=${date}` : ""}`),
    // Stepping to another day keeps this one on screen until it arrives.
    placeholderData: keepPreviousData,
  });

/** Warms the cache for the tabs the user has not opened yet. */
export function prefetchEssentials() {
  void queryClient.prefetchQuery({ queryKey: keys.habits, queryFn: fetchHabits });
  void queryClient.prefetchQuery({ queryKey: keys.today, queryFn: fetchToday });
}

/**
 * Refreshes these queries when the tab comes back into view — but only the
 * ones that went stale, so flipping between tabs costs nothing.
 */
export function useRefreshOnFocus(...queryKeys: QueryKey[]) {
  const first = useRef(true);
  const serialized = JSON.stringify(queryKeys);
  useFocusEffect(
    useCallback(() => {
      // The first focus is the mount, which useQuery already handles.
      if (first.current) {
        first.current = false;
        return;
      }
      for (const queryKey of JSON.parse(serialized) as QueryKey[]) {
        void queryClient.refetchQueries({ queryKey, stale: true, type: "active" });
      }
    }, [serialized]),
  );
}

/** Marks data as changed on the server, so every screen showing it refetches. */
export function invalidate(...queryKeys: QueryKey[]) {
  return Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
