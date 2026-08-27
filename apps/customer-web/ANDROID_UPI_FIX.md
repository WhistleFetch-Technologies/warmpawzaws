# Customer Android UPI checkout fix (Capacitor / WebView)

**iOS (Capacitor):** see [`IOS_RAZORPAY_UPI_FIX.md`](./IOS_RAZORPAY_UPI_FIX.md) for `LSApplicationQueriesSchemes`, `RazorpayBridgeViewController`, and IPA build steps.

**Screen-capture PDF download (Capacitor):** see [`CAPACITOR_SCREEN_CAPTURE_DOWNLOAD.md`](./CAPACITOR_SCREEN_CAPTURE_DOWNLOAD.md) — Web Share save path, no APK rebuild required.

The customer app loads `https://customer.warmpawz.com` inside a Capacitor
Android WebView and calls Razorpay Standard Checkout (`checkout.js`) via
`new window.Razorpay(options)`. There is no `react-native-razorpay`, so
`isWarmpawzCustomerNativeWebView()` is always **false** on the Capacitor APK.

If UPI options are missing only inside the installed APK (but visible in
Chrome at the same URL), fix all three:

1. JS — Razorpay options on `customer-web` (this repo)
2. Native — Android `<queries>` + UPI permissions on the customer Capacitor
   project (likely outside this repo, signed with the [keystore repo](https://github.com/AbhayankarBellur/keystore))
3. Razorpay Dashboard — UPI enabled on the live merchant account

## 1. JS checkout (canonical = old Pay Bill)

Do **not** inject `config.display` or `method: { upi: true }`. Those options
replace Razorpay's default saved-method sheet (PhonePe + Pay + More Options)
with a custom Appointment-style list.

All customer checkouts use `openStandardRazorpayCheckout` → minimal options
only. `sanitizeRazorpayInstanceOptions` strips leftover `config` / `method`.

After deploying customer-web to prod (S3 + CloudFront), do a hard refresh in
the APK or rebuild and reinstall — the WebView caches `_next/static` chunks.

### Verifying in Chrome remote debug

`chrome://inspect#devices` → WebView → console during checkout:

| Console line | Meaning |
|--------------|---------|
| Options have **no** `config.display` / `method` | Canonical Pay Bill sheet is live |
| `config.display` or `method: { upi: true }` | Stale UPI-block chunk → invalidate CloudFront / reinstall APK |
| Correct JS but no UPI app chips on intent picker | Manifest `<queries>` missing → step 2 |

## 2. Customer Android manifest (Capacitor project)

Locate the customer Capacitor project — it is **not** in `warmpawzaws`. The
keystore repo only stores signing files for it:

- `apps/customer-web/android/app/warmpawz-customer-release.keystore`
- `apps/customer-web/android/keystore.properties`

In whatever directory holds `apps/customer-web/android/app/src/main/AndroidManifest.xml`,
add `<queries>` before `<application>` so Android 11+ lets the WebView resolve
UPI intents:

```xml
<queries>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="upi" />
    </intent>
    <package android:name="com.google.android.apps.nbu.paisa.user" /> <!-- GPay -->
    <package android:name="com.phonepe.app" />
    <package android:name="net.one97.paytm" />
    <package android:name="in.org.npci.upiapp" /> <!-- BHIM -->
    <package android:name="in.amazon.mShop.android.shopping" />
    <package android:name="com.dreamplug.androidapp" /> <!-- Cred -->
    <package android:name="com.csam.icici.bank.imobile" />
    <package android:name="com.sbi.upi" />
</queries>
```

No new permissions are required for UPI itself. Keep the approved permission
set from `docs/APP_BUILD_MEMORY.md` in the keystore repo.

## 3. Build flow (matches keystore repo docs)

```powershell
# from the customer Capacitor project
Set-Location apps\customer-web
npm run build           # Next.js export → dist/
npx cap sync android

# Debug APK to verify
Set-Location android
.\gradlew.bat assembleDebug

# Release AAB (bump versionCode > 6 first)
.\gradlew.bat bundleRelease
```

Outputs:
- `apps/customer-web/android/app/build/outputs/apk/debug/app-debug.apk`
- `apps/customer-web/android/app/build/outputs/bundle/release/app-release.aab`

Copy `keystore.properties` and `warmpawz-customer-release.keystore` from the
keystore repo into the same paths before `bundleRelease`.

## Why this is needed

| Layer | Browser at customer.warmpawz.com | Installed customer APK |
|-------|----------------------------------|------------------------|
| Razorpay options | Latest from CloudFront | Same (remote URL load) |
| Android `<queries>` for `upi://` | Chrome already declares them | Only if your APK ships them |
| WebView intent visibility | OS-level | Per-app (Android 11+) |

Redeploying customer-web alone fixes (1) but cannot change the manifest
shipped inside the installed APK. Without (2) GPay / PhonePe chips disappear
from Razorpay's intent flow even when JS config is correct.
