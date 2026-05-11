package com.warmpawz.customer

import android.app.Activity
import android.app.Application
import android.app.Application.ActivityLifecycleCallbacks
import android.graphics.Color
import android.os.Bundle
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat
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
 *
 * Razorpay's CheckoutActivity reads `theme.color` from the JS payload at runtime and overrides
 * (a) `window.statusBarColor` to that brand color and (b) `setDecorFitsSystemWindows(window, false)`
 * so the colored toolbar bleeds into the status bar (this is what makes our `← W Warmpawz`
 * header render on top of the system clock / battery icons on Android).
 *
 * The XML theme alone (white statusBarColor + windowLightStatusBar=true + fitsSystemWindows=true
 * in [AppTheme.RazorpayCheckout]) is not enough because Razorpay's runtime calls happen AFTER the
 * theme is applied. We re-apply our preferences in onActivityCreated AND onActivityResumed AND in
 * a posted runnable so that we win the last write — yielding the same look as the BHIVE / Razorpay
 * reference design: white system status bar with dark icons, merchant toolbar starting cleanly
 * below it.
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
    forceWhiteStatusBarBelowDecor(activity)
    activity.window.decorView.post {
      if (activity.isFinishing || activity.javaClass.name != CHECKOUT_CLASS) return@post
      forceWhiteStatusBarBelowDecor(activity)
    }
  }

  private fun forceWhiteStatusBarBelowDecor(activity: Activity) {
    val window = activity.window
    WindowCompat.setDecorFitsSystemWindows(window, true)
    window.statusBarColor = Color.WHITE
    WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = true
  }

  companion object {
    private const val CHECKOUT_CLASS = "com.razorpay.CheckoutActivity"
  }
}
