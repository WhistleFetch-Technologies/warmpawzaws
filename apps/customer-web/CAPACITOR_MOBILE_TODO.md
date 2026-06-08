# Capacitor mobile — your manual TODO list

**Last updated:** 2026-06-06  
**App:** Warmpawz Customer (`com.warmpawz.app`)  
**WebView URL:** `https://customer.warmpawz.com`

Use this as the running checklist. **Phases 1–4 repo work is done**; you build, sign, deploy (when authorized), and QA on devices.

---

## Still required (blocking prod mobile)

### A. Deploy web + domain verification

- [ ] **Deploy customer-web** to prod (so `.well-known` and Razorpay JS ship)
  ```bash
  ./scripts/deploy-customer-web.sh --prod   # when explicitly authorized
  ```
- [ ] **`apple-app-site-association`** — replace `TEAMID` in  
  `apps/customer-web/public/.well-known/apple-app-site-association`  
  (Apple Team ID, 10 chars)
- [ ] **`assetlinks.json`** — replace `REPLACE_WITH_RELEASE_KEY_SHA256_FINGERPRINT` in  
  `apps/customer-web/public/.well-known/assetlinks.json`
  ```bash
  keytool -list -v -keystore YOUR_RELEASE.keystore -alias YOUR_ALIAS
  ```
- [ ] Confirm live URLs (no 404):
  - `https://customer.warmpawz.com/.well-known/apple-app-site-association`
  - `https://customer.warmpawz.com/.well-known/assetlinks.json`

### B. Android APK/AAB (you said “later” — still pending)

- [ ] Build web: `cd apps/customer-web && npm run build`
- [ ] Sync: `npm run cap:sync`
- [ ] Open Android Studio: `npm run cap:open:android`
- [ ] Build signed APK/AAB (release keystore)
- [ ] Smoke-test: hardware back, App Links, shop checkout, order track (no loop)

### C. iOS — Mac + Xcode (required for any iOS build)

- [ ] On **Mac**: `cd apps/customer-web && ./scripts/cap-ios-phase1.sh`
- [ ] `npm run cap:open:ios`
- [ ] Xcode → **Signing & Capabilities** → Team + bundle `com.warmpawz.app`
- [ ] Run on **simulator/device** → app loads `customer.warmpawz.com`
- [ ] **Archive → TestFlight** (Phase 5)

---

## Phase status (repo vs you)

| Phase | In repo | You must do |
|-------|---------|-------------|
| **1 Bootstrap** | `@capacitor/ios`, `ios/`, scripts | Mac: pod install, Xcode run |
| **2 Navigation** | Universal Links files, entitlements, iOS swipe-back JS | Deploy `.well-known`, device QA |
| **3 Razorpay UPI** | `Info.plist` schemes, `RazorpayBridgeViewController.swift`, storyboard | Mac: archive IPA, test UPI on device |
| **4 Push** | Entitlements, Info.plist, AppDelegate, `IOS_PUSH_SETUP.md` | Mac: Xcode capabilities + Firebase .p8 + device |
| **5 TestFlight / release** | `scripts/cap-testflight-checklist.sh` | You: Archive + App Store Connect |

---

## Phase 4 — Push (repo done; you finish on Mac)

**In repo:** `App.entitlements` (aps-environment), `Info.plist` background mode, `AppDelegate` APNs hooks, `ios-config/IOS_PUSH_SETUP.md`

```bash
./scripts/cap-push-phase4-verify.sh   # Mac/Git Bash — checks files only
```

**You still must:**

- [ ] Xcode → **Push Notifications** + **Background Modes → Remote notifications**
- [ ] Firebase → upload **APNs .p8** for `com.warmpawz.app`
- [ ] Test on **physical iPhone** (not simulator)
- [ ] App Store build: switch to **`production`** aps-environment (`ios-config/App.entitlements.production.example`)

See `ios-config/IOS_PUSH_SETUP.md` (replaces short notes below).

<details>
<summary>Legacy short notes</summary>

On Mac, in Xcode → App target → **Signing & Capabilities**:

- [ ] **+ Push Notifications**
- [ ] **+ Background Modes** → **Remote notifications**
- [ ] Firebase Console → Cloud Messaging → iOS → upload **APNs Auth Key (.p8)**

</details>

---

## Phase 5 — TestFlight

```bash
./scripts/cap-testflight-checklist.sh   # prints checklist
```

- [ ] Archive in Xcode → Upload to App Store Connect
- [ ] Internal TestFlight QA (navigation §8 + UPI + push)

---

## Device QA checklist (both platforms)

Copy from `CUSTOMER_NAV_AUDIT.md` §8:

- [ ] Home → Vet → Clinic list → Back ×3 (reverse order, not jump home)
- [ ] Bottom nav Home from deep shell → stack cleared
- [ ] Shop checkout success → Back does not return to payment
- [ ] Order success → Track → Back (no tracking ↔ detail loop)
- [ ] **iOS only:** edge swipe back on shell `/` (vet flow)
- [ ] **Android only:** hardware back same as in-app back
- [ ] Deep link: open `https://customer.warmpawz.com/shop/...` from browser → app
- [ ] **Push:** tray notification → correct screen (physical device)

---

## Quick commands

```bash
cd apps/customer-web

# Web build + sync both native projects
npm run build
npm run cap:sync

# Android (Windows OK)
npm run cap:open:android

# iOS (Mac only)
./scripts/cap-ios-phase1.sh
npm run cap:open:ios
```

---

## Do not

- Enable **`CapacitorHttp`** on customer (breaks login/session)
- Force-push `develop` / `prod`
- Skip `.well-known` placeholders before expecting verified App/Universal Links

---

*Navigation rules for new features:* `.cursor/rules/customer-navigation.mdc`
