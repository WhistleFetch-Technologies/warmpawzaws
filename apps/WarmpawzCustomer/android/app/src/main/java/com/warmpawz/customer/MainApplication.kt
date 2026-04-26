package com.warmpawz.customer

import android.app.Activity
import android.app.Application
import android.app.Application.ActivityLifecycleCallbacks
import android.os.Bundle
import androidx.core.view.WindowCompat
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost =
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // packages.add(new MyReactNativePackage());
          return PackageList(this).packages
        }

        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost
    get() = getDefaultReactHost(this.applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    registerActivityLifecycleCallbacks(RazorpayCheckoutWindowInsetsCallback())
    SoLoader.init(this, false)
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      load()
    }
    
    // Initialize Flipper only in debug builds
    if (BuildConfig.DEBUG) {
      try {
        val ReactNativeFlipper = Class.forName("com.facebook.react.flipper.ReactNativeFlipper")
        val initMethod = ReactNativeFlipper.getMethod(
          "initializeFlipper",
          android.content.Context::class.java,
          com.facebook.react.ReactInstanceManager::class.java
        )
        initMethod.invoke(null, this, reactNativeHost.reactInstanceManager)
      } catch (e: ClassNotFoundException) {
        // Flipper not available, ignore
      }
    }
  }
}

/**
 * Razorpay Standard Checkout runs in [com.razorpay.CheckoutActivity], not in React Native.
 * Themes on that activity help, but their WebView chrome can still draw under the status bar.
 * Forcing decor to fit system windows applies top padding at the window level so the orange
 * merchant header clears clock / icons (pairs with [AppTheme.RazorpayCheckout] in styles.xml).
 */
private class RazorpayCheckoutWindowInsetsCallback : ActivityLifecycleCallbacks {

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
    applyIfRazorpayCheckout(activity)
  }

  override fun onActivityResumed(activity: Activity) {
    applyIfRazorpayCheckout(activity)
  }

  override fun onActivityStarted(activity: Activity) {}

  override fun onActivityPaused(activity: Activity) {}

  override fun onActivityStopped(activity: Activity) {}

  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

  override fun onActivityDestroyed(activity: Activity) {}

  private fun applyIfRazorpayCheckout(activity: Activity) {
    if (activity.javaClass.name != CHECKOUT_CLASS) return
    val window = activity.window
    WindowCompat.setDecorFitsSystemWindows(window, true)
    window.decorView.post {
      if (activity.isFinishing || activity.javaClass.name != CHECKOUT_CLASS) return@post
      WindowCompat.setDecorFitsSystemWindows(activity.window, true)
    }
  }

  companion object {
    private const val CHECKOUT_CLASS = "com.razorpay.CheckoutActivity"
  }
}
