# fromNowToSuccess — mobile

The Android/iOS app of [fromNowToSuccess](https://github.com/rayanMELZI/from-now-to-success),
the habit tracker where habits form a roadmap from "now" to "success" and each
habit's gauge fills toward validation.

It is a client of the same Spring Boot backend as the web app — same account,
same habits, same points. Nothing is stored only on the phone.

## Download

Get the latest `.apk` from the [Releases](../../releases/latest) page and open it
on your phone (Android 8 or newer). Android asks you to allow installing apps
from your browser or file manager.

**Updates itself.** The app checks GitHub's latest release when it opens (and
every few hours after), downloads the new APK and installs it. The first update
asks you to tap Update once in Android's dialog; after that, Android 12+
installs updates silently. It can be turned off in Settings › App updates.

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

## Releases

Releases are built by GitHub Actions (`.github/workflows/release.yml`), not on
a PC. To ship a version:

```bash
git tag v1.1.0
git push origin v1.1.0
```

The workflow stamps the version into `app.json` (versionCode = 1.1.0 → 10100),
generates the Android project, builds a signed APK and publishes it as a
release. Installed apps pick it up on their next check.

### Signing key

Release APKs are signed with `release.keystore` (project root, not committed),
its passwords in `keystore.properties`:

```properties
storeFile=release.keystore
storePassword=...
keyAlias=fnts
keyPassword=...
```

**Keep a backup of both files.** An installed app only accepts updates signed
with the same key — lose it and every user has to uninstall and reinstall.

The workflow reads the key from four repository secrets. Set them once with
`gh auth login` then `bash scripts/set-release-secrets.sh`, or by hand under
Settings › Secrets and variables › Actions:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_STORE_PASSWORD` | `storePassword` |
| `ANDROID_KEY_ALIAS` | `keyAlias` |
| `ANDROID_KEY_PASSWORD` | `keyPassword` |

### Building one locally

Needs JDK 17 and the Android SDK:

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease \
  -PFNTS_STORE_FILE=../../release.keystore -PFNTS_STORE_PASSWORD=... \
  -PFNTS_KEY_ALIAS=fnts -PFNTS_KEY_PASSWORD=...
```

## Checks

```bash
npx tsc --noEmit
npx expo lint
npx expo-doctor
```
