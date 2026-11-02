package io.paydirt.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

// Exposes registerWithNtfy(), downloadUpdate() and installUpdate() to JS. Registration
// normally only runs at app startup (MainApplication.onCreate), so if ntfy was
// installed or its distributor approval was missed after launch, the kid
// "Check connection" flow had no way to re-send the REGISTER broadcast — a
// permanent dead end.
class PayDirtNativeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "PayDirtNative"

  init {
    reactCtx = reactContext
  }

  // Required so JS can subscribe with NativeEventEmitter.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  // Returns (and clears) the reason code of a failed update download, or 0 if none.
  // Covers failures that happened while JS wasn't listening (app backgrounded).
  @ReactMethod
  fun takeUpdateFailure(promise: Promise) {
    val prefs = reactApplicationContext.getSharedPreferences("paydirt_update", Context.MODE_PRIVATE)
    val reason = prefs.getInt("failed_reason", 0)
    prefs.edit().remove("failed_reason").apply()
    promise.resolve(reason)
  }

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

  // Downloads the update APK in-process (not DownloadManager: on Android 17 the
  // system Downloads provider is blocked from LAN addresses, so it timed out
  // against the self-hosted server). Progress/ready/failed go to JS as events.
  // Resolves false if a download is already running (duplicate taps are no-ops).
  @ReactMethod
  fun downloadUpdate(url: String, promise: Promise) {
    if (!downloading.compareAndSet(false, true)) {
      promise.resolve(false)
      return
    }
    promise.resolve(true)
    val ctx = reactApplicationContext
    Thread {
      try {
        val dir = File(ctx.cacheDir, UPDATE_DIR).apply { mkdirs() }
        val part = File(dir, "$UPDATE_FILE.part")
        val out = File(dir, UPDATE_FILE)
        out.delete()
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        if (conn.responseCode !in 200..299) throw HttpStatusException(conn.responseCode)
        val total = conn.contentLengthLong
        var done = 0L
        var lastPct = -1
        conn.inputStream.use { input ->
          part.outputStream().use { output ->
            val buf = ByteArray(64 * 1024)
            while (true) {
              val n = input.read(buf)
              if (n < 0) break
              output.write(buf, 0, n)
              done += n
              if (total > 0) {
                val pct = (done * 100 / total).toInt()
                if (pct != lastPct) {
                  lastPct = pct
                  emit("PayDirtUpdateProgress", pct)
                }
              }
            }
          }
        }
        if (total > 0 && part.length() != total) throw IOException("short download")
        if (!part.renameTo(out)) throw IOException("rename failed")
        emit("PayDirtUpdateReady", 1)
      } catch (e: HttpStatusException) {
        recordFailure(ctx, e.status)
      } catch (e: Exception) {
        // 1006 = out of space, 1004 = network/IO (matches describeDownloadFailure in JS)
        recordFailure(ctx, if (e.message?.contains("ENOSPC") == true) 1006 else 1004)
      } finally {
        downloading.set(false)
      }
    }.start()
  }

  // True when a finished download in the cache is newer than the installed app.
  // Restores the "Update ready" dialog after the app process restarted (e.g. after
  // the Install-unknown-apps toggle); a stale or already-installed APK is deleted.
  @ReactMethod
  fun readyUpdate(promise: Promise) {
    try {
      val ctx = reactApplicationContext
      val apk = File(File(ctx.cacheDir, UPDATE_DIR), UPDATE_FILE)
      if (!apk.exists()) {
        promise.resolve(false)
        return
      }
      val pm = ctx.packageManager
      val archive = pm.getPackageArchiveInfo(apk.path, 0)
      val installed = pm.getPackageInfo(ctx.packageName, 0).longVersionCode
      val newer = archive != null && archive.packageName == ctx.packageName && archive.longVersionCode > installed
      if (!newer) apk.delete()
      promise.resolve(newer)
    } catch (e: Exception) {
      promise.resolve(false)
    }
  }

  // Returns (and clears) the flag set when the user was sent to the permission screen.
  @ReactMethod
  fun takeInstallPending(promise: Promise) {
    val p = prefs(reactApplicationContext)
    val pending = p.getBoolean("install_pending", false)
    p.edit().remove("install_pending").apply()
    promise.resolve(pending)
  }

  // Opens the system installer for the downloaded APK. Call it while the app is
  // in the foreground (the "Install" button): background launches are blocked.
  // Resolves "started", "permission" (sent to the Install-unknown-apps screen) or "missing".
  @ReactMethod
  fun installUpdate(promise: Promise) {
    try {
      val ctx = reactApplicationContext
      val apk = File(File(ctx.cacheDir, UPDATE_DIR), UPDATE_FILE)
      if (!apk.exists()) {
        promise.resolve("missing")
        return
      }
      if (!ctx.packageManager.canRequestPackageInstalls()) {
        // Granting the permission can restart the app process, so remember to resume the install.
        prefs(ctx).edit().putBoolean("install_pending", true).apply()
        ctx.startActivity(
          Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${ctx.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
        promise.resolve("permission")
        return
      }
      val uri = FileProvider.getUriForFile(ctx, "${ctx.packageName}.updatefiles", apk)
      ctx.startActivity(
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(uri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        },
      )
      promise.resolve("started")
    } catch (e: Exception) {
      promise.reject("install_failed", e.message, e)
    }
  }

  private class HttpStatusException(val status: Int) : IOException("HTTP $status")

  companion object {
    private const val UPDATE_DIR = "updates"
    private const val UPDATE_FILE = "paydirt-update.apk"
    private val downloading = AtomicBoolean(false)
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("paydirt_update", Context.MODE_PRIVATE)
    @Volatile private var reactCtx: ReactApplicationContext? = null

    private fun emit(event: String, value: Int) {
      val rc = reactCtx
      if (rc != null && rc.hasActiveReactInstance()) {
        rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event, value)
      }
    }

    // Codes: >= 1000 are DownloadManager-style reasons, 400-599 are HTTP statuses.
    private fun recordFailure(ctx: Context, reason: Int) {
      val code = if (reason <= 0) 1 else reason
      ctx.getSharedPreferences("paydirt_update", Context.MODE_PRIVATE).edit().putInt("failed_reason", code).apply()
      emit("PayDirtUpdateFailed", code)
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
