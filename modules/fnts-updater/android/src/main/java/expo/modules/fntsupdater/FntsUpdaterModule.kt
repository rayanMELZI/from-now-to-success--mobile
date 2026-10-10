package expo.modules.fntsupdater

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.os.bundleOf
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Installs the app's own updates from its GitHub releases: downloads the APK,
 * then hands it to Android's PackageInstaller. Once the app has installed
 * itself once, Android 12+ lets later updates through without a prompt.
 */
class FntsUpdaterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("FntsUpdater")

    Events("onProgress", "onStatus")

    OnCreate {
      UpdateReceiver.listener = { status, message ->
        sendEvent("onStatus", bundleOf("status" to status, "message" to message))
      }
    }

    OnDestroy {
      UpdateReceiver.listener = null
    }

    /** Whether the user allowed this app to install apps (Android 8+ asks per app). */
    Function("canRequestInstalls") {
      Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()
    }

    /** Opens the "Install unknown apps" switch for this app. */
    Function("openInstallSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }

    /** Runs off the main thread: the download, then the install session. */
    AsyncFunction("downloadAndInstall") { url: String ->
      val apk = File(context.cacheDir, "update.apk")
      download(url, apk)
      install(apk)
    }
  }

  private fun download(url: String, target: File) {
    val conn = URL(url).openConnection() as HttpURLConnection
    // GitHub answers asset URLs with an https redirect to its storage host.
    conn.instanceFollowRedirects = true
    conn.connectTimeout = 20_000
    conn.readTimeout = 30_000
    if (conn.responseCode !in 200..299) throw IllegalStateException("Download failed (HTTP ${conn.responseCode})")

    val total = conn.contentLengthLong
    var done = 0L
    var lastReported = -1
    conn.inputStream.use { input ->
      target.outputStream().use { output ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val read = input.read(buffer)
          if (read < 0) break
          output.write(buffer, 0, read)
          done += read
          if (total > 0) {
            val percent = (done * 100 / total).toInt()
            if (percent != lastReported) {
              lastReported = percent
              sendEvent("onProgress", bundleOf("fraction" to done.toDouble() / total))
            }
          }
        }
      }
    }
    conn.disconnect()
  }

  private fun install(apk: File) {
    val installer = context.packageManager.packageInstaller
    val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
      setAppPackageName(context.packageName)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
      }
    }
    val sessionId = installer.createSession(params)
    installer.openSession(sessionId).use { session ->
      session.openWrite("update.apk", 0, apk.length()).use { out ->
        apk.inputStream().use { it.copyTo(out) }
        session.fsync(out)
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or
        (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0)
      val callback = PendingIntent.getBroadcast(
        context,
        sessionId,
        Intent(context, UpdateReceiver::class.java).setPackage(context.packageName),
        flags,
      )
      session.commit(callback.intentSender)
    }
  }
}
