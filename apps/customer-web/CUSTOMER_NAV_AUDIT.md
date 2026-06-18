# Customer Web Navigation Audit

**Date:** 2026-06-06  
**Scope:** `apps/customer-web` — Capacitor Android prod + localhost dev  
**Prod mobile:** Capacitor + Next.js only (`WarmpawzCustomer` RN out of scope)

---

## 1. Dual-layer navigation

| Layer | Mechanism | Examples |
|-------|-----------|----------|
| **URL** | Next.js App Router + `window.history` | `/shop`, `/cart`, `/checkout`, `/bookings`, `/profile` |
| **Shell (SPA on `/`)** | `CustomerHomeWrapper` screen state | `vet`, `vet-clinic-list`, `grooming_center`, `checkout` (embedded) |
| **Cross-layer** | `lib/go-back-or-replace.ts` sessionStorage intents | Shop/promotions/help/wallet back from `/` resume |

---

## 2. Production vs legacy shell

| | `wrappers/CustomerHomeWrapper.tsx` (PROD) | `CustomerHomeWrapper.tsx` (legacy) |
|---|-------------------------------------------|-------------------------------------|
| Used by | `CustomerApp` | Not imported |
| Stack | `currentScreen` + `previousScreen` (1 level) | `navigationHistory[]` push/pop |
| `handleBack` | Resets to `home` | Pops stack; at root → `home` |
| Forward nav | ~100× `setCurrentScreen` | `navigateToScreen` push |

**Root cause of broken back:** Production lost `navigationHistory`; generic back always jumps home.

---

## 3. Router usage (approximate)

- **~280+** `router.push/replace/back` calls across ~90 files
- **Hot files:** `go-back-or-replace.ts` (37), `customer-account-sidebar-nav.ts` (12), `CustomerHomeComplete.tsx` (12), `wrappers/CustomerHomeWrapper.tsx` (27)
- **Shell:** ~100 `setCurrentScreen` in production wrapper

---

## 4. Bottom tabs

`BottomNavigation.tsx`: Home, Shop, Bookings, Profile

- Shell (`/`): `handleBottomNav` — Home resets shell to `home` (stack clear target)
- Standalone routes: `useCustomerAccountSidebarHost.handleTabbedBottomNav` — `router.push('/')`, `/shop`, `/bookings`

**Policy (approved):** Tap Home → shell stack cleared; Back from Home does not restore deep Shop.

---

## 5. Existing back utilities

`lib/go-back-or-replace.ts`:

- `goBackOrReplace` / `goBackOrHome` — URL back with fallback
- Per-route back intents: shop, promotions, help, wallet children, subscriptions, my-packages, wishlist
- `WARMPAWZ_OPEN_SCREEN_AFTER_NAV_KEY` — resume embedded screen after returning to `/`

---

## 6. Gaps (pre–Phase 2)

| Gap | Severity |
|-----|----------|
| No shell stack in prod wrapper | **Critical** |
| No NavigationService / RouteRegistry | High |
| No Capacitor hardware back listener | High (Android) |
| No App Links in AndroidManifest | Medium |
| Checkout success may allow back to payment | Medium |
| Duplicate product/vendor push | Medium |

---

## 7. Special-case back handlers (must preserve)

Production wrapper overrides — do not replace with generic pop alone:

- `handleBackFromLabDiagnostics` — return to vet hub
- `handleBackFromBookings` / `navigateBackToPreviousOr`
- Package purchase loop guard (`screenToReturnAfterLeavingPackagePurchase`)
- `handleBackFromPackageBooking`, `handleBackFromPets`
- Profile from account menu (`profileFromAccountMenuRef`)
- Banner CTA (`bannerReturnHomeRef`)
- Pet sitter origin, boarding vendors return screen
- ~20 inline `setCurrentScreen(previousScreen)` callbacks

---

## 8. Manual test checklist (Phase 2)

| Flow | Expected |
|------|----------|
| Home → Vet → Clinic list → Profile → Back ×3 | Reverse order, not Home jump |
| Home → Grooming → Center → Back ×2 | Center → Grooming → Home |
| Bottom nav Home from deep shell | Stack reset to `home` |
| `/shop` → product → browser Back | Product → Shop |
| Order success → Back | Not checkout (Phase 3) |

---

## 9. Implementation order

1. **Phase 2 (done):** `lib/navigation/shell-stack.ts` + prod wrapper stack
2. **Phase 3 (done):** NavigationService, RouteRegistry, tab-policy, checkout replace, hot-path migration
3. **Phase 4 (done):** Capacitor hardware back, App Links, deep-link back stack seeding

### Phase 4 notes

- `NavigationBackBridge` in `app/providers.tsx` — global URL back + Capacitor listeners
- `CustomerHomeWrapper` registers shell overlay/pop handler (priority 100)
- Android App Links: `https://customer.warmpawz.com` — requires `/.well-known/assetlinks.json` on domain for verified links
- Rebuild Android app after manifest change: `npm run cap:sync` + Android Studio

---

## 10. iOS pass (Capacitor)

**Status:** Phase 1 bootstrapped in repo — `@capacitor/ios`, `ios/` Xcode project (generated), config, Mac build script. **Xcode archive / TestFlight: macOS + CocoaPods required.**

| Phase | Scope | Status |
|-------|--------|--------|
| **1 Bootstrap** | `@capacitor/ios`, `ios/`, `cap:open:ios`, `scripts/cap-ios-phase1.sh` | **Done** — Xcode build on Mac |
| **2 Navigation** | Universal Links, entitlements, iOS swipe-back, `.well-known` files | **In repo** — replace TEAMID/SHA256 + deploy + device QA |
| **3 Payments** | `IOS_RAZORPAY_UPI_FIX.md`, `RazorpayBridgeViewController.swift` | **In repo** — Mac: archive IPA + UPI device test |
| **4 Push** | `IOS_PUSH_SETUP.md`, entitlements, AppDelegate APNs | **In repo** — Mac: capabilities + Firebase .p8 + device |
| **5 TestFlight** | `cap-testflight-checklist.sh` | Archive + App Store Connect QA |

### Phase 2 — Navigation (done in repo; verify on device)

- `ios/App/App/App.entitlements` — `applinks:customer.warmpawz.com`
- `public/.well-known/apple-app-site-association` — replace `TEAMID` before prod
- `public/.well-known/assetlinks.json` — replace Android release SHA-256
- `lib/navigation/ios-shell-history.ts` — iOS swipe ↔ shell stack on `/`
- `.cursor/rules/customer-navigation.mdc` — agent checklist for new services

**Before verified links work:** deploy customer-web, fill placeholders in `.well-known/`, `npm run cap:sync:ios`, rebuild IPA/APK.

### Phase 3 — Razorpay UPI (done in repo; verify on device)

- `ios/App/App/Info.plist` — `LSApplicationQueriesSchemes` (UPI apps)
- `ios/App/App/RazorpayBridgeViewController.swift` — opens `upi://` etc. in native apps
- `Main.storyboard` — root VC → `RazorpayBridgeViewController`
- JS already in `lib/razorpay/razorpay-utils.ts` (deploy customer-web for prod)

**Mac:** Archive IPA → TestFlight → tap UPI on real device.

### Phase 4 — Push (done in repo; verify on device)

- `App.entitlements` — `aps-environment: development` (+ production example)
- `Info.plist` — `UIBackgroundModes: remote-notification`
- `AppDelegate.swift` — Capacitor APNs token forwarding
- `ios-config/IOS_PUSH_SETUP.md`, `scripts/cap-push-phase4-verify.sh`

**You:** Xcode Push capability, Firebase APNs .p8, test on physical iPhone.

### Phase 5 — TestFlight

- `scripts/cap-testflight-checklist.sh`

**Living checklist:** `CAPACITOR_MOBILE_TODO.md`

### Phase 1 — Mac steps (build & run)

`npx cap add ios` can run on Windows/Linux (creates `ios/`), but **pod install, xcodebuild, and Archive require macOS**.

```bash
cd apps/customer-web
./scripts/cap-ios-phase1.sh   # skips cap add if ios/ exists
npm run cap:open:ios          # Xcode → select Team → Run on simulator
```

`GoogleService-Info.plist` is copied from `ios-config/` into `ios/App/App/` (also in repo under `ios-config/` for re-copy after regenerate).

### Android reminder (parallel, any OS with Android Studio)

```bash
npm run build && npm run cap:sync && npm run cap:open:android
# Publish https://customer.warmpawz.com/.well-known/assetlinks.json
```

### iOS vs Android back

- **Android:** `App.backButton` → `NavigationBackBridge` → shell pop / URL back
- **iOS:** No hardware back; edge swipe uses WebView history — Phase 2 must QA shell on `/`

---

## 11. AI agent rules (Cursor / automation)

**Default:** All AI-assisted changes in customer-web that touch navigation, back, or screen flow MUST use `lib/navigation/`. This does not police human-only edits.

### Before editing

- Read `.cursor/rules/customer-navigation.mdc`
- Read §7 (special-case backs) if touching `CustomerHomeWrapper`
- For checkout: read `back-handler-registry.ts` priorities (checkout = 105)

### Must use

| Context | API |
|---------|-----|
| Shell `/` | `navigateToScreen`, `handleBack`, `routeKey` |
| URL routes | `useCustomerNavigation()` |
| Checkout steps | `CheckoutProvider.goBack` + registered handlers |
| Leave guard | `requestLeave()` |

### Must not (unless user explicitly overrides)

- `router.push('/cart|checkout|shop|orders|bookings')` in new/changed code
- `onBack={() => setCurrentScreen('x')}` in shell
- Checkout back via `goBackOrReplace`
- Changing Razorpay open timing

### Allowed exceptions (document in code)

- `// nav-exception: <reason>` — external redirect, loop break, etc.
- User message: "do not use navigation stack here because ..."

### Verify (agents)

`cd apps/customer-web && npm run test:navigation` — expect 74+ tests pass after nav changes.
