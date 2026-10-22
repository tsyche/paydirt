package io.paydirt.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

// Exposes registerWithNtfy() to JS. Registration normally only runs at app
// startup (MainApplication.onCreate), so if ntfy was installed or its
// distributor approval was missed after launch, the kid "Check connection"
// flow had no way to re-send the REGISTER broadcast — a permanent dead end.
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
}

class PayDirtPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(PayDirtNativeModule(reactContext))

  override fun createViewManagers(
    reactContext: ReactApplicationContext
  ): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
