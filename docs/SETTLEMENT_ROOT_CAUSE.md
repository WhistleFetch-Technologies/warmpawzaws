# Settlement Root Cause — Booking e8584dfb

---

## Problem

No settlement artifact exists for a completed paid booking with a ₹100 platform-funded discount:

- `settlements` table: 0 rows for this `booking_id`
- `wp_financial_meta`: no `settlementSnapshot`, `commissionBase`, `winningOffer`, or `fundingSummary`
- `vendor_earnings.metadata`: `{}`

---

## Expected

With funding-aware finance enabled:

1. At booking create, `enrichFinancialMetaWithSettlement` attaches a `settlementSnapshot` to `wp_financial_meta`.
2. At completion, `createFundingAwareVendorEarnings` reads snapshot (or recomputes from financial meta) and inserts `vendor_earnings` with rich `metadata`.
3. Batch settlement (`calculate-daily`) can aggregate from `vendor_earnings` with funding breakdown.

For a **platform-funded** ₹100 discount on ₹200 list price with Basic 20% tier:

| Field | Expected |
|-------|----------|
| `vendorBasePrice` | 200 |
| `commissionBase` | 200 (platform absorbs discount) |
| `commissionRate` | 20% |
| `commissionAmount` | 40 |
| `vendorSettlement` | 160 |
| `platformCost` | 100 |

---

## Actual

| Field | Actual |
|-------|--------|
| `vendor_earnings.total_amount` | 110 (customer checkout total) |
| `commission_rate` | 10% |
| `commission_amount` | 11 |
| `vendor_earnings.amount` (vendor net) | 99 |
| `metadata` | `{}` |
| `settlements` | none |

`wp_financial_meta` (persisted):

```json
{
  "servicePrice": 200,
  "platformDiscount": 100,
  "finalPaid": 110,
  "totalTax": 10
}
```

No settlement fields.

---

## Root Cause

### 1. `FINANCE_FUNDING_AWARE_SETTLEMENT` not enabled

`getFinanceFundingAwareSettlementMode()` defaults to **`LEGACY`** when env var is unset.

Dev Lambda has all `DISCOUNT_ENGINE_V2_*` = AUTHORITATIVE but **no** `FINANCE_FUNDING_AWARE_SETTLEMENT`.

Effect:

- `shouldPersistFundingAwareSnapshot()` → **false** → `enrichFinancialMetaWithSettlement` returns flat params without snapshot.
- `isFinanceFundingAwareSettlementEnabled()` → **false** → `ensureVendorEarningsForCompletedBooking` uses **legacy** INSERT (no metadata).
- `useFundingAwareVendorEarnings()` → **false**.

Discount-engine settlement (`DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=AUTHORITATIVE`) affects resolver preview in discount pipeline but **does not** replace Finance S2 accrual without `FINANCE_FUNDING_AWARE_SETTLEMENT`.

### 2. Legacy commission base = checkout total, not list price

`resolveLedgerGrossForVendorCommission`:

- `checkoutGross` = `total_amount` = **110**
- `visible` (vendor service list price) = **200**
- Condition `visible <= checkoutGross + 0.01` is **false** (200 > 110.01)
- Returns **checkoutGross 110** as commission base

Platform discount reduced customer pay but legacy path still commissions on post-discount checkout amount.

### 3. No settlement row at booking/payment time

`settlements` rows are created by batch/cron payout flows, not per-booking at create. With incorrect `vendor_earnings` and no snapshot, downstream batch has no funding-aware inputs.

### 4. Empty metadata on legacy INSERT

Legacy path in `vendor-earnings-on-completion.ts`:

```sql
INSERT INTO vendor_earnings (..., commission_rate, status, realized_at)
-- no metadata column
```

Funding-aware path would populate `metadata` via `settlementSnapshotToVendorEarningsMetadata`.

---

## Evidence

| Query | Result |
|-------|--------|
| `SELECT * FROM settlements WHERE booking_id = 'e8584dfb...'` | [] |
| `vendor_earnings.metadata` | `{}` |
| Lambda env | `FINANCE_FUNDING_AWARE_SETTLEMENT` absent |
| Booking notes | `wp_financial_meta` without `settlementSnapshot` |
| Terraform dev | Sets `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` only |

---

## Files

- `backend/lambda/src/finance/settlement/finance-settlement-mode.ts`
- `backend/lambda/src/finance/settlement/build-settlement-snapshot.ts` — `shouldPersistFundingAwareSnapshot`, `enrichFinancialMetaWithSettlement`
- `backend/lambda/src/finance/settlement/persist-settlement-snapshot.ts`
- `backend/lambda/src/finance/settlement/create-vendor-earnings-from-snapshot.ts`
- `backend/lambda/src/utils/vendor-earnings-on-completion.ts` — `resolveLedgerGrossForVendorCommission`, `ensureVendorEarningsForCompletedBooking`
- `backend/lambda/src/finance/settlement/compute-funding-aware-settlement.ts`

---

## Environment

- DEV Lambda: discount settlement AUTHORITATIVE, finance funding-aware **LEGACY (default)**
- `infra/envs/dev/main.tf`: no `FINANCE_FUNDING_AWARE_SETTLEMENT` entry

---

## Recommended Fix

1. Add `FINANCE_FUNDING_AWARE_SETTLEMENT=SHADOW` to dev Lambda + Terraform; validate CloudWatch compare logs; promote to AUTHORITATIVE.
2. Fix commission policy SQL (`expires_at` → `end_date`) so snapshot uses 20% not 10%.
3. For platform-funded discounts, ensure `resolveLedgerGrossForVendorCommission` prefers list price when `platformDiscount > 0` (or always use funding-aware snapshot).
4. Run `realignPendingVendorEarningsForBooking('e8584dfb-...')` after fixes.
5. Document two-flag requirement: `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` + `FINANCE_FUNDING_AWARE_SETTLEMENT`.

---

## Priority

**P1** — Incorrect vendor settlement amount and no audit trail.

---

## Risk

Vendor paid ₹99 vs ₹160 expected; platform cannot reconcile promotion subsidy; payout batch may use wrong commission base across all discounted bookings.
