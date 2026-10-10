import { requireOptionalNativeModule, type NativeModule } from "expo";

export type UpdaterEvents = {
  onProgress: (event: { fraction: number }) => void;
  onStatus: (event: { status: "waiting" | "success" | "failed"; message: string | null }) => void;
};

declare class FntsUpdaterModule extends NativeModule<UpdaterEvents> {
  canRequestInstalls(): boolean;
  openInstallSettings(): void;
  downloadAndInstall(url: string): Promise<void>;
}

/**
 * The native installer, or null where it does not exist (iOS, Expo Go) — the
 * app then falls back to opening the APK link in the browser.
 */
export default requireOptionalNativeModule<FntsUpdaterModule>("FntsUpdater");
