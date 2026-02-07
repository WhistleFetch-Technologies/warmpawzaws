# Admin Config Export – Complete Table List & Final Plan

This document is the **specific, final** list of what gets exported from dev and imported into prod when you run the one-time bootstrap. It includes **policies**, **onboarding forms**, **marketing and promotions**, and almost everything except vendor/customer transactional data. Use it to assure yourself before proceeding.

---

## 1. What We Export (Included) – By Category

### 1.1 Roles & service catalog

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `roles` | Vendor roles (veterinarian, groomer, etc.) and config | All rows |
| `role_permissions` | Permissions per role | All rows |
| `service_catalog` | Master list of services (IDs, names, roles, style, price) | All rows |
| `service_categories` | Categories (veterinary, grooming, etc.) and display order | All rows |
| `specialization_master` | Specializations (e.g. general_health, surgery) for problem grid / vendor profile | All rows |
| `specialization_symptoms` | Symptom mappings for specializations (if used) | All rows |

### 1.2 Policies configuration

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `cancellation_policies` | Platform cancellation policies (hours before, fee %) | All rows |
| `rbac_policies` | RBAC access policies (policy_id, rules, effect) | All rows |
| `booking_rules` | Advance booking, cancellation, rescheduling, payment rules | All rows |
| `payout_rules` | Min payout, processing days, fee % | All rows |
| `refund_rules` | Time/amount/status-based refund rules | **Only rows where `vendor_id IS NULL`** (platform defaults) |
| `refund_tiers` | Platform refund tiers (tier_name, min_hours_before_booking, refund_percentage) | All rows |
| `booking_cancellation_rules` | Cancellation cutoff hours, etc. | **Only rows where `vendor_id IS NULL`** (platform defaults) |
| `vendor_refund_tiers` | Refund tier definitions (hours, %, cancelled_by, service_location) – **platform config**, no vendor_id | All rows |
| `vendor_payment_rules` | Payment/reservation rules by vendor type – **platform config** | All rows |

### 1.3 Tax, GST, HSN

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `tax_categories` | Tax category name and rate | All rows |
| `gst_configs` | GST config (CGST/SGST/IGST) | All rows |
| `hsn_codes` | HSN code and GST rate | All rows |
| `gst_rules` | GST rules by role/service style (if exists) | All rows |

### 1.4 Platform & admin settings

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `platform_settings` | Key-value config (e.g. `admin:settings:aws` for SMS/SNS, other platform keys) | All rows (or only keys starting with `admin:`, `platform:` – your choice; recommend all) |
| `admin_settings` | Admin UI settings by category/key (payment, payout, refund, schedule, sms, aws, dashboard, etc.) | All rows |
| `payment_gateway_settings` | Gateway name and config (structure; **secrets stay in Secrets Manager**, not re-exported as sensitive values) | All rows (or export with placeholder for secrets) |

### 1.5 Onboarding forms

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `onboarding_forms` | Per-role form definition (role_id, fields JSON, version, status) | All rows |

### 1.6 Discovery, scheduling, problem grid

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `problem_grid_mappings` | Problem grid (problem_id, role_id, sub_category, order) for customer UI | All rows |
| `discovery_rules` | Discovery rules (role, flow, city, service_style) | All rows |
| `scheduling_policies` | Scheduling policies (buffer, slot duration, etc.) | All rows |

### 1.7 Marketing and promotions

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `promotions` | Promotions (name, type, discount, dates, is_spotlight, banner, etc.) | All rows |
| `coupons` | Coupon codes and discount config | All rows |
| `platform_promotions` | Platform-wide promotions (if exists) | All rows |
| `spotlight_offers` | Spotlight offers (role, category, title, discount, CTA, dates) | All rows |

### 1.8 Loyalty, regions, content

| Table | What it holds | Export rule |
|-------|----------------|-------------|
| `loyalty_rules` | Loyalty program rules (points, actions) | All rows |
| `regions` | Regions (name, code, country, config) | All rows |
| `notification_templates` | Templates for notifications (admin-managed) | All rows |
| `content_pages` | Static/content pages (e.g. T&C, privacy) | All rows |
| `report_templates` | Report templates for admin (if exists) | All rows |
| `ecommerce_categories` | Product/shop categories (admin-managed) | All rows |

### 1.9 Dashboard / UI config

| Source | What it holds | Export rule |
|--------|----------------|-------------|
| `admin_settings` | Dashboard layout, feature flags, UI config (if stored by category/key) | Already in 1.4; ensure dashboard-related keys are present in export |
| `platform_settings` | Any dashboard or UI keys | Already in 1.4 |

---

## 2. What We Do NOT Export (Excluded)

These are **vendor or customer data** or transactional data. Prod will have **zero** vendors and **zero** customers until they onboard/register in prod.

| Category | Tables (examples) |
|----------|-------------------|
| Vendors | `vendors`, `vendor_identity`, `vendor_onboarding_applications`, `vendor_services`, `vendor_settings`, `vendor_documents`, `vendor_kyc_verifications`, `vendor_bank_details`, `vendor_stats`, `vendor_promotions`, `vendor_service_promotions`, `vendor_refund_tiers` (only if per-vendor; in our schema it’s platform – see 1.2), `vendor_support_requests`, etc. |
| Customers | `customers`, `customer_wallets`, `customer_loyalty_points`, `customer_preferences`, `pets`, etc. |
| Staff | `staff`, `staff_services`, `staff_availability`, etc. (tied to vendors) |
| Transactions | `bookings`, `payments`, `refunds` (transaction table), `orders`, `order_items`, `payouts`, `settlements`, `wallet_transactions`, `coupon_usage`, `loyalty_transactions`, etc. |
| Operational | `notifications` (user-facing), `reminder_queue`, `otp_tokens`, `support_tickets` (optional: you could export ticket *templates* only; exclude per-user tickets), `search_history`, `search_analytics`, etc. |
| Refund/booking rules that are per-vendor | For `refund_rules` and `booking_cancellation_rules` we export **only** rows where `vendor_id IS NULL` (platform defaults). Rows with `vendor_id` set are excluded. |

---

## 3. Export Order (FK-safe)

When writing the import script, insert in an order that respects foreign keys (e.g. `roles` before `role_permissions`, `service_categories` before `service_catalog`). Suggested order:

1. `roles` → `role_permissions`
2. `service_categories` → `service_catalog`
3. `specialization_master` → `specialization_symptoms` (if applicable)
4. `cancellation_policies`, `rbac_policies`, `tax_categories`, `gst_configs`, `hsn_codes`, `gst_rules`
5. `booking_rules`, `payout_rules`, `refund_rules` (platform only), `refund_tiers`, `booking_cancellation_rules` (platform only), `vendor_refund_tiers`, `vendor_payment_rules`
6. `platform_settings`, `admin_settings`, `payment_gateway_settings`
7. `onboarding_forms`
8. `problem_grid_mappings`, `discovery_rules`, `scheduling_policies`
9. `promotions`, `coupons`, `platform_promotions`, `spotlight_offers`
10. `loyalty_rules`, `regions`, `notification_templates`, `content_pages`, `report_templates`, `ecommerce_categories`

---

## 4. Final Plan Summary (One-Pager)

### One-time bootstrap (before or on first prod deploy)

1. **Migrations** – Run DB migrations on prod (schema only).
2. **Export** – From **dev** DB, export all tables (and filters) listed in **Section 1** in FK-safe order to JSON files.
3. **Import** – Into **prod** DB: truncate or delete only those admin-config tables (in safe order), then insert from the exported JSON. Set bootstrap marker (e.g. `platform_settings.prod_bootstrap_completed`).
4. **Admin user** – Create Cognito user `admin@warmpawz.com` with password `Warmpawz2025` in prod pool; add to admin group. Update bootstrap marker.
5. **SMS** – Either include `admin:settings:aws` in the export (so prod gets it from dev) or run `seed-sms-aws-settings.js` once for prod with prod credentials.

### Every “promote develop → prod” run

1. **Check** – Run `check-prod-bootstrap.js` against prod DB. If bootstrap already done → **skip** export/import and admin seed.
2. **Migrations** – Run `migrate:up` (schema only) on prod.
3. **Deploy** – Terraform apply (prod), deploy Lambda, deploy **web** (admin-web, customer-web, vendor-web) to prod S3/CloudFront. No app build; no seed:prod (047/048).

### What you get in prod after bootstrap

- **Policies:** Cancellation, RBAC, booking, payout, refund rules (platform), refund_tiers, vendor_refund_tiers, vendor_payment_rules.
- **Onboarding forms:** All role-based form definitions.
- **Marketing & promotions:** Promotions, coupons, platform_promotions, spotlight_offers.
- **Tax/GST/HSN:** tax_categories, gst_configs, hsn_codes, gst_rules.
- **Roles & catalog:** roles, role_permissions, service_catalog, service_categories, specializations.
- **Platform & admin settings:** platform_settings (including SMS), admin_settings, payment_gateway_settings (structure).
- **Discovery & scheduling:** problem_grid_mappings, discovery_rules, scheduling_policies.
- **Content & loyalty:** loyalty_rules, regions, notification_templates, content_pages, report_templates, ecommerce_categories.
- **Dashboard/UI:** Whatever is stored in admin_settings / platform_settings for dashboard and UI.
- **No vendor data** – Zero vendors; no vendor-specific refund/payment rows. No customer data, no bookings, no orders.

---

## 5. Assurance checklist

- [ ] **Policies:** cancellation_policies, rbac_policies, booking_rules, payout_rules, refund_rules (platform), refund_tiers, booking_cancellation_rules (platform), vendor_refund_tiers, vendor_payment_rules – all in Section 1.
- [ ] **Onboarding forms:** onboarding_forms – in Section 1.
- [ ] **Marketing and promotions:** promotions, coupons, platform_promotions, spotlight_offers – in Section 1.
- [ ] **Tax/GST/HSN:** tax_categories, gst_configs, hsn_codes, gst_rules – in Section 1.
- [ ] **Everything except vendor data:** Section 1 = full list; Section 2 = explicit exclusions (vendors, customers, transactions).
- [ ] **Seed runs only once:** Bootstrap marker + check-prod-bootstrap.js; no 047/048 on every deploy.

When you’re satisfied with this list, you can treat it as the final plan and implement the export/import scripts and bootstrap flow accordingly.
