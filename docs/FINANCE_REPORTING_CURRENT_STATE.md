# Finance Reporting — Current State

**Phase:** Settlement Breakdown Analysis (Analysis Only)  
**Date:** 2026-07-06  
**Status:** Read-only inventory — no code changes  
**Scope:** Admin Finance reporting UI, APIs, exports, data sources, and settlement metadata availability.

---

## Executive Summary

Warmpawz Finance reporting lives under **Finance & Logistics** at `/finance?tab=…`. Five screens matter for Accounts reconciliation:

| Report | Tab param | Primary data source | Granularity | Export |
|--------|-----------|---------------------|-------------|--------|
| Daily Accrual | `vendor-daily-accrual` | `vendor_daily_accrual` + fee enrichment | Vendor × IST day | Server CSV |
| Monthly Accrual | `vendor-monthly-accrual` | Sum of daily snapshots | Vendor × IST month | Server CSV |
| Booking Earnings | `vendor-booking-earnings` | `vendor_earnings` + checkout waterfall | Vendor → booking | Server CSV (2 modes) |
| Settlement Dashboard | `settlements` | `settlements` | Batch | Client CSV |
| Payout Management | `payouts` | `payouts` + pending `settlements` | Payout batch | Client CSV |

**Settlement Breakdown** (commission base, funding type, winning offer, vendor/platform discount split) is **computed and persisted** by Finance S2 (`SettlementSnapshot` in `wp_financial_meta` and `vendor_earnings.metadata`) but **not exposed in any report or export today**.

There is **no Excel (.xlsx) export** for Finance reports. All exports are CSV.

There is **no pagination** on accrual or booking earnings reports — full vendor/booking lists load in one request.

---

## Entry Point

**Page:** `apps/admin-web/app/finance/page.tsx`  
**Barrel:** `apps/admin-web/components/admin/finance/index.ts`  
**Permission:** `admin.settlements`

Legacy alternate routes exist (`/settlements`, `FinanceDashboard.tsx`, `SettlementsTab.tsx`) but the primary hub is `/finance`.

---

## Report Inventory

### 1. Daily Accrual

| Attribute | Detail |
|-----------|--------|
| **Component** | `apps/admin-web/components/admin/finance/VendorDailyAccrualReport.tsx` |
| **Purpose** | IST calendar-day vendor accrual for investor reporting and payout prep |
| **Primary user** | Finance / Accounts team |
| **Frequency** | Daily (typically yesterday); manual Load or Compute |
| **Workflow** | Pick date → Load (read snapshot) or Compute (materialize) → review totals → Export CSV → send to Accounts |
| **Export format** | Server CSV via authenticated fetch |
| **API (read)** | `GET /admin/finance/vendor-daily-accrual?reportDate=YYYY-MM-DD` |
| **API (compute)** | `POST /admin/finance/vendor-daily-accrual/compute` body `{ reportDate }` |
| **API (export)** | `GET /admin/finance/vendor-daily-accrual/export.csv?reportDate=…` |
| **Handler** | `backend/lambda/src/endpoints/admin/endpoints/admin-vendor-daily-accrual.ts` |
| **Utils** | `vendor-accrual-ist.ts`, `vendor-accrual-fee-breakdown.ts`, `delivery-settlement-finance.ts` |

**Tables used:**

- **Read:** `vendor_daily_accrual` JOIN `vendors`; bank from `vendor_bank_accounts` / `vendor_bank_details`
- **Compute:** aggregates `vendor_earnings` by `realized_at` (IST window); `delivery_settlements` by delivery time; gap counts from `bookings` / `meal_orders`
- **Fee enrichment:** `vendor_earnings` + `bookings` + `payments`; delivery lines from `delivery_settlements` + `meal_orders`

**UI columns:** Business, Owner, Gross, Commission, Net, Platform, Convenience, Delivery, GST, Lines, Delivery lines, Missing VE, Missing DS, Bank, IFSC, Verified

**Summary KPI cards:** Vendors in snapshot, Gross, Commission, Net to vendors, Platform fee, Convenience fee, Delivery fee, GST

**Calculations:**

- `gross_amount` = SUM(`vendor_earnings.total_amount`) + delivery gross for IST day
- `commission_amount` = SUM(`vendor_earnings.commission_amount`) + delivery commission
- `net_amount` = SUM(`vendor_earnings.amount`) + delivery net payout
- Fee columns enriched post-read from payment/checkout breakdown (not stored in snapshot table)

**Filters:** Report date (IST) only  
**Pagination:** None  
**Drill-down:** None

**Performance constraints:**

- Compute: one heavy upsert SQL per day
- Fee enrichment: potential N+1 when `resolveBookingCustomerPaidFeeBreakdown` runs per booking without payment columns
- All vendors returned in single response

---

### 2. Monthly Accrual

| Attribute | Detail |
|-----------|--------|
| **Component** | `apps/admin-web/components/admin/finance/VendorMonthlyAccrualReport.tsx` |
| **Purpose** | IST calendar-month aggregation for monthly reconciliation and vendor payout batches |
| **Primary user** | Finance / Accounts |
| **Frequency** | Monthly; Compute refreshes all daily snapshots in month |
| **Workflow** | Pick month → Load or Compute (up to 31 daily upserts) → Export CSV |
| **Export format** | Server CSV |
| **API (read)** | `GET /admin/finance/vendor-daily-accrual/monthly?year=&month=` |
| **API (compute)** | `POST /admin/finance/vendor-daily-accrual/monthly/compute` |
| **API (export)** | `GET /admin/finance/vendor-daily-accrual/monthly/export.csv?year=&month=` |

**Tables used:** Same as daily — reads `vendor_daily_accrual` aggregated with `SUM` / `GROUP BY vendor_id`; adds `snapshot_day_count`

**UI columns:** Same as daily + **Days** (count of daily snapshots in month)

**Summary KPI cards:** Same structure as daily

**Filters:** Month picker (`YYYY-MM`)  
**Pagination:** None  
**Drill-down:** None

**Performance constraints:**

- Monthly compute loops sequentially over each IST day (up to 31 compute calls)
- Same fee enrichment N+1 as daily

---

### 3. Booking Earnings

| Attribute | Detail |
|-----------|--------|
| **Component** | `apps/admin-web/components/admin/finance/VendorBookingEarningsReport.tsx` |
| **Purpose** | Per-booking customer-paid waterfall + vendor ledger for audit and dispute resolution |
| **Primary user** | Finance ops; occasionally vendor support escalations |
| **Frequency** | Ad hoc daily or monthly |
| **Workflow** | Pick day/month → Load vendor summaries → click vendor → review bookings → expand booking for fee detail → Export summary or booking CSV |
| **Export format** | Server CSV (vendor summary or booking-level when `vendorId` set) |
| **API** | `GET /admin/finance/vendor-booking-earnings?reportDate=` or `?year=&month=`; optional `&vendorId=` |
| **Export API** | `GET /admin/finance/vendor-booking-earnings/export.csv?…` |
| **Handler** | `backend/lambda/src/endpoints/admin/endpoints/admin-vendor-booking-earnings.ts` |
| **Engine** | `backend/lambda/src/utils/vendor-booking-earnings-report.ts` |

**Tables used:** `vendor_earnings` JOIN `bookings`, `vendors`, `customers`, `vendor_services`, `service_catalog`; LATERAL `payments`

**Ledger SoT:** `ve.total_amount` (vendor gross), `ve.commission_amount`, `ve.amount` (vendor net), `ve.commission_rate`, `ve.realized_at`

**Customer-paid side:** Recomputed from `bookings` + `payments` via `vendor-accrual-fee-breakdown.ts` (not from settlement snapshot)

**UI — vendor summary columns:** Business, Owner, Bookings, Customer paid, Service base, Discount, GST, Platform, Gross, Commission, Vendor net

**UI — booking columns:** Booking ID, Service, Customer, Customer paid, Base, Discount, Coupon, GST, Platform, Delivery, Gross, Commission, Net

**UI — expanded booking panel:** Customer paid, Service base, Discount, Coupon, GST, Platform/Convenience/Delivery fees, Vendor gross, Commission (+ rate %), Vendor net, Fee source, Realized at

**Summary KPI cards:** Vendors, Bookings, Customer paid, Vendor net; secondary row: Service base, Discount, GST, Platform fees, Commission

**Filters:** Period type (Daily / Monthly), date or month  
**Pagination:** None  
**Drill-down:** Two levels — vendor row → inline booking sub-table; booking row → inline accordion (expanded row)

**Performance constraints:**

- Single SQL for all earnings rows (good)
- N+1: `buildVendorBookingEarningsLine` per row when fee breakdown must be resolved async

**Missing financial information today:**

- No `commission_base` (distinct from vendor gross when platform-funded promo)
- No vendor vs platform discount split
- No winning offer / funding type
- No settlement batch / payout linkage
- No read of `vendor_earnings.metadata` or `wp_financial_meta.settlementSnapshot`

---

### 4. Settlement Dashboard

| Attribute | Detail |
|-----------|--------|
| **Component** | `apps/admin-web/components/admin/finance/settlements/SettlementDashboard.tsx` |
| **Purpose** | Monitor settlement batches, process/retry payouts |
| **Primary user** | Finance ops |
| **Frequency** | Daily monitoring; auto-refresh every 30s |
| **Workflow** | Review stats → filter by status/date → Process/Retry individual settlements → optional client CSV |
| **Export format** | Client-side CSV (browser-generated) |
| **API** | `GET /admin/finance/settlements` (LIMIT 100); `GET /admin/payments/analytics`; `GET /settlements/summary`; `POST /admin/payments/settlements/:id/process` |

**Tables used:** `settlements` JOIN `vendors`, `vendor_identity`, `roles`

**UI columns:** Vendor, Role/Business type, Amount, Commission, Status, Date, Actions

**Stats cards:** Total Revenue, Platform Commission, Vendor Payout, Pending Settlements (count)

**Widgets:** Status pie chart; Recent settlements (top 5)

**Filters:** Status (All, Due, Pending, Paid, Failed); Date range (7/30/90 days) — client-side only

**Pagination:** None (hard LIMIT 100 from API)  
**Drill-down:** None — row actions only

**Closest breakdown API:** `GET /settlements/:id` returns settlement + related `bookings[]` (amounts only, no funding breakdown)

---

### 5. Payout Management

| Attribute | Detail |
|-----------|--------|
| **Component** | `apps/admin-web/components/admin/finance/payoutManagement/PayoutManagement.tsx` |
| **Purpose** | Review and process vendor bank payouts |
| **Primary user** | Finance / Accounts (payment execution) |
| **Frequency** | Per payout cycle + ad hoc retries |
| **Workflow** | Filter/search → View modal (bank + amount breakdown) → Process → Export filtered CSV |
| **Export format** | Client-side CSV |
| **API** | `GET /admin/payouts` (LIMIT 50); `GET /admin/payouts/stats`; `POST /admin/payouts/:id/process`; `PUT /admin/payouts/:id`; `DELETE /admin/payouts/:id` |

**Tables used:** `payouts`; correlated subqueries on `settlements`; merges pending `settlements` as pseudo-rows

**UI columns:** Vendor (+ phone), Role, Period, Gross, Commission, Net, Status, Actions

**Detail modal:** Gross, Commission, TDS, Net; bank account fields; Process button

**Stats cards:** Pending / Processing / Completed (₹ + count)

**Filters:** Search (name/phone); status dropdown — client-side  
**Pagination:** API LIMIT 50, no offset in admin UI  
**Drill-down:** Modal (not expandable rows)

---

## Settlement Metadata — What Exists Today

### `wp_financial_meta` (booking notes / `financial_meta` JSON)

**Parser:** `discount-engine/settlement/settlement-hook-bridge.ts` → `parseBookingFinancialMeta()`

**Checkout fields:** `servicePrice`, `vendorDiscount`, `platformDiscount`, `couponDiscount`, `subtotalAfterDiscounts`, tax/fees, `finalPaid`, promotion IDs, `policyFingerprint`

**Finance S2 fields** (when `FINANCE_FUNDING_AWARE_SETTLEMENT` active at completion):

| Field | Description |
|-------|-------------|
| `settlementSnapshot` | Full `SettlementSnapshot` object |
| `vendorBasePrice` | Pre-discount vendor list price |
| `winningOffer` | Offer type, funding type, discount amount, shares |
| `commissionBase` | Base used for commission % |
| `commissionRate` | Tier/subscription rate |
| `commissionAmount` | Platform commission |
| `vendorSettlement` | Net vendor receivable |
| `platformCost` / `vendorCost` | Funding split |
| `fundingSummary` | vendorPaid, platformPaid, shared splits, campaignPaid |

**Type definition:** `backend/lambda/src/finance/settlement/types.ts` → `SettlementSnapshot`

### `vendor_earnings.metadata` (JSONB, migration 1058)

**Written by:** `settlementSnapshotToVendorEarningsMetadata()` when Finance S2 authoritative path creates ledger row

**Stored keys:** `settlementSnapshot`, `commissionBase`, `vendorSettlement`, `fundingSummary`, `winningOffer`, `tierSource`, `subscriptionActive`, `policyFingerprint`, `integrationVersion`

**Not read by any report API today.**

### Legacy parallel path

Discount-engine authoritative mode may store `settlement_preview`, `funding_breakdown` in metadata via `settlement-hook-bridge.ts` — separate from Finance S2 snapshot.

---

## Export Implementation Summary

| Report | Mechanism | Filename pattern |
|--------|-----------|------------------|
| Daily Accrual | Server inline CSV string | `vendor-daily-accrual-{date}.csv` |
| Monthly Accrual | Server inline CSV | `vendor-monthly-accrual-{YYYY-MM}.csv` |
| Booking Earnings (summary) | Server inline CSV | `vendor-booking-earnings-{period}.csv` |
| Booking Earnings (bookings) | Server inline CSV | `vendor-booking-earnings-{period}-{vendorId}.csv` |
| Settlement Dashboard | Client `Blob` + download | `settlements-{today}.csv` |
| Payout Management | Client CSV | `payouts-{today}.csv` |

**Excel:** Not implemented. ExcelJS exists only for product bulk upload (`bulk-product-xlsx.ts`).

**Generic reports:** `POST /admin/reports/generate` returns JSON only; legacy `vendor_settlements` table — **not** the live Finance UI data source.

---

## Data Flow (Current)

```
Booking completion
  → vendor_earnings row (total_amount, commission_amount, amount, commission_rate)
  → [S2] vendor_earnings.metadata + wp_financial_meta.settlementSnapshot

Daily batch (POST /settlements/calculate-daily)
  → settlements batch rows
  → vendor_earnings.settlement_id updated

Payout (POST /admin/payouts/:id/process)
  → payouts row
  → vendor_earnings.payout_id updated

Daily Accrual compute
  → vendor_daily_accrual snapshot (aggregates vendor_earnings; no metadata)

Booking Earnings report
  → reads vendor_earnings + bookings + payments (ignores metadata)

Settlement Dashboard / Payouts
  → reads settlements / payouts (batch level only)
```

---

## Performance Profile (Cross-Report)

| Risk | Where | Severity |
|------|-------|----------|
| Fee breakdown N+1 | Accrual enrichment, Booking Earnings line build | Medium–High at scale |
| No pagination | Accrual, Booking Earnings | High for large vendor counts |
| Monthly compute loop | Up to 31 sequential daily upserts | Medium |
| Payout correlated subqueries | `GET /admin/payouts` | Medium |
| Settlement list cap | LIMIT 100 | Low (hidden truncation) |
| Metadata JSON parse | Not used in reports yet | Future risk if per-row parse without batching |

---

## Related Documentation

- `docs/FINANCE_CURRENT_STATE.md` — broader Finance module inventory (S1)
- `docs/FINANCE_SETTLEMENT_INTEGRATION_IMPLEMENTATION.md` — Finance S2 settlement snapshot design
- `docs/FINANCE_GAP_ANALYSIS.md` — pre-S2 gaps (partially addressed)
