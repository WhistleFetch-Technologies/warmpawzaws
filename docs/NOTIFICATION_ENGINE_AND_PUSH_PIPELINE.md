# Notification Engine & Push Pipeline

Reference for how Warmpawz delivers **in-app** and **system tray** notifications on dev and prod.  
Deploy steps: see `docs/notification-campaign-engine-deploy-verify.md`.

---

## 1. Two layers (do not mix them up)

| Layer | What it does | Main tables |
|-------|----------------|-------------|
| **Inbox (1020)** | Rows the apps poll; read/unread UI | `notifications`, `notification_delivery_log` |
| **Campaign engine (1024/1025)** | Admin creates/sends campaigns; audience + audit | `notification_campaigns`, `notification_campaign_deliveries`, templates, segments |

**Tray push** always needs both: a campaign (or other sender) that calls FCM **and** a row in `device_tokens` for that user/device.

---

## 2. End-to-end flow

```
Admin (/notification-engine)
  → POST /admin/notifications/campaigns/:id/send
  → resolveCampaignRecipientIds (audience filters)
  → For each recipient:
        1) INSERT notifications (inbox — in-app works)
        2) delivery_log + in-app channel finalized
        3) If channel includes PUSH and push enabled:
             SELECT all active fcm_token FROM device_tokens
             WHERE user_id = recipient AND user_type = customer|vendor
             → sendPushToMultipleDevices (Firebase Admin on Lambda)
        4) Record campaign delivery SENT/FAILED
  → Apps poll inbox (~5s) + OS shows tray if FCM succeeded
```

Campaign send runs **inside the Lambda HTTP request** (cap **5,000** recipients per send). Push is batched (**500** tokens per FCM multicast).

---

## 3. Device registration (every phone, automatic)

Native apps load **customer.warmpawz.com** / **vendor.warmpawz.com** (Capacitor WebView). Push is **not** baked into the APK binary beyond `google-services.json` (your Play Store build responsibility).

### Client (`apps/*/lib/push-bootstrap.ts` + `PushSessionRegistrar`)

| Trigger | Behaviour |
|---------|-----------|
| App mount | `PushSessionRegistrar` in `providers.tsx` — full sync on open |
| App resume / tab visible | Re-sync (no force-stop required) |
| Login / UUID stored | `persistCustomerDatabaseId` → pipeline + `bootstrapPushNotifications` |
| Cognito session | `hasCustomerAppSession()` — `customerCognitoTokens`, phone, or legacy `authToken` |
| Missing UUID | `ensureResolvedCustomerIdForPush` → `/customer/by-phone` |
| FCM `registration` event | Persistent listener **before** `register()` — posts token even if bootstrap timed out |
| Token rotation | Same listener upserts new token |
| Account switch | Clears local sync markers; re-registers for new `userId` |
| Logout | `teardownPushNotifications` → `DELETE /push/unregister-device` |
| Periodic | Re-POST every **6 hours** per user (`needsPushRegistrationSync`) |

**API:** `POST /push/register-device` (public, no admin auth)  
Body: `userId` (DB UUID), `userType`, `fcmToken`, `deviceId`, `platform` (`android` / `ios` / `web`).

**Storage keys (customer):** `warmpawz_cust_push_device_id`, `warmpawz_cust_push_token`, `warmpawz_cust_push_registered_at`, `warmpawz_cust_push_registered_user_id`.

### Backend upsert (`push-notifications.ts`)

```sql
INSERT INTO device_tokens (...) ON CONFLICT (user_id, user_type, device_id) DO UPDATE
  SET fcm_token = ..., platform = ..., is_active = true
```

One row per **physical device** (`device_id`). Multiple devices per user → multiple rows → **campaign sends to all of them**.

---

## 4. Tray vs in-app only

| Symptom | Cause |
|---------|--------|
| In-app only | Inbox insert OK; no active `device_tokens` for that **prod UUID** |
| Tray on one phone, not another | Second device never registered; or wrong customer UUID in audience |
| Dev UUID in prod campaign | Prod has different `customers.id` per phone — target prod UUID |
| `platform: web` only on prod | Native app never completed Capacitor registration to prod API |

**Prod API:** `https://mss9sa4y01.execute-api.ap-south-1.amazonaws.com`  
**Runtime config** on S3/CloudFront sets `apiBaseUrl` (not the CDN URL).

---

## 5. Fixes applied (dev-abhi → prod)

1. **Listener race** — Capacitor `addListener('registration')` before `register()`.
2. **`permission: unknown`** — no longer blocks `register()` (only `denied` stops).
3. **Session detection** — Cognito + phone sessions, not only `authToken`.
4. **UUID resolution** — by-phone when `customerId` keys empty.
5. **Persistent pipeline** — `ensureCapacitorPushRegistrationPipeline` + late FCM callback.
6. **Android channel** — `warmpawz_push` before register.
7. **Multi-device / multi-account** — `needsPushRegistrationSync`, resume sync, account-switch handling.
8. **Campaign SQL** — audience `DISTINCT` + `ORDER BY` fix (`notification-campaign-audience.ts`).
9. **Prod deploy** — migrations 1024/1025 via RDS Data API; Lambda + customer/vendor/admin web; prod build injects `NEXT_PUBLIC_*` + `runtime-config.js`.

---

## 6. Firebase & APK

| Item | Owner |
|------|--------|
| `google-services.json` in APK | You (Play Store builds: `com.warmpawz.customer`, `com.warmpawz.vendor`) |
| Lambda Firebase credentials | AWS Secrets Manager `warmpawz/prod/firebase` or `FIREBASE_*` env |
| Web VAPID | `NEXT_PUBLIC_FIREBASE_VAPID_KEY` on web deploy (browser/PWA path only) |

Capacitor native path uses **native FCM**, not the web Firebase SDK.

---

## 7. Migrations

| File | Purpose |
|------|---------|
| `1024_notification_campaign_engine.sql` | Campaign tables, templates, segments, channel settings |
| `1025_admin_notifications_permissions.sql` | Admin RBAC for notification UI |

**Prod (Windows-friendly):**

```powershell
$env:I_CONFIRM_PROD_MIGRATION_1024_1025='YES'
node scripts/run-migration-1024-1025-rds-data-api-prod-cli.js
```

**Dev:**

```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1024_notification_campaign_engine.sql
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1025_admin_notifications_permissions.sql
```

---

## 8. Deploy (prod)

```powershell
.\scripts\promote-notification-engine-prod.ps1 -Yes
```

Or manually: Lambda `warmpawz-prod-api-handler`, then `prodscripts/deploy-*-web-prod.ps1`, admin inline in promote script.

**Do not use CDK** — only `scripts/` and `prodscripts/` deploy paths.

---

## 9. Verify

### RDS tokens (prod)

```powershell
node scripts/check-push-tokens-prod-rds-data.js --phone=8296974568
```

Expect `platform: android` (or `ios`) with recent `updated_at`.

### Admin

1. Log in to prod admin → **Notification engine**.
2. New campaign, channel **PUSH**, send to audience.
3. Phones: logged in, notifications allowed — **open app once** after deploy (registration is automatic).

### API sanity (routes exist; 401 without admin token is OK)

```powershell
node scripts/sanity-check-notification-engine-prod.js
```

---

## 10. Key files

| Area | Path |
|------|------|
| Campaign send | `backend/lambda/src/utils/notification-campaign-processor.ts` |
| Audience SQL | `backend/lambda/src/utils/notification-campaign-audience.ts` |
| Admin API | `backend/lambda/src/endpoints/admin/endpoints/notification-campaigns.ts` |
| Device register | `backend/lambda/src/endpoints/push-notifications.ts` |
| FCM send | `backend/lambda/src/utils/firebase-client.ts` |
| Customer push | `apps/customer-web/lib/push-bootstrap.ts`, `components/PushSessionRegistrar.tsx` |
| Vendor push | `apps/vendor-web/lib/push-bootstrap.ts`, `components/PushSessionRegistrar.tsx` |
| Admin UI | `apps/admin-web` → `/notification-engine` |

---

## 11. Operational notes

- **Resend** a campaign already `SENT` may not re-fire the same way — create a **new** campaign for tests.
- Same phone can map to **multiple** customer UUIDs on prod — register and target the UUID the user is logged in with.
- Play Store apps with correct `google-services.json` pick up web bundle updates on next normal app open (CloudFront may take 5–15 minutes after deploy).
