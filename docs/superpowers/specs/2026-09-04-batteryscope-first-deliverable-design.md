# BatteryScope — First Deliverable Design

**Date:** 2026-09-04
**Scope:** PRD §71 (first runnable build) only. History, analytics, charging
sessions, background monitoring and CSV export are separate specs.
**Verification device:** INFINIX X6728, Android 15 (SDK 35), MT6768, arm64-v8a.

---

## 1. What this deliverable is

A live Dashboard and a Diagnostics screen, both built on the production design
foundation, fed by real telemetry from a Kotlin TurboModule. Done means the
numbers on screen match `adb shell dumpsys battery`, unsupported metrics read as
unavailable rather than zero, and the calculation logic is unit tested.

## 2. Findings from the target device

Read via `adb shell` before any code was written:

| Node | Value | Meaning |
| --- | --- | --- |
| `current_now` | 244000 µA | available |
| `voltage_now` | 4407000 µV | 4.407 V, consistent with dumpsys 4396 mV |
| `charge_counter` | 4850000 µAh | available |
| `charge_full` | 5000000 µAh | equal to design capacity |
| `charge_full_design` | 5000000 µAh | |
| `cycle_count` | 351 | available |
| `temp` | 290 | 29.0 °C |

Two consequences drove the design:

**`charge_full` equals `charge_full_design` exactly, at 351 cycles.** A battery
that far into its life is not still at design capacity, so the vendor is
publishing a constant, not a measurement. Treating it as real would produce a
fake "100% health". The provider therefore reports `fullChargeCapacity` as
unavailable whenever the two values are identical.

**Those reads came from `adb shell`, not from an app process.** Shell has higher
privilege, and SELinux commonly blocks app access to `/sys/class/power_supply`
on Android 10+. sysfs is therefore a *probe* whose result is surfaced in
Diagnostics, never a silent fallback.

## 3. Architecture

```
Kotlin  BatteryTelemetryProvider     reads BatteryManager + ACTION_BATTERY_CHANGED,
        BatteryTelemetryModule       normalises units, probes capabilities.
              |                      No analytics here.
              v
TS      BatteryRepository / store    single door to native
              |
              +-- signCalibration    current-direction calibration, persisted per device
              +-- validate           conservative range rejection
              +-- units              conversion and formatting
              v
        Zustand store  ->  screens (Tamagui)
```

Rule: Kotlin computes nothing that TypeScript can compute. Not architectural
purity — the error-prone logic (sign handling, unit conversion) has to be
testable in Jest without a device.

## 4. Native contract

Codegen spec at `src/core/native/NativeBatteryTelemetry.ts`:

```
getSnapshot(): Promise<NativeSnapshot>
getCapabilities(): Promise<NativeCapabilities>
getDiagnostics(): Promise<NativeDiagnostics>
startMonitoring(intervalMs): Promise<void>
stopMonitoring(): Promise<void>
onTelemetry: EventEmitter<NativeSnapshot>
```

Three deviations from the PRD:

1. **`availability: Record<string, boolean>` (§9) replaced by an explicit
   struct.** Codegen does not handle free-key maps well. Same information,
   codegen-able shape — which is what §30 already describes.
2. **Capabilities are probed, not declared.** Each `BATTERY_PROPERTY_*` is read
   once and marked available only if the result is not `Integer.MIN_VALUE` /
   `Long.MIN_VALUE`, Android's sentinel for unsupported. This is what separates
   "unsupported" from "legitimately zero".
3. **sysfs is an explicit probe** whose success or failure appears in
   Diagnostics.

Plug/unplug is pushed by a `ACTION_BATTERY_CHANGED` receiver in addition to the
polling tick, so state changes appear immediately rather than at the next
interval.

## 5. TypeScript layer

Two models, deliberately distinct:

- `NativeSnapshot` — raw, as reported, `null` for unsupported.
- `BatteryReading` — sign-normalised, human units, what screens consume.

The split makes "never fabricate a value" structural: `powerW` cannot be
populated when either input is null.

`chargeStatus` and `plugType` are union literals rather than `string` (§9), so
mistyped values fail at compile time and switches can be checked for
exhaustiveness.

### Sign calibration

§11 asks for "many consistent observations" without a number. Concretely:

- A sample qualifies only when the status is unambiguous (charging or
  discharging) **and** `|currentUa| > 30000`. Near-zero current carries no
  direction and is the main source of wrong guesses.
- **10 consecutive qualifying samples** must agree. One disagreement resets the
  streak. Non-qualifying samples are skipped, not counted as disagreement.
- Persisted in MMKV under a key containing `Build.MODEL`, so a convention never
  carries across devices. Locked until reset from Diagnostics.

While uncalibrated, magnitude is trusted and direction comes from Android's
charge status, which is always reliable.

### Validation

Ranges from §18: voltage 2500–5000 mV, temperature −100…800 d°C,
`|current| < 20 A`, level 0–100. Out-of-range values become null.

"Unsupported" and "out of range" both surface as null in a `BatteryReading`, but
Diagnostics distinguishes them. Without that, debugging an unfamiliar vendor is
guesswork.

### UI state

`loading | ready | error` only. §40's `partialData` and `unsupported` were
dropped as screen states: availability is a property of each metric, not of the
screen. A device without a charge counter is `ready`; only that one card says
unavailable.

## 6. Design system

Tokens (`src/core/theme/tokens.ts`) carry the §41.3 spacing scale
(4/8/12/16/20/24/32/40/48), the radius family (12/16/20/26/pill), the §41.4 type
hierarchy, and a dark-first layered palette.

**Discharging is not red.** A draining battery is normal; red is reserved for
temperature above 45 °C and critical level. Charging state is always carried by
an icon and a written label as well as colour (§41.5).

Components built now: `AppScreen`, `BatteryHero`, `BatteryRing`, `MetricCard`,
`MetricSkeleton`, `DiagnosticRow`, `InlineNotice`, `SectionHeader`. The rest of
§42's list waits for the screens that need them — building components ahead of
their screens produces the wrong API.

`BatteryRing` uses react-native-svg plus Reanimated rather than Skia: svg is
already present for icons, so the hero gauge costs no extra dependency.

## 7. Verification

- Jest covers unit conversion, power calculation, sign calibration streaks,
  range rejection, and a snapshot where every optional metric is missing.
- Type check must be clean.
- On device: values match `dumpsys battery`; plugging and unplugging changes
  state; no metric shows a fabricated zero.

## 8. Questions answered on the device

All three unknowns were resolved by running the Diagnostics screen on the
INFINIX X6728:

| Question | Answer |
| --- | --- |
| Does BatteryManager report current on MT6768? | **Yes.** `CURRENT_NOW` and `CURRENT_AVERAGE` are both available. |
| Can an app process read sysfs? | **No.** Diagnostics reports "Path not present on this device" — `adb shell` can read it, the app cannot. sysfs is dead weight on this device, exactly as the probe design assumed. |
| Cycle count? | **351**, via `EXTRA_CYCLE_COUNT`, matching what sysfs reports to the shell. |

`ENERGY_COUNTER` is unsupported and `fullChargeCapacity` unavailable (sysfs
blocked), both shown as unavailable rather than filled with zero.

Values were cross-checked against `dumpsys battery`: level 100 = 100 %,
temperature 320 = 32.0 °C, voltage 4459 mV vs 4.460 V displayed (1 mV apart,
different sampling instants).

## 9. Design defect found by the device

At 100 % the Infinix reports `EXTRA_STATUS = charging` while
`CURRENT_NOW = -48800` — negative. A full battery stops accepting charge and
the system draws a little back out, so "charging" no longer implies current
flowing in.

The calibration rules as specified in section 5 would have treated those as
qualifying samples (unambiguous status, magnitude above threshold) and locked
the device to **reversed** permanently, inverting every current and power
reading from then on.

Fix: a sample only qualifies when the battery level is known and below
`MAX_CALIBRATION_LEVEL` (95 %). §11 alone was not sufficient; this rule came
from hardware, not from the PRD.

## 10. UI issues found on the device

- "Not plugged" overflowed a half-width metric card. Word values now render at
  section-title size rather than telemetry size (§41.4), with two-line wrap.
- Content scrolled behind the tab bar. `useBottomTabBarHeight()` now supplies
  the bottom padding, rather than a magic number (§41.7).

Light and dark were both checked on device; the light theme uses white cards on
a light grey ground, not an inverted dark theme.
