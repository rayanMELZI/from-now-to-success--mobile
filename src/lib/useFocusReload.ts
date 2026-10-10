import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Tabs stay mounted, so "the page loaded" happens once. Reloading every time
 * a tab comes into view keeps it honest after work done on another tab (a
 * check-in from the plan, a habit added on the roadmap).
 */
export function useFocusReload(reload: () => Promise<unknown>, onError?: (err: unknown) => void) {
  useFocusEffect(
    useCallback(() => {
      reload().catch((err: unknown) => onError?.(err));
    }, [reload, onError]),
  );
}
