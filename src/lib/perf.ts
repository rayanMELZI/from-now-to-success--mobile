import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Timing probe for test builds (EXPO_PUBLIC_PERF_LOG=1). Logs to logcat,
 * tag ReactNativeJS, lines starting with "[perf]":
 *   - startup: JS start → first screen drawn
 *   - tab <name>: tab tapped → that tab's next frame drawn
 * In every normal build it does nothing.
 */
const ON = process.env.EXPO_PUBLIC_PERF_LOG === "1";

let pressedAt = 0;
let startupLogged = false;

export function markTabPress() {
  if (ON) pressedAt = performance.now();
}

/** Call once in each tab screen. */
export function usePerfFocus(name: string) {
  useFocusEffect(
    useCallback(() => {
      if (!ON) return;
      const t0 = pressedAt;
      pressedAt = 0;
      requestAnimationFrame(() => {
        const now = performance.now();
        if (t0) console.log(`[perf] tab ${name} ${Math.round(now - t0)}ms`);
        else if (!startupLogged) {
          startupLogged = true;
          console.log(`[perf] startup ${name} ${Math.round(now)}ms`);
        }
      });
    }, [name]),
  );
}
