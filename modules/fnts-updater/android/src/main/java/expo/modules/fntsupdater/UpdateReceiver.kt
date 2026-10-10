package expo.modules.fntsupdater

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

/**
 * Where Android reports how an install session went. The first update needs
 * the user to confirm, so that one opens the system dialog; success simply
 * replaces the running app.
 */
class UpdateReceiver : BroadcastReceiver() {
  companion object {
    var listener: ((status: String, message: String?) -> Unit)? = null
  }

  override fun onReceive(context: Context, intent: Intent) {
    val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
    val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
    when (status) {
      PackageInstaller.STATUS_PENDING_USER_ACTION -> {
        val confirm: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
        } else {
          @Suppress("DEPRECATION")
          intent.getParcelableExtra(Intent.EXTRA_INTENT)
        }
        confirm?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        if (confirm != null) context.startActivity(confirm)
        listener?.invoke("waiting", null)
      }
      PackageInstaller.STATUS_SUCCESS -> listener?.invoke("success", null)
      else -> listener?.invoke("failed", message ?: "The update could not be installed")
    }
  }
}
