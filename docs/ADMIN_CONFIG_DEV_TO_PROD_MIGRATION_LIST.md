# Admin Configuration Migration: Dev → Prod RDS – Data to Migrate

This document lists **all configuration data** that should be migrated from **Dev RDS** to **Prod RDS** so that the admin UI (Catalog, Platform Settings, Finance & Logistics, policies, etc.) shows the same **current/live config** in production—not old seed files.

Use this as the checklist. **After you confirm this list, the actual migration scripts can be implemented.**

---

## 1. Catalog & Services (Admin: Service Catalog)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 1.1 | `roles` | Table | Vendor roles (veterinarian, groomer, trainer, etc.) and config | Catalog → Vendor Roles tab; Roles page |
| 1.2 | `role_permissions` | Table | Permissions per role | RBAC / Roles |
| 1.3 | `service_categories` | Table | Categories (veterinary, grooming, etc.), display order, category_id, icon | Catalog → Categories tab |
| 1.4 | `service_catalog` | Table | Master list of services: names, roles, style, price, status, publish_status, display_order, specialization_ids | Catalog → Service Catalog tab |
| 1.5 | `specialization_master` | Table | Specializations (e.g. general_health, surgery) for problem grid / vendor profile | Catalog / discovery |
| 1.6 | `specialization_symptoms` | Table | Symptom mappings for specializations (if used) | Discovery / problem grid |
| 1.7 | `ecommerce_categories` | Table | Product/shop categories (admin-managed) | Ecommerce / Catalog |

**Notes:**  
- Export **all rows** from these tables.  
- Insert order: `roles` → `role_permissions`; `service_categories` → `service_catalog`; `specialization_master` → `specialization_symptoms`.

---

## 2. Platform Settings (Admin: Platform Settings)

### 2.1 Key–value and integration config

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 2.1.1 | `platform_settings` | Table | All key–value config (e.g. `admin:settings:aws`, `platform:integrations:aws`, `platform:integrations:google_maps`, `platform:integrations:razorpay`, `platform:settings:logistics`, `admin:finance:settlement-schedule`, `platform:fees:config`, etc.) | Platform Settings → Cloud & Maps; Payment Gateway; Logistics; Schedule |
| 2.1.2 | `admin_settings` | Table | Admin UI settings by category/key: payment, payout, refund, schedule, sms, aws, dashboard, **fee configuration** (platform_fee_*, convenience_fee_*, delivery_fee_*, etc.), **settlement** (rules if stored here), **ecommerce** (cancellation_refund_policy) | Platform Settings; Finance → Fee Config, Schedule, Ecommerce policies |
| 2.1.3 | `payment_gateway_settings` | Table | Gateway name and config (Razorpay, Stripe, Paytm). **Secrets:** use placeholders or keep in Secrets Manager for prod | Platform Settings → Payment Gateway |

### 2.2 Cloud & Maps, Payment, Logistics (stored in above tables)

- **AWS / SNS / SMS:** `platform_settings` (e.g. `admin:settings:aws`) or `admin_settings`.
- **Google Maps:** `platform_settings` (e.g. `platform:integrations:google_maps`, `google_maps_api_key`, `google_maps_map_id`).
- **Razorpay / Stripe / Paytm:** `platform_settings` (e.g. `platform:integrations:razorpay`) and/or `payment_gateway_settings`.
- **Logistics (Shiprocket, Delhivery, BlueDart, etc.):** `platform_settings` (e.g. `platform:settings:logistics`, `platform:integrations:shiprocket`, `platform:integrations:delhivery`) and **logistics partners/rules** below.

### 2.3 Logistics (Platform Settings → Logistics Integration)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 2.3.1 | `logistics_partners` | Table | Partners (Shiprocket, Delhivery, BlueDart, etc.): partner_id, config, regions, pricing, enabled | Platform Settings → Logistics → Partners & Configuration |
| 2.3.2 | `logistics_rules` | Table | Delivery rules: distance, base_fee, per_km_rate, applies_to (ecommerce, pharmacy, meal), etc. | Platform Settings → Logistics → Delivery Rules |

### 2.4 Loyalty & Rewards (Platform Settings → Loyalty & Rewards)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 2.4.1 | `loyalty_rules` | Table | Points per rupee, redemption rate, min redemption points | Platform Settings → Loyalty & Rewards |

### 2.5 Discovery & Rule Book (Platform Settings → Rule Book)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 2.5.1 | `discovery_rules` | Table | Discovery rules (role, flow, city, service_style) | Platform Settings → Rule Book |
| 2.5.2 | `problem_grid_mappings` | Table | Problem grid (problem_id, role_id, sub_category, order) for customer UI | Problem grid / discovery |
| 2.5.3 | `scheduling_policies` | Table | Buffer, slot duration, etc. | Scheduling config |

### 2.6 Legal & Policies (Platform Settings → Legal & Policies)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 2.6.1 | `content_pages` | Table | Static/content pages (T&C, privacy, vendor agreements) | Platform Settings → Legal & Policies |
| 2.6.2 | `notification_templates` | Table | Admin-managed notification templates | Notifications / templates |

---

## 3. Finance & Logistics (Admin: Finance)

### 3.1 Fee configuration

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.1.1 | `admin_settings` | Table | Rows with fee keys: `platform_fee_percentage`, `platform_fee_flat`, `max_platform_fee`, `convenience_fee_booking`, `convenience_fee_order`, `convenience_fee_tele`, `delivery_fee_base`, `delivery_fee_per_km`, `free_delivery_threshold`, `max_delivery_distance`, `packaging_fee_enabled`, `packaging_fee_amount`, and `fee_override_*` for service types | Finance → Fee Configuration |

### 3.2 Payment policies (payment rules)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.2.1 | `vendor_payment_rules` | Table | Payment/reservation rules by vendor type, service location (advance, escrow, grace period, etc.) | Finance → Payment Policies; Payment Gateway tab |

### 3.3 Refund policies

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.3.1 | `vendor_refund_tiers` | Table | Refund tiers: hours before service, refund %, cancellation fee, service_location, cancelled_by, etc. (platform-level; no vendor_id or vendor_id IS NULL) | Finance → Refund Policies |
| 3.3.2 | `refund_tiers` | Table | Legacy/platform refund tiers (tier_name, min_hours_before_booking, refund_percentage) | If still used |
| 3.3.3 | `refund_rules` | Table | **Only rows where vendor_id IS NULL** (platform defaults) | If used |

### 3.4 Cancellation policy

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.4.1 | `cancellation_policies` | Table | Platform cancellation policies (hours before, fee %, refund %, cancellation_windows, vendor_cancellation_penalty, no_show_policy, service_category, service_format) | Finance → Cancellation Policy |
| 3.4.2 | `booking_cancellation_rules` | Table | **Only rows where vendor_id IS NULL** (platform defaults) | If used |

### 3.5 Ecommerce policies

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.5.1 | `admin_settings` | Table | `setting_category = 'ecommerce'`, `setting_key = 'cancellation_refund_policy'`: returnWindowHours, cancelBeforeDispatchFullRefund, refundProcessingDays, nonReturnableCategories | Finance → Ecommerce Policies |
| 3.5.2 | `ecommerce_policies` | Table | **Only platform-level rows** (vendor_id IS NULL if supported, or default policy rows used as platform default) | Finance → Ecommerce Policies (if stored in table) |

### 3.6 GST / Tax

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.6.1 | `tax_categories` | Table | Tax category name and rate | Finance → GST Configuration; Flexible Tax |
| 3.6.2 | `gst_configs` | Table | GST config (CGST/SGST/IGST) | Finance → GST Configuration |
| 3.6.3 | `hsn_codes` | Table | HSN code and GST rate | Finance → GST Configuration |
| 3.6.4 | `gst_rules` | Table | GST rules by role/service style (if exists) | Finance → GST / Flexible Tax |

### 3.7 Settlement schedule & rules

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.7.1 | `platform_settings` | Table | `setting_key = 'admin:finance:settlement-schedule'` | Finance → Schedule Settings |
| 3.7.2 | `settlement_rules` | Table | If table exists: rule_name, rule_type, conditions, actions, priority, is_active | Finance → Settlement Rules |
| 3.7.3 | `admin_settings` | Table | If no settlement_rules table: `setting_category = 'settlement'`, `setting_key = 'rules'` (JSON array of rules) | Finance → Settlement Rules |

### 3.8 Payout rules & booking rules

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.8.1 | `payout_rules` | Table | Min payout amount, processing days, fee % | Finance / Payout config |
| 3.8.2 | `booking_rules` | Table | Advance booking, cancellation, rescheduling, payment rules | Finance / Booking config |

### 3.9 Tier system (vendor tiers)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 3.9.1 | `vendor_tiers` | Table | Tier name, display name, commission_rate, payout_period_days, monthly_cost, yearly_cost, is_default, features, applicable_roles, terms_and_conditions | Finance → Tier System |

---

## 4. Policies (RBAC and platform policies)

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 4.1 | `rbac_policies` | Table | RBAC access policies (policy_id, rules, effect) | Roles / Governance |
| 4.2 | All policy-related tables above | — | Cancellation, refund, payment, payout, booking, ecommerce (see Sections 3.2–3.5, 3.8) | Finance; Platform Settings |

---

## 5. Onboarding & discovery

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 5.1 | `onboarding_forms` | Table | Per-role form definition (role_id, fields JSON, version, status) | Catalog → Onboarding tab |

---

## 6. Regions & content

| # | Source (Dev) | Table / Storage | What it holds | Admin UI location |
|---|--------------|-----------------|---------------|-------------------|
| 6.1 | `regions` | Table | Regions (name, code, country, config) | Regions page / config |

---

## 7. Summary: Tables to export (in FK-safe order)

1. **Roles & catalog:** `roles` → `role_permissions` → `service_categories` → `service_catalog` → `specialization_master` → `specialization_symptoms` → `ecommerce_categories`
2. **Policies (platform):** `cancellation_policies` → `rbac_policies` → `booking_rules` → `payout_rules` → `refund_rules` (platform only) → `refund_tiers` → `booking_cancellation_rules` (platform only) → `vendor_refund_tiers` → `vendor_payment_rules`
3. **Tax/GST:** `tax_categories` → `gst_configs` → `hsn_codes` → `gst_rules`
4. **Platform & admin settings:** `platform_settings` → `admin_settings` → `payment_gateway_settings`
5. **Settlement rules:** `settlement_rules` (if table exists)
6. **Logistics:** `logistics_partners` → `logistics_rules`
7. **Tiers:** `vendor_tiers`
8. **Ecommerce policies (table):** `ecommerce_policies` (platform/default rows only if applicable)
9. **Onboarding:** `onboarding_forms`
10. **Discovery & scheduling:** `problem_grid_mappings` → `discovery_rules` → `scheduling_policies`
11. **Loyalty, regions, content:** `loyalty_rules` → `regions` → `notification_templates` → `content_pages` → `report_templates` (if exists)

---

## 8. Explicitly excluded (do not migrate)

- **Vendors:** `vendors`, `vendor_identity`, `vendor_services`, `vendor_settings`, etc.
- **Customers:** `customers`, `pets`, `customer_wallets`, etc.
- **Staff:** `staff`, `staff_services`, `staff_availability`, etc.
- **Transactions:** `bookings`, `payments`, `refunds`, `orders`, `order_items`, `payouts`, `settlements`, `wallet_transactions`, etc.
- **Operational:** `notifications`, `reminder_queue`, `otp_tokens`, `support_tickets` (optional: only ticket templates if any), `search_history`, `search_analytics`
- **Vendor-specific policy rows:** e.g. `refund_rules`, `booking_cancellation_rules` where `vendor_id IS NOT NULL`; `ecommerce_policies` where `vendor_id IS NOT NULL` (unless you want to migrate vendor-level policies; usually prod starts with no vendors)

---

## 9. How to run the migration (implemented)

Scripts are in `scripts/admin-config/`. **Secrets in platform_settings are copied as-is; Prod can keep using AWS Secrets Manager and use these as fallback.**

### Step 1: Export from Dev

From the project root, with Dev RDS reachable (and AWS CLI + credentials if using `ENVIRONMENT=dev`):

```bash
# Option A: Direct connection string (Dev)
DATABASE_URL="postgres://user:pass@dev-rds-endpoint:5432/warmpawz" node scripts/admin-config/export-admin-config.js

# Option B: Use AWS + ENVIRONMENT=dev (resolves cluster and secret)
ENVIRONMENT=dev node scripts/admin-config/export-admin-config.js
```

- Output directory: `scripts/admin-config/export/<YYYY-MM-DD-HHmmss>/`
- Contains one JSON file per table (`roles.json`, `platform_settings.json`, …) and `manifest.json`.

### Step 2: Import into Prod

Point at Prod RDS and run import (uses latest export dir if path omitted):

```bash
# Option A: Direct connection string (Prod)
DATABASE_URL="postgres://user:pass@prod-rds-endpoint:5432/warmpawz" node scripts/admin-config/import-admin-config.js

# Option B: Use AWS + ENVIRONMENT=prod
ENVIRONMENT=prod node scripts/admin-config/import-admin-config.js

# Optional: use a specific export directory
ENVIRONMENT=prod node scripts/admin-config/import-admin-config.js scripts/admin-config/export/2025-02-10-123456
```

- Import **deletes** from the config tables (in reverse FK order), then **inserts** from the exported JSON (in FK-safe order), then sets `platform_settings.prod_bootstrap_completed = true`.
- If `prod_bootstrap_completed` is already set, import exits without changes unless you set `SKIP_BOOTSTRAP_CHECK=1`.

### Step 3: Re-run import (optional)

To re-import (e.g. after another export from Dev):

```bash
SKIP_BOOTSTRAP_CHECK=1 ENVIRONMENT=prod node scripts/admin-config/import-admin-config.js [path-to-export-dir]
```

### Check bootstrap status

```bash
DATABASE_URL="postgres://..." node scripts/admin-config/check-prod-bootstrap.js
# Exit 0 = bootstrap done; exit 1 = not done
```

---

## 10. Prod: missing tables and CSS (Tailwind) fix

### Missing tables on Prod

If Prod was deployed without running all migrations, these admin tables may be missing and can cause blank content or API errors: `settlement_rules`, `report_templates`, `content_pages`, `scheduling_policies`, `problem_grid_mappings`, `vendor_payment_rules`, `vendor_refund_tiers`, `booking_cancellation_rules`, `gst_rules`.

**Fix:** Run migration 550 on Prod (creates all of them with `IF NOT EXISTS`):

```bash
ENVIRONMENT=prod node scripts/run-migration-rds-node.js db/migrations/550_prod_missing_admin_tables.sql
```

Then re-import admin config so the new tables get data:

```bash
SKIP_BOOTSTRAP_CHECK=1 ENVIRONMENT=prod node scripts/admin-config/import-admin-config.js [path-to-export-dir]
```

### Admin portal CSS / Tailwind not loading

If the admin portal (e.g. admin.warmpawz.com/finance) loads but looks unstyled (no Tailwind):

1. **Ensure full build and deploy**  
   From project root run a full build and deploy so all `_next/static` assets (including CSS) are uploaded and CloudFront is invalidated:
   ```bash
   ./scripts/deploy-admin-web.sh
   ```
   Do not use `--deploy-only` unless you already have a fresh `dist` that was built with Tailwind.

2. **Build from repo root**  
   Admin-web’s Tailwind preset is `../../packages/ui/tailwind.preset`. Build from the repo root (or from `apps/admin-web` with `packages/ui` available) so the preset and content paths resolve and Tailwind can generate utility classes.

3. **Layout fallback**  
   The root layout includes inline fallback styles on `<body>` (background, color, font) so if the Tailwind CSS chunk fails to load, the shell still has a minimal style. Redeploy admin-web to pick this up.

4. **Check in browser**  
   Open DevTools → Network, reload the page, and confirm that the CSS file under `/_next/static/.../*.css` returns 200. If it’s 404, the deploy didn’t upload all of `dist/` or the path is wrong (e.g. basePath/assetPrefix).

## 11. Prod: vendor_identity and vendor_tiers columns (500 fixes)

If Prod returns 500 for **admin/finance/settlements**, **admin/payouts**, or **admin/payments/tiers**, run these migrations. The backend has fallbacks so endpoints can work without them, but running migrations is recommended for full behavior.

### vendor_identity missing (relation "vendor_identity" does not exist)

Settlements and payouts JOIN `vendor_identity` for vendor display names. Create the table on Prod:

```bash
ENVIRONMENT=prod node scripts/run-migration-rds-node.js db/migrations/049_vendor_onboarding_state_machine.sql
```

### vendor_tiers.terms_and_conditions missing (column "terms_and_conditions" does not exist)

Finance tier configuration expects `terms_and_conditions` and `terms_version` on `vendor_tiers`. Add them on Prod:

```bash
ENVIRONMENT=prod node scripts/run-migration-rds-node.js db/migrations/542_tier_terms_and_payout_options.sql
```

After running migrations, redeploy the backend (Lambda) so any cached behavior is cleared; the code already supports both “with” and “without” these so no code change is required after migrations.
