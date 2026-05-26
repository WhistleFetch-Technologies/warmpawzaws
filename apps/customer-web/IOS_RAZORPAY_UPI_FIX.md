# Customer iOS Capacitor — Razorpay UPI + native app deep links

Parity with the Android customer Capacitor fix. The app loads **`https://customer.warmpawz.com`**; checkout uses Razorpay Standard Checkout (`checkout.js`) in **WKWebView**.

Three layers (same as Android):

| Layer | What | Ships in IPA? |
|-------|------|----------------|
| **1. JS** | `getWarmpawzRazorpayUpiDisplayConfig()` + `method: { upi: true }` | No — from URL after prod deploy |
| **2. Capacitor config** | `ios.overrideUserAgent` (recommended) | Yes — after `cap sync ios` |
| **3. Native** | `LSApplicationQueriesSchemes` + WKWebView navigation handler for `upi://`, `tez://`, etc. | Yes — Xcode archive |

**Do not enable `CapacitorHttp` on customer** (same as Android — breaks login/session).

See also: `ANDROID_UPI_FIX.md` (JS + Android manifest), `docs/COPILOT_V7_ANDROID_BUILD.md` (customer native overview).

---

## Prerequisites

- Mac with Xcode 15+ and CocoaPods (`pod --version`)
- Apple Developer account + distribution cert / provisioning for `com.warmpawz.customer`
- `customer-web` deployed to prod with Razorpay UPI JS (`ANDROID_UPI_FIX.md` §1)
- Razorpay Dashboard: UPI enabled on live merchant

---

## 1. One-time: add iOS platform (if missing)

From repo root:

```bash
cd apps/customer-web
npm install
npm run build
npx cap add ios
npx cap sync ios
```

This creates `apps/customer-web/ios/`. Commit `ios/` only if your team tracks it; otherwise regenerate per machine.

---

## 2. `capacitor.config.json` — iOS user agent

Add an `ios` block (keep existing `server.url`; **no** `CapacitorHttp`):

```json
{
  "appId": "com.warmpawz.customer",
  "appName": "Warmpawz Customer",
  "webDir": "dist",
  "server": {
    "url": "https://customer.warmpawz.com",
    "androidScheme": "https"
  },
  "android": {
    "allowMixedContent": false,
    "overrideUserAgent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.91 Mobile Safari/537.36"
  },
  "ios": {
    "overrideUserAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
  }
}
```

Then:

```bash
npx cap sync ios
```

---

## 3. `Info.plist` — query UPI apps (`LSApplicationQueriesSchemes`)

iOS blocks `canOpenURL` / opening other apps unless schemes are declared.

Edit **`ios/App/App/Info.plist`** (merge into existing `<dict>`):

```xml
<key>LSApplicationQueriesSchemes</key>
<array>
  <string>upi</string>
  <string>tez</string>
  <string>gpay</string>
  <string>phonepe</string>
  <string>paytmmp</string>
  <string>bhim</string>
  <string>credpay</string>
  <string>amazonpay</string>
  <string>whatsapp</string>
</array>
```

This does **not** add App Store privacy permissions; it only allows the app to detect/open those URL schemes.

---

## 4. Native UPI deep link handler — custom bridge view controller

Default WKWebView does not open `upi://` / `tez://` / `phonepe://` in the UPI app; navigation fails silently.

### 4.1 Create `ios/App/App/RazorpayBridgeViewController.swift`

```swift
import UIKit
import Capacitor
import WebKit

/// Opens non-http(s) URLs (UPI intents) in the native UPI app instead of loading them in WKWebView.
final class RazorpayBridgeViewController: CAPBridgeViewController, WKNavigationDelegate {

  private static let externalSchemes: Set<String> = [
    "upi", "tez", "gpay", "phonepe", "paytmmp", "bhim",
    "credpay", "amazonpay", "whatsapp", "mailto", "tel", "sms"
  ]

  override func capacitorDidLoad() {
    super.capacitorDidLoad()
    bridge?.webView?.navigationDelegate = self
  }

  func webView(
    _ webView: WKWebView,
    decidePolicyFor navigationAction: WKNavigationAction,
    decisionHandler: @escaping (WKNavigationDecision) -> Void
  ) {
    guard let url = navigationAction.request.url,
          let scheme = url.scheme?.lowercased() else {
      decisionHandler(.allow)
      return
    }

    if scheme == "http" || scheme == "https" || scheme == "about" || scheme == "file" {
      decisionHandler(.allow)
      return
    }

    if Self.externalSchemes.contains(scheme) {
      UIApplication.shared.open(url, options: [:]) { opened in
        if !opened {
          NSLog("[Razorpay] Could not open external URL: \(url.absoluteString)")
        }
      }
      decisionHandler(.cancel)
      return
    }

    // Unknown custom scheme — try open anyway (Razorpay / bank apps)
    if UIApplication.shared.canOpenURL(url) {
      UIApplication.shared.open(url, options: [:], completionHandler: nil)
      decisionHandler(.cancel)
      return
    }

    decisionHandler(.allow)
  }
}
```

### 4.2 Point the storyboard at the custom class

Open **`ios/App/App/Base.lproj/Main.storyboard`** in Xcode:

1. Select the **Bridge View Controller** (root view controller).
2. Identity inspector → **Class**: `RazorpayBridgeViewController`
3. **Module**: `App` (your app target name).

If your project uses a programmatic root VC (no storyboard), set in `AppDelegate.swift`:

```swift
window?.rootViewController = RazorpayBridgeViewController()
```

(Capacitor 8 default is storyboard-based — prefer the storyboard change.)

### 4.3 Add Swift file to Xcode target

In Xcode: **App** target → **Build Phases** → **Compile Sources** must include `RazorpayBridgeViewController.swift`.

---

## 5. Optional — status bar / Razorpay header safe area (iOS)

Razorpay’s merchant toolbar lives in a **cross-origin iframe** (`checkout.razorpay.com`). CSS `env(safe-area-inset-top)` inside WKWebView is unreliable.

Minimal native approach in **`RazorpayBridgeViewController`**:

```swift
override func viewDidLoad() {
  super.viewDidLoad()
  view.backgroundColor = UIColor(red: 1, green: 0.55, blue: 0.26, alpha: 1) // #FF8C42
}

override var preferredStatusBarStyle: UIStatusBarStyle {
  .darkContent
}
```

Ensure **Info.plist** includes:

```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>
```

Test on a notched iPhone; adjust only if overlap remains.

**Android equivalent:** `android/.../MainActivity.java` window insets — use that on Android, not this Swift block.

---

## 6. Web / JS (no iOS-specific fork)

Same as Android — in this repo:

| File | Change |
|------|--------|
| `lib/razorpay/razorpay-utils.ts` | `getWarmpawzRazorpayUpiDisplayConfig()` |
| `components/customer/payment/UniversalPaymentPage.tsx` | `config` + `method: { upi: true }` |
| `lib/razorpay/build-standard-checkout-options.ts` | Other checkout flows |

Deploy **customer-web** to prod before testing the IPA.

`isWarmpawzCustomerNativeWebView()` is **false** on Capacitor iOS (React Native `ReactNativeWebView` only).

---

## 7. Build & sign the IPA

```bash
cd apps/customer-web
npm run build
npx cap sync ios
cd ios/App
pod install
open App.xcworkspace
```

In Xcode:

1. Select **App** scheme, **Any iOS Device (arm64)**.
2. **Signing & Capabilities** → Team + bundle `com.warmpawz.customer`.
3. Bump **Version** / **Build** (greater than last App Store build).
4. **Product → Archive** → **Distribute App** → App Store Connect / TestFlight.

Optional CLI archive:

```bash
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release \
  -archivePath build/App.xcarchive archive
```

---

## 8. Verification checklist

| Step | Pass |
|------|------|
| Safari at `customer.warmpawz.com` | UPI options visible |
| TestFlight / debug on device | Login works (no forced re-onboarding) |
| Open payment | Web Inspector: `blocks.upi`, `flows: ['collect','intent','qr']` |
| Tap PhonePe / GPay / Paytm | App backgrounds; UPI app opens |
| Return after payment | App resumes; payment completes |

**Web Inspector:** Mac Safari → **Develop** → [device] → Warmpawz Customer.

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| UPI missing in app, OK in Safari | Deploy customer-web; set `ios.overrideUserAgent`; reinstall |
| UPI list shows, tap does nothing | `LSApplicationQueriesSchemes` or storyboard not using `RazorpayBridgeViewController` |
| `canOpenURL` returns false | Add scheme to `LSApplicationQueriesSchemes` |
| Login / profile broken | Remove `CapacitorHttp` from customer `capacitor.config.json` |
| Works on Android, not iOS | Implement §3 + §4; Android `MainActivity.java` is not used on iOS |

---

## 10. File checklist (iOS)

| File | Action |
|------|--------|
| `apps/customer-web/capacitor.config.json` | Add `ios.overrideUserAgent` |
| `apps/customer-web/ios/App/App/Info.plist` | `LSApplicationQueriesSchemes` |
| `apps/customer-web/ios/App/App/RazorpayBridgeViewController.swift` | **New** |
| `apps/customer-web/ios/App/App/Base.lproj/Main.storyboard` | Class → `RazorpayBridgeViewController` |
| `apps/customer-web/ios/App/Podfile` | `pod install` after `cap sync` |

**Android-only (do not copy to iOS):** `MainActivity.java`, `AndroidManifest.xml` `<queries>`.

---

## 11. Copilot one-shot prompt

```
Implement customer iOS Capacitor Razorpay UPI parity with Android:
- server.url https://customer.warmpawz.com, NO CapacitorHttp
- ios.overrideUserAgent in capacitor.config.json
- Info.plist LSApplicationQueriesSchemes: upi, tez, gpay, phonepe, paytmmp, bhim, credpay, amazonpay, whatsapp
- RazorpayBridgeViewController.swift: WKNavigationDelegate opens non-http(s) schemes via UIApplication.shared.open
- Wire storyboard root VC to RazorpayBridgeViewController
- npx cap sync ios && pod install; document Xcode archive steps
Do not change Android files. Verify UPI app opens on device when user taps intent flow.
```

Follow: `apps/customer-web/IOS_RAZORPAY_UPI_FIX.md`

---

*Android reference:* `android/app/src/main/java/com/warmpawz/customer/MainActivity.java`
