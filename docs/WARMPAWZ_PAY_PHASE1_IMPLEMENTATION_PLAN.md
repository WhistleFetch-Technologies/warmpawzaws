# Warmpawz Pay — Phase 1 Implementation Plan

**Document type:** Implementation plan (pre-migration) — **no SQL, no TypeScript**  
**Branch:** `feature/warmpawzpay` → implementation on `feature/wpay-schema`  
**References:**

- `docs/WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE_FINAL.md`
- `docs/WARMPAWZ_PAY_PHASE1_SCHEMA_ANALYSIS.md` (updated July 23, 2026)

**Status:** Approved for migration authoring  
**Date:** July 23, 2026

---

## Purpose

This plan is the **authoritative checklist** for Phase 1 database foundation and repository scaffolding. The next step is to generate `db/migrations/1080_warmpawz_pay_phase1_schema.sql` from this document.

---

## Architecture decisions (binding)

| Decision | Rule |
|----------|------|
| **Discounts** | Promotion Engine V2 only. **No** Warmpawz Pay discount/pricing/promotion tables. |
| **Quote flow** | Customer → Quote API → Promotion Engine V2 → resolve promotions → return discount. Quote API **never** calculates discounts itself. |
| **Catalogue** | `warmpawz_pay_vendor_catalog` is **publishing visibility only**. Admin decides which vendors appear in the customer app. |
| **Catalogue exclusions** | Must **not** include `discount_percent`, `max_discount_amount`, `offer_label`, or any promotion/pricing columns. |
| **Payment hub** | Extend `payments` with `payment_source`, `original_amount`, `metadata` — no separate payment table. |
| **Settlement** | Reuse `settlements` with `order_type = 'warmpawz_pay'` — not `ecommerce_order_settlements`, not `vendor_earnings`. |
| **Usage commit** | Extend existing `promotion_usages` / `coupon_usages` with `payment_id` — not new usage tables. |

---

## 1. Final migration list

| # | Migration file | Purpose | Status |
|---|----------------|---------|--------|
| **M1** | `1080_warmpawz_pay_phase1_schema.sql` | Complete Phase 1 schema foundation | **Author next** |
| M2 | `10XX_payments_payment_source_not_null.sql` | Platform backfill + `SET NOT NULL` on `payment_source` | Deferred (post-MVP) |
| M3 | `10XX_warmpawz_pay_quotes.sql` | Persistent quote entities | Deferred (post-MVP) |

**Phase 1 delivers exactly one migration: M1.**

### M1 — `1080_warmpawz_pay_phase1_schema.sql`

| Attribute | Value |
|-----------|-------|
| **Purpose** | Warmpawz Pay bounded-context database foundation |
| **Affected objects** | 6 extensions + 1 new table + 12 indexes + 1 CHECK extension + 3 new FKs |
| **Dependencies** | Migrations through `1079_*`; requires `payments`, `settlements`, `transactions`, `promotion_usages`, `coupon_usages`, `vendors` |
| **Merge order** | **① First** on `feature/wpay-schema` → PR to `develop` before all other Warmpawz Pay branches |
| **Apply (dev)** | `ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1080_warmpawz_pay_phase1_schema.sql` |
| **Idempotency** | All statements must use `IF NOT EXISTS` / conditional `DO $$` blocks per repo convention |

### M1 internal execution order (within single file)

See §5 below — order matters for FK dependencies.

---

## 2. Final table changes

### 2.1 `payments` — EXTEND

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `payment_source` | `TEXT` | YES | **none** | Warmpawz Pay: `'warmpawz_pay'`. Nullable at DB for legacy compatibility; repo always sets on insert. |
| `original_amount` | `NUMERIC(12,2)` | YES | none | Pre-discount bill amount |
| `metadata` | `JSONB` | NO | `'{}'` | Promo snapshot, quote ref — **not** effect flags |

**Unchanged:** all existing columns, FKs, status CHECK, global `idx_payment_idempotency`.

**Warmpawz Pay insert invariants (repository-enforced):**

- `payment_source = 'warmpawz_pay'`
- `booking_id`, `order_id`, `pharmacy_order_id`, `subscription_id` = NULL
- `original_amount` = bill before discount; `amount` = payable after discount
- Promo snapshot in `metadata` (from Quote API / engine response)

---

### 2.2 `vendors` — EXTEND

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `pay_bill_enabled` | `BOOLEAN` | NO | `false` | Vendor eligible for Pay Bill product |
| `bank_verified` | `BOOLEAN` | NO | `false` | `ADD IF NOT EXISTS` — may exist on prod |

**Unchanged:** `status`, `metadata`, commission columns, bank detail tables.

**Eligibility predicate (application + catalogue JOIN):**

```text
pay_bill_enabled = true AND bank_verified = true AND status = 'active'
```

---

### 2.3 `warmpawz_pay_vendor_catalog` — CREATE (new)

**Role:** Vendor publishing catalogue — **visibility only**.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK |
| `vendor_id` | `UUID` | NO | — | UNIQUE FK → `vendors(id)` |
| `publish_status` | `TEXT` | NO | `'draft'` | CHECK: `'draft'` \| `'published'` |
| `published_at` | `TIMESTAMPTZ` | YES | NULL | Set on publish |
| `created_by` | `UUID` | YES | NULL | Admin user ID (no FK required in Phase 1) |
| `created_at` | `TIMESTAMPTZ` | NO | `NOW()` | Audit |
| `updated_at` | `TIMESTAMPTZ` | NO | `NOW()` | Audit |

**Forbidden columns (must not appear in migration or repo):**

- `discount_percent`, `max_discount_amount`, `offer_label`
- `promotion_id`, `coupon_id`, `campaign_id`, or any pricing field

**Customer visibility query pattern:**

```text
FROM warmpawz_pay_vendor_catalog c
JOIN vendors v ON v.id = c.vendor_id
WHERE c.publish_status = 'published'
  AND v.status = 'active'
  AND v.bank_verified = true
  AND v.pay_bill_enabled = true
```

---

### 2.4 `settlements` — EXTEND (index only)

**No new columns.**

| Usage | Value |
|-------|-------|
| `order_type` | `'warmpawz_pay'` |
| `payment_id` | FK to completed payment |
| `settlement_status` | `'pending'` on async accrual |

---

### 2.5 `transactions` — EXTEND (CHECK only)

| Change | Detail |
|--------|--------|
| `transaction_category` CHECK | Add `'warmpawz_pay'` to allowed values |

**No new columns.**

---

### 2.6 `promotion_usages` — EXTEND

| Column | Type | Nullable | FK |
|--------|------|----------|-----|
| `payment_id` | `UUID` | YES | → `payments(id)` ON DELETE SET NULL |

**Unchanged:** `booking_id`, `order_id`, amount columns. Warmpawz Pay rows use `payment_id`; booking/order NULL.

**Usage source:** Promotion Engine V2 commit path (Sprint 2+) — Phase 1 only prepares schema.

---

### 2.7 `coupon_usages` — EXTEND

| Column | Type | Nullable | FK |
|--------|------|----------|-----|
| `payment_id` | `UUID` | YES | → `payments(id)` ON DELETE SET NULL |
| `discount_amount` | `NUMERIC(10,2)` | YES | ADD IF NOT EXISTS (env parity) |

---

### 2.8 Tables explicitly NOT created

| Table | Reason |
|-------|--------|
| Warmpawz Pay discount / pricing tables | Promotion Engine V2 |
| `warmpawz_pay_quotes` | Deferred — signed tokens for MVP |
| `warmpawz_pay_promotions` | Forbidden |
| `ecommerce_order_settlements` usage | Wrong bounded context |

---

## 3. Final indexes

### 3.1 `payments` (partial — Warmpawz Pay only)

| Index | Definition |
|-------|------------|
| `idx_payments_wpay_customer_date` | `(customer_id, created_at DESC)` WHERE `payment_source = 'warmpawz_pay'` |
| `idx_payments_wpay_vendor_date` | `(vendor_id, created_at DESC)` WHERE `payment_source = 'warmpawz_pay'` |
| `idx_payments_wpay_pending` | `(created_at)` WHERE `payment_source = 'warmpawz_pay' AND payment_status = 'pending'` |
| `idx_payments_wpay_idempotency` | UNIQUE `(customer_id, idempotency_key)` WHERE `payment_source = 'warmpawz_pay' AND idempotency_key IS NOT NULL` |

**Retain:** existing global `idx_payment_idempotency` — do not drop.

---

### 3.2 `settlements`

| Index | Definition |
|-------|------------|
| `idx_settlements_wpay_payment_unique` | UNIQUE `(payment_id)` WHERE `order_type = 'warmpawz_pay' AND payment_id IS NOT NULL` |

---

### 3.3 `promotion_usages`

| Index | Definition |
|-------|------------|
| `idx_promotion_usages_payment_id` | `(payment_id)` WHERE `payment_id IS NOT NULL` |
| `idx_promotion_usages_wpay_unique` | UNIQUE `(payment_id, promotion_type)` WHERE `payment_id IS NOT NULL` |

---

### 3.4 `coupon_usages`

| Index | Definition |
|-------|------------|
| `idx_coupon_usages_payment_id` | `(payment_id)` WHERE `payment_id IS NOT NULL` |
| `idx_coupon_usages_wpay_unique` | UNIQUE `(payment_id)` WHERE `payment_id IS NOT NULL` |

---

### 3.5 `warmpawz_pay_vendor_catalog`

| Index | Definition |
|-------|------------|
| `idx_wpay_catalog_vendor_id` | UNIQUE `(vendor_id)` |
| `idx_wpay_catalog_published` | `(vendor_id)` WHERE `publish_status = 'published'` |

---

### 3.6 Indexes NOT in Phase 1

| Index | Reason |
|-------|--------|
| GIN on `payments.metadata` | No query requirement yet |
| `transactions(transaction_category)` | Low volume |
| Discount/pricing indexes on catalogue | Catalogue has no pricing columns |

---

## 4. Repository interfaces

Location: `backend/lambda/src/endpoints/warmpawz-pay/repositories/` (interfaces in same folder or `repositories/interfaces/`).

### 4.1 `IVendorCatalogRepository`

**Owns:** `warmpawz_pay_vendor_catalog`

| Method (conceptual) | Responsibility |
|---------------------|----------------|
| `createEntry(vendorId, createdBy)` | Insert draft catalogue row |
| `updatePublishStatus(vendorId, status, publishedAt?)` | Admin publish/unpublish |
| `findByVendorId(vendorId)` | Admin detail |
| `listPublishedEligibleVendors(filters)` | Customer list — JOIN `vendors` with eligibility predicate |
| `listAll(filters)` | Admin catalogue list |

**Must not:** read/write discount or promotion data.

---

### 4.2 `IPaymentIntentRepository`

**Owns:** `payments` WHERE `payment_source = 'warmpawz_pay'`

| Method (conceptual) | Responsibility |
|---------------------|----------------|
| `insert(intent)` | **Reject** if `payment_source` missing or ≠ `'warmpawz_pay'` |
| `findById(paymentId)` | Always filter by source |
| `findByIdForUpdate(paymentId)` | Verify TX — `FOR UPDATE` |
| `findByIdempotency(customerId, key)` | Initiate idempotency |
| `updateStatus(paymentId, patch)` | Verify completion |

**Must not:** import monolith payment handlers.

---

### 4.3 `ISettlementAccrualRepository`

**Owns:** `settlements` WHERE `order_type = 'warmpawz_pay'`

| Method (conceptual) | Responsibility |
|---------------------|----------------|
| `insertAccrual(paymentId, vendorId, amounts, period)` | Idempotent insert |
| `findByPaymentId(paymentId)` | Downstream status / history |

---

### 4.4 `IPromotionUsageRepository`

**Owns:** `promotion_usages` and `coupon_usages` by `payment_id`

| Method (conceptual) | Responsibility |
|---------------------|----------------|
| `insertPromotionUsage(...)` | Idempotent — engine-driven payload |
| `insertCouponUsage(...)` | Idempotent coupon path |
| `existsForPayment(paymentId)` | Reconciliation / composite status |

**Integrates with:** Promotion Engine V2 usage tracker (Sprint 2+) — Phase 1 defines interface only.

---

### 4.5 `ITransactionLedgerRepository`

**Owns:** `transactions` WHERE `transaction_category = 'warmpawz_pay'`

| Method (conceptual) | Responsibility |
|---------------------|----------------|
| `insertLedgerEntry(paymentId, ...)` | Idempotent admin ledger row |
| `existsForPayment(paymentId)` | Downstream status |

---

### 4.6 Interface dependency graph

```text
VendorCatalogRepository          (independent — catalogue)
        ↓ (customer list reads vendor eligibility)
PaymentIntentRepository          (depends on M1 payments columns)
        ↓
SettlementAccrualRepository      (depends on payment_id + settlements index)
PromotionUsageRepository         (depends on payment_id on usage tables)
TransactionLedgerRepository      (depends on transaction_category CHECK)
```

---

## 5. Migration execution order

**Single file `1080_warmpawz_pay_phase1_schema.sql` — apply steps in this order:**

| Step | Object | Action | Depends on |
|------|--------|--------|------------|
| 1 | `vendors` | Add `pay_bill_enabled`, `bank_verified` (IF NOT EXISTS) | — |
| 2 | `payments` | Add `payment_source`, `original_amount`, `metadata` | — |
| 3 | `warmpawz_pay_vendor_catalog` | CREATE TABLE + CHECK on `publish_status` | `vendors` |
| 4 | `warmpawz_pay_vendor_catalog` | CREATE indexes | Step 3 |
| 5 | `promotion_usages` | Add `payment_id` FK | `payments` |
| 6 | `coupon_usages` | Add `payment_id` FK; `discount_amount` IF NOT EXISTS | `payments` |
| 7 | `transactions` | Extend `transaction_category` CHECK | — |
| 8 | `payments` | CREATE partial indexes | Step 2 |
| 9 | `settlements` | CREATE unique partial index | `payments`, `settlements.order_type` |
| 10 | `promotion_usages` | CREATE indexes | Step 5 |
| 11 | `coupon_usages` | CREATE indexes | Step 6 |
| 12 | COMMENT ON | Document catalogue as visibility-only | Step 3 |

**Why vendors before catalogue:** FK target must exist with new eligibility columns available for documentation/testing.

**Why payments before usage FKs:** `payment_id` references `payments(id)`.

---

## 6. Repository implementation order

After M1 merged and applied on dev RDS:

| Step | Deliverable | Branch | Blocked by |
|------|-------------|--------|------------|
| 1 | Define TypeScript interfaces (§4) — contracts only | `feature/wpay-schema` | M1 merged |
| 2 | `VendorCatalogRepository` implementation | `feature/wpay-schema` | Step 1 |
| 3 | `PaymentIntentRepository` + unit test (rejects missing `payment_source`) | `feature/wpay-schema` | Step 1 |
| 4 | `SettlementAccrualRepository` scaffold | `feature/wpay-schema` | Step 3 |
| 5 | `PromotionUsageRepository` scaffold | `feature/wpay-schema` | Step 3 |
| 6 | `TransactionLedgerRepository` scaffold | `feature/wpay-schema` | Step 3 |
| 7 | Export repos from `warmpawz-pay/repositories/index.ts` | `feature/wpay-schema` | Steps 2–6 |
| 8 | PR → `develop`; apply M1 on dev RDS | Team | Steps 1–7 |

**Not in Phase 1 repo scope:**

- QuoteService / Promotion Engine V2 wiring (Sprint 2 — `feature/wpay-payment-flow`)
- PostPaymentProcessor writes (Sprint 2 — `feature/wpay-post-payment`)
- Customer 4-layer read repos (Sprint 2 — `feature/abhi-wpay-customer`)
- Admin catalogue UI/API handlers (Sprint 2 — `feature/wpay-admin`)

**Promotion Engine V2 application work (post-schema, not migration):**

- Add `WARMPAWZ_PAY` to `DiscountDomain` enum
- Wire Quote API to engine resolver — **no new DB tables**
- Optionally extend `promotions.discount_domain` / `coupons.discount_domain` CHECK for `'WARMPAWZ_PAY'` in a **separate** migration if engine requires durable domain tagging — **not in M1** unless blocked; confirm during payment-flow sprint

---

## 7. Validation checklist

### 7.1 Pre-merge (author)

- [ ] Migration file named `1080_warmpawz_pay_phase1_schema.sql`
- [ ] All statements idempotent (`IF NOT EXISTS`, conditional constraint drops)
- [ ] `payment_source` added **nullable, no DEFAULT**
- [ ] `metadata` added `NOT NULL DEFAULT '{}'::jsonb`
- [ ] Catalogue table has **exactly** the 7 required columns — no pricing/discount columns
- [ ] `publish_status` CHECK includes only `draft` and `published`
- [ ] `vendor_id` UNIQUE on catalogue
- [ ] All 12 indexes from §3 present
- [ ] `transaction_category` CHECK includes all **existing** values plus `'warmpawz_pay'`
- [ ] No `DROP TABLE`, `DROP COLUMN`, or `TRUNCATE`
- [ ] No references to `ecommerce_order_settlements` or `vendor_earnings`

### 7.2 Post-apply on dev RDS

- [ ] Migration exits 0: `ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1080_warmpawz_pay_phase1_schema.sql`
- [ ] Re-run migration — idempotent (no errors, no duplicate objects)
- [ ] Verify columns:

```text
payments: payment_source, original_amount, metadata
vendors: pay_bill_enabled, bank_verified
warmpawz_pay_vendor_catalog: exists with 7 columns
promotion_usages.payment_id: exists
coupon_usages.payment_id: exists
```

- [ ] Verify indexes exist (12 total from §3)
- [ ] Insert smoke catalogue row (draft) for test vendor — manual or script
- [ ] Confirm legacy `INSERT INTO payments (...)` without `payment_source` still succeeds (nullable)
- [ ] Confirm Warmpawz Pay repo test rejects insert without `payment_source`

### 7.3 Repository validation

- [ ] `PaymentIntentRepository` unit test: missing `payment_source` → error
- [ ] `PaymentIntentRepository` unit test: insert always uses `'warmpawz_pay'`
- [ ] `VendorCatalogRepository` unit test: no discount fields in insert payload
- [ ] `SettlementAccrualRepository` integration test: duplicate insert → single row (unique index)
- [ ] No imports from forbidden paths (`razorpay.razorpay.ts`, `payments-enhanced.ts`) in `warmpawz-pay/`

### 7.4 CI / team gates

- [ ] PR targets `develop` from `feature/wpay-schema`
- [ ] Migration file listed in PR description
- [ ] Schema PR merged **before** payment-flow, admin, customer branches rebase
- [ ] Dev RDS apply confirmed by schema owner (Bindu per sprint plan)

---

## 8. Risks before migration

| Risk | Severity | Mitigation |
|------|----------|------------|
| Legacy payment inserts break if `payment_source` NOT NULL | **High** | M1 adds column **nullable**; no DEFAULT |
| Sprint plan SQL snippets include `discount_percent` on catalogue | **High** | **Reject** — this plan overrides; catalogue is visibility-only |
| `bank_verified` already on prod with different type/default | **Medium** | `ADD COLUMN IF NOT EXISTS`; run `\d vendors` on dev before apply |
| `transaction_category` CHECK drop/recreate fails mid-migration | **Medium** | Idempotent `DO $$` — list all existing enum values explicitly |
| Global `idx_payment_idempotency` vs wpay composite index confusion | **Low** | Keep both; document global is stricter |
| Catalogue FK `ON DELETE` for vendor | **Medium** | Prefer `RESTRICT` or `CASCADE` with explicit team choice — default recommend **RESTRICT** to prevent accidental vendor delete with published catalogue |
| `created_by` without admin FK | **Low** | UUID nullable; no FK in Phase 1 |
| Large `payments` table lock on ADD COLUMN | **Low–Medium** | Nullable ADD COLUMN is fast in PG 11+; schedule prod apply in low-traffic window |
| Promotion Engine V2 domain not in DB CHECK yet | **Low** | Engine enum is TypeScript; M1 does not require `discount_domain` extension unless payment-flow sprint blocks — track separately |
| Duplicate migration number `1080` | **Low** | Confirm no other branch claimed `1080` before PR |

### Pre-migration verification queries (dev/prod read-only)

Run before authoring SQL to confirm prod parity:

1. `\d payments` — confirm `metadata`, `payment_source` absent  
2. `\d vendors` — confirm `pay_bill_enabled` absent; note if `bank_verified` exists  
3. `\d promotion_usages` — confirm `payment_id` absent  
4. `\dt warmpawz_pay_vendor_catalog` — confirm table absent  
5. `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'transactions'::regclass AND contype = 'c';` — capture current `transaction_category` CHECK  

---

## 9. Definition of done (Phase 1)

Phase 1 is complete when:

1. M1 migration merged to `develop` and applied on dev RDS  
2. All §7 validation checkboxes passed  
3. Five repository interfaces defined and four payment/settlement repos + catalogue repo scaffolded  
4. `PaymentIntentRepository` unit test green  
5. No Warmpawz Pay discount tables exist  
6. `warmpawz_pay_vendor_catalog` exists with **visibility columns only**  
7. Downstream branches (`feature/wpay-payment-flow`, `feature/wpay-admin`, `feature/abhi-wpay-customer`) rebased on `develop` and unblocked  

---

## 10. Next step

Generate `db/migrations/1080_warmpawz_pay_phase1_schema.sql` implementing §2, §3, and §5 of this plan.

**Do not** include discount/pricing columns on the catalogue.  
**Do not** create Warmpawz Pay promotion tables.  
**Do not** modify legacy monolith payment files in the same PR as M1.

---

**Document end.**
