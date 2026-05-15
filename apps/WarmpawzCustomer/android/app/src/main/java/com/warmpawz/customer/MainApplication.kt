package com.warmpawz.customer

import android.app.Activity
import android.app.Application
import android.app.Application.ActivityLifecycleCallbacks
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
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
 * header render on top of the system clock / battery icons on Android). That override happens
 * AFTER `onCreate` / `onStart` / `onResume` — Razorpay only applies the brand color once its
 * embedded WebView has loaded `checkout.js` and fired its theme callback. A single re-apply in
 * a lifecycle callback or a `decorView.post {}` is too early and loses the race.
 *
 * To win the race we layer three defences (all are cheap; together they match the BHIVE /
 * Razorpay Trusted Business reference look — white system status bar with dark icons, merchant
 * toolbar starting cleanly below it):
 *   1. Burst re-applies at 0 / 50 / 150 / 400 / 800 / 1500 / 3000 ms after each lifecycle hit so
 *      whenever Razorpay's WebView fires its theme handler we restore WHITE within one frame.
 *   2. A `ViewTreeObserver.OnPreDrawListener` watchdog (installed once per checkout activity)
 *      reverts any non-WHITE status bar before the next frame is drawn.
 *   3. A `OnApplyWindowInsetsListener` on `android.R.id.content` that pads the content view by
 *      the system bar inset so even if Razorpay flips back to `setDecorFitsSystemWindows(false)`,
 *      its WebView still starts BELOW the status bar instead of under it.
 */
private class RazorpayCheckoutWindowInsetsCallback : ActivityLifecycleCallbacks {

  private val mainHandler = Handler(Looper.getMainLooper())

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
    if (!isRazorpayCheckout(activity)) return
    forceWhiteStatusBarBelowDecor(activity)
    installContentInsetPadding(activity)
    installPreDrawWatchdog(activity)
    scheduleReapplyBursts(activity)
  }

  override fun onActivityStarted(activity: Activity) {
    if (!isRazorpayCheckout(activity)) return
    forceWhiteStatusBarBelowDecor(activity)
  }

  override fun onActivityResumed(activity: Activity) {
    if (!isRazorpayCheckout(activity)) return
    forceWhiteStatusBarBelowDecor(activity)
    scheduleReapplyBursts(activity)
  }

  override fun onActivityPaused(activity: Activity) {}

  override fun onActivityStopped(activity: Activity) {}

  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}

  override fun onActivityDestroyed(activity: Activity) {}

  private fun isRazorpayCheckout(activity: Activity): Boolean =
    activity.javaClass.name == CHECKOUT_CLASS

  private fun forceWhiteStatusBarBelowDecor(activity: Activity) {
    val window = activity.window
    WindowCompat.setDecorFitsSystemWindows(window, true)
    if (window.statusBarColor != Color.WHITE) {
      window.statusBarColor = Color.WHITE
    }
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    if (!controller.isAppearanceLightStatusBars) {
      controller.isAppearanceLightStatusBars = true
    }
  }

  /**
   * Pad `android.R.id.content` by the system bar inset so the Razorpay WebView lays out below the
   * status bar even if Razorpay calls `setDecorFitsSystemWindows(window, false)` after our reset.
   * `setOnApplyWindowInsetsListener` replaces any previous listener, so re-invoking is idempotent.
   */
  private fun installContentInsetPadding(activity: Activity) {
    val content = activity.window.findViewById<ViewGroup>(android.R.id.content) ?: return
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val sysBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      // Only override top; preserve any horizontal / bottom padding Razorpay may rely on.
      // When the decor view already handles system padding (mode 1) `sysBars.top` is 0, so this
      // is a no-op. When Razorpay flips to edge-to-edge (mode 2), this pushes the WebView below
      // the status bar.
      v.setPadding(v.paddingLeft, sysBars.top, v.paddingRight, v.paddingBottom)
      WindowInsetsCompat.CONSUMED
    }
    ViewCompat.requestApplyInsets(content)
  }

  /**
   * Re-applies WHITE status bar + dark icons before every frame draw. Cheap (only writes if the
   * value drifted) and self-detaches when the activity is finishing. Invoked once per activity
   * instance from `onActivityCreated`.
   */
  private fun installPreDrawWatchdog(activity: Activity) {
    val window = activity.window
    val decor: View = window.decorView
    decor.viewTreeObserver.addOnPreDrawListener(object : ViewTreeObserver.OnPreDrawListener {
      override fun onPreDraw(): Boolean {
        if (activity.isFinishing || !isRazorpayCheckout(activity)) {
          decor.viewTreeObserver.removeOnPreDrawListener(this)
          return true
        }
        if (window.statusBarColor != Color.WHITE) {
          window.statusBarColor = Color.WHITE
        }
        val controller = WindowInsetsControllerCompat(window, decor)
        if (!controller.isAppearanceLightStatusBars) {
          controller.isAppearanceLightStatusBars = true
        }
        return true
      }
    })
  }

  /**
   * Re-apply our overrides on a staircase of delays so we catch Razorpay's late theme push
   * (`checkout.js` → native bridge → `window.setStatusBarColor`). 3 s is a generous upper bound;
   * the WebView callback typically lands within ~500 ms.
   */
  private fun scheduleReapplyBursts(activity: Activity) {
    longArrayOf(0L, 50L, 150L, 400L, 800L, 1500L, 3000L).forEach { delay ->
      mainHandler.postDelayed({
        if (!activity.isFinishing && isRazorpayCheckout(activity)) {
          forceWhiteStatusBarBelowDecor(activity)
          val content = activity.window.findViewById<ViewGroup>(android.R.id.content)
          if (content != null) {
            ViewCompat.requestApplyInsets(content)
          }
        }
      }, delay)
    }
  }

  companion object {
    private const val CHECKOUT_CLASS = "com.razorpay.CheckoutActivity"
  }
}
