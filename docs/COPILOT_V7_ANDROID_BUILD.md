# Copilot instructions: Android v7 build (vendor gallery + customer Razorpay UPI + header)

**Audience:** GitHub Copilot / developers updating the **keystore** repo (last Play upload **versionCode 6**) and the **main app source** repo that contains `vendor-web` and `customer-web`.

**Goal:** Ship signed **AAB** files for Play Console with:

1. **Vendor** — center/gallery **image upload** working in the installed APK (not only in Chrome).
2. **Customer** — **Razorpay UPI** visible and tappable in the installed APK; UPI apps open when selected. (**iOS:** `apps/customer-web/IOS_RAZORPAY_UPI_FIX.md`.)
3. **Customer** — **payment header** no longer under the status bar / punch-hole (Razorpay checkout sheet + in-app headers).
4. **Vendor (optional)** — same **status-bar inset** pattern if the vendor app back button overlaps the system bar.

**Reference implementation (verified):** `warmpawzaws` monorepo — copy files from paths listed in §8.

**Vendor upload still broken after APK rebuild?** Use the stricter two-gate checklist: `docs/COPILOT_VENDOR_GALLERY_FIX_VERIFY.md` (prod JS deploy + `cap sync` — APK alone is not enough).

**Same URL but our APK works and yours does not?** Native shell parity only: `docs/COPILOT_VENDOR_APK_PARITY.md` (verify baked `assets/capacitor.config.json`, `cap sync`, Capacitor 8, manifest `<queries>`).

---

## Critical rules (read first)

| Rule | Detail |
|------|--------|
| **Remote URL shells** | Both apps load production URLs: `https://vendor.warmpawz.com`, `https://customer.warmpawz.com`. Website deploy updates **JS only**. Manifest, `capacitor.config.json`, and `MainActivity.java` require **`npx cap sync android` + new APK/AAB**. |
| **Do not change `<uses-permission>`** | Keep the Play-approved permission list from `docs/APP_BUILD_MEMORY.md` in the keystore repo. **Only add** `<queries>` blocks (package visibility — not runtime permissions). |
| **Customer: no `CapacitorHttp`** | Enabling `CapacitorHttp` on customer broke login (existing users treated as new). Vendor **needs** `CapacitorHttp`. |
| **Bump `versionCode`** | Play rejects duplicate version codes. After v6, use **7** (or higher) for **each** app you upload. |
| **Razorpay header is not CSS-fixable** | The orange “← W Warmpawz” bar on checkout is **inside** `checkout.razorpay.com` (cross-origin iframe). Fix = **native** window insets in customer `MainActivity.java`, not Tailwind on customer-web. |
| **Signing files stay in keystore repo** | Copy `keystore.properties` + `*.keystore` into each app’s `android/` before `bundleRelease`. Never commit passwords to the main app repo. |

---

## Repository layout (typical)

Adjust paths if your keystore repo nests projects differently.

```
keystore/                          # signing + build docs (you are here)
  docs/APP_BUILD_MEMORY.md
  apps/vendor-web/android/
    keystore.properties
    app/warmpawz-vendor-release.keystore
  apps/customer-web/android/
    keystore.properties
    app/warmpawz-customer-release.keystore

<main-app-repo>/                   # e.g. warmpawzaws
  apps/vendor-web/
    capacitor.config.json
    lib/api-client.ts
    lib/photo-upload-enhanced.ts
    android/...
  apps/customer-web/
    capacitor.config.json
    lib/razorpay/
    android/...
```

Copilot: apply **web** edits in `<main-app-repo>`, **native** edits under each `apps/*/android/`, then copy keystores from **keystore** before release builds.

---

## Part A — Vendor app (`com.warmpawz.vendor`)

### A1. Web source (deploy `vendor-web` to prod **before** or **with** APK)

Merge from `warmpawzaws` (or equivalent):

| File | Change |
|------|--------|
| `apps/vendor-web/lib/api-client.ts` | Export `postJsonWithXhr()`: on native, `CapacitorHttp.post` with JSON body + auth headers; clear error if native upload fails. |
| `apps/vendor-web/lib/photo-upload-enhanced.ts` | Gallery upload via **JSON base64** array (`photos: [{ base64, fileName, mimeType }]`), calling `postJsonWithXhr`. Log: `[GALLERY] Uploading via JSON base64`. |
| `apps/vendor-web/lib/capacitor-camera-pick.ts` | (if missing) Camera plugin path returning base64 to upload helper. |
| `apps/vendor-web/components/shared/TouchFilePicker.tsx` | Pass camera base64 payloads through bridge when present. |

**Why:** Android WebView XHR cannot reliably POST large base64 bodies. Native HTTP plugin handles them.

### A2. `apps/vendor-web/capacitor.config.json`

Ensure:

```json
{
  "appId": "com.warmpawz.vendor",
  "appName": "Warmpawz Vendor",
  "webDir": "dist",
  "server": {
    "url": "https://vendor.warmpawz.com",
    "androidScheme": "https"
  },
  "android": {
    "allowMixedContent": false
  },
  "plugins": {
    "CapacitorHttp": {
      "enabled": true
    }
  }
}
```

Run `npx cap sync android` after editing.

### A3. `apps/vendor-web/android/app/src/main/AndroidManifest.xml`

**Add only** this block immediately **before** `<application>` (do **not** add/remove `<uses-permission>` lines):

```xml
<!-- Android 11+ package visibility: Camera / gallery intents in WebView -->
<queries>
    <intent>
        <action android:name="android.media.action.IMAGE_CAPTURE" />
    </intent>
    <intent>
        <action android:name="android.media.action.VIDEO_CAPTURE" />
    </intent>
    <intent>
        <action android:name="android.intent.action.GET_CONTENT" />
    </intent>
    <intent>
        <action android:name="android.intent.action.PICK" />
    </intent>
</queries>
```

### A4. `apps/vendor-web/android/app/build.gradle`

Inside `android { }`:

```gradle
buildFeatures {
    buildConfig = true
}
defaultConfig {
    versionCode 7        // was 6 on Play — increment every upload
    versionName "1.0.4"
}
```

Keep existing `signingConfigs.release` pointing at `keystore.properties`.

### A5. `apps/vendor-web/android/.../MainActivity.java`

Minimum (debug WebView inspect):

```java
package com.warmpawz.vendor;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }
}
```

**Optional — vendor header / status bar:** If the vendor app back button sits under the clock, copy the **customer** `MainActivity` inset block from §B5 (same `WindowCompat` / `OnApplyWindowInsetsListener` on `android.R.id.content`, brand color `#FF8C42`). Do **not** add Razorpay `shouldOverrideUrlLoading` unless vendor uses Razorpay in-WebView.

### A6. Vendor verify (debug APK)

```powershell
Set-Location apps\vendor-web
npm run build:prod
npx cap sync android
Set-Location android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.11"   # or your JDK 17/21 path
.\gradlew.bat assembleDebug
```

Install: `android\app\build\outputs\apk\debug\app-debug.apk`

| Step | Pass criteria |
|------|----------------|
| Gallery pick | File chooser / camera opens (queries working). |
| Upload | Photo appears after refresh. |
| Console | `chrome://inspect` → WebView → `[GALLERY] Uploading via JSON base64`. |

---

## Part B — Customer app (`com.warmpawz.customer`)

### B1. Web source (deploy `customer-web` to prod)

Merge Razorpay UPI display from `warmpawzaws`:

| File | Change |
|------|--------|
| `apps/customer-web/lib/razorpay/razorpay-utils.ts` | Add `getWarmpawzRazorpayUpiDisplayConfig()` with `flows: ['collect', 'intent', 'qr']` and `method: { upi: true }`. Avoid legacy `banks` block mixing UPI+card for Android WebView checkout. |
| `apps/customer-web/lib/razorpay/build-standard-checkout-options.ts` | Default checkout uses UPI block when `includeInstrumentBlocks: true`. |
| `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx` | Before `new Razorpay(options)`: `options.config = getWarmpawzRazorpayUpiDisplayConfig(); options.method = { upi: true };` (unless user entered manual VPA). |

Deploy customer-web to S3 + **invalidate CloudFront** so the WebView loads new `_next/static` chunks.

**Do not enable `CapacitorHttp` on customer.**

### B2. `apps/customer-web/capacitor.config.json`

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
  }
}
```

No `plugins.CapacitorHttp` block.

`overrideUserAgent` prevents Razorpay from hiding UPI in WebView UA sniffing.

Run `npx cap sync android` after editing.

### B3. `apps/customer-web/android/app/src/main/AndroidManifest.xml`

**Add only** `<queries>` before `<application>`. **Do not** add camera/location permissions.

```xml
<!--
  Android 11+ package visibility: required for Razorpay UPI intent flow.
  Does NOT add runtime permissions.
-->
<queries>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="upi" />
    </intent>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="https" />
    </intent>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="http" />
    </intent>
    <package android:name="com.phonepe.app" />
    <package android:name="com.google.android.apps.nbu.paisa.user" />
    <package android:name="net.one97.paytm" />
    <package android:name="in.org.npci.upiapp" />
    <package android:name="com.amazon.mShop.android.shopping" />
    <package android:name="com.whatsapp" />
    <package android:name="com.csam.icici.bank.imobile" />
    <package android:name="com.sbi.upi" />
    <package android:name="com.axis.mobile" />
    <package android:name="com.snapwork.hdfc" />
</queries>
```

Keep customer `<uses-permission>` minimal (typically `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `VIBRATE` only — match your approved keystore list).

### B4. `apps/customer-web/android/app/build.gradle`

Add release signing (mirror vendor) if missing. Bump for Play:

```gradle
defaultConfig {
    versionCode 7        // increment from last Play upload (was 6)
    versionName "1.0.4"
}
```

Wire `signingConfigs.release` + `keystore.properties` same as vendor (paths in keystore repo).

### B5. `apps/customer-web/android/app/src/main/java/com/warmpawz/customer/MainActivity.java`

**Replace** default `BridgeActivity` with the full implementation from `warmpawzaws`:

`apps/customer-web/android/app/src/main/java/com/warmpawz/customer/MainActivity.java`

It must include:

1. **Header / status bar** — `setDecorFitsSystemWindows(false)`, status bar color `0xFFFF8C42`, `OnApplyWindowInsetsListener` on `findViewById(android.R.id.content)` padding children by `systemBars() | displayCutout()` top inset, return `WindowInsetsCompat.CONSUMED`.
2. **UPI deep links** — in `onStart`, wrap WebViewClient `shouldOverrideUrlLoading` to handle `intent:`, `upi:`, `phonepe:`, `gpay:`, `tez:`, `paytmmp:`, `bhim:`, etc., via `Intent.parseUri` / `startActivity`.

Copilot: copy the file verbatim from warmpawzaws; do not strip either block.

### B6. Razorpay Dashboard

Confirm **UPI** is enabled on the **live** merchant account. JS + manifest cannot fix a dashboard-disabled method.

### B7. Customer verify (debug APK)

```powershell
Set-Location apps\customer-web
npm run build
npx cap sync android
Set-Location android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.11"
.\gradlew.bat assembleDebug
```

**Uninstall** the old customer app first if `versionCode` unchanged (Android may not replace debug installs cleanly).

| Step | Pass criteria |
|------|----------------|
| Login | Existing phone number → correct account (not forced re-onboarding). |
| Checkout | UPI section visible (not flashing away). |
| Console | Razorpay options show `blocks.upi` with `flows: ['collect','intent','qr']`, **not** `blocks.banks`. |
| UPI tap | PhonePe / GPay opens (intent handler working). |
| Header | Back arrow and “Warmpawz” title **below** status bar on Razorpay sheet. |

---

## Part C — Release AAB (sign + Play upload)

### C1. Copy signing material (from keystore repo)

**Vendor:**

```
keystore/apps/vendor-web/android/keystore.properties
  → <main>/apps/vendor-web/android/keystore.properties

keystore/apps/vendor-web/android/app/warmpawz-vendor-release.keystore
  → <main>/apps/vendor-web/android/app/warmpawz-vendor-release.keystore
```

**Customer:** same pattern with `warmpawz-customer-release.keystore`.

`keystore.properties` example (do not commit real passwords to git):

```properties
MYAPP_RELEASE_STORE_FILE=warmpawz-vendor-release.keystore
MYAPP_RELEASE_KEY_ALIAS=...
MYAPP_RELEASE_STORE_PASSWORD=...
MYAPP_RELEASE_KEY_PASSWORD=...
```

### C2. Build release bundles

**Vendor:**

```powershell
Set-Location apps\vendor-web
npm run build:prod
npx cap sync android
Set-Location android
.\gradlew.bat bundleRelease
```

Output: `apps\vendor-web\android\app\build\outputs\bundle\release\app-release.aab`

**Customer:**

```powershell
Set-Location apps\customer-web
npm run build
npx cap sync android
Set-Location android
.\gradlew.bat bundleRelease
```

Output: `apps\customer-web\android\app\build\outputs\bundle\release\app-release.aab`

### C3. Pre-upload checklist

- [ ] `versionCode` **>** last Play upload (7 if last was 6).
- [ ] `npx cap sync android` run after **every** `capacitor.config.json` change.
- [ ] `<queries>` present; `<uses-permission>` **unchanged** from approved list.
- [ ] Vendor: `CapacitorHttp.enabled: true`.
- [ ] Customer: **no** `CapacitorHttp`; `overrideUserAgent` set; full `MainActivity.java`.
- [ ] customer-web + vendor-web **deployed** to prod (remote URL apps load live JS).
- [ ] Debug APK verification passed on a physical device (Android 11+).

### C4. Play Console

Upload each AAB to the correct app listing. Add release notes, e.g.:

- **Vendor 1.0.4 (7):** Gallery/center photo upload fix for Android WebView; intent visibility for camera/gallery.
- **Customer 1.0.4 (7):** Razorpay UPI in app; payment header safe area; UPI app deep-link handling.

---

## Part D — Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Gallery works in Chrome, not APK | Old APK (v6) or missing `<queries>` / `CapacitorHttp` | Rebuild + reinstall; sync capacitor config |
| UPI works in Chrome, not APK | Missing `overrideUserAgent`, `<queries>`, or old JS chunk | Deploy customer-web + invalidate CDN + new APK |
| UPI flashes then hides | Old Razorpay `banks` config cached | Hard refresh / reinstall; check console for `blocks.upi` |
| Login shows new user in APK | `CapacitorHttp` enabled on customer | Remove plugin from customer `capacitor.config.json` |
| UPI list shows but app won’t open | Missing `MainActivity` intent handler | Copy §B5 WebViewClient block |
| Header still under status bar | CSS-only fix attempted | Must use §B5 native insets; redeploy **APK** not web only |
| `BuildConfig.DEBUG` compile error | Missing `buildFeatures.buildConfig` | Add to vendor `build.gradle` |
| `SDK location not found` | No `local.properties` | `sdk.dir=C\:\\Android\\Sdk` in `android/local.properties` |

---

## Part E — Copilot task summary (copy as prompt)

```
You are updating Warmpawz Android Capacitor apps from Play versionCode 6 to 7.

CONSTRAINTS:
- Do NOT add, remove, or rename any <uses-permission> entries. Only add <queries> blocks.
- Vendor: enable CapacitorHttp in capacitor.config.json. Customer: do NOT enable CapacitorHttp.
- Customer MainActivity must include window inset padding AND UPI shouldOverrideUrlLoading.
- Bump versionCode to 7 and versionName to 1.0.4 in both apps before bundleRelease.

VENDOR:
1. Merge postJsonWithXhr + photo-upload-enhanced base64 upload from warmpawzaws.
2. Add manifest <queries> for camera/gallery intents.
3. capacitor.config.json: CapacitorHttp enabled, server.url vendor.warmpawz.com.
4. build.gradle: buildConfig true, versionCode 7.

CUSTOMER:
1. Merge getWarmpawzRazorpayUpiDisplayConfig + UniversalPaymentPage Razorpay options.
2. capacitor.config.json: overrideUserAgent Chrome string, NO CapacitorHttp.
3. Add manifest <queries> for upi + UPI packages.
4. Replace MainActivity.java with warmpawzaws customer version (insets + UPI intents).
5. build.gradle: versionCode 7, release signing from keystore repo.

BUILD:
npm run build:prod (vendor) / npm run build (customer) → npx cap sync android → gradlew bundleRelease
Copy keystore.properties + .keystore from keystore repo before release build.
```

---

## Part F — File copy list (warmpawzaws → your repo)

| Purpose | Source path in warmpawzaws |
|---------|----------------------------|
| Vendor upload HTTP | `apps/vendor-web/lib/api-client.ts` (`postJsonWithXhr`) |
| Vendor gallery | `apps/vendor-web/lib/photo-upload-enhanced.ts` |
| Vendor Capacitor config | `apps/vendor-web/capacitor.config.json` |
| Vendor manifest queries | `apps/vendor-web/android/app/src/main/AndroidManifest.xml` |
| Vendor build.gradle | `apps/vendor-web/android/app/build.gradle` |
| Vendor MainActivity | `apps/vendor-web/android/app/src/main/java/com/warmpawz/vendor/MainActivity.java` |
| Customer UPI JS | `apps/customer-web/lib/razorpay/razorpay-utils.ts` |
| Customer checkout builder | `apps/customer-web/lib/razorpay/build-standard-checkout-options.ts` |
| Customer payment page | `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx` |
| Customer Capacitor config | `apps/customer-web/capacitor.config.json` |
| Customer manifest | `apps/customer-web/android/app/src/main/AndroidManifest.xml` |
| Customer MainActivity | `apps/customer-web/android/app/src/main/java/com/warmpawz/customer/MainActivity.java` |
| Extra docs | `apps/vendor-web/ANDROID_BUILD.md`, `apps/customer-web/ANDROID_UPI_FIX.md` |

---

## Part G — Where to put this file in the keystore repo

Copy this document to:

```
keystore/docs/COPILOT_V7_ANDROID_BUILD.md
```

Pin it in Copilot instructions or reference it in `docs/APP_BUILD_MEMORY.md` under “v7 migration”.

---

*Last aligned with warmpawzaws: vendor versionCode 7 / 1.0.4, customer Capacitor scaffold + MainActivity inset/UPI handler.*
