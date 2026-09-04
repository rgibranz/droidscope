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
| react-native-nitro-modules | 0.37.1 | MMKV 4 and NitroSQLite peer. |
| react-native-nitro-sqlite | 9.7.0 | Battery sample history (§4.0.6). |
| @shopify/react-native-skia | 2.11.2 | Chart rendering backend. |
| victory-native | 42.0.1 | Time-series charts (§4.0.5). |
| react-native-gesture-handler | 2.32.0 | Chart scrubbing (see deviation 7). |
| @shopify/flash-list | 2.3.2 | Sessions list (§42.4). |
| @react-navigation/native-stack | 7.18.10 | Settings → Diagnostics drill-down (§42.1). |

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

**4. Every PRD-suggested package is now installed, but each arrived only when
something needed it.** Skia, victory-native and NitroSQLite landed with History;
FlashList with the Sessions list. Holding them back kept the first deliverable
at 12 packages instead of ~25 and made each Gradle sync substantially faster.

**5. `@tamagui/config` is version 2.7.7, not "v5".**
The PRD's "@tamagui/config v5" refers to the `v5` *preset subpath*
(`@tamagui/config/v5`), which this version provides. The package itself is on
2.x, tracking `tamagui` 2.x.

**6. Tamagui is imported through `src/design-system/tamagui.ts`, never the
`tamagui` barrel.** The barrel exports menu/popover/dialog, and
`@tamagui/popper` among them imports `react-dom`, which cannot resolve in a
React Native bundle (Metro fails outright). Importing `@tamagui/core`,
`@tamagui/stacks` and `@tamagui/scroll-view` directly avoids it and keeps the
bundle to what the app renders. Tamagui's `Button` came from the barrel too and
is replaced by an eight-line `ActionButton`.

**7. `react-native-gesture-handler` is 2.32.0, not 3.x.** GH 3 ships its C++
shadow nodes at a very deep path:

```
node_modules/react-native-gesture-handler/shared/shadowNodes/react/renderer/
  components/rngesturehandler_codegen/RNGestureHandlerDetectorShadowNode.cpp
```

The resulting object filename is roughly 300 characters, and ninja rejects any
path over 260 with `Filename longer than 260 characters` — it applies that limit
to the string itself, so Windows' `LongPathsEnabled=1` (already on here) does not
help, and neither does shortening the build directory. GH 2.32.0's deepest C++
path is 78 characters and builds cleanly. `victory-native` declares
`react-native-gesture-handler >=2.0.0`, so 2.x is supported, not a workaround
around its requirements.

Revisit if the project moves to a much shorter path, or once GH flattens that
tree.

## Native API notes

**`BATTERY_PROPERTY_CYCLE_COUNT` does not exist.** It is not in `android.jar` at
any API level. Android 14 (API 34) exposes cycle count as the broadcast extra
`BatteryManager.EXTRA_CYCLE_COUNT` instead. The provider reads that, and falls
back to sysfs `cycle_count` for older vendors.

**MMKV 4 replaced `new MMKV()` with `createMMKV()`**, and `delete(key)` with
`remove(key)`. NitroSQLite opens with `open({ name })` and returns a synchronous
`execute`.

**No `foregroundServiceType` describes battery monitoring.** `dataSync`,
`location`, `mediaPlayback` and the rest all mean something else, so the service
declares `specialUse` with its reason stated in the manifest rather than
borrowing a type that would be untrue.

**No new dependency was added for file sharing.** React Native's Share API
carries text and URLs only; a ~50-line native module writes the CSV to app cache
and hands Android a `content://` URI through FileProvider, with no storage
permission (§33).

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
