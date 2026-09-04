# Dependencies

Recorded as required by PRD §73. Versions were chosen by checking the registry
and each package's peer requirements against React Native 0.87.1 / React 19.2.3,
not copied from the PRD's suggested list.

Target device for verification: **INFINIX X6728**, Android 15 (SDK 35),
MediaTek MT6768, arm64-v8a only.

## Selected versions

| Package | Version | Why it is here |
| --- | --- | --- |
| react-native | 0.87.1 | Project baseline. New Architecture, Hermes and edge-to-edge all enabled in `gradle.properties`. |
| react | 19.2.3 | Required by RN 0.87. |
| tamagui | 2.7.7 | Design system and token source (§4.0.3). |
| @tamagui/config | 2.7.7 | Supplies the `v5` preset (tokens, themes, fonts, media). |
| react-native-reanimated | 4.6.0 | Ring animation. Peer range `react-native 0.83 - 0.87` covers 0.87.1. |
| react-native-worklets | 0.12.1 | Reanimated 4 peer; also owns the Babel plugin. |
| react-native-svg | 15.15.5 | Icons, and the battery ring arc. |
| lucide-react-native | 1.40.0 | Icon set (see deviation 1). |
| @react-navigation/native | 7.3.18 | Latest stable major, per §4.2. |
| @react-navigation/bottom-tabs | 7.18.18 | Primary navigation (§42.1). |
| react-native-screens | 4.27.0 | Navigation peer. |
| react-native-safe-area-context | 5.5.2 | Edge-to-edge insets (§41.7). |
| zustand | 5.0.15 | Live telemetry store. |
| react-native-mmkv | 4.3.2 | Small preferences only (§4.0.6). |
| react-native-nitro-modules | 0.37.1 | MMKV 4 peer. |

## Deviations from the PRD's suggested stack

**1. `lucide-react-native` instead of `@tamagui/lucide-icons`.**
`@tamagui/lucide-icons` has no stable release -- latest is `2.0.0-rc.26`.
Installing it would violate the PRD's own rule §4.2 no. 1 (no prereleases).
§4.0.1 already permits `lucide-react-native` as the alternative. It requires
`react-native-svg`, which the battery ring then reuses.

**2. No Tamagui animation driver registered.**
The one animation in this deliverable (the battery ring) runs on Reanimated
directly, and press feedback works through `pressStyle` without a driver.
`@tamagui/animations-reanimated` is installed but unused; a driver gets wired in
when a component actually needs Tamagui-level animation.

**3. `styleCompat: 'react-native'`, `onlyAllowShorthands: false`.**
The v5 preset defaults to web-style prop names (`background`, not
`backgroundColor`) and shorthand-only styling. Overriding this keeps React
Native's vocabulary, so the components stay readable to any RN engineer (§4.0.2).

**4. Skia, victory-native, FlashList and NitroSQLite are not installed yet.**
§71's first deliverable has no chart, no long list and no history, so these four
native-heavy packages would have no work to do. They arrive with the History
spec. This keeps the install at 12 packages instead of ~25 and makes each Gradle
sync substantially faster.

**5. `@tamagui/config` is version 2.7.7, not "v5".**
The PRD's "@tamagui/config v5" refers to the `v5` *preset subpath*
(`@tamagui/config/v5`), which this version provides. The package itself is on
2.x, tracking `tamagui` 2.x.

## Native API notes

**`BATTERY_PROPERTY_CYCLE_COUNT` does not exist.** It is not in `android.jar` at
any API level. Android 14 (API 34) exposes cycle count as the broadcast extra
`BatteryManager.EXTRA_CYCLE_COUNT` instead. The provider reads that, and falls
back to sysfs `cycle_count` for older vendors.

**MMKV 4 replaced `new MMKV()` with `createMMKV()`**, and `delete(key)` with
`remove(key)`.

**6. Tamagui is imported through `src/design-system/tamagui.ts`, never the
`tamagui` barrel.** The barrel exports menu/popover/dialog, and
`@tamagui/popper` among them imports `react-dom`, which cannot resolve in a
React Native bundle (Metro fails outright). Importing `@tamagui/core`,
`@tamagui/stacks` and `@tamagui/scroll-view` directly avoids it and keeps the
bundle to what the app renders. Tamagui's `Button` came from the barrel too and
is replaced by an eight-line `ActionButton`.

## Metro resolver

`@tamagui/web` declares a `react-dom` peer that a React Native project cannot
satisfy, so npm installs a **nested copy for every dependent — 45 of them, with
no hoisted copy at all**. Multiple copies mean multiple Tamagui runtimes, and
theme lookups then miss the instance the provider registered:

```
Looked for theme (component: ScrollView), but no parent theme context was found
Tamagui: Using global config fallback. This may indicate duplicate tamagui instances
```

`npm dedupe` does not help, because the duplication comes from the unmet peer
rather than from version drift. `metro.config.js` resolves every
`@tamagui/web` request as if it originated from `@tamagui/core`, pinning the
bundle to one copy.

## Build configuration

`reactNativeArchitectures` is narrowed to `arm64-v8a` because the verification
device reports only that ABI. Restore the full list before building for an
emulator or for distribution.
