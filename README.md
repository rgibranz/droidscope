# BatteryScope

Android battery telemetry app. React Native 0.87 + TypeScript, with a Kotlin
TurboModule for the actual battery reads.

Local-first: no account, no backend, no network. Battery data never leaves the
device unless you export it yourself.

**Guiding rule:** a trustworthy "Unavailable" beats a beautiful fake number. If
a device does not report a metric, the app says so instead of showing a zero.

---

## Requirements

```
Node.js 22.11+
JDK 17
Android Studio + Android SDK (platform 35+, CMake, NDK)
An Android 10+ device (arm64) with USB debugging
```

## First run

```bash
npm install
```

## Development

Two terminals, or run Metro in the background.

```bash
# 1. Start the bundler
npm start

# 2. Build and install the debug app
npm run android
```

Debug builds load JS from Metro, so Metro must be running. If the device cannot
reach it:

```bash
adb reverse tcp:8081 tcp:8081
```

### Gradle directly

`npm run android` wraps Gradle. To call it yourself (useful when you only want
to rebuild native code):

```bash
# Build and install debug
./android/gradlew.bat -p android installDebug

# Build only, no install
./android/gradlew.bat -p android assembleDebug
```

On macOS/Linux drop the `.bat`.

## Production build

Release builds bundle the JavaScript **into** the APK, so Metro is not needed —
the APK stands alone.

```bash
# APK, for installing directly on a phone
./android/gradlew.bat -p android assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk

# AAB, only if you are uploading to Play Store
./android/gradlew.bat -p android bundleRelease
# -> android/app/build/outputs/bundle/release/app-release.aab
```

Install it:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

The release APK is around 48 MB for arm64-v8a alone — Skia is most of that.

A built APK is committed under `dist/` so a working binary travels with the
source. See `dist/README.md` for what that build is and is not.

### Three things to know before shipping one

**1. Signing still uses the debug keystore.** This is the React Native template
default and it works — the APK installs fine. But it cannot go to Play Store,
and if you later switch to your own keystore you must uninstall first, because
the signature differs. That wipes stored history.

To use a real keystore:

```bash
keytool -genkeypair -v -storetype PKCS12 \
  -keystore batteryscope-release.keystore \
  -alias batteryscope -keyalg RSA -keysize 2048 -validity 10000
```

Put the credentials in `~/.gradle/gradle.properties` (never in the repo) and add
a `signingConfigs.release` block in `android/app/build.gradle`.

**2. Architectures are narrowed to arm64-v8a.** `android/gradle.properties` has:

```properties
reactNativeArchitectures=arm64-v8a
```

This cuts build time from ~16 minutes to ~3, and matches the verification device
(INFINIX X6728 reports only arm64-v8a). The APK will **not** run on a 32-bit
phone or an x86 emulator. Before distributing, restore:

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
```

**3. ProGuard is off** (`enableProguardInReleaseBuilds = false`). That is the RN
default and it is safe. Enabling it shrinks the APK but needs keep rules for
TurboModules and Nitro; do not turn it on unless APK size becomes a problem.

### When a native build misbehaves

CMake caches under `.cxx` go stale and produce errors that look unrelated to
your change — most memorably `ninja: error: manifest 'build.ninja' still dirty
after 100 tries`. Clear them:

```bash
# PowerShell
Remove-Item -Recurse -Force .\android\app\.cxx
Remove-Item -Recurse -Force .\node_modules\*\android\.cxx

# bash
rm -rf android/app/.cxx node_modules/*/android/.cxx
```

A full Gradle clean, when that is not enough:

```bash
./android/gradlew.bat -p android clean
```

## Checks

```bash
npm test              # 93 unit tests
npx tsc --noEmit      # type check
npx eslint . --ext .ts,.tsx
```

All three must be clean. Tests cover the calculation logic (§52): unit
conversion, power, current-sign calibration, range validation, chart bucketing,
repository mapping, session derivation, time estimates and CSV formatting.

## Project layout

```
src/
├── app/                  navigation
├── core/
│   ├── native/           TurboModule specs + mocks
│   ├── battery/          normalisation, sign calibration
│   ├── storage/          MMKV preferences
│   ├── theme/            Tamagui config and tokens
│   └── utils/            unit conversion, validation
├── data/
│   ├── models/           domain types
│   └── history/          SQLite schema, queries, sessions
├── design-system/        shared components
└── features/
    ├── battery-live/     Overview
    ├── history/          History
    ├── sessions/         Sessions
    ├── analytics/        estimates
    ├── settings/         Settings
    ├── diagnostics/      Diagnostics
    └── export/           CSV

android/app/src/main/java/com/batteryscope/telemetry/
    BatteryTelemetryProvider.kt   reads BatteryManager + broadcasts
    BatteryTelemetryModule.kt     TurboModule
    BatteryMonitorService.kt      foreground service (§20)
    BatteryScopeFilesModule.kt    CSV share
```

## Docs

- `docs/DEPENDENCIES.md` — chosen versions and every deviation from the PRD,
  with reasons
- `docs/superpowers/specs/` — design docs per phase, including the defects each
  phase found on real hardware
