# Warmpawz Pay — Phase 1 Schema Analysis

**Document type:** Analysis only (no SQL, no TypeScript)  
**Architecture reference:** `docs/WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE_FINAL.md`  
**Supplement:** Phase 1 architecture decisions (July 23, 2026) — Promotion Engine V2 + vendor publishing catalogue  
**Branch context:** `feature/warmpawzpay`  
**Date:** July 23, 2026 (updated)  
**Scope:** Database foundation for the Warmpawz Pay bounded context — schema, migrations, indexes, constraints, repository impact

**Out of scope for this document:** Quote service, payment flow, Razorpay adapters, Admin UI, Customer APIs, History APIs, notifications.

---

## Executive summary

Warmpawz Pay Phase 1 extends **five existing tables** (`payments`, `settlements`, `transactions`, `promotion_usages`, `coupon_usages`) and **one vendor configuration surface** (`vendors`), and adds **one new table** (`warmpawz_pay_vendor_catalog`).

**Promotion / discount rule (final decision):** Warmpawz Pay uses **Promotion Engine V2** exclusively. **No** Warmpawz Pay–specific discount, pricing, or promotion tables. Discounts are resolved at quote time via the engine; usage is committed to existing `promotion_usages` / `coupon_usages` via `payment_id`.

**Catalogue rule (final decision):** `warmpawz_pay_vendor_catalog` is a **vendor publishing catalogue only** — it controls which vendors appear in the customer app (`publish_status`). It is **not** a pricing table, discount table, or promotion table. Admin controls visibility; Promotion Engine V2 controls discounts.

The codebase already has a mature payment hub (`payments`), batch-capable settlements (`settlements` with `order_type` and `payment_id`), admin finance ledger (`transactions`), and promotion usage tracking (`promotion_usages` / `coupon_usages`). What is **missing** is bounded-context discrimination (`payment_source`), Warmpawz Pay–specific indexes, promo/ledger linkage via `payment_id`, vendor eligibility flags, `payments.metadata` / `original_amount` columns, and the vendor publishing catalogue table.

There is **no** `backend/lambda/src/endpoints/warmpawz-pay/` module yet. Payment writes today go through monolith paths (`razorpay.razorpay.ts`, `payments-enhanced.ts`, etc.) via generic `insert('payments', …)` — Phase 1 repositories will be **new**, not modifications to legacy monolith repos.

---

# SECTION 1 — CURRENT DATABASE

## 1.1 Payment tables

### `payments` (primary hub)

**Canonical snapshot:** `db/schemas/payment/payments.sql` (partial — production has many additional columns from migrations).

**Core columns (baseline + accumulated migrations):**

| Column group | Columns | Notes |
|--------------|---------|-------|
| Identity | `id`, `created_at`, `updated_at`, `completed_at` | Standard audit timestamps |
| Parties | `customer_id` (NOT NULL), `vendor_id`, `booking_id`, `order_id`, `pharmacy_order_id`, `subscription_id` | Domain FKs — Warmpawz Pay requires booking/order/pharmacy/subscription **NULL** |
| Amounts | `amount`, `discount_amount`, `total_amount`, `net_amount`, `commission_amount`, `platform_commission`, `vendor_amount`, fee columns, GST columns | `amount` is the charged/payable amount today |
| Razorpay | `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature` | Used across booking/ecommerce/pharmacy |
| Status | `payment_method`, `payment_status`, `failure_reason` | CHECK: `pending`, `processing`, `completed`, `failed`, `refunded`, `partially_refunded` |
| Promo snapshot | `coupon_code`, `promotion_id`, `discount_source` | Inline promo fields — not usage commit |
| Idempotency | `idempotency_key` | Added in `043_temporal_audit_fixes.sql` |
| Commission snapshot | `commission_rate`, `tier_at_payment`, GST fields | Written at verify in existing flows |

**Missing vs Final architecture:** `payment_source`, `original_amount`, `metadata`.

**Foreign keys:**

- `customer_id` → `customers(id)` ON DELETE CASCADE  
- `vendor_id` → `vendors(id)` ON DELETE SET NULL  
- `booking_id` → `bookings(id)` ON DELETE SET NULL  
- `order_id` → `orders(id)` ON DELETE SET NULL  
- `pharmacy_order_id` → `pharmacy_orders(id)` (migration `509_pharmacy_payments_and_convenience.sql`)

**How used today:** Booking payments (`payments-enhanced.ts`, `bookings-enhanced.booking.ts`), ecommerce (`razorpay.razorpay.ts`, `ecommerce.ts`), pharmacy, meal/subscription flows. All insert without `payment_source`. No Warmpawz Pay rows exist.

---

### Related payment audit tables (no Phase 1 change)

| Table | Purpose | FK / audit |
|-------|---------|------------|
| `payment_status_history` | Status transition audit | `payment_id` → `payments(id)` CASCADE; `metadata JSONB`; `043_temporal_audit_fixes.sql` |
| `payment_transaction_log` | Payment event audit | `payment_id` → `payments(id)` CASCADE; `details JSONB`; `011_audit_fixes_complete.sql` |
| `payment_history` | Denormalized customer/vendor payment list | `payment_id` → `payments(id)` CASCADE |
| `refunds` | Refund records | `payment_id` → `payments(id)` CASCADE — reused later for admin refund (not Phase 1 schema) |
| `idempotency_keys` | Generic API idempotency store | Separate from `payments.idempotency_key`; `043_temporal_audit_fixes.sql` |

---

## 1.2 Settlement tables

### `settlements` (platform finance — **reuse for Warmpawz Pay**)

**Canonical snapshot:** `db/schemas/payment/settlements.sql` + migrations `020`, `213`, `029`, `008`.

**Current columns:**

| Column | Notes |
|--------|-------|
| `vendor_id` | NOT NULL → `vendors(id)` CASCADE |
| `total_amount`, `commission_amount`, `net_amount` | Core settlement math |
| `settlement_status` | CHECK: `pending`, `processing`, `completed`, `failed` |
| `settlement_period_start`, `settlement_period_end` | NOT NULL in base schema — batch settlements |
| `payment_ids UUID[]` | Array of included payments (batch pattern) |
| `payout_id` | → `payouts(id)` SET NULL |
| `booking_id` | Per-booking settlement (migration `020`) |
| **`payment_id`** | Per-payment settlement (migration `020`) → `payments(id)` |
| **`order_type`** | VARCHAR(50) DEFAULT `'booking'` (migration `213`) — **Warmpawz Pay uses `'warmpawz_pay'`** |
| `settlement_breakup`, `tier_deduction_amount`, `commission_rate_used`, etc. | Tier/finance extensions |

**How used today:** Booking settlement batches (`settlement-processor.ts`, `settlements.ts`), per-booking Razorpay Route transfers (`razorpay.razorpay.ts`). Ecommerce uses a **separate** table `ecommerce_order_settlements` (migration `1064`) — Warmpawz Pay must **not** use that table per architecture.

**Indexes (existing):**

- `idx_settlements_vendor_id`, `idx_settlements_status`, `idx_settlements_period`  
- `idx_settlements_payment_id` WHERE `payment_id IS NOT NULL` (`020`)  
- `idx_settlements_vendor_status`  
- **No** unique index on `(payment_id, order_type)` for `warmpawz_pay`

---

### Other settlement-related tables (not used by Warmpawz Pay)

| Table | Reason excluded |
|-------|-----------------|
| `ecommerce_order_settlements` | Ecommerce-only ledger; architecture forbids |
| `vendor_earnings` | Booking-only accrual; `booking_id NOT NULL`; architecture forbids writes |
| `delivery_settlements` | Logistics domain |
| `vendor_settlements` | Legacy vendor capability table |

---

## 1.3 Transaction tables

### `transactions` (admin finance ledger)

**Created in:** `053_admin_endpoints_tables.sql`  
**Used by:** `/admin/transactions` (read via `admin-advanced.ts`)

**Current shape:**

| Column | Notes |
|--------|-------|
| `transaction_type` | CHECK: `payment`, `refund`, `payout`, `commission`, `fee`, `adjustment` |
| **`transaction_category`** | CHECK: `'booking'`, `'order'`, `'subscription'`, `'wallet'`, `'payout'`, `'other'` — **missing `'warmpawz_pay'`** |
| `payment_id` | Nullable FK → `payments(id)` SET NULL |
| `customer_id`, `vendor_id`, `booking_id`, `order_id`, `refund_id`, `payout_id` | Nullable domain FKs |
| `amount`, `currency`, `status`, gateway fields | Standard ledger |
| `metadata JSONB DEFAULT '{}'` | Present |
| Audit | `created_at`, `updated_at`, `transaction_date`, `processed_at`, `completed_at` |

**How used today:** Admin read/filter. **No** `insert('transactions', …)` found in backend — ledger writes for Warmpawz Pay will be **new behavior** in PostPaymentProcessor (Sprint 2+). Phase 1 only extends the category CHECK.

---

## 1.4 Promotion usage tables

### `promotion_usages`

**Created in:** `204_vendor_promotions_tables.sql`

| Column | FK / notes |
|--------|------------|
| `promotion_id`, `promotion_type` | NOT NULL; no FK constraint to promotions |
| `booking_id` | → `bookings(id)` SET NULL |
| `order_id` | → `orders(id)` SET NULL |
| `customer_id` | → `customers(id)` SET NULL |
| `discount_amount`, `original_amount`, `final_amount` | Amount audit |
| `created_at` | Audit |
| **`payment_id`** | **Does not exist** |

**Indexes:** `promotion_id`, `customer_id`, `booking_id`, `order_id` — no `payment_id` index.

**How used today:** Booking/ecommerce promo commit via `vendor-promotion-usage.ts`, discount engine `legacy-usage-tracker.ts`, commercial campaigns.

---

### `coupon_usages`

**Created in:** `013_coupon_tables.sql`; extended opportunistically in app code.

| Column | FK / notes |
|--------|------------|
| `coupon_id` | → `coupons(id)` CASCADE |
| `customer_id` | → `customers(id)` |
| `booking_id` | → `bookings(id)` |
| `order_id` | → `orders(id)` |
| `used_at` | Timestamp |
| **`payment_id`** | **Does not exist** |
| `discount_amount` | **May exist on prod** — app checks `information_schema` dynamically (`vendor-promotion-usage.ts`); not in base migration |

**How used today:** Coupon redemption for bookings and ecommerce; idempotency keyed on `(coupon_id, booking_id)` or `(coupon_id, order_id)`.

---

## 1.5 Vendor configuration

### `vendors`

**Canonical snapshot:** `db/schemas/vendor/vendor.sql` (richer than `db/schema.sql` baseline).

**Relevant existing columns:**

| Column | Warmpawz Pay relevance |
|--------|------------------------|
| `status` | Eligibility requires `'active'` — **exists** with CHECK constraint |
| `is_active` | Operational flag — separate from `status` |
| `metadata JSONB` | General vendor settings |
| `commission_rate`, `commission_percentage`, `tier` | Commission resolution |
| `razorpay_account_id`, `bank_verified` | **Used extensively in application code** (`razorpay.razorpay.ts`, `settlement-processor.ts`, vendor bank endpoints) but **`bank_verified` is not in committed migration files** — likely present on prod RDS from manual/undocumented DDL |
| **`pay_bill_enabled`** | **Does not exist** anywhere in repo — required by architecture §2 eligibility |

### `vendor_bank_details`

- `is_verified BOOLEAN` — bank verification at detail-record level (`db/schemas/vendor/vendor_bank_details.sql`)  
- Application also sets `vendors.bank_verified = true` on verification (`vendor-bank-accounts.ts`)  
- Eligibility in architecture references **`vendors.bank_verified`**, not `vendor_bank_details.is_verified` directly

### `vendor_bank_accounts`

- Separate table from migration `200_pharmacy_meal_delivery_complete.sql` with `razorpay_account_id`, `is_verified`  
- Payout flows may consult multiple bank sources (`settlements.ts` comments)

---

## 1.6 Migration structure

| Convention | Current state |
|------------|---------------|
| Location | `db/migrations/{NNN}_{snake_case_description}.sql` |
| Latest numbered files | `1079_*` (two files at same number — team uses next free `1080`) |
| Idempotency pattern | `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DO $$ … IF NOT EXISTS … $$` |
| Apply script | `ENVIRONMENT=dev node scripts/run-migration-rds-node.js <file>.sql` |
| Schema snapshots | `db/schemas/**` — **reference only**; migrations are authoritative |
| Validator | No Warmpawz Pay–specific migration validator yet |

---

## 1.7 Repository structure (existing)

| Pattern | Location | Warmpawz Pay relevance |
|---------|----------|------------------------|
| Generic RDS helpers | `backend/lambda/src/database/rds-connection.ts` — `query`, `insert`, `select`, `update`, `withTransaction` | All repos use this |
| Customer 4-layer repos | `backend/lambda/src/endpoints/customer/**/repos/*.repo.ts` | Future customer read APIs — **not Phase 1** |
| Discount engine repos | `backend/lambda/src/discount-engine/**/repositories/` | Analytics/usage read — no `payment_id` today |
| Finance services (not repos) | `backend/lambda/src/finance/settlement/*`, `finance/commission/*` | Reuse for settlement **calculation** — not SQL repos |
| Monolith payment writes | `razorpay.razorpay.ts`, `payments-enhanced.ts`, `payments.ts` | Direct SQL / `insert('payments')` — Warmpawz Pay must **not** extend these |
| Warmpawz Pay module | **Does not exist** | Phase 1 creates new repositories under planned `endpoints/warmpawz-pay/repositories/` |

---

# SECTION 2 — REQUIRED CHANGES

## 2.1 `payments`

| | |
|---|---|
| **Current** | No `payment_source`. No `original_amount`. No `metadata`. Amount columns mostly `NUMERIC(10,2)`. Legacy rows have domain FKs populated per flow. Global unique index on `idempotency_key` (`idx_payment_idempotency`). |
| **Required** | 1. Add `payment_source TEXT` — **nullable, no DEFAULT** (see §2.1.1). 2. Add `original_amount NUMERIC(12,2) NULL`. 3. Add `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`. 4. Warmpawz Pay inserts: `payment_source = 'warmpawz_pay'`, domain FKs NULL, `original_amount` = pre-discount bill, `amount` = payable, promo snapshot in `metadata`. |
| **Reason** | Bounded-context ownership (§7.1). Pre-discount vs payable separation. Context-only metadata (quote ref, promo snapshot) without effect flags (§7.2). |

### 2.1.1 `payment_source` NOT NULL — migration nuance

Final architecture specifies `NOT NULL` with no DEFAULT, but also states legacy rows may remain NULL until a **separate platform backfill** (out of Warmpawz Pay MVP).

**Phase 1 recommendation:**

- Add column **nullable** (no default) in migration `1080`  
- Warmpawz Pay repository **always** sets `'warmpawz_pay'` on insert  
- Platform-wide `SET NOT NULL` deferred until all legacy insert paths set explicit `payment_source` (future migration, out of Phase 1)

**No change required (reuse as-is):**

- `customer_id`, `vendor_id`, `amount`, `discount_amount`, Razorpay columns, `payment_status`, commission/GST columns, `idempotency_key`, audit timestamps  
- Existing FKs and payment_status CHECK  
- `payment_status_history` integration (verify TX inserts history — application concern, not schema)

---

## 2.2 `settlements`

| | |
|---|---|
| **Current** | Has `payment_id`, `order_type` (default `'booking'`), `settlement_status`, amount columns, period dates NOT NULL, `payment_ids` array. Index on `payment_id` (non-unique). |
| **Required** | **No new columns.** Use existing columns: `order_type = 'warmpawz_pay'`, `payment_id = <payments.id>`, async insert post-verify. Add **unique partial index** on `payment_id` WHERE `order_type = 'warmpawz_pay'`. |
| **Reason** | Architecture §7.3 — one settlement accrual per Warmpawz Pay payment; idempotent `ON CONFLICT DO NOTHING`. |

**No change required:**

- Table structure, existing FKs, `settlement_status` CHECK  
- Batch payout pipeline reuses `settlements` + `payouts` (application layer)

**Application note (not schema):** Inserts must populate `settlement_period_start` / `settlement_period_end` (NOT NULL today) — typically payment completion date for per-payment accrual.

---

## 2.3 `transactions`

| | |
|---|---|
| **Current** | `transaction_category` CHECK excludes `'warmpawz_pay'`. `payment_id` FK already exists. |
| **Required** | Extend `transaction_category` CHECK to include `'warmpawz_pay'`. |
| **Reason** | Architecture §7.5 — admin ledger rows tagged `transaction_category = 'warmpawz_pay'`. |

**No change required:**

- Table creation, other category values, `metadata`, indexes (existing admin query indexes sufficient for MVP volume)

---

## 2.4 `promotion_usages`

| | |
|---|---|
| **Current** | Links usage to `booking_id` / `order_id` only. No `payment_id`. |
| **Required** | Add `payment_id UUID NULL REFERENCES payments(id) ON DELETE SET NULL`. Add partial unique index: one row per `payment_id` (where not null) — architecture: "one usage row per payment_id per promotion type" → recommend `UNIQUE (payment_id, promotion_type) WHERE payment_id IS NOT NULL`. Add lookup index on `payment_id`. |
| **Reason** | Architecture §7.4 — async promo commit keyed by payment; subsystem-owned promo status. |

**No change required:**

- Existing booking/order columns (remain NULL for Warmpawz Pay)  
- `discount_amount`, `original_amount`, `final_amount` columns

---

## 2.5 `coupon_usages`

| | |
|---|---|
| **Current** | Links to `booking_id` / `order_id`. No `payment_id`. `discount_amount` column presence varies by environment. |
| **Required** | Add `payment_id UUID NULL REFERENCES payments(id) ON DELETE SET NULL`. Add partial unique index: `UNIQUE (payment_id) WHERE payment_id IS NOT NULL` (one coupon usage per payment). Add lookup index on `payment_id`. Optionally ensure `discount_amount NUMERIC(10,2)` exists (additive IF NOT EXISTS) for analytics parity. |
| **Reason** | Architecture §7.4 — coupon path mirrors promotion_usages for Warmpawz Pay. |

---

## 2.6 `vendors`

| | |
|---|---|
| **Current** | `status` with `'active'` value. `bank_verified` used in code but **not guaranteed in migrations**. `pay_bill_enabled` **absent**. |
| **Required** | 1. `pay_bill_enabled BOOLEAN NOT NULL DEFAULT false`. 2. `bank_verified BOOLEAN NOT NULL DEFAULT false` — **ADD IF NOT EXISTS** (prod may already have it). |
| **Reason** | Architecture §2 eligibility: `pay_bill_enabled AND bank_verified AND status = 'active'`. |

**No change required:**

- `vendor_bank_details`, `vendor_bank_accounts` tables  
- `metadata JSONB` (do not store pay-bill config in metadata — use explicit column)

**Optional index (low priority):** partial index on `(status, pay_bill_enabled, bank_verified) WHERE pay_bill_enabled = true` — only if vendor list queries need it; defer until query plan evidence.

---

## 1.8 Vendor publishing catalogue (new — Phase 1)

### `warmpawz_pay_vendor_catalog` (does not exist today)

**Purpose:** Admin-controlled **visibility** for the Warmpawz Pay customer vendor list. One row per vendor maximum.

**Required columns (final decision):**

| Column | Type / constraint | Notes |
|--------|-------------------|-------|
| `id` | UUID PK | Standard |
| `vendor_id` | UUID NOT NULL UNIQUE → `vendors(id)` | One catalogue entry per vendor |
| `publish_status` | TEXT NOT NULL | `draft` \| `published` — admin toggle |
| `published_at` | TIMESTAMPTZ NULL | Set when first published / on republish |
| `created_by` | UUID NULL | Admin user who added vendor to catalogue |
| `created_at` | TIMESTAMPTZ NOT NULL | Audit |
| `updated_at` | TIMESTAMPTZ NOT NULL | Audit |

**Explicitly excluded (must NOT be on this table):**

- `discount_percent`, `max_discount_amount`, `offer_label`  
- Any promotion / coupon / campaign columns  
- Any pricing columns  

**Customer list visibility (application query — not stored on catalogue):**

```text
catalog.publish_status = 'published'
AND vendor.status = 'active'
AND vendor.bank_verified = true
AND vendor.pay_bill_enabled = true
```

**Discount resolution:** Quote API → Promotion Engine V2 → returns discount. Catalogue plays **no role** in pricing.

---

# SECTION 3 — NEW TABLES vs EXTENSIONS

| Entity | Decision | Why |
|--------|----------|-----|
| **`payments`** | **B. Extension** | Approved architecture §7.1 — extend hub with `payment_source`, `original_amount`, `metadata`. No separate Warmpawz Pay payment table. |
| **`settlements`** | **B. Extension** | §7.3 — reuse platform rail with `order_type = 'warmpawz_pay'`. Do not create `warmpawz_pay_settlements`. Do not use `ecommerce_order_settlements`. |
| **`transactions`** | **B. Extension** | §7.5 — extend CHECK on existing admin ledger. |
| **`promotion_usages`** | **B. Extension** | §7.4 — add `payment_id` FK; usage commit after payment via Promotion Engine V2 (no new discount tables). |
| **`coupon_usages`** | **B. Extension** | §7.4 — add `payment_id` FK; coupon path via existing engine. |
| **`vendors`** | **B. Extension** | §2 eligibility flags on existing vendor row. |
| **`warmpawz_pay_vendor_catalog`** | **A. New table — Phase 1** | **Publishing catalogue only** — admin visibility; not pricing/discount/promotion. |
| **`warmpawz_pay_quotes`** | **A. New table — DEFERRED** | §8 — MVP uses signed tokens; persistent quotes only when mutable/multi-step checkout needed. **Not Phase 1.** |
| **Warmpawz Pay discount tables** | **Do not create** | Promotion Engine V2 resolves all discounts; reuse `promotions`, `coupons`, engine tables. |
| **`vendor_earnings`** | **No access** | Architecture forbids — booking-only. |
| **`ecommerce_order_settlements`** | **No access** | Wrong bounded context. |

---

# SECTION 4 — MIGRATIONS

Next available migration number: **`1080`**.

Recommended: **one cohesive migration** for Phase 1 (atomic deploy, single RDS apply). Alternative: split into two if team prefers vendor flags separate from payment hub (not required).

---

## Migration 1 (recommended)

| Field | Value |
|-------|-------|
| **Name** | `1080_warmpawz_pay_phase1_schema.sql` |
| **Purpose** | Full database foundation for Warmpawz Pay bounded context |
| **Affected tables** | `payments`, `settlements`, `transactions`, `promotion_usages`, `coupon_usages`, `vendors`, **`warmpawz_pay_vendor_catalog`** (new) |
| **Dependencies** | Requires existing tables from migrations `001`–`1079` (especially `020_settlements`, `213_ecommerce_missing_tables`, `043_temporal_audit_fixes`, `053_admin_endpoints_tables`, `204_vendor_promotions_tables`, `013_coupon_tables`) |
| **Merge order** | **① First** — blocks all Warmpawz Pay feature branches per sprint plan (`feature/wpay-schema` merge before payment flow, post-payment, customer APIs) |

### Contents (descriptive — no SQL)

1. `payments`: add `payment_source`, `original_amount`, `metadata`  
2. `payments`: partial indexes for Warmpawz Pay queries (§5)  
3. `settlements`: unique partial index for `warmpawz_pay` + `payment_id`  
4. `transactions`: extend `transaction_category` CHECK  
5. `promotion_usages`: add `payment_id` FK + indexes  
6. `coupon_usages`: add `payment_id` FK + indexes; optional `discount_amount` if missing  
7. `vendors`: add `pay_bill_enabled`, `bank_verified` (IF NOT EXISTS)  
8. **`warmpawz_pay_vendor_catalog`**: create table (visibility columns only — see §1.8) + indexes

---

## Migration 2 (deferred — out of Phase 1)

| Field | Value |
|-------|-------|
| **Name** | `10XX_payments_payment_source_not_null.sql` (future platform migration) |
| **Purpose** | Backfill `payment_source` on all legacy rows; `ALTER COLUMN payment_source SET NOT NULL` |
| **Affected tables** | `payments` |
| **Dependencies** | All bounded contexts updated to set explicit `payment_source` on insert |
| **Merge order** | After platform-wide insert path updates — **explicitly out of Warmpawz Pay MVP** per architecture §1 |

---

## Migration 3 (deferred — out of Phase 1)

| Field | Value |
|-------|-------|
| **Name** | `10XX_warmpawz_pay_quotes.sql` |
| **Purpose** | Persistent quote entities when mutable/multi-step checkout required |
| **Affected tables** | New `warmpawz_pay_quotes` |
| **Dependencies** | Phase B quote architecture (§8.3) |
| **Merge order** | Post-MVP |

---

# SECTION 5 — INDEXES

## 5.1 Current indexes (relevant)

### `payments`

| Index | Definition | Warmpawz Pay impact |
|-------|------------|---------------------|
| `idx_payments_customer_id` | `(customer_id)` | Generic — retained |
| `idx_payments_vendor_id` | `(vendor_id) WHERE vendor_id IS NOT NULL` | Generic — retained |
| `idx_payments_status` | `(payment_status)` | Generic — retained |
| `idx_payments_created_at` | `(created_at DESC)` | Generic — retained |
| `idx_payments_customer_status_date` | `(customer_id, payment_status, created_at DESC)` | Useful but not filtered by source |
| `idx_payments_pending` | `(created_at) WHERE payment_status = 'pending'` | All domains — reconciliation job may scan; Warmpawz-specific pending index still valuable |
| **`idx_payment_idempotency`** | **UNIQUE `(idempotency_key) WHERE idempotency_key IS NOT NULL`** | **Global** — stricter than architecture's per-customer scope; **retain** (do not drop in Phase 1) |

### `settlements`

| Index | Notes |
|-------|-------|
| `idx_settlements_payment_id` | Non-unique — **insufficient** for Warmpawz Pay idempotency |
| No index on `order_type` | Batch queries filter by status; acceptable for MVP |

### `promotion_usages` / `coupon_usages`

| Index | Notes |
|-------|-------|
| Existing FK lookup indexes | booking/order scoped — **missing payment_id** |

### `transactions`

| Index | Notes |
|-------|-------|
| `idx_transactions_type`, `idx_transactions_date`, FK indexes | Sufficient for admin MVP |

---

## 5.2 Missing indexes (required)

### `payments` — partial, Warmpawz Pay only (architecture §7.1)

| Index name | Columns | Predicate | Purpose |
|------------|---------|-----------|---------|
| `idx_payments_wpay_customer_date` | `(customer_id, created_at DESC)` | `payment_source = 'warmpawz_pay'` | Customer history |
| `idx_payments_wpay_vendor_date` | `(vendor_id, created_at DESC)` | `payment_source = 'warmpawz_pay'` | Vendor history |
| `idx_payments_wpay_pending` | `(created_at)` | `payment_source = 'warmpawz_pay' AND payment_status = 'pending'` | Reconciliation: stale pending |
| `idx_payments_wpay_idempotency` | `(customer_id, idempotency_key)` UNIQUE | `payment_source = 'warmpawz_pay' AND idempotency_key IS NOT NULL` | Architecture idempotency — **functionally redundant with global `idx_payment_idempotency` for uniqueness** but documents intent and supports planner for filtered lookups |

### `settlements` (architecture §7.3)

| Index name | Columns | Predicate | Purpose |
|------------|---------|-----------|---------|
| `idx_settlements_wpay_payment_unique` | `(payment_id)` UNIQUE | `order_type = 'warmpawz_pay' AND payment_id IS NOT NULL` | Idempotent settlement accrual |

### `promotion_usages` (architecture §7.4)

| Index name | Columns | Predicate | Purpose |
|------------|---------|-----------|---------|
| `idx_promotion_usages_payment_id` | `(payment_id)` | `payment_id IS NOT NULL` | Lookup by payment |
| `idx_promotion_usages_wpay_unique` | `(payment_id, promotion_type)` UNIQUE | `payment_id IS NOT NULL` | One promo commit per type per payment |

### `coupon_usages` (architecture §7.4)

| Index name | Columns | Predicate | Purpose |
|------------|---------|-----------|---------|
| `idx_coupon_usages_payment_id` | `(payment_id)` | `payment_id IS NOT NULL` | Lookup by payment |
| `idx_coupon_usages_wpay_unique` | `(payment_id)` UNIQUE | `payment_id IS NOT NULL` | One coupon usage per payment |

### `warmpawz_pay_vendor_catalog` (Phase 1 — publishing only)

| Index name | Columns | Predicate | Purpose |
|------------|---------|-----------|---------|
| `idx_wpay_catalog_vendor_id` | `(vendor_id)` UNIQUE | — | One row per vendor |
| `idx_wpay_catalog_published` | `(vendor_id)` | `publish_status = 'published'` | Customer vendor list JOIN |

---

## 5.3 Indexes explicitly NOT required

| Index | Reason |
|-------|--------|
| `payment_source` alone (non-partial) | Low selectivity; partial indexes cover Warmpawz Pay queries |
| `transactions(transaction_category)` | Admin volume low for MVP; add only if admin reports slow |
| `vendors(pay_bill_enabled)` | Covered by catalogue + vendor JOIN pattern; add only if EXPLAIN shows need |
| Catalogue discount/pricing columns | **Forbidden** — not a pricing table |
| GIN on `payments.metadata` | No query requirement in Phase 1 |

---

# SECTION 6 — FOREIGN KEYS

## 6.1 Existing FKs (unchanged)

| Table | FK | ON DELETE | ON UPDATE |
|-------|-----|-----------|-----------|
| `payments.customer_id` | → `customers(id)` | CASCADE | NO ACTION |
| `payments.vendor_id` | → `vendors(id)` | SET NULL | NO ACTION |
| `payments.booking_id` | → `bookings(id)` | SET NULL | NO ACTION |
| `payments.order_id` | → `orders(id)` | SET NULL | NO ACTION |
| `payments.pharmacy_order_id` | → `pharmacy_orders(id)` | (per migration) | — |
| `settlements.vendor_id` | → `vendors(id)` | CASCADE | NO ACTION |
| `settlements.payment_id` | → `payments(id)` | (no action specified in 020) | — |
| `settlements.payout_id` | → `payouts(id)` | SET NULL | NO ACTION |
| `transactions.payment_id` | → `payments(id)` | SET NULL | — |
| `promotion_usages.booking_id` | → `bookings(id)` | SET NULL | — |
| `promotion_usages.order_id` | → `orders(id)` | SET NULL | — |
| `coupon_usages.coupon_id` | → `coupons(id)` | CASCADE | — |

## 6.2 New FKs (Phase 1)

| Table | Column | References | Nullable | ON DELETE | ON UPDATE | Notes |
|-------|--------|------------|----------|-----------|-----------|-------|
| `promotion_usages` | `payment_id` | `payments(id)` | YES | SET NULL | NO ACTION | Warmpawz Pay rows set payment_id; booking/order NULL |
| `coupon_usages` | `payment_id` | `payments(id)` | YES | SET NULL | NO ACTION | Same pattern |
| **`warmpawz_pay_vendor_catalog`** | `vendor_id` | `vendors(id)` | NO | CASCADE or RESTRICT | NO ACTION | One catalogue row per vendor; prefer RESTRICT if vendor soft-delete |

**No new FK on `payments`** — Warmpawz Pay does not reference quotes table in MVP.

**No FK from catalogue to promotions/coupons** — discounts are engine-resolved, not catalogue-linked.

## 6.3 Nullable relationships (Warmpawz Pay invariants)

| Column | Warmpawz Pay value | Other domains |
|--------|-------------------|---------------|
| `payments.booking_id` | NULL | Often set |
| `payments.order_id` | NULL | Ecommerce |
| `payments.pharmacy_order_id` | NULL | Pharmacy |
| `payments.subscription_id` | NULL | Subscriptions |
| `payments.payment_source` | `'warmpawz_pay'` | Legacy NULL until backfill |
| `payments.original_amount` | Pre-discount bill | NULL or N/A |
| `promotion_usages.booking_id` / `order_id` | NULL | Set per domain |
| `promotion_usages.payment_id` | Set post-verify | NULL for legacy |
| `coupon_usages.payment_id` | Set if coupon used | NULL otherwise |
| `settlements.booking_id` | NULL | Often set for booking |
| `settlements.order_type` | `'warmpawz_pay'` | `'booking'`, etc. |

**Delete rules:** SET NULL on usage FKs preserves usage analytics if payment row archived (prefer soft-delete patterns). CASCADE on `payment_status_history` already removes history if payment deleted — existing behavior unchanged.

---

# SECTION 7 — REPOSITORY IMPACT

## 7.1 Repositories to **create** (new module)

Planned location per architecture §6: `backend/lambda/src/endpoints/warmpawz-pay/repositories/`

| Repository | Responsibility | Key operations |
|------------|----------------|----------------|
| **`PaymentIntentRepository`** | Sole writer to `payments` for Warmpawz Pay | Insert with mandatory `payment_source = 'warmpawz_pay'`; select/update by id with `WHERE payment_source = 'warmpawz_pay'`; FOR UPDATE on verify; idempotency lookup |
| **`SettlementAccrualRepository`** | Insert/read `settlements` for `order_type = 'warmpawz_pay'` | Idempotent insert by `payment_id`; read settlement status by payment |
| **`PromotionUsageRepository`** | Write/read `promotion_usages` and `coupon_usages` by `payment_id` | Idempotent usage insert; existence check for reconciliation |
| **`TransactionLedgerRepository`** | Write/read `transactions` with `transaction_category = 'warmpawz_pay'` | Idempotent ledger insert by `payment_id` |
| **`VendorCatalogRepository`** | CRUD on `warmpawz_pay_vendor_catalog` | Admin publish/unpublish; customer list query (JOIN `vendors` for eligibility) |

## 7.2 Repository **interfaces** (contracts — no code)

| Interface | Consumers |
|-----------|-----------|
| `IPaymentIntentRepository` | `PaymentOrchestrator`, `HistoryService`, reconciliation jobs |
| `ISettlementAccrualRepository` | `PostPaymentProcessor`, reconciliation jobs |
| `IPromotionUsageRepository` | `PostPaymentProcessor`, discount engine usage adapter (future) |
| `ITransactionLedgerRepository` | `PostPaymentProcessor` |
| `IVendorCatalogRepository` | Admin catalogue APIs, customer vendor list repo |

## 7.3 Existing code — **do not modify** in Phase 1 schema work

| Path | Reason |
|------|--------|
| `endpoints/razorpay/endpoints/razorpay.razorpay.ts` | Monolith — forbidden dependency |
| `endpoints/payments-enhanced.ts` | Booking-only |
| `utils/vendor-promotion-usage.ts` | Legacy booking/ecommerce usage — Warmpawz Pay gets own repo; adapter integration is Sprint 2+ |
| `discount-engine/adapters/legacy-usage-tracker.ts` | Extend in later sprint when `WARMPAWZ_PAY` domain wired |
| Customer `*/repos/*` | Unrelated to Phase 1 |

## 7.4 Existing code — **read-only reference**

| Path | Use |
|------|-----|
| `database/rds-connection.ts` | Pool, transactions, insert helpers |
| `finance/settlement/compute-funding-aware-settlement.ts` | Settlement amount math (application layer) |
| `finance/commission/resolve-vendor-commission-policy.ts` | Commission snapshot at verify |

## 7.5 Vendor eligibility + catalogue queries

Customer vendor list reads **`warmpawz_pay_vendor_catalog` INNER JOIN `vendors`**:

```text
catalog.publish_status = 'published'
AND vendor.pay_bill_enabled = true
AND vendor.bank_verified = true
AND vendor.status = 'active'
```

`VendorCatalogRepository` owns catalogue CRUD; eligibility predicates live in the repository SQL for list endpoints (customer + admin).

---

# SECTION 8 — RISKS

## 8.1 Migration risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| `payment_source` added as NOT NULL immediately | **High** — breaks all legacy `INSERT INTO payments` without column | Add **nullable** in Phase 1; enforce in Warmpawz Pay repo only |
| `transaction_category` CHECK extension | **Medium** — must drop/recreate constraint idempotently | Use `DO $$` block checking constraint name; include all existing + new value |
| `bank_verified` already exists with different default | **Low** | `ADD COLUMN IF NOT EXISTS`; document prod verification query before apply |
| Duplicate migration numbers (`1079_*`) | **Low** | Use `1080` for Warmpawz Pay migration |

## 8.2 Locking risks

| Risk | Mitigation |
|------|------------|
| `ALTER TABLE payments` on large table | PostgreSQL ADD COLUMN with nullable defaults is fast (metadata has DEFAULT); index creation **CONCURRENTLY** if prod table is huge — team standard is non-concurrent in migration files; schedule low-traffic window for prod |
| Unique index build on `settlements` | Partial index — small cardinality initially |

## 8.3 Data migration risks

| Risk | Mitigation |
|------|------------|
| Legacy payments with NULL `payment_source` | Expected — filter `WHERE payment_source = 'warmpawz_pay'` excludes them |
| Existing settlement rows with `payment_id` + non-warmpawz `order_type` | Unique index scoped to `order_type = 'warmpawz_pay'` — no collision |
| `coupon_usages.discount_amount` missing on some envs | Optional ADD IF NOT EXISTS in same migration |

## 8.4 Backward compatibility

| Area | Impact |
|------|--------|
| Legacy payment inserts | Unaffected if `payment_source` nullable |
| Booking settlements | Unaffected — different `order_type` |
| Ecommerce settlements | Unaffected — uses `ecommerce_order_settlements` |
| Admin transactions | Unaffected — new category value only |
| Promotion analytics | Existing booking/order usage rows unchanged |

## 8.5 Rollback considerations

| Action | Rollback |
|--------|----------|
| Migration apply | Idempotent additive migration — rollback = drop indexes + drop columns (only if no Warmpawz Pay rows exist) |
| Warmpawz Pay rows in prod | **Do not drop columns** after live payments — forward-only |
| Feature flag off | Application can disable routes; schema extensions are harmless when unused |

---

# SECTION 9 — IMPLEMENTATION ORDER

Exact sequence for Phase 1 database foundation:

```text
1. payments extension
   ├── payment_source (nullable, no default)
   ├── original_amount
   └── metadata JSONB

2. vendors extension
   ├── pay_bill_enabled
   └── bank_verified (IF NOT EXISTS)

3. warmpawz_pay_vendor_catalog (new table)
   ├── visibility columns only (no pricing/discount)
   └── catalogue indexes

4. payments partial indexes
   ├── idx_payments_wpay_customer_date
   ├── idx_payments_wpay_vendor_date
   ├── idx_payments_wpay_pending
   └── idx_payments_wpay_idempotency

5. settlements index
   └── UNIQUE partial on payment_id WHERE order_type = 'warmpawz_pay'

6. transactions CHECK extension
   └── add 'warmpawz_pay' to transaction_category

7. promotion_usages extension
   ├── payment_id FK
   └── indexes (lookup + unique partial)

8. coupon_usages extension
   ├── payment_id FK
   ├── discount_amount (IF NOT EXISTS)
   └── indexes (lookup + unique partial)

9. Apply migration on dev RDS
   └── ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1080_warmpawz_pay_phase1_schema.sql

10. Repository interfaces (contract definitions — no implementation in schema PR)

11. Repository implementations (scaffold in feature/wpay-schema branch)
    ├── VendorCatalogRepository
    ├── PaymentIntentRepository
    ├── SettlementAccrualRepository
    ├── PromotionUsageRepository
    └── TransactionLedgerRepository

12. Unit test: PaymentIntentRepository rejects insert without payment_source
    (application layer — follows migration merge)
```

**Dependency graph:**

```text
1080 migration (steps 1–7)
        ↓
dev RDS apply (step 8)
        ↓
repository scaffold (steps 9–10) — blocked on 1080 merge
        ↓
payment flow / post-payment / customer APIs (later sprints)
```

---

# APPENDIX A — Column-level gap matrix

| Table | Column / artifact | Exists today | Phase 1 action |
|-------|-------------------|--------------|----------------|
| `payments` | `payment_source` | No | **Add** |
| `payments` | `original_amount` | No | **Add** |
| `payments` | `metadata` | No | **Add** |
| `payments` | `idempotency_key` | Yes | No change |
| `payments` | Warmpawz partial indexes | No | **Add** |
| `settlements` | `order_type` | Yes | No change |
| `settlements` | `payment_id` | Yes | No change |
| `settlements` | wpay unique index | No | **Add** |
| `transactions` | `'warmpawz_pay'` category | No | **Extend CHECK** |
| `promotion_usages` | `payment_id` | No | **Add** |
| `coupon_usages` | `payment_id` | No | **Add** |
| `vendors` | `pay_bill_enabled` | No | **Add** |
| `vendors` | `bank_verified` | Maybe (prod) | **Add IF NOT EXISTS** |
| `warmpawz_pay_quotes` | table | No | **Deferred** |
| `warmpawz_pay_vendor_catalog` | table | No | **Create** (visibility only) |
| Warmpawz Pay discount tables | — | — | **Do not create** (Promotion Engine V2) |

---

# APPENDIX B — Related tables (no Phase 1 change)

| Table | Status |
|-------|--------|
| `payment_status_history` | No change required |
| `payment_transaction_log` | No change required |
| `refunds` | No change required (Phase 1) |
| `payouts` | No change required |
| `vendor_earnings` | No access — no change |
| `ecommerce_order_settlements` | No access — no change |
| `idempotency_keys` | No change required |

---

**Document end.**  
**Next step (when approved):** Author `db/migrations/1080_warmpawz_pay_phase1_schema.sql` following this analysis — SQL generation is a separate task.
