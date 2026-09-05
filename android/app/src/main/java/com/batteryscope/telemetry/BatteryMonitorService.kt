package com.batteryscope.telemetry

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.batteryscope.MainActivity
import com.batteryscope.R
import com.facebook.react.ReactApplication

/**
 * §20: optional background monitoring. Android will not let an app sample on a
 * schedule from the background without a foreground service and a visible
 * notification, so the notification is not decoration -- it is the price of the
 * feature, and it shows live telemetry so it is at least useful.
 *
 * The service owns the schedule (§19.1) but does not write to the database
 * itself; persistence stays in TypeScript where it is unit tested, and a second
 * writer in Kotlin would mean duplicating the schema.
 *
 * That only works while a JS runtime exists, which is not automatic: after
 * START_STICKY revives the process there is no Activity, and `reactHost` is a
 * lazy property nothing else would touch. `ensureJsRuntime` covers that -- it is
 * the difference between recording and merely appearing to.
 *
 * No wake locks are taken (§20): the sampling interval is minutes-scale and
 * missing a tick while the CPU sleeps is preferable to draining the battery
 * this app exists to measure.
 */
class BatteryMonitorService : Service() {

  private lateinit var provider: BatteryTelemetryProvider
  private val handler = Handler(Looper.getMainLooper())
  private var intervalMs = DEFAULT_INTERVAL_MS

  private val ticker =
    object : Runnable {
      override fun run() {
        ensureJsRuntime()
        val snapshot = provider.snapshot()
        BatteryTelemetryModule.emitFromService(snapshot)
        updateNotification()
        handler.postDelayed(this, intervalMs)
      }
    }

  /**
   * The database write happens in JavaScript, so a running service with no JS
   * runtime samples into the void: the notification keeps updating from native
   * values while nothing is recorded.
   *
   * That is the state after START_STICKY revives the process without an
   * Activity -- `reactHost` is a lazy property that only an Activity would
   * otherwise touch. Starting it here is what makes background recording real.
   */
  private fun ensureJsRuntime() {
    try {
      val host = (application as? ReactApplication)?.reactHost ?: return
      if (host.currentReactContext == null) {
        // Asynchronous; this tick's emit is likely dropped and the next one
        // lands. Losing one sample beats losing every sample.
        host.start()
      }
    } catch (t: Throwable) {
      // A service that cannot reach JS still shows correct live values in its
      // notification, so it must not crash here.
    }
  }

  override fun onCreate() {
    super.onCreate()
    provider = BatteryTelemetryProvider(this)
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    intervalMs =
      intent?.getLongExtra(EXTRA_INTERVAL_MS, DEFAULT_INTERVAL_MS)
        ?: DEFAULT_INTERVAL_MS

    startForeground(NOTIFICATION_ID, buildNotification(null))
    handler.removeCallbacks(ticker)
    handler.post(ticker)
    running = true

    // Restart if Android kills us for memory; the user asked for monitoring.
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(ticker)
    running = false
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  // ------------------------------------------------------------ notification

  private fun createChannel() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channel =
      NotificationChannel(
        CHANNEL_ID,
        "Battery monitoring",
        // LOW keeps it silent: this notification exists because Android
        // requires it, not because it has anything urgent to say.
        NotificationManager.IMPORTANCE_LOW,
      )
    channel.description = "Shows live battery telemetry while monitoring in the background."
    channel.setShowBadge(false)
    manager.createNotificationChannel(channel)
  }

  private fun updateNotification() {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(NOTIFICATION_ID, buildNotification(provider.summaryLine()))
  }

  private fun buildNotification(summary: String?): Notification {
    val openApp =
      PendingIntent.getActivity(
        this,
        0,
        Intent(this, MainActivity::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("BatteryScope monitoring active")
      .setContentText(summary ?: "Reading battery sensors…")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentIntent(openApp)
      .setOngoing(true)
      .setSilent(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  companion object {
    const val CHANNEL_ID = "batteryscope.monitoring"
    const val EXTRA_INTERVAL_MS = "intervalMs"
    private const val NOTIFICATION_ID = 1001
    private const val DEFAULT_INTERVAL_MS = 60_000L

    @Volatile var running: Boolean = false
      private set

    fun start(context: Context, intervalMs: Long) {
      val intent =
        Intent(context, BatteryMonitorService::class.java).putExtra(
          EXTRA_INTERVAL_MS,
          intervalMs,
        )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, BatteryMonitorService::class.java))
      running = false
    }
  }
}
