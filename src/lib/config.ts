/**
 * The backend this build talks to. Production by default; point a dev build at
 * a local stack with EXPO_PUBLIC_API_URL (e.g. http://10.0.2.2:3000 from the
 * Android emulator, or your PC's LAN address from a real phone).
 */
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "https://fnts.rayanemelzi.dev"
).replace(/\/+$/, "");
