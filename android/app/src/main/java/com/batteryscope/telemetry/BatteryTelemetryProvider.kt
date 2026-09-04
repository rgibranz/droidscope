package com.batteryscope.telemetry

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.File

/**
 * Reads battery telemetry and normalises units. Deliberately contains no
 * analytics: everything that can be computed in TypeScript is computed there,
 * where it can be unit tested without a device.
 *
 * Android returns Integer.MIN_VALUE / Long.MIN_VALUE from BatteryManager for
 * properties a device does not support. That sentinel -- not the value 0 -- is
 * the only thing that means "unsupported".
 */
class BatteryTelemetryProvider(private val context: Context) {

  private val batteryManager: BatteryManager? =
    context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager

  private val sysfsRoot = File("/sys/class/power_supply/battery")

  // ---------------------------------------------------------------- reads

  private fun intProperty(id: Int): Int? {
    val bm = batteryManager ?: return null
    return try {
      val value = bm.getIntProperty(id)
      if (value == Int.MIN_VALUE) null else value
    } catch (t: Throwable) {
      null
    }
  }

  private fun longProperty(id: Int): Long? {
    val bm = batteryManager ?: return null
    return try {
      val value = bm.getLongProperty(id)
      if (value == Long.MIN_VALUE) null else value
    } catch (t: Throwable) {
      null
    }
  }

  fun batteryIntent(): Intent? =
    try {
      context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    } catch (t: Throwable) {
      null
    }

  /** Broadcast extras are optional; a missing extra is null, not zero. */
  private fun intExtra(intent: Intent?, key: String): Int? {
    if (intent == null) return null
    if (!intent.hasExtra(key)) return null
    val value = intent.getIntExtra(key, Int.MIN_VALUE)
    return if (value == Int.MIN_VALUE) null else value
  }

  /**
   * Reading sysfs from an ordinary app process is frequently blocked by SELinux
   * on modern Android even though "adb shell" can read the same file. Treated as
   * a probe whose result is surfaced in Diagnostics, never as a silent fallback.
   */
  private fun readSysfs(name: String): String? =
    try {
      val file = File(sysfsRoot, name)
      if (file.canRead()) {
        val text = file.readText().trim()
        if (text.isEmpty()) null else text
      } else {
        null
      }
    } catch (t: Throwable) {
      null
    }

  private fun sysfsLong(name: String): Long? = readSysfs(name)?.toLongOrNull()

  // ------------------------------------------------------------- snapshot

  fun snapshot(): WritableMap {
    val intent = batteryIntent()
    val map = Arguments.createMap()

    map.putDouble("timestamp", System.currentTimeMillis().toDouble())

    val level = intExtra(intent, BatteryManager.EXTRA_LEVEL)
    val scale = intExtra(intent, BatteryManager.EXTRA_SCALE)
    val levelPercent =
      if (level != null && scale != null && scale > 0) {
        level * 100 / scale
      } else {
        intProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
      }
    map.putNullableInt("levelPercent", levelPercent)

    map.putNullableInt("voltageMv", intExtra(intent, BatteryManager.EXTRA_VOLTAGE))
    map.putNullableInt("currentUa", intProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW))
    map.putNullableInt(
      "currentAvgUa",
      intProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE),
    )
    map.putNullableInt("temperatureDeciC", intExtra(intent, BatteryManager.EXTRA_TEMPERATURE))
    map.putNullableInt(
      "chargeCounterUah",
      intProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER),
    )
    map.putNullableLong(
      "energyCounterNwh",
      longProperty(BatteryManager.BATTERY_PROPERTY_ENERGY_COUNTER),
    )
    map.putNullableInt("cycleCount", cycleCount(intent))
    map.putNullableInt("healthCode", intExtra(intent, BatteryManager.EXTRA_HEALTH))
    map.putNullableInt("statusCode", intExtra(intent, BatteryManager.EXTRA_STATUS))
    map.putNullableInt("pluggedCode", intExtra(intent, BatteryManager.EXTRA_PLUGGED))

    val technology = intent?.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)
    if (technology == null || technology.isEmpty()) {
      map.putNull("technology")
    } else {
      map.putString("technology", technology)
    }

    map.putBoolean(
      "present",
      intent?.getBooleanExtra(BatteryManager.EXTRA_PRESENT, true) ?: true,
    )
    return map
  }

  /**
   * There is no BATTERY_PROPERTY for cycle count. Android 14 exposes it as a
   * broadcast extra instead, and vendors that predate it sometimes publish it
   * through sysfs.
   */
  private fun cycleCount(intent: Intent?): Int? {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val fromExtra = intExtra(intent, BatteryManager.EXTRA_CYCLE_COUNT)
      if (fromExtra != null) return fromExtra
    }
    return sysfsLong("cycle_count")?.toInt()
  }

  /**
   * One line for the foreground-service notification (§20), e.g.
   * "82% - -2.80 W - 34.8C". Metrics the device does not report are simply left
   * out rather than shown as zero.
   */
  fun summaryLine(): String {
    val intent = batteryIntent()
    val parts = mutableListOf<String>()

    val level = intExtra(intent, BatteryManager.EXTRA_LEVEL)
    val scale = intExtra(intent, BatteryManager.EXTRA_SCALE)
    if (level != null && scale != null && scale > 0) {
      parts.add("${level * 100 / scale}%")
    }

    val voltageMv = intExtra(intent, BatteryManager.EXTRA_VOLTAGE)
    val currentUa = intProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)
    if (voltageMv != null && currentUa != null) {
      val watts = (voltageMv / 1000.0) * (currentUa / 1_000_000.0)
      parts.add(String.format("%.2f W", watts))
    }

    val tempDeci = intExtra(intent, BatteryManager.EXTRA_TEMPERATURE)
    if (tempDeci != null) {
      parts.add(String.format("%.1f°C", tempDeci / 10.0))
    }

    return if (parts.isEmpty()) "Reading battery sensors…" else parts.joinToString(" • ")
  }

  // --------------------------------------------------------- capabilities

  fun capabilities(): WritableMap {
    val intent = batteryIntent()
    val map = Arguments.createMap()

    map.putBoolean(
      "levelPercent",
      intExtra(intent, BatteryManager.EXTRA_LEVEL) != null ||
        intProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) != null,
    )
    map.putBoolean("voltage", intExtra(intent, BatteryManager.EXTRA_VOLTAGE) != null)
    map.putBoolean("temperature", intExtra(intent, BatteryManager.EXTRA_TEMPERATURE) != null)
    map.putBoolean(
      "currentNow",
      intProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW) != null,
    )
    map.putBoolean(
      "currentAverage",
      intProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE) != null,
    )
    map.putBoolean(
      "chargeCounter",
      intProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER) != null,
    )
    map.putBoolean(
      "energyCounter",
      longProperty(BatteryManager.BATTERY_PROPERTY_ENERGY_COUNTER) != null,
    )
    map.putBoolean("cycleCount", cycleCount(intent) != null)

    val chargeFull = sysfsLong("charge_full")
    val chargeFullDesign = sysfsLong("charge_full_design")
    // A vendor reporting charge_full identical to charge_full_design is
    // reporting a constant, not a measurement. Trusting it would produce a fake
    // "100% health" on any aged battery.
    map.putBoolean("fullChargeCapacity", chargeFull != null && chargeFull != chargeFullDesign)
    map.putBoolean("designCapacity", chargeFullDesign != null)
    return map
  }

  // ---------------------------------------------------------- diagnostics

  fun diagnostics(): WritableMap {
    val map = Arguments.createMap()
    map.putString("manufacturer", Build.MANUFACTURER ?: "unknown")
    map.putString("model", Build.MODEL ?: "unknown")
    map.putString("device", Build.DEVICE ?: "unknown")
    map.putString("androidRelease", Build.VERSION.RELEASE ?: "unknown")
    map.putInt("sdkInt", Build.VERSION.SDK_INT)
    map.putString("hardware", Build.HARDWARE ?: "unknown")

    val probe = readSysfs("voltage_now")
    map.putBoolean("sysfsReadable", probe != null)
    map.putString(
      "sysfsNote",
      if (probe != null) {
        "Readable from the app process"
      } else if (sysfsRoot.exists()) {
        "Path exists but is not readable by this app (likely SELinux)"
      } else {
        "Path not present on this device"
      },
    )

    map.putArray("raw", rawEntries())
    return map
  }

  private fun rawEntries(): WritableArray {
    val intent = batteryIntent()
    val entries = Arguments.createArray()

    fun add(key: String, value: Any?, source: String) {
      val entry = Arguments.createMap()
      entry.putString("key", key)
      entry.putString("value", value?.toString() ?: "unsupported")
      entry.putString("source", source)
      entries.pushMap(entry)
    }

    add("EXTRA_LEVEL", intExtra(intent, BatteryManager.EXTRA_LEVEL), "broadcast")
    add("EXTRA_SCALE", intExtra(intent, BatteryManager.EXTRA_SCALE), "broadcast")
    add("EXTRA_VOLTAGE", intExtra(intent, BatteryManager.EXTRA_VOLTAGE), "broadcast")
    add("EXTRA_TEMPERATURE", intExtra(intent, BatteryManager.EXTRA_TEMPERATURE), "broadcast")
    add("EXTRA_STATUS", intExtra(intent, BatteryManager.EXTRA_STATUS), "broadcast")
    add("EXTRA_HEALTH", intExtra(intent, BatteryManager.EXTRA_HEALTH), "broadcast")
    add("EXTRA_PLUGGED", intExtra(intent, BatteryManager.EXTRA_PLUGGED), "broadcast")
    add(
      "PROPERTY_CAPACITY",
      intProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY),
      "BatteryManager",
    )
    add(
      "PROPERTY_CURRENT_NOW",
      intProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW),
      "BatteryManager",
    )
    add(
      "PROPERTY_CURRENT_AVERAGE",
      intProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE),
      "BatteryManager",
    )
    add(
      "PROPERTY_CHARGE_COUNTER",
      intProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER),
      "BatteryManager",
    )
    add(
      "PROPERTY_ENERGY_COUNTER",
      longProperty(BatteryManager.BATTERY_PROPERTY_ENERGY_COUNTER),
      "BatteryManager",
    )
    add("EXTRA_CYCLE_COUNT", cycleCount(intent), "broadcast/sysfs")

    val sysfsNames =
      listOf(
        "current_now",
        "voltage_now",
        "charge_counter",
        "charge_full",
        "charge_full_design",
        "cycle_count",
        "temp",
        "status",
      )
    for (name in sysfsNames) {
      add("sysfs/" + name, readSysfs(name), "sysfs")
    }
    return entries
  }
}

private fun WritableMap.putNullableInt(key: String, value: Int?) {
  if (value == null) putNull(key) else putDouble(key, value.toDouble())
}

private fun WritableMap.putNullableLong(key: String, value: Long?) {
  if (value == null) putNull(key) else putDouble(key, value.toDouble())
}
