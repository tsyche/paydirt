package io.paydirt.app

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Environment
import androidx.core.content.ContextCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.io.File

// Exposes registerWithNtfy() and downloadAndInstallApk() to JS. Registration
// normally only runs at app startup (MainApplication.onCreate), so if ntfy was
// installed or its distributor approval was missed after launch, the kid
// "Check connection" flow had no way to re-send the REGISTER broadcast — a
// permanent dead end.
class PayDirtNativeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "PayDirtNative"

  @ReactMethod
  fun registerWithNtfy(promise: Promise) {
    try {
      // Calls the top-level helper — a member with this name would shadow it.
      registerAppWithNtfy(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("register_failed", e.message, e)
    }
  }

  // Downloads the APK with DownloadManager, then opens the system installer as
  // soon as it finishes (the user still taps Install; Android requires it).
  @ReactMethod
  fun downloadAndInstallApk(url: String, promise: Promise) {
    try {
      val ctx = reactApplicationContext
      // A leftover file makes DownloadManager save as "paydirt-update-1.apk".
      File(
        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
        "paydirt-update.apk",
      ).delete()
      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle("PayDirt update")
        .setDescription("Downloading update...")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "paydirt-update.apk")
        .setMimeType("application/vnd.android.package-archive")
      val dm = ctx.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      pendingDownloadId = dm.enqueue(request)
      ensureInstallReceiver(ctx)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("download_failed", e.message, e)
    }
  }

  companion object {
    @Volatile private var pendingDownloadId = -1L
    private var receiverRegistered = false

    @Synchronized
    private fun ensureInstallReceiver(ctx: Context) {
      if (receiverRegistered) return
      val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, intent: Intent) {
          val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
          if (id != pendingDownloadId) return
          val dm = c.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
          val uri = dm.getUriForDownloadedFile(id) ?: return
          val install = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
          }
          c.startActivity(install)
        }
      }
      ContextCompat.registerReceiver(
        ctx.applicationContext,
        receiver,
        IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
        ContextCompat.RECEIVER_EXPORTED,
      )
      receiverRegistered = true
    }
  }
}

class PayDirtPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PayDirtNativeModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
