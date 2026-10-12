import { useSyncExternalStore } from "react";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import FntsUpdater from "../../modules/fnts-updater";
import { loadJson, saveJson } from "./storage";

/**
 * Self-updates from GitHub releases, the way the Game Time Limiter app does:
 * ask GitHub for the latest release, compare its tag with this build's
 * version, download the APK and hand it to Android's installer. The first
 * update needs one tap on Android's dialog; on Android 12+ the later ones
 * install without asking.
 */

const LATEST = "https://api.github.com/repos/rayanMELZI/from-now-to-success--mobile/releases/latest";
const CHECK_EVERY_MS = 3 * 60 * 60 * 1000;
const AUTO_KEY = "fnts.autoUpdate";

export const CURRENT_VERSION = Constants.expoConfig?.version ?? "0.0.0";
/** Only installed release builds update themselves — not dev, not iOS. */
export const UPDATES_SUPPORTED = Platform.OS === "android" && !__DEV__;
export const CAN_SELF_INSTALL = FntsUpdater !== null;

export interface Release {
  version: string;
  apkUrl: string;
  notes: string;
  pageUrl: string;
}

export interface UpdateState {
  checking: boolean;
  latest: Release | null;
  phase: "idle" | "downloading" | "installing" | "waiting" | "failed";
  progress: number;
  error: string | null;
  checkedAt: number | null;
}

let state: UpdateState = {
  checking: false,
  latest: null,
  phase: "idle",
  progress: 0,
  error: null,
  checkedAt: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<UpdateState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}

export function useUpdateState(): UpdateState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** "1.10.0" > "1.9.2" */
export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export const autoUpdateEnabled = () => loadJson<boolean>(AUTO_KEY) !== false;
export const setAutoUpdate = (on: boolean) => saveJson(AUTO_KEY, on);

/**
 * Asks GitHub for the latest release. Throttled to once every few hours
 * unless `force` (the Settings button). Returns the release when it is newer.
 */
export async function checkForUpdate(force = false): Promise<Release | null> {
  if (state.checking) return state.latest;
  if (!force && state.checkedAt && Date.now() - state.checkedAt < CHECK_EVERY_MS) return state.latest;
  set({ checking: true, error: null });
  try {
    const res = await fetch(LATEST, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
    const json = (await res.json()) as {
      tag_name: string;
      body?: string;
      html_url: string;
      assets: { name: string; browser_download_url: string }[];
    };
    const apk = json.assets.find((a) => a.name.endsWith(".apk"));
    const version = json.tag_name.replace(/^v/, "");
    const release =
      apk && isNewer(version, CURRENT_VERSION)
        ? { version, apkUrl: apk.browser_download_url, notes: json.body ?? "", pageUrl: json.html_url }
        : null;
    set({ checking: false, latest: release, checkedAt: Date.now() });
    return release;
  } catch {
    set({ checking: false, error: "Couldn't check for updates." });
    return null;
  }
}

/** Downloads and installs the latest release (or opens it in the browser). */
export async function installUpdate(): Promise<void> {
  const release = state.latest ?? (await checkForUpdate(true));
  if (!release) return;

  if (!FntsUpdater) {
    await Linking.openURL(release.apkUrl);
    return;
  }

  if (!FntsUpdater.canRequestInstalls()) {
    set({
      phase: "failed",
      error: "Allow this app to install updates (the switch that just opened), then tap Update again.",
    });
    FntsUpdater.openInstallSettings();
    return;
  }

  const progress = FntsUpdater.addListener("onProgress", ({ fraction }) =>
    set({ progress: fraction, phase: fraction >= 1 ? "installing" : "downloading" }),
  );
  const status = FntsUpdater.addListener("onStatus", ({ status: s, message }) => {
    if (s === "waiting") set({ phase: "waiting" });
    else if (s === "failed") set({ phase: "failed", error: message ?? "The update could not be installed." });
    if (s !== "waiting") {
      progress.remove();
      status.remove();
    }
  });

  set({ phase: "downloading", progress: 0, error: null });
  try {
    await FntsUpdater.downloadAndInstall(release.apkUrl);
    // Android takes it from here: success restarts the app on the new version.
    if (state.phase === "downloading") set({ phase: "installing" });
  } catch (err) {
    progress.remove();
    status.remove();
    set({ phase: "failed", error: err instanceof Error ? err.message : "The download failed." });
  }
}
