# Notification Campaign Engine — Build, Deploy & Verify

**Branch:** `dev-abhi`  
**Migrations:** `1024_notification_campaign_engine.sql`, `1025_admin_notifications_permissions.sql`  
**Dev API base:** `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`

This document describes what was built for the admin Notification Campaign Engine, how to deploy it to dev (and prod), and how to verify end-to-end behaviour including debug Capacitor APKs.

---

## 1. Architecture Overview

The notification system has **two complementary layers** that must not be confused:

| Layer | Purpose | Primary table(s) |
|-------|---------|------------------|
| **Inbox + delivery state machine (1020)** | Per-user notification rows polled by Capacitor apps; delivery lifecycle tracking | `notifications`, `notification_delivery_log` |
| **Campaign engine (1024/1025)** | Admin-created broadcast/targeted campaigns with audience, templates, audit trail | `notification_campaigns`, junction tables, `notification_campaign_deliveries` |

### End-to-end send flow

```
Admin UI (/notification-engine)
  → POST /admin/notifications/campaigns/:id/send
  → resolveCampaignRecipientIds (audience SQL)
  → executeCampaignDelivery (per recipient)
      → Insert notifications (inbox)
      → notification_delivery_log + in-app finalize (1020 state machine)
      → FCM push via device_tokens (if enabled)
      → notification_campaign_deliveries → SENT/FAILED
  → Customer/Vendor app polls inbox (5s interval)
  → Native push tray (if token registered)
```

Campaign send is **synchronous inside the Lambda request** (up to **5,000 recipients**). There is no separate SQS worker for campaigns yet.

### Route registration order

Campaign endpoints are registered in `backend/lambda/src/handler/index.ts` **before** `registerAdminAdvancedEndpoints` so new `/admin/notifications/*` routes take precedence over legacy handlers.

---

## 2. What Was Built

### 2.1 Database — Migration 1024

**File:** `db/migrations/1024_notification_campaign_engine.sql`

Creates the campaign platform schema.

**Enums**

- `notification_campaign_channel` — PUSH, SMS, EMAIL, WHATSAPP, IN_APP
- `notification_target_app` — CUSTOMER, VENDOR
- `notification_campaign_status` — DRAFT, SCHEDULED, QUEUED, SENDING, SENT, FAILED, CANCELLED
- `notification_campaign_delivery_status` — PENDING, SENT, DELIVERED, FAILED
- `notification_targeting_type` — BROADCAST, SPECIFIC_USERS, REGIONS, CITIES, SEGMENTS
- `notification_campaign_event_type` — CREATED, UPDATED, VALIDATED, SCHEDULED, QUEUED, SENDING, SENT, FAILED, CANCELLED

**Core tables**

| Table | Purpose |
|-------|---------|
| `notification_campaigns` | Campaign metadata + `audience_filters JSONB` |
| `notification_channel_settings` | Per-app push on/off (seeded CUSTOMER + VENDOR) |
| `notification_campaign_templates` | Reusable title/message/CTA templates |
| `notification_segments` | Named audience segments |
| `notification_segment_rules` | Rule rows per segment |
| `notification_segment_targets` | Campaign ↔ segment junction |
| `notification_campaign_deliveries` | Per-recipient campaign pipeline output |
| `notification_campaign_events` | Audit trail |

**Targeting junction tables**

| Table | Key column | Matches |
|-------|------------|---------|
| `notification_campaign_regions` | `region_id` | `regions.id` |
| `notification_campaign_cities` | `city_name TEXT` | `customers.city` / `vendors.city` |
| `notification_campaign_users` | `user_id` | Specific customer/vendor UUID |
| `notification_segment_targets` | `segment_id` | `notification_segments.id` |

**Seeds:** 5 example segments and 5 campaign templates (idempotent by name).

> **Important:** Inbox rows remain in the existing `notifications` table (migration 1020). Campaigns use `notification_campaigns` — no schema collision.

### 2.2 Database — Migration 1025

**File:** `db/migrations/1025_admin_notifications_permissions.sql`

Grants RBAC permissions to `admin_master`:

- `admin.notifications.view`
- `admin.notifications.create`
- `admin.notifications.edit`
- `admin.notifications.approve`
- `admin.notifications.send`
- `admin.notifications.analytics`

Also wired in:

- `backend/lambda/src/utils/admin-rbac-permissions.ts`
- `backend/lambda/src/endpoints/roles.ts`
- `apps/admin-web/lib/admin-route-permissions.ts`

### 2.3 Backend — Campaign API

**File:** `backend/lambda/src/endpoints/admin/endpoints/notification-campaigns.ts`

| Method | Route | Purpose |
|--------|-------|---------|
| GET/PUT | `/admin/notifications/settings` | Customer/vendor push toggles |
| POST | `/admin/notifications/estimate-audience` | Audience count + warnings (no send) |
| GET/POST/PUT/DELETE | `/admin/notifications/templates` | Campaign template CRUD |
| GET/POST | `/admin/notifications/segments` | Segment list + create |
| POST | `/admin/notifications/segments/:id/preview` | Segment audience preview |
| GET/POST/PUT | `/admin/notifications/campaigns` | Campaign CRUD |
| GET | `/admin/notifications/campaigns/:id` | Campaign + targeting |
| POST | `/admin/notifications/campaigns/:id/duplicate` | Clone campaign |
| POST | `/admin/notifications/campaigns/:id/validate` | Pre-send validation |
| POST | `/admin/notifications/campaigns/:id/schedule` | Set SCHEDULED status |
| POST | `/admin/notifications/campaigns/:id/send` | **Full delivery pipeline** |
| POST | `/admin/notifications/campaigns/:id/cancel` | Cancel campaign |
| GET | `/admin/notifications/campaigns/:id/deliveries` | Paginated delivery records |
| GET | `/admin/notifications/campaigns/:id/analytics` | Delivery status counts |

### 2.4 Backend — Audience resolution

**File:** `backend/lambda/src/utils/notification-campaign-audience.ts`

Shared by estimate and send. Filters align with the real RDS schema:

| Filter | SQL behaviour |
|--------|---------------|
| BROADCAST | All active customers/vendors |
| REGIONS | Match `state`/`city` text against selected `regions.name` / `regions.code` |
| CITIES | Match `LOWER(TRIM(city))` against selected city names |
| SPECIFIC_USERS | `id = ANY(uuid[])` |
| SEGMENTS | Loads segment rules + name hints (e.g. Dog Owners → `pet_type: dog`) |
| Pet type | `pets.species` |
| Activity | Booking recency via `bookings` |
| Wallet min | `customer_wallets.balance` |
| Vendor type | `vendors.category` LIKE |
| Vendor status | `vendors.status` |

**Limits:** `loyalty_tier` filter warns and is skipped (no `loyalty_members` table yet). Max **5,000** recipients per send.

### 2.5 Backend — Send processor

**File:** `backend/lambda/src/utils/notification-campaign-processor.ts`

For each resolved recipient:

1. Insert `notification_campaign_deliveries` (PENDING)
2. Insert `notifications` inbox row (`notification_type: 'campaign'`)
3. Create `notification_delivery_log` entries
4. Advance in-app delivery: `created → queued → sent → delivered`
5. If push enabled and channel is PUSH: load `device_tokens`, send via Firebase (`sendPushToMultipleDevices`, batches of 500)
6. Update delivery row → SENT or FAILED
7. Update campaign → SENT (or FAILED if zero inbox deliveries)

Push respects `notification_channel_settings.push_enabled` per target app.

### 2.6 Backend — Inbox delivery monitoring (1020)

**File:** `backend/lambda/src/endpoints/admin/endpoints/admin-notification-delivery.ts`  
**Utility:** `backend/lambda/src/utils/notification-delivery.ts`

| Route | Purpose |
|-------|---------|
| `GET /admin/notifications/delivery/stats` | Aggregate delivery status counts |
| `GET /admin/notifications/delivery` | Paginated inbox monitor |
| `GET /admin/notifications/:id/delivery-log` | Per-notification channel log |
| `POST /admin/notifications/test` | Test notification |

**Admin pages**

| Path | Purpose |
|------|---------|
| `/notification-engine` | Create, estimate, send campaigns |
| `/notifications` | Inbox delivery monitor (1020) |

### 2.7 Admin web UI

| File | Purpose |
|------|---------|
| `apps/admin-web/app/notification-engine/page.tsx` | Full campaign workflow |
| `apps/admin-web/components/admin/notification-engine/CampaignPreview.tsx` | Live preview mockups |
| `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx` | Nav: Marketing → Notification Engine |

**Workflow:** Campaign details → Audience → Message builder → Preview → Estimate → Validate → Send / Schedule

**Picker data sources**

- Regions: `GET /admin/regions`
- Cities: `GET /admin/banners/locations/cities`
- Segments: `GET /admin/notifications/segments`

### 2.8 Mobile app integration (existing, fed by campaigns)

Campaign send writes to the same inbox mobile apps already poll.

**Customer (Capacitor web)**

- Polls `GET /customer/notifications?phone=` every **5 seconds** — `apps/customer-web/components/customer/useNotificationService.tsx`
- Push: `apps/customer-web/lib/push-bootstrap.ts` → `POST /push/register-device`

**Vendor (Capacitor web)**

- Polls via `useVendorNotificationService`
- Push: `apps/vendor-web/lib/push-bootstrap.ts`

**Push path:** `POST /push/send` → `backend/lambda/src/utils/firebase-client.ts`

No mobile app code changes are required for campaigns to appear in inbox after backend deploy.

---

## 3. Deployment Procedure

### Prerequisites

- AWS CLI configured for the target environment
- Node.js for migration scripts
- Bash (Git Bash / WSL) for Lambda deploy on Windows

### Step 1 — Get the code

```bash
git fetch origin
git checkout dev-abhi
git pull origin dev-abhi
```

### Step 2 — Run migrations on RDS

**Order matters:** run **1024**, then **1025**, then deploy Lambda.

**Dev:**

```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1024_notification_campaign_engine.sql
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1025_admin_notifications_permissions.sql
```

The script connects to `warmpawz-{ENVIRONMENT}-cluster` via Secrets Manager and executes SQL from `db/migrations/`.

**Optional RDS verification:**

```sql
SELECT COUNT(*) FROM notification_campaign_templates;
SELECT permission_name FROM role_permissions WHERE permission_name LIKE 'admin.notifications.%';
```

**Prod (when ready):**

```bash
ENVIRONMENT=prod node scripts/run-migration-rds-node.js 1024_notification_campaign_engine.sql
ENVIRONMENT=prod node scripts/run-migration-rds-node.js 1025_admin_notifications_permissions.sql
```

### Step 3 — Deploy Lambda

**Dev:**

```bash
./scripts/deploy-lambda-direct.sh
```

Defaults to `warmpawz-dev-api-handler` in `ap-south-1`. Builds `backend/lambda`, packages `api-handler.zip`, uploads to AWS.

**Prod:**

```bash
LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh
```

### Step 4 — Deploy admin web

Deploy admin-web to the dev admin host so `/notification-engine` is available. Lambda deploy alone does not publish the Next.js UI.

---

## 4. Verification Procedure

### 4.1 Automated API sanity check

```bash
node scripts/sanity-check-notification-engine-dev.js
```

**Expected after migrate + deploy (all checks pass):**

| Check | Expected |
|-------|----------|
| `GET /admin/notifications/campaigns` | 200 |
| `GET /admin/notifications/settings` | 200 |
| `GET /admin/notifications/templates` | 200, array from `notification_campaign_templates` |
| `GET /admin/notifications/segments` | 200 |
| `GET /admin/notifications/delivery/stats` | 200 |
| `POST /admin/notifications/estimate-audience` | 200, `{ estimatedRecipients, warnings }` |

**Pre-deploy baseline:** campaign routes return 404; templates may 500 (`column "name" does not exist`) because legacy handler hits the wrong table.

### 4.2 Route probe

```bash
node scripts/probe-notification-routes-dev.js
```

### 4.3 Admin UI functional test

1. Log in as admin with `admin.notifications.*` (or `admin_master`)
2. Open `/notification-engine`
3. Create a BROADCAST campaign targeting CUSTOMER
4. Fill title (≤60 chars), message (≤180 chars)
5. Click **Estimate Audience** — count should be > 0 if customers exist
6. **Save Draft**, then **Send Now**
7. Response should include `status: "SENT"`, `sentRecipients`, etc.
8. Open `/notifications` — new rows with `notification_type: campaign`

### 4.4 Debug Capacitor APK — inbox

1. Install debug customer APK pointed at dev API
2. Log in as a customer in the broadcast audience
3. Within ~5 seconds, inbox poll should surface the campaign notification
4. Confirm via API:

```bash
curl "https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/customer/notifications?phone=<phone>&limit=10"
```

### 4.5 Debug Capacitor APK — native push

1. Open app — push bootstrap registers token in `device_tokens`
2. Get FCM token from logcat:

```bash
adb logcat | findstr /i "FCM token registration"
```

3. Smoke test:

```bash
node scripts/test-native-push-dev.js --userId=<uuid> --userType=customer --token=<fcm-token>
```

4. Send a campaign with **SPECIFIC_USERS** targeting that UUID — tray notification should appear if push is enabled in channel settings.

### 4.6 Database verification post-send

```sql
SELECT id, name, status, estimated_recipients, sent_recipients, sent_at
FROM notification_campaigns ORDER BY created_at DESC LIMIT 5;

SELECT status, COUNT(*) FROM notification_campaign_deliveries
WHERE campaign_id = '<campaign-id>' GROUP BY status;

SELECT id, recipient_id, title, notification_type, delivery_status, created_at
FROM notifications WHERE notification_type = 'campaign'
ORDER BY created_at DESC LIMIT 10;
```

---

## 5. Known Limitations

| Item | Status |
|------|--------|
| Scheduled auto-send | `POST .../schedule` sets SCHEDULED; no cron/SQS fires at `scheduled_at_utc` |
| Async queue for large sends | Synchronous in Lambda (5k cap; may hit timeout on large sends) |
| Loyalty tier filter | UI field exists; SQL skipped until `loyalty_members` exists |
| SMS / EMAIL / WHATSAPP | Enum exists; pipeline implements PUSH + in-app only |
| Campaign analytics | Delivery status counts only; no open/click tracking |
| Segment rules UI | Segments via API; admin UI has multi-select only |

---

## 6. File Reference

| Area | Path |
|------|------|
| Campaign migration | `db/migrations/1024_notification_campaign_engine.sql` |
| Permissions migration | `db/migrations/1025_admin_notifications_permissions.sql` |
| Campaign API | `backend/lambda/src/endpoints/admin/endpoints/notification-campaigns.ts` |
| Send processor | `backend/lambda/src/utils/notification-campaign-processor.ts` |
| Audience SQL | `backend/lambda/src/utils/notification-campaign-audience.ts` |
| Inbox delivery utils | `backend/lambda/src/utils/notification-delivery.ts` |
| Delivery monitor API | `backend/lambda/src/endpoints/admin/endpoints/admin-notification-delivery.ts` |
| Handler registration | `backend/lambda/src/handler/index.ts` |
| Admin campaign UI | `apps/admin-web/app/notification-engine/page.tsx` |
| Admin delivery monitor | `apps/admin-web/app/notifications/page.tsx` |
| Sanity script | `scripts/sanity-check-notification-engine-dev.js` |
| Route probe | `scripts/probe-notification-routes-dev.js` |
| Push smoke test | `scripts/test-native-push-dev.js` |
| Lambda deploy | `scripts/deploy-lambda-direct.sh` |
| RDS migration runner | `scripts/run-migration-rds-node.js` |

---

## 7. Deploy Checklist

```
[ ] git pull dev-abhi
[ ] Migration 1024 on target RDS
[ ] Migration 1025 on target RDS
[ ] ./scripts/deploy-lambda-direct.sh
[ ] node scripts/sanity-check-notification-engine-dev.js  → all pass
[ ] Admin: /notification-engine → estimate + send test campaign
[ ] Debug APK: inbox within ~5s
[ ] Debug APK: push tray (if device token registered)
[ ] Admin: /notifications delivery monitor shows new rows
```
