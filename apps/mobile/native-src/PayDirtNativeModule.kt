package io.paydirt.app

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

// Exposes registerWithNtfy() and downloadAndInstallApk() to JS.
class PayDirtNativeModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = "PayDirtNative"

  @ReactMethod
  fun registerWithNtfy(promise: Promise) {
    try {
      registerAppWithNtfy(reactApplicationContext)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("register_failed", e.message, e)
    }
  }

  @ReactMethod
  fun downloadAndInstallApk(url: String, promise: Promise) {
    try {
      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle("PayDirt update")
        .setDescription("Downloading update...")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "paydirt-update.apk")
        .setMimeType("application/vnd.android.package-archive")
      val dm = reactApplicationContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      dm.enqueue(request)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("download_failed", e.message, e)
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
