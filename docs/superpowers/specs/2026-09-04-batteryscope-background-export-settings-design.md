# BatteryScope — Background Monitoring, Export & Settings

**Date:** 2026-09-04
**Scope:** PRD Phases 6–8 plus the Settings screen the MVP list (§57) requires.

---

## 1. Background monitoring (§20)

A foreground service owns the sampling schedule (§19.1). The notification is not
decoration — Android will not allow scheduled background work without one — so
it earns its place by showing live telemetry:

```
BatteryScope monitoring active
100% • 0.81 W • 32.0°C
```

Channel importance is LOW and the notification is silent and badge-free: it
exists because Android requires it, not because it has anything urgent to say.

**The service does not write to the database itself.** React Native keeps the JS
runtime alive for the life of the process, and the foreground service is what
keeps the process alive, so the existing TypeScript persistence path keeps
working. Duplicating the schema into Kotlin would buy nothing and risk two
writers on one file. Samples are pushed through the same `onTelemetry` event the
app already listens to; if JS is gone the emit is dropped and the notification
still shows live values.

**No wake locks** (§20). The interval is minutes-scale, and missing a tick while
the CPU sleeps is better than draining the battery this app exists to measure.

**Foreground service type is `specialUse`.** None of the defined types describes
"watch the battery" — `dataSync`, `location` and the rest all mean something
else. The manifest states the reason rather than borrowing a type that would
pass review while being untrue.

`START_STICKY` restarts the service if Android reclaims it, and the enabled flag
in MMKV restores monitoring after an app restart — but only when the service is
not already running, which `isBackgroundMonitoringActive()` checks first.

### Verified on device

Backgrounded for 140 seconds, sample count rose 244 → 249 — one every ~28
seconds, matching the 30-second background interval rather than the 10-second
foreground one. The schedule really is the service's. Toggling the setting off
stopped the service cleanly (§56).

## 2. CSV export (§32)

The React Native Share API carries text and URLs only, so writing the file and
handing Android a `content://` URI needs native code. That is the whole of
`BatteryScopeFilesModule` — no new dependency for it (§4.0.2).

§33 is respected: no storage permission. The file is written to the app's own
cache and the share sheet grants read access to the chosen app for that share
alone. FileProvider is scoped to the export directory, nothing else. Only the
basename of a caller-supplied filename is used, so a path cannot escape it.

**An unsupported metric is an empty CSV field, not a zero.** Anyone importing
the file must be able to tell "no reading" from "a reading of zero" — the same
distinction §9 makes in the data model.

## 3. Settings (§7.6, §42.5)

Grouped, not one long form: Appearance, Monitoring, History, Data, Diagnostics,
About. Diagnostics moved under Settings via a native stack push, which is where
§42.1 puts it once Settings exists.

The notification permission is requested at the moment background monitoring is
switched on, not at launch — the user sees why it is being asked.

## 4. A defect this phase found

The Settings screen showed "238 samples stored" while History showed 249. The
count was computed once during render and never recomputed, so it silently went
stale while other tabs were open. A number that is quietly wrong is the failure
mode §2.1 is about, even when it is only a count. It is now recomputed with
`useFocusEffect` whenever the screen comes into view.

## 5. Phase 8 status

Unit coverage is 93 tests across conversions, power, sign calibration,
validation, bucketing, repository mapping, sessions, estimates and CSV. Every
phase was verified on the INFINIX X6728 as it landed, cross-checked against
`dumpsys battery`.

Accessibility work carried through the build rather than being bolted on at the
end: labels on hero, metric cards, session cards and chart summaries; state
conveyed by icon and text as well as colour; reduced-motion respected by the
battery ring; scale and time span rendered as real text outside the charts so
they scale with the user's font size.

Not done: a measured frame-rate pass on a mid-range device, and screen-state
tracking (§29), which would let drain be split into screen-on and screen-off.
