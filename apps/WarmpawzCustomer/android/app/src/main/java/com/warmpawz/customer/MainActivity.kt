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
 * `AppTheme.RazorpayCheckout`: opaque status/nav, `windowLayoutInDisplayCutoutMode=never` (notch),
 * and on API 35+ `windowOptOutEdgeToEdgeEnforcement` so the orange merchant header clears system UI.
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
