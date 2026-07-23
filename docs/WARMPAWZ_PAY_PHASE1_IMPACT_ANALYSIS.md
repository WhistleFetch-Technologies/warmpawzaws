# Warmpawz Pay — Phase 1 Impact Analysis

**Document type:** Pre-migration impact analysis (no SQL, no code changes)  
**References:**

- `docs/WARMPAWZ_PAY_PHASE1_SCHEMA_ANALYSIS.md` (updated)
- `docs/WARMPAWZ_PAY_PHASE1_IMPLEMENTATION_PLAN.md`
- `docs/WARMPAWZ_PAY_TECHNICAL_ARCHITECTURE_FINAL.md`

**Date:** July 23, 2026  
**Scope:** Verify approved Phase 1 schema (`1080_warmpawz_pay_phase1_schema.sql`) can land without breaking existing backend behaviour; inventory all touchpoints that will **eventually** need Warmpawz Pay updates.

**Method:** Static analysis of `backend/lambda/src/**`, `backend/lambda/src/jobs/**`, and selected `scripts/**` via repository-wide search for reads/writes to the six target tables.

---

## Executive conclusion

| Verdict | **GO** — migration M1 is safe to author and apply on dev |
|---------|----------------------------------------------------------|
| Breaking changes at migration time | **None expected** for existing flows |
| Legacy code changes required **before** migration | **None** |
| Legacy code changes required **after** migration | **Warmpawz Pay module only** (new bounded context) |
| Largest post-migration risk | Operational — legacy payments with `NULL payment_source` until backfill; booking reconciliation ignores non-booking payments (correct for now) |

---

# 1. Payments impact

## 1.1 Insert paths (complete inventory)

All locations performing `insert('payments', …)` or `INSERT INTO payments`:

| # | File | Module / endpoint | Bounded context | Payment type | New columns affect flow? | Continue without change? |
|---|------|-------------------|-----------------|----------------|--------------------------|--------------------------|
| 1 | `endpoints/razorpay/endpoints/razorpay.razorpay.ts` | Razorpay monolith | Legacy hub | Booking, ecommerce, pharmacy, meal (multi-path) | **No** — inserts use dynamic column lists filtered via `information_schema`; omitted nullable columns get DB NULL/default | **Yes** |
| 2 | `endpoints/payments-enhanced.ts` | Booking payments | Booking | Service booking | **No** — same dynamic column filter pattern (L523–538) | **Yes** |
| 3 | `endpoints/booking/endpoints/bookings-enhanced.booking.ts` | Booking create | Booking | Service booking | **No** — dynamic column filter before INSERT | **Yes** |
| 4 | `endpoints/payments.ts` | Generic payments API | Legacy | Mixed | **No** — builds column list from request body only | **Yes** |
| 5 | `endpoints/package-booking.ts` | Package booking | Booking / package | Package purchase | **No** — explicit columns; new cols omitted | **Yes** |
| 6 | `utils/vendor-package-razorpay-flow.ts` | Package Razorpay | Booking / package | Vendor package | **No** — `insert('payments', paymentRow)` without new fields | **Yes** |
| 7 | `utils/payments/meal-order-original-refund.ts` | Meal refunds | Meal | Meal order (uses `transaction_id` marker) | **No** — explicit INSERT column list | **Yes** |
| 8 | `endpoints/promotions.ts` | Promotions | Booking / subscription | Zero-amount subscription | **No** | **Yes** |
| 9 | `endpoints/subscriptions.ts` | Subscriptions job/handler | Subscription | Recurring subscription | **No** — sets `subscription_id`, not new cols | **Yes** |
| 10 | `endpoints/teleCommunication/endpoints/video-call.teleCommunication.ts` | Teleconsult | Teleconsult / booking | Instant tele | **No** | **Yes** |

**Why all insert paths survive:**

- `payment_source` — **nullable, no DEFAULT** → omitted from INSERT → PostgreSQL stores NULL  
- `original_amount` — **nullable** → omitted → NULL  
- `metadata` — **NOT NULL DEFAULT `'{}'`** → omitted → PostgreSQL applies default  

The shared `insert()` helper (`database/rds-connection.ts` L607–676) builds INSERT from object keys only — it never requires new columns.

**Defensive pattern already in codebase:** `payments-enhanced.ts`, `razorpay.razorpay.ts`, and `bookings-enhanced.booking.ts` query `information_schema.columns` and filter insert payloads — new columns are **not auto-included**, preventing accidental wrong `payment_source` values from legacy code.

---

## 1.2 Update paths (representative inventory)

| File | Operation | Context | Affected by new columns? |
|------|-----------|---------|--------------------------|
| `razorpay.razorpay.ts` | Many `UPDATE payments SET payment_status…` | Verify webhook, ecommerce, pharmacy, booking | **No** — updates existing columns only |
| `payments-enhanced.ts` | Status / Razorpay field updates | Booking verify | **No** |
| `bookings-enhanced.booking.ts` | Link `booking_id`, complete payment | Booking lifecycle | **No** |
| `package-booking.ts` | Complete payment, link booking | Package | **No** |
| `utils/payments/payment-reconciliation.ts` | Complete stale pending payments | **Booking only** (`WHERE booking_id = ANY(...)`) | **No** — Warmpawz Pay rows have `booking_id NULL` |
| `utils/payments/booking-original-refund.ts` | Refund status | Booking | **No** |
| `utils/payment-hold.ts` | Hold release | Booking / shop | **No** |
| `otp-enhanced.ts`, `packages.ts` | `update('payments', …)` | OTP / package | **No** |
| `followup-reschedule.ts`, `pet-holidays.ts`, `instant-tele-v2/v3` | Link booking to payment | Booking / tele | **No** |
| `meal-order-original-refund.ts` | Status updates | Meal | **No** |

**No existing UPDATE** sets or reads `payment_source`, `original_amount`, or `metadata`.

---

## 1.3 Read paths (high-traffic)

| Area | Files | Query pattern | Impact |
|------|-------|---------------|--------|
| Booking payment sources | `utils/payments/booking-payment-sources.ts` | `FROM payments WHERE booking_id…` | **No impact** — Warmpawz Pay rows excluded (no booking_id) |
| Customer bookings | `customer/bookings/repos/module-helpers.repo.ts` | JOIN payments on booking | **No impact** |
| Admin analytics | `admin/endpoints/analytics.admin.ts`, `admin-advanced.ts` | Aggregate payments | **No impact** — NULL `payment_source` rows appear as legacy; no filter breakage |
| Reports | `endpoints/reports.ts` | Revenue / payment reports | **No impact** at migration time |
| Refunds | `lib/services/refundable-base.ts`, `utils/payments/refund-service.ts` | By `payment_id` | **No impact** |
| Transaction monitoring | `endpoints/transaction-monitoring.ts` | Payment queries | **No impact** |
| Vendor earnings | `utils/vendor-earnings-on-completion.ts` | Booking-linked | **No impact** |
| Ecommerce | `razorpay.razorpay.ts`, `ecommerce.ts` | Order / shop payments | **No impact** |

**Future Warmpawz Pay reads** must filter `WHERE payment_source = 'warmpawz_pay'` — not required for legacy code.

---

## 1.4 Services, jobs, helpers (payments)

| Component | Role | Touches payments? | Phase 1 impact |
|-----------|------|-------------------|----------------|
| `utils/payments/payment-reconciliation.ts` | Booking reconcile | UPDATE by id (booking-scoped discovery) | **Safe** |
| `utils/payments/payment-verification-service.ts` | Verify helper | Read | **Safe** |
| `utils/payments/booking-original-refund.ts` | Booking refunds | Read/update | **Safe** |
| `utils/payments/meal-order-original-refund.ts` | Meal refunds | Insert/update | **Safe** |
| `utils/payments/shop-order-refund.ts` | Ecommerce refunds | Read | **Safe** |
| `utils/payment-hold.ts` | Booking hold | Update | **Safe** |
| `utils/shop-payment-hold.ts` | Shop hold | Read payments | **Safe** |
| `lib/services/booking-promotion-service.ts` | Promo (no direct payment write) | Indirect | **Safe** |
| Customer convenience services (~15 files) | Call `reconcileBookingPayments` | Booking only | **Safe** |

**No scheduled Lambda in repo** exclusively reconciles all payments globally — booking reconciliation is on-demand from customer API reads.

---

## 1.5 Payment lifecycle (existing)

```text
Legacy domains:
  Booking    → payments-enhanced / razorpay.razorpay / bookings-enhanced
  Ecommerce  → razorpay.razorpay → ecommerce_order_settlements (separate)
  Pharmacy   → razorpay.razorpay (pharmacy_order_id)
  Meal       → meal-order-original-refund / razorpay paths
  Package    → vendor-package-razorpay-flow / package-booking
  Subscription → subscriptions.ts / promotions.ts
  Teleconsult  → video-call.teleCommunication.ts

Warmpawz Pay (not implemented):
  → PaymentIntentRepository (post-M1)
  → payment_source = 'warmpawz_pay'
```

Adding nullable columns **does not alter** any step in legacy lifecycles.

---

# 2. Settlements impact

## 2.1 Insert paths (complete)

| # | File | Type | Sets `order_type`? | Sets `payment_id`? | Impact from wpay index |
|---|------|------|--------------------|--------------------|------------------------|
| 1 | `jobs/settlement-processor.ts` | Scheduled/batch job | No (default `'booking'`) | Uses `booking_id` | **None** — partial unique index scoped to `order_type = 'warmpawz_pay'` |
| 2 | `endpoints/settlement&payouts/endpoints/settlements.ts` L1152 | Vendor batch settlement | No | No (uses `payment_ids[]`) | **None** |
| 3 | `endpoints/razorpay/endpoints/razorpay.razorpay.ts` L2317 | Per-booking Route transfer | No | No (`booking_id` set) | **None** |

**Ecommerce settlements:** Written to **`ecommerce_order_settlements`** via `utils/write-ecommerce-order-settlement.ts`, processed by `jobs/ecommerce-settlement-processor.ts` — **does not insert into `settlements`** for per-order ledger. **Zero conflict.**

## 2.2 Update paths

| File | Purpose |
|------|---------|
| `jobs/settlement-processor.ts` | Payout execution status |
| `endpoints/settlement&payouts/endpoints/settlements.ts` | Admin/vendor settlement ops |
| `endpoints/razorpay-settlements.ts` | Razorpay settlement sync |
| `razorpay.razorpay.ts` | Transfer status on booking settlement |

All updates target rows by `id` or booking context — **unaffected** by new partial unique index.

## 2.3 Read paths

Heavy read usage in `settlements.ts`, `vendor-dashboard-enhanced.ts`, `admin-comprehensive.ts`, `ecommerce.ts` (join for vendor history). Queries use `SELECT *` or specific columns — **additive schema only** (index add, no column change on settlements).

## 2.4 Verification: `order_type = 'warmpawz_pay'` + unique index

| Concern | Analysis |
|---------|----------|
| Booking batch inserts | Default `order_type = 'booking'` — outside partial index predicate |
| Booking per-booking insert (razorpay) | No `payment_id` — index predicate requires `payment_id IS NOT NULL` |
| Ecommerce | Separate table — no interaction |
| Duplicate `payment_id` across domains | Legacy booking rows unlikely to set `payment_id` + `order_type='warmpawz_pay'` simultaneously |
| **Conclusion** | **No behavioural impact** on booking or ecommerce settlement flows |

---

# 3. Transactions impact

## 3.1 Writers

**No `insert('transactions', …)` or `INSERT INTO transactions` found** anywhere in `backend/lambda/src`.

The admin ledger table is **read-only** in current application code.

## 3.2 Readers / `transaction_category` usage

| File | Usage |
|------|-------|
| `admin/endpoints/admin-advanced.ts` | `select('transactions', filters)`, raw SELECT |
| `admin/endpoints/admin-comprehensive.ts` | Paginated admin transaction list |
| `admin-comprehensive.ts` | Duplicate admin paths |
| `admin/endpoints/admin-customer-endpoints.ts` | Customer transaction history join |

**Grep for `transaction_category` in `backend/lambda/src`:** **zero matches.**

Admin queries do not filter CHECK values in application code — they read whatever categories exist.

## 3.3 CHECK extension impact

Extending CHECK to include `'warmpawz_pay'`:

| Effect | Result |
|--------|--------|
| Existing INSERT paths | **None** (no writers) |
| Existing SELECT paths | **None** |
| Existing rows | **Unchanged** |
| **Conclusion** | **Zero behavioural impact** |

---

# 4. Promotion impact

## 4.1 Architecture alignment

- **Promotion Engine V2** resolves all Warmpawz Pay discounts (Quote API → engine → discount).  
- **No new discount tables** in Phase 1.  
- Usage commit reuses **`promotion_usages`** and **`coupon_usages`** with new nullable **`payment_id`**.

## 4.2 `promotion_usages` writers

| File | Function | Links via | `payment_id` today |
|------|----------|-----------|-------------------|
| `utils/vendor-promotion-usage.ts` | `recordServicePromotionUsage`, `recordPlatformPromotionUsage`, `recordVendorPromotionUsage` | `booking_id` / `order_id` | NULL |
| `utils/resolve-commercial-campaign.ts` | Campaign usage | `order_id` | NULL |
| `endpoints/vendor/endpoints/vendor-promotions.ts` | Vendor promo apply | booking/order | NULL |

**Readers:** `discount-engine/adapters/legacy-usage-tracker.ts`, `discount-engine/analytics/repositories/usage-read-repository.ts`, `endpoints/promotions.ts` (stats), `endpoints/discount-analytics.endpoints.ts`.

## 4.3 `coupon_usages` writers

| File | Function | Links via |
|------|----------|-----------|
| `utils/vendor-promotion-usage.ts` | `insertCouponUsageRow` (schema-adaptive) | `booking_id` / `order_id` |
| `endpoints/promotions.ts` | `POST /coupons/apply` | `booking_id` |

**Readers:** `lib/services/platform-coupon-service.ts`, `discount-engine/adapters/coupon-usage-counts.ts`, analytics repos.

## 4.4 Nullable `payment_id` impact

| Concern | Analysis |
|---------|----------|
| Existing INSERT omit `payment_id` | Column NULL — **valid** |
| Idempotency on `(coupon_id, booking_id)` | **Unchanged** — still works |
| Unique partial index on `payment_id` | Only applies when `payment_id IS NOT NULL` — legacy rows unaffected |
| `insertCouponUsageRow` schema probe | Dynamically checks columns — will include `payment_id` only when callers pass it (Warmpawz Pay future) |
| Analytics queries | JOIN on booking/order — NULL `payment_id` rows behave as today |
| **Conclusion** | **Cannot break** existing promotion flows |

## 4.5 Post-M1 code (Warmpawz Pay — not Phase 1 migration)

| Component | Change needed |
|-----------|---------------|
| `DiscountDomain` enum | Add `WARMPAWZ_PAY` (TypeScript — not M1 SQL) |
| Quote API | Call Promotion Engine V2 |
| `PromotionUsageRepository` / usage tracker | Pass `payment_id` on commit |
| `legacy-usage-tracker.ts` | New domain adapter path |

---

# 5. Vendor impact

## 5.1 New columns

| Column | Default | Impact on existing rows |
|--------|---------|-------------------------|
| `pay_bill_enabled` | `false` | All existing vendors not in Warmpawz Pay catalogue |
| `bank_verified` | `false` (IF NOT EXISTS) | If column already exists on prod — migration no-op |

## 5.2 `bank_verified` writers (existing)

| File | Action |
|------|--------|
| `endpoints/vendor-bank-accounts.ts` | `UPDATE vendors SET bank_verified = true` |
| `endpoints/vendor/endpoints/vendor-bank-accounts.ts` | Same |
| `endpoints/razorpay-settlements.ts` | Penny-test verification update |
| `jobs/settlement-processor.ts` | Reads `bank_verified` before payout |

**No conflict** with `pay_bill_enabled` — independent column.

## 5.3 Status updates (representative)

Widespread `update('vendors', …)` across onboarding, admin, dashboard, governance (~40+ files). All update explicit fields — **adding columns with defaults does not break UPDATE statements**.

## 5.4 Eligibility reads

| Location | Reads |
|----------|-------|
| `razorpay.razorpay.ts` | `bank_verified` for Route transfer |
| `settlement-processor.ts` | `bank_verified` |
| `razorpay-settlements.ts` | `bank_verified` filter |
| `vendor-dashboard-enhanced.ts` | `bankVerified` in API response |

**`pay_bill_enabled` is not read anywhere today** — new column invisible to legacy code until Warmpawz Pay ships.

## 5.5 `warmpawz_pay_vendor_catalog` (new table)

**No existing code references this table** — zero migration risk to legacy paths.

---

# 6. Hidden dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Dynamic column filtering on `payments` insert | Legacy never sets `payment_source` | Intended — Warmpawz Pay repo owns explicit value |
| `payment-reconciliation.ts` booking-scoped | Warmpawz pending payments not auto-healed | Future Warmpawz reconcile job (architecture §10) |
| `ecommerce_order_settlements` parallel ledger | Team must not confuse with `settlements` | Documented in architecture; code already split |
| `settlement-processor.ts` uses mixed column names (`status` vs `settlement_status`, `vendor_amount` vs `net_amount`) | Pre-existing schema drift | Out of Phase 1 scope; wpay repo should use canonical columns |
| `bank_verified` on prod without migration | `ADD IF NOT EXISTS` safe | Pre-flight `\d vendors` on dev |
| Seed / test scripts (`scripts/seed-comprehensive-test-data.js`, `scripts/validation/phase1-schema-validation.ts`) | May need awareness of new columns | **Non-blocking** for prod migration |
| Playwright `schema-validation.spec.ts` | May list fixed payment columns | **Low risk** — CI may need update later, not before migration |
| Discount Engine `DiscountDomain` enum | No `WARMPAWZ_PAY` yet | Application sprint — not M1 blocker |
| Customer `customer_payment_methods` vs `payments` | Different table — name collision in convenience routes | **No confusion** — convenience `/customer/payments` is saved cards, not `payments` hub |
| Global `idx_payment_idempotency` on `idempotency_key` | Stricter than wpay per-customer index | **Compatible** — no change needed |

---

# 7. Breaking change analysis

| Change | Breaks existing code? | Evidence |
|--------|----------------------|----------|
| `payments.payment_source` nullable | **No** | All inserts omit unknown columns |
| `payments.original_amount` nullable | **No** | Same |
| `payments.metadata` NOT NULL DEFAULT | **No** | PG applies default when omitted |
| `vendors.pay_bill_enabled` DEFAULT false | **No** | Additive |
| `vendors.bank_verified` IF NOT EXISTS | **No** | Additive or no-op |
| `warmpawz_pay_vendor_catalog` CREATE | **No** | New table |
| `promotion_usages.payment_id` nullable FK | **No** | Additive |
| `coupon_usages.payment_id` nullable FK | **No** | Additive |
| `transactions` CHECK + `'warmpawz_pay'` | **No** | No writers |
| Partial indexes (all tables) | **No** | Additive; no query plan breakage |
| settlements wpay unique partial index | **No** | Scoped to `order_type = 'warmpawz_pay'` |

**Breaking change count: 0** at migration apply time.

---

# 8. Migration safety analysis

| Criterion | Assessment |
|-----------|------------|
| Idempotent migration pattern | Required per team convention — plan specifies `IF NOT EXISTS` |
| Legacy INSERT compatibility | **Pass** — nullable + defaults |
| FK add order | `payments` before usage FKs — per implementation plan §5 |
| Lock / downtime | ADD nullable columns + CREATE INDEX — low risk on dev; prod window for index build |
| Rollback | Forward-only if Warmpawz Pay rows exist; pre-live rollback = drop index/columns/table |
| Data backfill required | **None** for Phase 1 |
| NOT NULL on `payment_source` | **Deferred** — would break legacy inserts if applied now |

---

# 9. Existing insert paths (summary matrix)

| Table | Insert locations (count) | Domains |
|-------|--------------------------|---------|
| `payments` | 10 files | booking, ecommerce, pharmacy, meal, package, subscription, teleconsult |
| `settlements` | 3 files | booking batch, booking route, vendor batch |
| `transactions` | **0** | — |
| `promotion_usages` | 4 files | booking, ecommerce, campaign, vendor promo |
| `coupon_usages` | 2 files | booking, ecommerce coupon apply |
| `vendors` | ~15 insert paths | onboarding, admin, bank setup |
| `warmpawz_pay_vendor_catalog` | **0** (new) | — |

---

# 10. Existing update paths (summary)

| Table | Primary updaters | Notes |
|-------|------------------|-------|
| `payments` | razorpay monolith, payments-enhanced, package-booking, reconciliation | Status / Razorpay IDs |
| `settlements` | settlement-processor, settlements.ts, razorpay-settlements | Status / payout |
| `transactions` | **None** | — |
| `promotion_usages` | **None** (insert-only) | — |
| `coupon_usages` | **None** (insert-only) | — |
| `vendors` | 40+ files | status, metadata, bank, tier, profile |

---

# 11. Existing scheduled jobs

| Job file | Tables touched | Warmpawz Pay conflict |
|----------|----------------|----------------------|
| `jobs/settlement-processor.ts` | `settlements`, `vendors`, `payments` (read) | **None** |
| `jobs/ecommerce-settlement-processor.ts` | `ecommerce_order_settlements` only | **None** |
| `jobs/notification-processor.ts` | notifications | **None** |
| `jobs/scheduled-notification-processor.ts` | notifications | **None** |
| Other jobs (email, sms, support, analytics) | unrelated | **None** |

**No existing job** writes Warmpawz Pay settlements or reads `payment_source`.

---

# 12. Existing reconciliation jobs

| Mechanism | Scope | Touches wpay? |
|-----------|-------|---------------|
| `utils/payments/payment-reconciliation.ts` | Bookings via `booking_id` | **No** |
| `utils/meal-refund-case-execution.ts` | Meal refund cases | **No** |
| Ecommerce settlement batch | `ecommerce_order_settlements` | **No** |
| Admin auto-reconcile config | `admin-advanced.ts` (settings UI) | **No** |

Architecture-defined Warmpawz jobs (`reconcile-pending-payments`, `reconcile-missing-settlements`, `reconcile-missing-promo-usage`) **do not exist yet** — no conflict.

---

# 13. Existing payment lifecycle (cross-domain)

```text
                    ┌─────────────────────────────────────┐
                    │           payments (hub)             │
                    │  (no payment_source today)           │
                    └──────────────┬──────────────────────┘
           booking_id │ order_id │ pharmacy_order_id │ subscription_id
                     ▼          ▼                   ▼
              bookings      orders            pharmacy_orders
                     │
                     ▼
         vendor_earnings (booking)     settlements (booking batch)
                                              │
         ecommerce ──► ecommerce_order_settlements (NOT settlements hub rows)

Phase 1 adds:
  payment_source | original_amount | metadata  (nullable/default)
  warmpawz_pay rows: all domain FKs NULL, payment_source = 'warmpawz_pay'
  settlements row: order_type = 'warmpawz_pay', payment_id set (async, future)
```

Legacy lifecycles **unchanged** at migration time.

---

# 14. Required code changes BEFORE migration

| Required? | Item |
|-----------|------|
| **None** | No legacy file must change before M1 apply |

**Recommended pre-flight (non-blocking):**

- Run `\d payments`, `\d vendors`, `\d settlements` on dev RDS  
- Confirm `1080` migration number free  
- Confirm no open PR also adding `1080_*`

---

# 15. Required code changes AFTER migration

These are **new work** on Warmpawz Pay branches — **not** modifications to legacy monolith paths for migration safety:

| Priority | Component | Branch (per sprint plan) |
|----------|-----------|------------------------|
| P0 | `1080` migration apply on dev RDS | `feature/wpay-schema` |
| P0 | `PaymentIntentRepository` — always `payment_source = 'warmpawz_pay'` | `feature/wpay-schema` |
| P0 | `VendorCatalogRepository` — catalogue CRUD / published list | `feature/wpay-schema` / `feature/wpay-admin` |
| P1 | `SettlementAccrualRepository`, `PromotionUsageRepository`, `TransactionLedgerRepository` | `feature/wpay-post-payment` |
| P1 | Quote API → Promotion Engine V2 (`WARMPAWZ_PAY` domain) | `feature/wpay-payment-flow` |
| P1 | PostPaymentProcessor async writes | `feature/wpay-post-payment` |
| P2 | Customer vendor list JOIN catalogue + eligibility | `feature/abhi-wpay-customer` |
| P2 | Admin catalogue UI/API | `feature/wpay-admin` |
| P3 | Warmpawz reconciliation jobs | `feature/wpay-post-payment` |
| P3 | Platform `payment_source` backfill + NOT NULL | Future platform migration |

**Legacy paths that should NOT be modified for Warmpawz Pay:**

- `razorpay.razorpay.ts` payment create  
- `payments-enhanced.ts`  
- `vendor-promotion-usage.ts` (extend via new adapter, not rewrite)  
- `settlement-processor.ts` booking logic  

---

# 16. Final Go / No-Go recommendation

## GO — proceed to author `1080_warmpawz_pay_phase1_schema.sql`

**Conditions:**

1. Migration follows implementation plan §5 statement order.  
2. `payment_source` remains **nullable** in M1 (not NOT NULL).  
3. Catalogue table contains **only** visibility columns (no discount/pricing).  
4. Partial unique index on settlements uses `WHERE order_type = 'warmpawz_pay' AND payment_id IS NOT NULL`.  
5. Apply on **dev RDS first**; smoke-test one legacy booking payment + one ecommerce order after apply.  
6. Do **not** require legacy insert paths to set `payment_source` in the same PR as M1.

**No-Go triggers (none observed):**

- Would apply if M1 made `payment_source NOT NULL` without backfill  
- Would apply if catalogue included pricing columns tied to quote logic  
- Would apply if migration dropped/recreate `payments` or removed columns  

**Post-migration monitoring (dev):**

- Legacy booking payment create + verify still succeeds  
- Ecommerce checkout payment still succeeds  
- Admin settlements list loads  
- Promotion stats endpoints return same shape  
- `\d warmpawz_pay_vendor_catalog` shows 7 columns only  

---

## Appendix A — Repository / layer map (no dedicated repos today)

Warmpawz Pay Phase 1 introduces the **first** dedicated repositories. Today all access is:

| Table | Access pattern |
|-------|----------------|
| `payments` | Direct SQL + `insert()` / `query()` in monolith endpoints |
| `settlements` | `insert()` in jobs + settlements endpoint |
| `transactions` | `select()` / raw SQL in admin only |
| `promotion_usages` | `insert()` in utils + vendor endpoints |
| `coupon_usages` | `insert()` in utils + promotions endpoint |
| `vendors` | Widespread `update()` / `insert()` / raw SQL |

Customer 4-layer repos **do not** write to `payments` hub (except read in `module-helpers.repo.ts` for booking enrichment).

---

## Appendix B — Scripts / tooling touchpoints (non-production)

| Script | Relevance |
|--------|-----------|
| `scripts/seed-comprehensive-test-data.js` | Dynamic payments insert — will omit new cols |
| `scripts/seed-finance-settlements-demo.js` | Settlements seed |
| `scripts/validation/phase1-schema-validation.ts` | FK validation — may need update later |
| `scripts/run-migration-rds-node.js` | Migration apply path |

None block M1.

---

**Document end.**
