package com.warmpawz.customer

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * React Native host activity. In-app safe areas use the JS `ScreenShell` component and `SafeAreaProvider`.
 *
 * **Razorpay standard checkout:** `RazorpayCheckout.open()` starts `com.razorpay.CheckoutActivity`.
 * That UI is not a React child, so JS `ScreenShell` does not apply. The manifest applies
 * `AppTheme.RazorpayCheckout` (white opaque status bar with dark icons,
 * `windowLayoutInDisplayCutoutMode=never` for notch handling, and on API 35+
 * `windowOptOutEdgeToEdgeEnforcement`). Razorpay's CheckoutActivity overrides those values at
 * runtime from `theme.color`, so `RazorpayCheckoutWindowInsetsCallback` in `MainApplication.kt`
 * re-applies WHITE statusBarColor + light-status-bar appearance after Razorpay's onCreate. Net
 * result: the orange merchant toolbar (back button + "Warmpawz") sits cleanly below the system
 * status bar instead of bleeding under it.
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
