# BatteryScope — Analytics & Sessions Design

**Date:** 2026-09-04
**Scope:** PRD Phase 5 — derived metrics, time estimates, charging/discharging
sessions.
**Builds on:** the History spec.

---

## 1. Estimates are a union, not nullable fields

```ts
type Estimate =
  | { kind: 'unavailable'; reason: string }
  | { kind: 'ready'; hours; percentPerHour; confidence; basis }
```

An estimate either exists complete with its basis and confidence, or it does not
exist and says what it is waiting for. There is no shape in which a number
appears without the context needed to read it, which is what §2.2 and §31 are
really asking for.

`percentPerHour` is itself nullable inside the ready case: when the charge
counter produced the estimate but battery percentage has not moved, the rate in
%/h is genuinely unknown — deriving it from mAh would need a full-charge
capacity this device does not report.

## 2. Rules that came from the PRD, made concrete

| Rule | Implementation |
| --- | --- |
| §25 — enough data first | Under 5 minutes of usable window → `unavailable` |
| §24 — smooth over 10–30 min | 30-minute window, charge counter preferred |
| §48 — no infinite battery life | Level unchanged → "Battery level has not moved yet", never ∞ |
| §26 — charging is not linear | Above 80 % confidence is capped at `low` |
| §31 — confidence | ≥20 min high, ≥10 min medium, else low |

**Windows never straddle a plug event.** Only the trailing run of samples in the
same charge state is used. A window spanning a plug-in describes two different
behaviours and averaging it would describe neither.

**The charge counter is preferred but not trusted blindly.** If the counter does
not move — the Infinix reports a constant — the estimate silently falls back to
the level trend rather than dividing by zero or reporting nonsense.

## 3. Sessions are derived, not tracked

Sessions come from a SQL query over the samples table, not from a second table
maintained by a state machine.

Two reasons. A tracked session can be left hanging open when the process is
killed; a derived one cannot. And retention applies to sessions for free,
because they exist only as long as the samples behind them.

Sessionisation runs in SQLite: a window function marks a boundary wherever the
charge state flips **or a gap exceeds 5 minutes**, and a running sum turns those
marks into group ids. The gap rule matters because sampling stops when the app
closes — a silence is not evidence that charging continued, so the run is split
rather than papering over missing time.

Single-sample runs are discarded as noise. `energyAddedWh` is average power over
elapsed time and is labelled `(estimated)` in the UI, because that is what it is.

## 4. Recompute cadence

The estimate recomputes once a minute, not on every telemetry tick. The window
behind it is 30 minutes long, so recalculating every 10 seconds would cost a
database read to move the answer by nothing (§63).

## 5. Verified on device

- Battery at 100 % while charging → **"Battery is full"**, not a fabricated
  "0m to full".
- Forced discharging with no usable history → **"Collecting usage data…"**,
  not a placeholder number.
- Sessions screen showed a real 25-minute charging session derived from stored
  samples: avg +0.19 W, peak +1.58 W, peak temp 33.0 °C, ≈0.08 Wh (estimated).
- Discharging hero renders in the neutral accent with a down-arrow icon and a
  written label — never colour alone (§41.5).
