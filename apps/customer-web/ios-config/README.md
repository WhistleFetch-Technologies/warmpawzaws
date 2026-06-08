# iOS Capacitor setup (customer-web)

**Bundle ID (canonical):** `com.warmpawz.app` (matches `capacitor.config.json`)

Navigation JS is shared with Android (`lib/navigation/`). Native iOS work is phased; see `CUSTOMER_NAV_AUDIT.md` §10.

**Push (Phase 4):** see **[IOS_PUSH_SETUP.md](./IOS_PUSH_SETUP.md)** — full APNs + Firebase steps.

**Manual checklist:** `../CAPACITOR_MOBILE_TODO.md`

---

## Phase 1 — Bootstrap

`npx cap add ios` works on Windows/Linux (creates `ios/`). **Building the IPA requires macOS** (Xcode + CocoaPods).

```bash
cd apps/customer-web
./scripts/cap-ios-phase1.sh
# or manually:
npm ci && npm run build && npm run cap:add:ios && npm run cap:sync:ios
npm run cap:open:ios
```

After `cap add ios`:

1. Copy `ios-config/GoogleService-Info.plist` → `ios/App/App/GoogleService-Info.plist`
2. Xcode → App target → **Signing & Capabilities** → Team + bundle `com.warmpawz.app`
3. Run on simulator — WebView loads `https://customer.warmpawz.com` (same as Android)

**npm scripts**

| Script | Purpose |
|--------|---------|
| `npm run cap:add:ios` | One-time: create `ios/` (Mac only) |
| `npm run cap:sync:ios` | Copy web assets + config into Xcode project |
| `npm run cap:open:ios` | Open `ios/App/App.xcworkspace` |

Commit `ios/` if the team tracks native projects (Android is tracked today).

---

## Phase 2 — Navigation (later)

- Associated Domains: `applinks:customer.warmpawz.com` (in `App.entitlements`)
- Host `/.well-known/apple-app-site-association` on the domain
- QA: edge-swipe back on shell `/` vs in-app back buttons

---

## Phase 3 — Razorpay UPI

See [`IOS_RAZORPAY_UPI_FIX.md`](../IOS_RAZORPAY_UPI_FIX.md) (`LSApplicationQueriesSchemes`, `RazorpayBridgeViewController`).
