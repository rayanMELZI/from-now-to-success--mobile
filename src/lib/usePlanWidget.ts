import { useEffect } from "react";
import { AppState } from "react-native";
import { useUser } from "./auth";
import { fetchPlanDay, keys } from "./queries";
import { queryClient } from "./queryClient";
import type { PlanDay } from "./types";
import { HAS_WIDGET, pushPlanToWidget, pushPlannerOffToWidget } from "./widget";

const isPlanDay = (data: unknown): data is PlanDay =>
  typeof data === "object" && data !== null && "blocks" in data && "today" in data;

/**
 * Keeps the home-screen widget on today's plan while signed in: every time
 * the plan lands in the cache — fetched, ticked off, edited, shifted — the
 * widget gets the new copy. Coming back to the app refreshes it too, even
 * when the Plan tab is on another day.
 */
export function usePlanWidget() {
  const { plannerEnabled, dayEndHour } = useUser();

  useEffect(() => {
    if (!HAS_WIDGET) return;
    if (!plannerEnabled) {
      pushPlannerOffToWidget(dayEndHour);
      return;
    }

    const cached = queryClient.getQueryData(keys.plan(null));
    if (isPlanDay(cached)) pushPlanToWidget(cached, dayEndHour);

    // Any plan query counts: a day picked by date can be today as well.
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.query.queryKey[0] !== keys.plan(null)[0]) return;
      const data: unknown = event.query.state.data;
      if (isPlanDay(data)) pushPlanToWidget(data, dayEndHour);
    });

    // Fresh data is kept 30 s, so this only hits the network when it is due.
    const refresh = () =>
      void queryClient.prefetchQuery({ queryKey: keys.plan(null), queryFn: () => fetchPlanDay(null) });
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });

    return () => {
      unsubscribe();
      sub.remove();
    };
  }, [plannerEnabled, dayEndHour]);
}
