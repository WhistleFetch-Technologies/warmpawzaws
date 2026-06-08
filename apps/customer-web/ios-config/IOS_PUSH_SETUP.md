# iOS push notifications — Capacitor customer app

Bundle: **`com.warmpawz.app`**

---

## Repo (done)

| File | Purpose |
|------|---------|
| `ios/App/App/GoogleService-Info.plist` | Firebase iOS config (copy from `ios-config/`) |
| `ios/App/App/App.entitlements` | `aps-environment: development` + Associated Domains |
| `ios-config/App.entitlements.production.example` | Use `production` for App Store Archive |
| `ios/App/App/Info.plist` | `UIBackgroundModes` → `remote-notification` |
| `ios/App/App/AppDelegate.swift` | Forwards APNs token to Capacitor Push plugin |
| `lib/push-bootstrap.ts` | Permission, token, backend register, tap → navigate |
| `lib/push-navigation.ts` | Tray tap routing (bookings, deep_link, shop) |

Verify repo files:

```bash
cd apps/customer-web
./scripts/cap-push-phase4-verify.sh
```

---

## You must do (Mac + Firebase)

### 1. Xcode capabilities

Open `npm run cap:open:ios` → **App** target → **Signing & Capabilities**:

- [ ] **+ Push Notifications**
- [ ] **+ Background Modes** → check **Remote notifications**

(Entitlements file already has `aps-environment`; Xcode may merge capabilities on save.)

### 2. Firebase APNs

1. [Apple Developer](https://developer.apple.com) → Keys → create APNs key → download **.p8** (once)
2. [Firebase Console](https://console.firebase.google.com) → Project → **Cloud Messaging** → **Apple app configuration**
3. Upload **APNs Authentication Key** (.p8), Key ID, Team ID
4. Confirm iOS app uses same bundle ID as `GoogleService-Info.plist`

### 3. Build environment

| Build | `aps-environment` |
|-------|-------------------|
| Debug / dev device | `development` (current `App.entitlements`) |
| TestFlight / App Store | **`production`** — swap entitlements or use Xcode Release profile |

Before **Archive**, either:

- Replace `aps-environment` with `production` in `App.entitlements`, or  
- Copy `ios-config/App.entitlements.production.example` → `ios/App/App/App.entitlements`

Then: `npm run build && npm run cap:sync:ios` → Archive.

### 4. Device test

- [ ] Install on **physical iPhone** (push does not work on simulator for remote)
- [ ] Login → accept notification permission
- [ ] Send test from Firebase Console or backend
- [ ] Tray appears; tap opens booking / deep link screen
- [ ] Cold start from notification tap

---

## Android push (already mostly wired)

- `android/app/google-services.json` present
- `POST_NOTIFICATIONS` in `AndroidManifest.xml`
- Same JS: `push-bootstrap.ts`

Rebuild APK after `cap sync` when you get to Android build.

---

## Do not

- Enable `CapacitorHttp` on customer
- Deploy prod without explicit approval (see team bible)

See also: `CAPACITOR_MOBILE_TODO.md`
