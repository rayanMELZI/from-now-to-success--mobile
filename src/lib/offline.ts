import { useSyncExternalStore } from "react";
import { loadJson, saveJson } from "./storage";
import type { UserInfo } from "./types";

/**
 * Whether the last request actually reached the server. The request layer is
 * the only source of truth: a phone can have Wi-Fi and still not reach the
 * backend (captive portal, server down), and that is "offline" for this app.
 */
let reachable = true;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (reachable === next) return;
  reachable = next;
  for (const listener of listeners) listener();
}

export const reportReachable = () => set(true);
export const reportUnreachable = () => set(false);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => reachable);
}

/* --------------------------------------------------------- offline identity */

const USER_KEY = "fnts.lastUser";

/**
 * The profile last shown on screen. The app opens straight onto it (and the
 * cached screens) while the session refreshes in the background. The session
 * itself lives in the native cookie store, never here.
 */
export const rememberUser = (user: UserInfo | null) => saveJson(USER_KEY, user);
export const recallUser = () => loadJson<UserInfo>(USER_KEY);
