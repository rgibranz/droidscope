package com.batteryscope.telemetry

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule

@ReactModule(name = BatteryTelemetryModule.NAME)
class BatteryTelemetryModule(reactContext: ReactApplicationContext) :
  NativeBatteryTelemetrySpec(reactContext) {

  private val provider = BatteryTelemetryProvider(reactContext)
  private val handler = Handler(Looper.getMainLooper())

  private var intervalMs: Long = DEFAULT_INTERVAL_MS
  private var monitoring = false

  private val ticker =
    object : Runnable {
      override fun run() {
        if (!monitoring) return
        emitSnapshot()
        handler.postDelayed(this, intervalMs)
      }
    }

  /**
   * Plugging or unplugging must show up immediately rather than at the next
   * tick, so state changes are pushed by the broadcast in addition to polling.
   */
  private val batteryChangeReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (monitoring) emitSnapshot()
      }
    }

  override fun getName(): String = NAME

  private fun emitSnapshot() {
    try {
      emitOnTelemetry(provider.snapshot())
    } catch (t: Throwable) {
      // A failed emit must never take the app down; the next tick tries again.
    }
  }

  override fun getSnapshot(promise: Promise) {
    try {
      promise.resolve(provider.snapshot())
    } catch (t: Throwable) {
      promise.reject(ERR_SNAPSHOT, t.message, t)
    }
  }

  override fun getCapabilities(promise: Promise) {
    try {
      promise.resolve(provider.capabilities())
    } catch (t: Throwable) {
      promise.reject(ERR_CAPABILITIES, t.message, t)
    }
  }

  override fun getDiagnostics(promise: Promise) {
    try {
      promise.resolve(provider.diagnostics())
    } catch (t: Throwable) {
      promise.reject(ERR_DIAGNOSTICS, t.message, t)
    }
  }

  override fun startMonitoring(intervalMs: Double, promise: Promise) {
    try {
      this.intervalMs = intervalMs.toLong().coerceAtLeast(MIN_INTERVAL_MS)
      if (!monitoring) {
        monitoring = true
        reactApplicationContext.registerReceiver(
          batteryChangeReceiver,
          IntentFilter(Intent.ACTION_BATTERY_CHANGED),
        )
      }
      handler.removeCallbacks(ticker)
      handler.post(ticker)
      promise.resolve(null)
    } catch (t: Throwable) {
      monitoring = false
      promise.reject(ERR_MONITORING, t.message, t)
    }
  }

  override fun stopMonitoring(promise: Promise) {
    stopInternal()
    promise.resolve(null)
  }

  private fun stopInternal() {
    handler.removeCallbacks(ticker)
    if (monitoring) {
      monitoring = false
      try {
        reactApplicationContext.unregisterReceiver(batteryChangeReceiver)
      } catch (t: Throwable) {
        // Already unregistered; nothing to clean up.
      }
    }
  }

  override fun invalidate() {
    stopInternal()
    super.invalidate()
  }

  companion object {
    const val NAME = "BatteryTelemetry"
    private const val DEFAULT_INTERVAL_MS = 10_000L
    private const val MIN_INTERVAL_MS = 1_000L
    private const val ERR_SNAPSHOT = "E_SNAPSHOT"
    private const val ERR_CAPABILITIES = "E_CAPABILITIES"
    private const val ERR_DIAGNOSTICS = "E_DIAGNOSTICS"
    private const val ERR_MONITORING = "E_MONITORING"
  }
}
