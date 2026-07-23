# Warmpawz Pay Phase 1 — PostgreSQL Schema Verification

**Role:** Principal PostgreSQL Database Architect — pre-migration safety audit  
**Scope:** Verify that `1080_warmpawz_pay_phase1_schema.sql` can be generated safely without overwriting, dropping, or duplicating existing schema objects  
**Date:** 2026-07-23  
**Sources inspected:** `db/migrations/**`, `db/schemas/**`, `db/indexes.sql`, approved Phase 1 plans  
**Verdict:** **GO** — with mandatory pre-apply RDS checks documented in §15

---

## Executive summary

Repository inspection confirms **no committed migration or schema file** defines `payment_source`, `payments.original_amount`, `payments.metadata`, `pay_bill_enabled`, `promotion_usages.payment_id`, `coupon_usages.payment_id`, `coupon_usages.discount_amount`, or `warmpawz_pay_vendor_catalog`. Migration number **1080 is unused** (latest: two `1079_*` files). The only **destructive-risk operation** in Phase 1 is **`transactions.transaction_category` CHECK drop/recreate** — must preserve all six existing values plus `'warmpawz_pay'`. **`bank_verified`** is used in application code but **absent from migrations** — `ADD COLUMN IF NOT EXISTS` is correct but requires pre-flight `\d vendors` on target RDS. **`payments_status_check`** (011) references non-existent column `status` — verify on RDS whether this orphan constraint exists.

---

## 1. Existing schema inventory

### 1.1 `payments`

**Created:** `001_initial_schema.sql`  
**Schema snapshot:** `db/schemas/payment/payments.sql` (partial — predates many migration columns)

| Column | Type | Default | Introduced |
|--------|------|---------|------------|
| `id` | UUID PK | `gen_random_uuid()` | 001 |
| `booking_id` | UUID | — | 001 |
| `order_id` | UUID | — | 001 |
| `customer_id` | UUID NOT NULL | — | 001 |
| `vendor_id` | UUID | — | 001 |
| `amount` | NUMERIC(10,2) NOT NULL | — | 001 |
| `currency` | TEXT | `'INR'` | 001 |
| `payment_method` | TEXT NOT NULL | — | 001 |
| `payment_status` | TEXT NOT NULL | `'pending'` | 001 |
| `razorpay_order_id` | TEXT | — | 001 |
| `razorpay_payment_id` | TEXT | — | 001 |
| `razorpay_signature` | TEXT | — | 001 |
| `discount_amount` | NUMERIC(10,2) | `0` | 001 |
| `coupon_code` | TEXT | — | 001 |
| `promotion_id` | UUID | — | 001 |
| `loyalty_points_used` | INTEGER | `0` | 001 |
| `wallet_amount_used` | NUMERIC(10,2) | `0` | 001 |
| `transaction_id` | TEXT | — | 001 |
| `failure_reason` | TEXT | — | 001 |
| `created_at` | TIMESTAMPTZ | `NOW()` | 001 |
| `updated_at` | TIMESTAMPTZ | `NOW()` | 001 |
| `completed_at` | TIMESTAMPTZ | — | 001 |
| `idempotency_key` | TEXT | — | 043 |
| `commission_rate` | NUMERIC(5,2) | — | 008 |
| `platform_commission` | NUMERIC(10,2) | `0` | 008 |
| `vendor_amount` | NUMERIC(10,2) | `0` | 008 |
| `tier_at_payment` | TEXT | — | 008 |
| `gst_amount`, `cgst_amount`, `sgst_amount`, `igst_amount` | NUMERIC(10,2) | `0` | 007/045/510 |
| `gst_rule_id` | UUID | — | 510 |
| `price_validation` | JSONB | — | 008 |
| `platform_fee`, `convenience_fee`, `delivery_fee`, `packaging_fee` | NUMERIC(10,2) | `0` | 410 |
| `fee_breakdown` | JSONB | — | 410 |
| `commission_amount` | DECIMAL(10,2) | `0` | 057 |
| `total_amount` | DECIMAL(10,2) | — | 057 |
| `net_amount` | DECIMAL(10,2) | — | 058 |
| `discount_source` | VARCHAR(20) | — | 306 |
| `subscription_id` | UUID | — | 306 |
| `pharmacy_order_id` | UUID | — | 509 |

**Generated columns:** None  
**Phase 1 columns (not in repo):** `payment_source`, `original_amount`, `metadata`

---

### 1.2 `settlements`

**Created:** `001_initial_schema.sql`  
**Schema snapshot:** `db/schemas/payment/settlements.sql` (partial)

| Column | Type | Default | Introduced |
|--------|------|---------|------------|
| `id` | UUID PK | `gen_random_uuid()` | 001 |
| `vendor_id` | UUID NOT NULL | — | 001 |
| `total_amount` | NUMERIC(10,2) NOT NULL | — | 001 |
| `commission_amount` | NUMERIC(10,2) NOT NULL | — | 001 |
| `net_amount` | NUMERIC(10,2) NOT NULL | — | 001 |
| `settlement_status` | TEXT NOT NULL | `'pending'` | 001 |
| `settlement_period_start` | DATE NOT NULL | — | 001 |
| `settlement_period_end` | DATE NOT NULL | — | 001 |
| `payment_ids` | UUID[] NOT NULL | — (001); schema dump shows `'{}'` | 001 |
| `payout_id` | UUID | — | 001 |
| `created_at` | TIMESTAMPTZ | `NOW()` | 001 |
| `processed_at` | TIMESTAMPTZ | — | 001 |
| `completed_at` | TIMESTAMPTZ | — | 001 |
| `booking_id` | UUID | — | 020 |
| `payment_id` | UUID | — | 020 |
| `settlement_date` | DATE | — | 020 |
| `razorpay_settlement_id` | TEXT | — | 020 |
| `currency` | TEXT | `'INR'` | 020 |
| `failure_reason` | TEXT | — | 020 |
| `settlement_key` | TEXT UNIQUE | — | 008 |
| `excluded_payment_ids` | UUID[] | `'{}'` | 008 |
| `commission_rate_used` | NUMERIC(5,2) | — | 008 |
| `settlement_breakup` | JSONB | — | 029 |
| `tier_deduction_amount` | NUMERIC(10,2) | `0` | 029 |
| `order_type` | VARCHAR(50) | `'booking'` | 213 |
| `logistics_amount` | NUMERIC(10,2) | `0` | 213 |
| `referral_commission` | NUMERIC(10,2) | `0` | 213 |
| `fulfillment_type` | VARCHAR(50) | — | 213 |

**Generated columns:** None  
**Phase 1:** No new columns — unique partial index on `(payment_id)` WHERE `order_type = 'warmpawz_pay'`

---

### 1.3 `transactions`

**Created:** `053_admin_endpoints_tables.sql`  
**Schema file:** None under `db/schemas/`

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | UUID PK | `gen_random_uuid()` | |
| `transaction_id` | TEXT NOT NULL UNIQUE | — | |
| `transaction_type` | TEXT NOT NULL | — | CHECK inline |
| `transaction_category` | TEXT NOT NULL | `'booking'` | CHECK inline — **Phase 1 extend** |
| `customer_id`, `vendor_id`, `booking_id`, `order_id` | UUID | — | Inline FKs in CREATE |
| `payment_id` | UUID | — | FK → `payments(id) ON DELETE SET NULL` |
| `refund_id`, `payout_id` | UUID | — | Inline FKs |
| `amount` | NUMERIC(10,2) NOT NULL | — | |
| `currency` | TEXT NOT NULL | `'INR'` | |
| `status` | TEXT NOT NULL | `'pending'` | CHECK inline |
| `gateway`, `gateway_transaction_id`, `gateway_response` | various | — | |
| `transaction_date` | TIMESTAMPTZ NOT NULL | `NOW()` | |
| `processed_at`, `completed_at` | TIMESTAMPTZ | — | |
| `description`, `notes` | TEXT | — | |
| `metadata` | JSONB | `'{}'` | Already exists on **transactions**, not payments |
| `created_at`, `updated_at` | TIMESTAMPTZ | `NOW()` | |

**Generated columns:** None

---

### 1.4 `promotion_usages`

**Created:** `204_vendor_promotions_tables.sql`

| Column | Type | Default | FK |
|--------|------|---------|-----|
| `id` | UUID PK | `gen_random_uuid()` | — |
| `promotion_id` | UUID NOT NULL | — | **No FK** in migration |
| `promotion_type` | TEXT NOT NULL | — | — |
| `booking_id` | UUID | — | → `bookings(id) ON DELETE SET NULL` |
| `order_id` | UUID | — | → `orders(id) ON DELETE SET NULL` |
| `customer_id` | UUID | — | → `customers(id) ON DELETE SET NULL` |
| `discount_amount` | NUMERIC(10,2) NOT NULL | `0` | — |
| `original_amount` | NUMERIC(10,2) | — | — |
| `final_amount` | NUMERIC(10,2) | — | — |
| `created_at` | TIMESTAMPTZ | `NOW()` | — |

**Generated columns:** None  
**Phase 1:** Add `payment_id UUID NULL` → `payments(id)`

---

### 1.5 `coupon_usages`

**Created:** `013_coupon_tables.sql`

| Column | Type | Default | FK |
|--------|------|---------|-----|
| `id` | UUID PK | `gen_random_uuid()` | — |
| `coupon_id` | UUID NOT NULL | — | → `coupons(id) ON DELETE CASCADE` |
| `customer_id` | UUID | — | → `customers(id)` (no ON DELETE) |
| `booking_id` | UUID | — | → `bookings(id)` |
| `order_id` | UUID | — | → `orders(id)` |
| `used_at` | TIMESTAMPTZ | `NOW()` | — |

**Generated columns:** None  
**Phase 1:** Add `payment_id`; optionally `discount_amount NUMERIC(10,2)` IF NOT EXISTS

---

### 1.6 `vendors`

**Created:** `001_initial_schema.sql`  
**Schema snapshot:** `db/schemas/vendor/vendor.sql` (broader prod extract)

Core columns from 001 plus 40+ additive migrations (metadata, UPI, tier, seller_status, is_deleted, password_hash, etc.). See §9 for Phase 1 target columns.

**Generated columns:** None

---

## 2. Existing constraints (CHECK)

### 2.1 `payments.payment_status` ⚠️ Special attention

| Property | Value |
|----------|-------|
| **Primary constraint name** | `payments_payment_status_check` (named in `db/schemas/payment/payments.sql`; inline in 001 auto-names similarly) |
| **Definition** | `payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded')` |
| **Allowed values** | `pending`, `processing`, `completed`, `failed`, `refunded`, `partially_refunded` |
| **Phase 1 change?** | **No** — Warmpawz Pay reuses existing lifecycle values |
| **Recreation required?** | **No** |
| **Alter vs recreate** | N/A |
| **Risk of value loss** | **None** for Phase 1 |

**Legacy drift — `payments_status_check` (011_audit_fixes_complete.sql):**

| Property | Value |
|----------|-------|
| **Name** | `payments_status_check` |
| **Definition** | `status IN ('pending', 'processing', 'paid', 'refunded', 'partially_refunded', 'failed')` |
| **Problem** | References column **`status`**, which does **not exist** on `payments` (column is `payment_status`) |
| **Phase 1 impact** | None unless migration accidentally targets this name |
| **RDS pre-flight** | Query `pg_constraint` for `payments_status_check`; drop if orphan on prod |

---

### 2.2 `payments.payment_method`

| Property | Value |
|----------|-------|
| **Name** | `payments_payment_method_check` |
| **Definition** | `payment_method IN ('razorpay', 'wallet', 'cash', 'card', 'upi', 'netbanking')` |
| **Phase 1 change?** | **No** |
| **Recreation required?** | **No** |

---

### 2.3 `payments.discount_source`

| Property | Value |
|----------|-------|
| **Name** | Auto-generated inline (likely `payments_discount_source_check`) |
| **Definition** | `discount_source IN ('vendor', 'platform')` |
| **Introduced** | 306 |
| **Phase 1 change?** | **No** |

---

### 2.4 `transactions.transaction_category` ⚠️ Special attention — **MUST RECREATE**

| Property | Value |
|----------|-------|
| **Name** | `transactions_transaction_category_check` (PostgreSQL default for inline CHECK) |
| **Definition (current)** | `transaction_category IN ('booking', 'order', 'subscription', 'wallet', 'payout', 'other')` |
| **Source** | `053_admin_endpoints_tables.sql` line 112 |
| **Phase 1 required values** | All **six existing** + `'warmpawz_pay'` |
| **Recreation required?** | **Yes** — ADD CONSTRAINT cannot extend IN-list in place |
| **Alter vs recreate** | Must **DROP** (if exists) then **ADD** with full value set |
| **Risk of value loss** | **HIGH** if migration omits any existing value — existing rows would violate new CHECK |
| **Mitigation** | Idempotent `DO $$` block: discover constraint name via `pg_constraint`, drop, add with explicit 7-value list |

**Related (unchanged in Phase 1):**

| Constraint | Allowed values |
|------------|----------------|
| `transactions_transaction_type_check` | `payment`, `refund`, `payout`, `commission`, `fee`, `adjustment` |
| `transactions_status_check` | `pending`, `processing`, `success`, `failed`, `cancelled`, `refunded` |

---

### 2.5 `settlements.settlement_status` ⚠️ Special attention

| Property | Value |
|----------|-------|
| **Primary name** | `settlements_settlement_status_check` |
| **Definition** | `settlement_status IN ('pending', 'processing', 'completed', 'failed')` |
| **Source** | 001 inline; named in `db/schemas/payment/settlements.sql` |
| **Phase 1 change?** | **No** |
| **Recreation required?** | **No** |

**Duplicate name — `settlements_status_check` (011):**

| Property | Value |
|----------|-------|
| **Definition** | Same four values on `settlement_status` |
| **Risk** | Redundant duplicate CHECK on same column if both applied |
| **Phase 1 impact** | None — do not drop unless explicitly cleaning drift |
| **RDS pre-flight** | List all CHECK constraints on `settlements` |

---

### 2.6 `vendors.status` ⚠️ Special attention

| Property | Value |
|----------|-------|
| **Name** | Inline — typically `vendors_status_check` |
| **Definition** | `status IN ('new', 'onboarding', 'pending', 'approved', 'rejected', 'active', 'suspended', 'inactive')` |
| **Source** | 001, `db/schemas/vendor/vendor.sql` |
| **Default** | `'pending'` |
| **Phase 1 change?** | **No** — eligibility uses existing `'active'` value |
| **Recreation required?** | **No** |
| **Risk** | None |

**Other vendor CHECK constraints (unchanged):**

| Name | Definition | Source |
|------|------------|--------|
| `vendors_tier_check` | `tier IS NULL OR trim(tier) <> ''` | 543 (replaced restrictive Bronze/Platinum list) |
| Inline `tier` (001) | Dropped/replaced by 543 on upgraded DBs | 001 |
| `seller_status` inline | `not_applied`, `pending`, `approved`, `rejected` | 052 |
| `fulfillment_type` inline | `warmpawz`, `self`, `hybrid` | 210 |
| `rating` inline | `0 <= rating <= 5` | 058 |
| `onboarding_progress` inline | `0–100` | 030 |
| `chk_vendor_phone_format` | Phone regex | schema dump only |
| `chk_vendor_email_format` | Email regex | schema dump only |
| `chk_vendor_commission` | `0–100` | schema dump only |

---

### 2.7 `promotion_usages` / `coupon_usages`

| Table | CHECK constraints in repo |
|-------|---------------------------|
| `promotion_usages` | **None** |
| `coupon_usages` | **None** |

Phase 1 adds no CHECK on usage tables (FK + partial UNIQUE indexes only).

---

### 2.8 Proposed `warmpawz_pay_vendor_catalog.publish_status` (new table)

Not in repo. Phase 1 will add CHECK: `draft`, `published` only — **no conflict** with existing objects.

---

## 3. Existing foreign keys

### 3.1 `payments`

| Constraint | Source | Target | ON DELETE | ON UPDATE | Source |
|------------|--------|--------|-----------|-----------|--------|
| `payments_customer_id_fkey` | `customer_id` | `customers(id)` | NO ACTION (default) | NO ACTION | 002 / schema |
| `payments_vendor_id_fkey` | `vendor_id` | `vendors(id)` | NO ACTION | NO ACTION | 002 / schema |
| `payments_booking_id_fkey` | `booking_id` | `bookings(id)` | NO ACTION | NO ACTION | 002 / schema |
| `payments_order_id_fkey` | `order_id` | `orders(id)` | NO ACTION | NO ACTION | 002 / schema |
| Schema dump variants | same | same | **SET NULL** on booking/order/vendor | NO ACTION | `payments.sql` |

**Note:** 002 uses default NO ACTION; prod schema dump may differ (SET NULL). Phase 1 does not add payment FKs.

---

### 3.2 `settlements`

| Constraint | Source | Target | ON DELETE | ON UPDATE | Source |
|------------|--------|--------|-----------|-----------|--------|
| `settlements_vendor_id_fkey` | `vendor_id` | `vendors(id)` | **CASCADE** (schema) / NO ACTION (002) | NO ACTION | 002 / schema |
| `settlements_payout_id_fkey` | `payout_id` | `payouts(id)` | SET NULL | NO ACTION | 002 / schema |
| Inline (020) | `booking_id` | `bookings(id)` | NO ACTION | NO ACTION | 020 |
| Inline (020) | `payment_id` | `payments(id)` | NO ACTION | NO ACTION | 020 |

---

### 3.3 `transactions`

| Column | Target | ON DELETE | Source |
|--------|--------|-----------|--------|
| `customer_id` | `customers(id)` | SET NULL | 053 inline |
| `vendor_id` | `vendors(id)` | SET NULL | 053 |
| `booking_id` | `bookings(id)` | SET NULL | 053 |
| `order_id` | `orders(id)` | SET NULL | 053 |
| `payment_id` | `payments(id)` | SET NULL | 053 |
| `refund_id` | `refunds(id)` | SET NULL | 053 |
| `payout_id` | `payouts(id)` | SET NULL | 053 |

---

### 3.4 `promotion_usages`

| Column | Target | ON DELETE | Source |
|--------|--------|-----------|--------|
| `booking_id` | `bookings(id)` | SET NULL | 204 |
| `order_id` | `orders(id)` | SET NULL | 204 |
| `customer_id` | `customers(id)` | SET NULL | 204 |
| `promotion_id` | — | — | **No FK** |

---

### 3.5 `coupon_usages`

| Column | Target | ON DELETE | Source |
|--------|--------|-----------|--------|
| `coupon_id` | `coupons(id)` | **CASCADE** | 013 |
| `customer_id` | `customers(id)` | NO ACTION | 013 |
| `booking_id` | `bookings(id)` | NO ACTION | 013 |
| `order_id` | `orders(id)` | NO ACTION | 013 |

---

### 3.6 Proposed Phase 1 FKs — name collision check ✅

| Proposed constraint | Status in repo |
|---------------------|----------------|
| `promotion_usages_payment_id_fkey` | **Not present** — safe |
| `coupon_usages_payment_id_fkey` | **Not present** — safe |
| `warmpawz_pay_vendor_catalog_vendor_id_fkey` | **Not present** — safe |

**Recommended ON DELETE for new FKs:** `SET NULL` on `promotion_usages.payment_id` and `coupon_usages.payment_id` (matches `transactions.payment_id` pattern). Catalogue `vendor_id` → team choice **RESTRICT** recommended (implementation plan §8).

---

## 4. Existing indexes

### 4.1 `payments`

| Index | Unique | Partial predicate | Columns | Source |
|-------|--------|-------------------|---------|--------|
| `payments_pkey` | Yes | — | `(id)` | 001 |
| `idx_payments_customer_id` | No | — | `(customer_id)` | 003 |
| `idx_payments_vendor_id` | No | `vendor_id IS NOT NULL` | `(vendor_id)` | 003 |
| `idx_payments_booking_id` | No | `booking_id IS NOT NULL` | `(booking_id)` | 003 |
| `idx_payments_order_id` | No | `order_id IS NOT NULL` | `(order_id)` | 003 |
| `idx_payments_status` | No | — | `(payment_status)` | 003 |
| `idx_payments_payment_method` | No | — | `(payment_method)` | 003 |
| `idx_payments_created_at` | No | — | `(created_at DESC)` | 003 |
| `idx_payments_razorpay_order_id` | No | `razorpay_order_id IS NOT NULL` | `(razorpay_order_id)` | 003 |
| `idx_payments_razorpay_payment_id` | No | `razorpay_payment_id IS NOT NULL` | `(razorpay_payment_id)` | 003 |
| `idx_payments_customer_status` | No | — | `(customer_id, payment_status, created_at DESC)` | 003 |
| `idx_payments_vendor_status` | No | `vendor_id IS NOT NULL` | `(vendor_id, payment_status, created_at DESC)` | 003 |
| `idx_payments_pending` | No | `payment_status = 'pending'` | `(created_at)` | 003 |
| `idx_vendor_earnings` | No | `payment_status = 'completed'` | `(vendor_id, payment_status, created_at DESC)` | 003 |
| `idx_payment_idempotency` | **Yes** | `idempotency_key IS NOT NULL` | `(idempotency_key)` | 043 |
| `idx_payments_vendor_status_date` | No | `vendor_id IS NOT NULL` | `(vendor_id, payment_status, created_at DESC)` | 050 |
| `idx_payments_customer_status_date` | No | `customer_id IS NOT NULL` | `(customer_id, payment_status, created_at DESC)` | 050 |
| `idx_payments_commission_rate` | No | — | `(commission_rate)` | 008 |
| `idx_payments_tier_at_payment` | No | — | `(tier_at_payment)` | 008 |
| `idx_payments_gst_rule` | No | — | `(gst_rule_id)` | 008 |
| `idx_payments_fees` | No | `platform_fee > 0 OR convenience_fee > 0` | `(platform_fee, convenience_fee)` | 410 |
| `idx_payments_discount_source` | No | `discount_source IS NOT NULL` | `(discount_source)` | 306 |
| `idx_payments_subscription_id` | No | `subscription_id IS NOT NULL` | `(subscription_id)` | 306 |
| `idx_payments_pharmacy_order_id` | No | `pharmacy_order_id IS NOT NULL` | `(pharmacy_order_id)` | 509 |

**Proposed wpay indexes:** All names `idx_payments_wpay_*` — **not in repo**.

---

### 4.2 `settlements`

| Index | Unique | Partial predicate | Columns | Source |
|-------|--------|-------------------|---------|--------|
| `settlements_pkey` | Yes | — | `(id)` | 001 |
| `idx_settlements_vendor_id` | No | — | `(vendor_id)` | 003 / schema |
| `idx_settlements_status` | No | — | `(settlement_status)` | 003 |
| `idx_settlements_period` | No | — | `(settlement_period_start, settlement_period_end)` | 003 |
| `idx_settlements_payout_id` | No | `payout_id IS NOT NULL` | `(payout_id)` | schema |
| `idx_settlements_booking_id` | No | `booking_id IS NOT NULL` | `(booking_id)` | 020 |
| `idx_settlements_payment_id` | No | `payment_id IS NOT NULL` | `(payment_id)` | 020 |
| `idx_settlements_vendor_status` | No | — | `(vendor_id, settlement_status)` | 020 |
| `idx_settlements_settlement_key` | No | — | `(settlement_key)` | 008 |
| `idx_settlements_vendor_status_date` | No | `vendor_id IS NOT NULL` | `(vendor_id, settlement_status, created_at DESC)` | 050 |
| `idx_settlements_status_date` | No | — | `(settlement_status, created_at DESC)` | 050 |

**Proposed:** `idx_settlements_wpay_payment_unique` — **not in repo**; complements (does not duplicate) non-unique `idx_settlements_payment_id`.

---

### 4.3 `transactions`

| Index | Unique | Partial | Columns | Source |
|-------|--------|---------|---------|--------|
| (PK on `id`) | Yes | — | `(id)` | 053 |
| `transactions_transaction_id_key` | Yes | — | `(transaction_id)` | 053 UNIQUE |
| `idx_transactions_type` | No | — | `(transaction_type)` | 053 |
| `idx_transactions_status` | No | — | `(status)` | 053 |
| `idx_transactions_customer_id` | No | — | `(customer_id)` | 053 |
| `idx_transactions_vendor_id` | No | — | `(vendor_id)` | 053 |
| `idx_transactions_booking_id` | No | — | `(booking_id)` | 053 |
| `idx_transactions_order_id` | No | — | `(order_id)` | 053 |
| `idx_transactions_date` | No | — | `(transaction_date DESC)` | 053 |
| `idx_transactions_gateway_id` | No | — | `(gateway_transaction_id)` | 053 |

**Phase 1:** No new indexes on `transactions`.

---

### 4.4 `promotion_usages`

| Index | Unique | Partial | Columns | Source |
|-------|--------|---------|---------|--------|
| `idx_promotion_usages_promotion` | No | — | `(promotion_id)` | 204 |
| `idx_promotion_usages_customer` | No | — | `(customer_id)` | 204 |
| `idx_promotion_usages_booking` | No | — | `(booking_id)` | 204 |
| `idx_promotion_usages_order` | No | — | `(order_id)` | 204 |

**Proposed:** `idx_promotion_usages_payment_id`, `idx_promotion_usages_wpay_unique` — **not in repo**.

---

### 4.5 `coupon_usages`

| Index | Unique | Partial | Columns | Source |
|-------|--------|---------|---------|--------|
| `idx_coupon_usages_coupon` | No | — | `(coupon_id)` | 013 |
| `idx_coupon_usages_customer` | No | — | `(customer_id)` | 013 |

**Proposed:** `idx_coupon_usages_payment_id`, `idx_coupon_usages_wpay_unique` — **not in repo**.

---

## 5. Existing triggers

| Table | Trigger | Timing | Function | Impact of new columns |
|-------|---------|--------|----------|------------------------|
| `payments` | `audit_payments` | AFTER INSERT/UPDATE/DELETE | `log_audit_changes()` | **Low risk** — serializes full row to `audit_logs`; new columns appear in audit JSON automatically |
| `vendors` | `prevent_deleted_vendor_insert` | BEFORE INSERT | `prevent_deleted_vendor_insert()` | **No impact** — only forces `is_deleted = false` |
| `settlements` | — | — | — | — |
| `transactions` | — | — | — | — |
| `promotion_usages` | — | — | — | — |
| `coupon_usages` | — | — | — | — |

**Source:** `010_complete_kv_to_sql_migration.sql` (audit), `612_fix_vendors_is_deleted_default.sql` (vendor insert guard).

No trigger references column lists — **adding nullable/default columns is safe**.

---

## 6. Existing defaults (Phase 1–relevant)

| Table.Column | Default | Phase 1 proposal | Conflict? |
|--------------|---------|------------------|-----------|
| `payments.payment_status` | `'pending'` | Unchanged | No |
| `payments.currency` | `'INR'` | Unchanged | No |
| `payments.discount_amount` | `0` | Unchanged | No |
| `payments.payment_source` | — (absent) | **No DEFAULT** (nullable M1) | No — correct |
| `payments.metadata` | — (absent) | `NOT NULL DEFAULT '{}'::jsonb` | No — new column |
| `payments.original_amount` | — (absent) | NULL | No |
| `vendors.pay_bill_enabled` | — (absent) | `NOT NULL DEFAULT false` | No |
| `vendors.bank_verified` | — (absent in migrations) | `NOT NULL DEFAULT false` IF NOT EXISTS | **Pre-flight** if column exists with different default |
| `vendors.status` | `'pending'` | Unchanged | No |
| `settlements.settlement_status` | `'pending'` | Unchanged | No |
| `settlements.order_type` | `'booking'` | Warmpawz Pay sets `'warmpawz_pay'` in app | No |
| `transactions.transaction_category` | `'booking'` | New rows may use `'warmpawz_pay'` | No — CHECK extended |
| `transactions.metadata` | `'{}'` | Unchanged | No |

---

## 7. Existing partial indexes (summary)

All partial indexes on target tables are listed in §4. Key overlaps for duplication analysis:

| Existing | Proposed | Duplicate? |
|----------|----------|------------|
| `idx_payments_pending` (`payment_status = 'pending'`) | `idx_payments_wpay_pending` (+ `payment_source = 'warmpawz_pay'`) | **No** — narrower predicate |
| `idx_payment_idempotency` (`idempotency_key` UNIQUE) | `idx_payments_wpay_idempotency` (`customer_id`, `idempotency_key` UNIQUE + wpay filter) | **No** — different columns; global is broader on key alone |
| `idx_settlements_payment_id` (non-unique) | `idx_settlements_wpay_payment_unique` (unique + `order_type = 'warmpawz_pay'`) | **No** — adds uniqueness for subset |

---

## 8. Existing generated columns

**None** on `payments`, `settlements`, `transactions`, `promotion_usages`, `coupon_usages`, or `vendors`.

Phase 1 introduces no generated columns — **no conflict**.

---

## 9. Duplicate column analysis

| Column | Exists in repo? | Location if yes | Phase 1 action |
|--------|-----------------|-----------------|----------------|
| `payments.payment_source` | **No** | — | `ADD COLUMN` |
| `payments.original_amount` | **No** on payments | `promotion_usages.original_amount` (204) — **different table** | `ADD COLUMN` on payments |
| `payments.metadata` | **No** on payments | `vendors.metadata` (030/611), `transactions.metadata` (053) — **different tables** | `ADD COLUMN` on payments |
| `vendors.pay_bill_enabled` | **No** | — | `ADD COLUMN` |
| `vendors.bank_verified` | **No in migrations** | App code writes it (`vendor-bank-accounts.ts`, `razorpay-settlements.ts`); index `idx_vendor_bank_verified` on **`vendor_bank_details.is_verified`** (011) — different table/column | `ADD COLUMN IF NOT EXISTS` + **RDS pre-flight** |
| `promotion_usages.payment_id` | **No** | — | `ADD COLUMN` + FK |
| `coupon_usages.payment_id` | **No** | — | `ADD COLUMN` + FK |
| `coupon_usages.discount_amount` | **No in 013** | App/discount-engine docs note env variance | `ADD COLUMN IF NOT EXISTS` |
| `warmpawz_pay_vendor_catalog` | **No** | — | `CREATE TABLE` |

**Grep across `db/`:** Zero matches for `warmpawz_pay`, `payment_source`, `pay_bill_enabled`.

---

## 10. Constraint recreation risk

| Constraint | Risk level | Required action |
|------------|------------|-----------------|
| `transactions_transaction_category_check` | **HIGH** | Drop + recreate with **7 values**; verify no rows use values outside list before deploy |
| `payments_payment_status_check` | **NONE** | Do not touch |
| `settlements_settlement_status_check` | **NONE** | Do not touch |
| `vendors_status_check` | **NONE** | Do not touch |
| New `publish_status` CHECK on catalogue | **LOW** | New table only |

**Critical checklist for `transaction_category` recreation:**

1. Query prod/dev: `SELECT DISTINCT transaction_category FROM transactions;`
2. Ensure recreated CHECK includes: `booking`, `order`, `subscription`, `wallet`, `payout`, `other`, `warmpawz_pay`
3. Use constraint name discovery — do not hard-code wrong name if prod differs
4. Wrap in transaction or short lock window — brief validation gap between DROP and ADD

---

## 11. Index duplication risk

| Proposed index (12 total) | Conflict with existing? |
|---------------------------|-------------------------|
| `idx_payments_wpay_customer_date` | **No** |
| `idx_payments_wpay_vendor_date` | **No** |
| `idx_payments_wpay_pending` | **No** (see §7) |
| `idx_payments_wpay_idempotency` | **No** (see §7) |
| `idx_settlements_wpay_payment_unique` | **No** |
| `idx_promotion_usages_payment_id` | **No** |
| `idx_promotion_usages_wpay_unique` | **No** |
| `idx_coupon_usages_payment_id` | **No** |
| `idx_coupon_usages_wpay_unique` | **No** |
| `idx_wpay_catalog_vendor_id` | **No** (new table) |
| `idx_wpay_catalog_published` | **No** (new table) |

All use `CREATE INDEX IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` — idempotent.

**Retain:** `idx_payment_idempotency` — do **not** drop (implementation plan §3.1).

---

## 12. Migration conflict analysis

### 12.1 Migration number

| Check | Result |
|-------|--------|
| `1080_*.sql` in repo | **Absent** |
| Latest migrations | `1079_orders_cancelled_by.sql`, `1079_booking_cancelled_to_confirmed_payment_recovery.sql` |
| `warmpawz_pay` in any migration | **None** |

**Conflict with 1080 number:** **None** in repo (confirm no parallel branch before PR).

### 12.2 Prior migrations touching same objects

| Migration | Overlap with Phase 1 | Conflict? |
|-----------|---------------------|-----------|
| 001 | Creates base tables + inline CHECKs | No — additive only |
| 011 | `payments_status_check`, `settlements_status_check` | No — do not modify; verify drift |
| 020 | `settlements.payment_id` | No — index complements |
| 043 | `idempotency_key`, global unique index | No — keep both indexes |
| 053 | `transactions` + category CHECK | **Touches same CHECK** — Phase 1 extends, does not conflict if values preserved |
| 204 | `promotion_usages` | No — additive column |
| 013 | `coupon_usages` | No — additive column |
| 213 | `settlements.order_type` | No — wpay index depends on this column (**already exists**) |
| 306 | `payments.discount_source` | No |
| 410 | fee columns + partial index | No |
| 612 | vendor trigger | No |

**No migration modifies `payment_source`, catalogue table, or wpay indexes.**

### 12.3 Concurrent migration risk

Two files share number **1079** — team pattern allows next free **1080**. Ensure no open PR claims `1080` before merge.

---

## 13. Safe migration order

Approved order from `WARMPAWZ_PAY_PHASE1_IMPLEMENTATION_PLAN.md` §5 — **verified safe**:

| Step | Action | Rationale |
|------|--------|-----------|
| 1 | `vendors` — `pay_bill_enabled`, `bank_verified` | No FK deps; eligibility columns for catalogue queries |
| 2 | `payments` — `payment_source`, `original_amount`, `metadata` | FK target for usage tables |
| 3 | `CREATE warmpawz_pay_vendor_catalog` | FK → `vendors` |
| 4 | Catalogue indexes | After table |
| 5 | `promotion_usages.payment_id` + FK | Requires `payments` |
| 6 | `coupon_usages.payment_id` (+ `discount_amount`) + FK | Requires `payments` |
| 7 | `transactions` CHECK extend | Independent; brief constraint window |
| 8 | `payments` partial indexes | Requires `payment_source` column |
| 9 | `settlements` unique partial index | Requires `payments`, `order_type` (213) |
| 10–11 | Usage table indexes | After `payment_id` columns |
| 12 | COMMENT ON catalogue | Documentation |

**Dependencies satisfied:** `order_type` on settlements exists from **213** — step 9 is safe on any DB that ran migrations through 213+.

---

## 14. Final SQL generation recommendations

*(Guidance for migration author — not SQL.)*

1. **Idempotency:** Every statement uses `IF NOT EXISTS` / conditional `DO $$ … END $$` for constraints.
2. **`payment_source`:** `ADD COLUMN IF NOT EXISTS payment_source TEXT` — **nullable, no DEFAULT**.
3. **`metadata`:** `ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb` — backfill not needed on add (default applies).
4. **`bank_verified`:** `ADD COLUMN IF NOT EXISTS bank_verified BOOLEAN NOT NULL DEFAULT false` — if column exists, skip (do not alter type).
5. **`transaction_category`:** Discover constraint name from `pg_constraint`; drop only category CHECK; add with full 7-value list.
6. **Do not** modify `payments_payment_status_check`, `settlements_settlement_status_check`, or `vendors_status_check`.
7. **Do not** drop `idx_payment_idempotency` or `idx_settlements_payment_id`.
8. **FK names:** Use standard `{table}_{column}_fkey` — verified unused.
9. **Catalogue table:** Exactly 7 columns — no pricing/discount columns (architecture lock).
10. **Pre-apply on dev RDS:** Run §15 queries; capture `\d` output for PR attachment.
11. **Re-run test:** Apply 1080 twice — must exit 0 both times.
12. **Do not** add `NOT NULL` on `payment_source` in M1.

---

## 15. Final GO / NO-GO recommendation

### **GO** — Phase 1 migration SQL may be generated

**Conditions (mandatory before apply on any environment):**

| # | Pre-flight check | Blocker if failed |
|---|------------------|-------------------|
| 1 | `\d payments` — confirm `payment_source`, `original_amount`, `metadata` absent | Skip ADD if already present (IF NOT EXISTS handles) |
| 2 | `\d vendors` — note if `bank_verified` exists and its type/default | If wrong type exists, **NO-GO** until manual remediation plan |
| 3 | `\dt warmpawz_pay_vendor_catalog` — absent | IF NOT EXISTS handles |
| 4 | `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'transactions'::regclass AND contype = 'c';` | Capture exact `transaction_category` name |
| 5 | `SELECT DISTINCT transaction_category FROM transactions;` | Any value outside 6 known → extend CHECK list before GO |
| 6 | Confirm no other branch filed `1080_*.sql` | Duplicate number → coordinate |
| 7 | Optional: check `payments_status_check` orphan on prod | Informational — do not fail GO |

**Rationale for GO:**

- All Phase 1 objects are **additive** (columns, table, indexes, one CHECK extension).
- **No** duplicate column or index names in repository history.
- **No** trigger logic blocks new columns.
- Legacy payment inserts remain valid (`payment_source` nullable, no DEFAULT).
- **`settlements.order_type`** and **`payments.idempotency_key`** prerequisites already in migration chain.
- Only elevated risk is **`transaction_category` CHECK recreation** — mitigated by explicit value list and pre-flight DISTINCT query.

**Would become NO-GO if:**

- Pre-flight finds `bank_verified` with incompatible type (e.g. TEXT).
- Pre-flight finds `transaction_category` values outside the six known literals not accounted for in new CHECK.
- Another `1080` migration merged first.
- Author proposes `payment_source NOT NULL` without backfill in M1.

---

## Appendix A — Comments on target tables

| Table | Comments in repo |
|-------|------------------|
| `payments` | Table + column comments in 001, 306, 043 (history table) |
| `settlements` | 001, 020, 029 |
| `transactions` | 053 |
| `promotion_usages` | None |
| `coupon_usages` | Table-level in 013 |
| `vendors` | Extensive across 030, 052, 611, etc. |

Phase 1 should add COMMENT ON for `warmpawz_pay_vendor_catalog` (visibility-only) and new payment columns — **no overwrite** of existing comments if using `COMMENT ON COLUMN … IS` on new columns only.

---

## Appendix B — UNIQUE constraints (non-index)

| Table | Constraint | Source |
|-------|------------|--------|
| `transactions` | `transaction_id` UNIQUE | 053 |
| `settlements` | `settlement_key` UNIQUE (column) | 008 |
| `vendors` | `phone` UNIQUE (001); replaced by partial `idx_vendors_phone_unique_active` (613) | 001, 613 |

Phase 1 UNIQUE constraints are implemented as **partial unique indexes** (catalogue `vendor_id`, wpay idempotency, settlement accrual, usage per payment) — no naming collision with table-level UNIQUE above.

---

*Document generated from repository inspection. Does not contain SQL or migration files per audit charter.*
