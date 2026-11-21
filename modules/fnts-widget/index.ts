import { requireOptionalNativeModule, type NativeModule } from "expo";

declare class FntsWidgetModule extends NativeModule {
  setPlan(json: string): void;
  clear(): void;
}

/**
 * The Android home-screen widget, or null where it does not exist (iOS,
 * Expo Go, the web) — the app then simply has nothing to keep in sync.
 */
export default requireOptionalNativeModule<FntsWidgetModule>("FntsWidget");
