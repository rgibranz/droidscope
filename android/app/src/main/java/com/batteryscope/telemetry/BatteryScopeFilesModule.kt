package com.batteryscope.telemetry

import android.content.Intent
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.annotations.ReactModule
import java.io.File

/**
 * Writes an export to app cache and hands Android a content:// URI for it.
 *
 * The React Native Share API carries text and URLs only, so a file export needs
 * this much native code. §33: no storage permission is requested -- the file
 * lives in the app's own cache and the share sheet grants read access to
 * whichever app the user picks, for that share only.
 */
@ReactModule(name = BatteryScopeFilesModule.NAME)
class BatteryScopeFilesModule(reactContext: ReactApplicationContext) :
  NativeBatteryScopeFilesSpec(reactContext) {

  override fun getName(): String = NAME

  override fun shareCsv(fileName: String, content: String, promise: Promise) {
    try {
      val context = reactApplicationContext
      val dir = File(context.cacheDir, EXPORT_DIR).apply { mkdirs() }

      // Only the basename is used: a caller-supplied path must not be able to
      // write outside the export directory.
      val safeName = File(fileName).name
      val file = File(dir, safeName)
      file.writeText(content)

      val uri =
        FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)

      val share =
        Intent(Intent.ACTION_SEND).apply {
          type = "text/csv"
          putExtra(Intent.EXTRA_STREAM, uri)
          putExtra(Intent.EXTRA_SUBJECT, safeName)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

      val chooser =
        Intent.createChooser(share, "Export battery history").apply {
          // Started from a module, not an Activity, so it needs its own task.
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

      context.startActivity(chooser)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject(ERR_EXPORT, t.message, t)
    }
  }

  companion object {
    const val NAME = "BatteryScopeFiles"
    private const val EXPORT_DIR = "exports"
    private const val ERR_EXPORT = "E_EXPORT"
  }
}
