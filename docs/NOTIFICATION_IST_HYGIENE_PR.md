# PR: Notification IST display + device token hygiene + campaign targeting

**Branch:** `feature/abhi-notification-ist-hygiene` → **`develop`**

## Summary

- Formats booking date/time in **IST-friendly copy** (push, SMS, templates) via backend only — **no native app rebuild required** for push tray text.
- Caps active `device_tokens` per user/platform after register to prevent reinstall bloat (default: 3 ios/android, 5 web).
- Admin campaigns: **has push token** + optional **platform** audience filters; removed non-functional loyalty tier field.
- Customer inbox page: relative timestamps use **Asia/Kolkata** for dates (web CDN deploy only).

**Does not change:** FCM send path, `firebase-client.ts` payload shape, Capacitor push-bootstrap, or APNs configuration. iOS/Android push delivery remains on the existing unified pipeline.

## Files changed

| Area | Files |
|------|--------|
| IST formatters | `backend/lambda/src/utils/notification-display-format.ts` (+ tests) |
| Booking push/SMS | `booking-notifications.ts`, `sms-notifications.ts`, `jio-vendor-appointment-sms.ts`, `aws-sns-notification-service.ts` |
| Token hygiene | `device-token-hygiene.ts`, `push-notifications.ts` |
| Campaigns | `notification-campaign-audience.ts`, `apps/admin-web/app/notification-engine/page.tsx` |
| Inbox UI | `apps/customer-web/app/notifications/page.tsx` |

## Deploy order (dev)

```bash
# 1) Backend — required for push/SMS IST copy + token cap + campaign SQL
cd backend/lambda && npm run build
./scripts/deploy-lambda-direct.sh

# 2) Admin — campaign audience UI (optional if only testing booking push)
./scripts/deploy-admin-web.sh

# 3) Customer web — inbox timestamp labels only (optional)
./scripts/deploy-customer-web.sh
```

**No TestFlight / Play Store rebuild needed** for this PR.

## Test plan

### Regression: iOS + Android push (critical)

1. Vendor TestFlight: login → allow notifications → confirm `POST /push/register-device` 200.
2. Fire test push: `POST /push/send` with vendor `userId` / `userType: vendor`.
3. **Pass:** Firebase success, notification appears on lock screen (app killed).
4. Repeat on Android vendor app.

### IST copy

1. Create booking on dev with time e.g. `18:30` IST.
2. **Pass:** Vendor push body shows `6:30 PM` (not raw `18:30`).
3. **Pass:** Customer `booking_created` push template shows formatted date/time.

### Device token cap

1. Query `device_tokens` for test vendor before/after login from a fresh install.
2. **Pass:** Active ios rows ≤ 3 (or `DEVICE_TOKEN_MAX_ACTIVE_PER_PLATFORM` env).

### Admin campaign

1. Open `/notification-engine` on dev admin.
2. Enable **Only users with active push token** → Estimate audience.
3. **Pass:** Count ≤ broadcast count; warnings empty.
4. Optional: filter **iOS** only → estimate drops appropriately.

### SMS (unchanged send path)

1. Booking created still triggers customer SMS if configured — body dates should read IST-style.

## Rollback

- Redeploy previous Lambda artifact from CI or prior commit on `develop`.
- Token cap is non-destructive (deactivates old rows only); re-register restores active token.

## Env vars (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEVICE_TOKEN_MAX_ACTIVE_PER_PLATFORM` | `3` | Max active tokens per user per ios/android |
| `DEVICE_TOKEN_MAX_ACTIVE_WEB` | `5` | Max active web tokens |

## Out of scope (follow-up PRs)

- Meal live/progress notifications
- SMS dedup when push token exists
- iOS Live Activities
