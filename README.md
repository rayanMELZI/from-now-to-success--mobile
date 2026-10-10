# fromNowToSuccess — mobile

The Android/iOS app of [fromNowToSuccess](https://github.com/rayanMELZI/from-now-to-success),
the habit tracker where habits form a roadmap from "now" to "success" and each
habit's gauge fills toward validation.

It is a client of the same Spring Boot backend as the web app — same account,
same habits, same points. Nothing is stored only on the phone.

## Stack

- **Expo SDK 57** (React Native 0.86, React 19, TypeScript)
- **Expo Router** — file-based routes in `src/app/`, like the web app's App Router
- **react-native-svg** + **gesture-handler** + **reanimated** — the island map
  (pan / pinch-zoom), gauges, progress ring and history chart
- **expo-notifications** — the daily check-in reminder, scheduled on the phone
- **lucide-react-native** — the same icon set as the web app

## Layout

```
src/
  app/
    _layout.tsx          providers + signed-in / signed-out guard
    (auth)/              login, register
    (tabs)/              roadmap (index), check-in, plan, stats, settings
  components/            screens' building blocks (island map, habit form…)
    ui/                  primitives: Txt, Btn, Card, Sheet, Segmented, pickers…
  lib/
    api.ts               fetch wrapper: token refresh, offline cache
    auth.tsx             session state
    types.ts             shared with the web app (copied from frontend/src/lib)
    reminders.ts         local daily notifications
    theme.tsx            light/dark tokens (same palette as globals.css)
```

## Run it

```bash
npm install
npx expo start            # scan the QR code with Expo Go on your phone
```

By default the app talks to production (`https://fnts.rayanemelzi.dev`).
To use a local stack (`docker compose up` in the main repo), copy
`.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL`:

- Android emulator: `http://10.0.2.2:3000`
- Real phone on the same Wi-Fi: `http://<your-PC-LAN-IP>:3000`

## Build an APK

```bash
npx eas-cli@latest build -p android --profile preview   # cloud build, gives an .apk link
```

or locally (needs Android SDK + JDK 17):

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```
