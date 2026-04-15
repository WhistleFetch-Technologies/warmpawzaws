package com.warmpawz.customer

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * React Native host activity. In-app safe areas use the JS `ScreenShell` component and `SafeAreaProvider`.
 *
 * **Razorpay standard checkout:** `RazorpayCheckout.open()` starts the Razorpay SDK Android activity,
 * which renders its own toolbar (e.g. branded “Warmpawz” bar). That UI is not a React child, so JS
 * `ScreenShell` does not apply. Overlap with the status bar must be addressed by upgrading
 * `react-native-razorpay` / `com.razorpay:checkout`, Razorpay release notes, or checkout options
 * (e.g. hosted / web checkout) — not by RN `SafeAreaView` alone.
 */
class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "warmpawz-customer"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
