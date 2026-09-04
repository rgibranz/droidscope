# BatteryScope — History Design

**Date:** 2026-09-04
**Scope:** PRD Phase 4 — sampling to storage, retention, downsampling, and the
History screen with interactive charts.
**Builds on:** `2026-09-04-batteryscope-first-deliverable-design.md`

---

## 1. Storage

One table, one index (§21):

```sql
samples(id, timestamp, level_percent, voltage_mv, current_ua, power_w,
        temperature_c, charge_counter_uah, is_charging, charge_status,
        plug_type, screen_on)
CREATE INDEX idx_samples_timestamp ON samples (timestamp)
```

Values are stored in **platform units** (mV, µA), not display units, so the
database keeps what the device reported and formatting stays a UI concern.

`screen_on` is nullable and currently always NULL. Screen-state tracking (§29)
is not implemented, and writing `0` would claim the screen was off — a
fabricated value, which §2.1 forbids. NULL correctly means "not known".

A reading with no battery level at all is not stored: there is nothing to plot.

## 2. Sampling

The live store already receives telemetry every 10 s plus an immediate event on
every plug/unplug broadcast. Writes are **throttled to the sampling interval**,
because a burst of broadcasts (which is what connecting a cable produces) would
otherwise inflate the database for no extra information (§19, §63).

The throttle resets when monitoring starts, so a fresh session writes its first
sample immediately instead of waiting out a stale timer.

A storage failure sets `historyError` and is otherwise swallowed: §35 requires
that the live view keeps working when persistence does not.

## 3. Retention

§22's options (24 h / 3 d / 7 d / 30 d / unlimited) live in MMKV, default 7 days.
Purging runs once when monitoring starts. Sampling then keeps the window
rolling; there is no timer, because the app cannot sample in the background yet
anyway (that is Phase 6).

## 4. Downsampling

§45 is explicit: tens of thousands of raw points must never reach the chart.
Aggregation happens **in SQL**, so the data transferred is proportional to what
is drawn rather than to what is stored:

```sql
SELECT (timestamp / :bucket) * :bucket AS bucket_start,
       AVG(level_percent), AVG(power_w), AVG(current_ua), AVG(temperature_c),
       COUNT(*)
FROM samples WHERE timestamp BETWEEN :from AND :to
GROUP BY bucket_start ORDER BY bucket_start
```

Bucket widths come from a fixed ladder (10 s … 6 h) rather than an exact
division, so buckets land on recognisable boundaries and stay stable as a range
moves. Target is ~300 points; the tests assert every offered range lands between
60 and 300 points.

| Range | Bucket | Points |
| --- | --- | --- |
| 1H | 30 s | 120 |
| 6H | 2 min | 180 |
| 24H | 5 min | 288 |
| 7D | 1 h | 168 |

## 5. Charts

`victory-native` on Skia, one chart per metric: level, power, current,
temperature.

- Battery level uses a **fixed 0–100 domain** (§45) so a 2 % dip does not look
  like a cliff. The other metrics use a padded dynamic domain.
- A null bucket is a real gap and is **dropped**, never plotted as zero.
- Scrubbing uses `useChartPressState`; the readout is copied to React state
  through `useAnimatedReaction` only when the value changes.
- **Axis labels are not drawn by Skia.** Skia axis text requires a bundled font
  file, and §45 wants the key numbers to exist as real text outside the graph
  regardless. The scale and time span are rendered as Tamagui text, which also
  respects the user's font size setting.

## 6. Summary block

§45 says charts must not be the only place key information lives. Above the
charts, a summary card shows level change, average / min / max power, and the
sample count, with an accessibility label that states the same in a sentence.

Below the sample threshold the charts say "Collecting enough history to plot
this range…" rather than rendering an empty axis (§41.11).

## 7. Refresh

History reloads on mount and on `AppState` returning to `active`. No polling:
§19.1 keeps the JS layer passive, and history only advances as fast as the
sampling interval.

## 8. Testing

Pure functions and the repository's SQL/mapping are covered without a device:
bucket ladder behaviour across every range, unit round-tripping on insert, NULL
preservation, µA→mA conversion on read, purge counts, the write throttle, and
that a storage failure leaves live telemetry `ready`.

Real-device verification covers what tests cannot: that samples actually
accumulate, survive a restart, and render.
