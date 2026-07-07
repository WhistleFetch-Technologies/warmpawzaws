# Commission Policy Investigation — Booking e8584dfb

---

## Problem

Vendor **Vet Center Bindu TEST** is on tier **Basic** (`vendors.tier = "Basic"`, `vendor_tiers.commission_rate = 20%`), but `vendor_earnings` for this booking used **10%** commission.

---

## Expected

`resolveVendorCommissionPolicy(vendorId)` priority chain:

1. Active `vendor_tier_subscriptions` (none for this vendor) → skip  
2. **Vendor assigned tier** — join `vendors.tier` → `vendor_tiers.tier_name` → **20%**  
3. Default tier (also Basic 20% on DEV)  
4. Fallback `DEFAULT_COMMISSION_RATE` (10%) only if all lookups fail  

Expected earnings (platform-funded discount, funding-aware):

- Commission base: **₹200** (list price)  
- Rate: **20%**  
- Commission: **₹40**  
- Vendor net: **₹160**  

Even on legacy checkout-base semantics (₹110): 20% → commission ₹22, vendor ₹88 — still not 10%/₹11.

---

## Actual

```
vendor_earnings:
  total_amount (commission base) = 110.00
  commission_rate               = 10.00
  commission_amount             = 11.00
  amount (vendor net)           = 99.00
  metadata                      = {}
```

RDS tier match query (DEV):

```
vendor.tier = "Basic"
vendor_tiers.tier_name = "Basic", commission_rate = 20.00
vendor_tier_subscriptions: 0 rows
```

---

## Root Cause

### Primary: SQL schema mismatch in `resolveVendorCommissionPolicy`

Subscription lookup uses a non-existent column:

```sql
SELECT ... vts.expires_at
FROM vendor_tier_subscriptions vts
WHERE vts.vendor_id = $1
  AND vts.status = 'active'
  AND vts.expires_at > NOW()
```

DEV schema (`vendor_tier_subscriptions` columns): `start_date`, **`end_date`** — no `expires_at`.

PostgreSQL throws `column vts.expires_at does not exist`. The function wraps **all** logic in one `try/catch`:

```typescript
} catch (error) {
  console.error('[resolveVendorCommissionPolicy] error:', error);
  return empty; // commissionRate: DEFAULT_COMMISSION_RATE (10%)
}
```

The vendor-tier join (`vendors.tier` → `vendor_tiers`) **never runs** because the subscription query fails first — even when there are **zero** subscription rows.

### Secondary: Legacy commission base uses checkout total

`resolveLedgerGrossForVendorCommission` returned **₹110** (`total_amount`) instead of **₹200** list price because post-discount checkout (110) < visible service price (200). Commission calculated on discounted customer total.

### Tertiary: Finance S2 disabled

Without `FINANCE_FUNDING_AWARE_SETTLEMENT=AUTHORITATIVE`, `createFundingAwareVendorEarnings` is not used; legacy `getVendorCommissionRate` → broken policy resolver → 10% on ₹110.

---

## Evidence

| Check | Result |
|-------|--------|
| `TIER_MATCH` SQL | Basic → 20% |
| `vendor_tier_subscriptions` | [] |
| `DEFAULT_COMMISSION_RATE` constant | 10.0 (`lib/constants/commission.ts`) |
| `vendor_earnings.commission_rate` | 10.00 |
| Code: `resolve-vendor-commission-policy.ts` | uses `vts.expires_at` |
| RDS columns | `end_date` exists, `expires_at` does not |

---

## Files

- `backend/lambda/src/finance/commission/resolve-vendor-commission-policy.ts` — **bug location**
- `backend/lambda/src/utils/vendor-commission-rate.ts` — delegates to policy resolver
- `backend/lambda/src/lib/constants/commission.ts` — `DEFAULT_COMMISSION_RATE = 10`
- `backend/lambda/src/utils/vendor-earnings-on-completion.ts` — `resolveLedgerGrossForVendorCommission`, legacy earnings INSERT
- `db/migrations/*vendor_tier_subscriptions*` — schema uses `end_date`

---

## Environment

- DEV RDS schema confirmed via `information_schema.columns`
- No active tier subscription for vendor `109ac8bc-...`

---

## Recommended Fix

1. **Immediate code fix**: Replace `vts.expires_at` with `vts.end_date` (or `COALESCE(vts.end_date, 'infinity')`).
2. **Resilience**: Run subscription query in nested try/catch so failure does not skip vendor-tier fallback.
3. **Regression test**: Unit test `resolveVendorCommissionPolicy` with zero subscriptions + Basic tier vendor → 20%.
4. **Realign earnings**: `realignPendingVendorEarningsForBooking` for `e8584dfb-...` after deploy.
5. **Enable Finance S2** on dev for correct platform-funded commission base.

---

## Priority

**P0** — Affects **all** vendors on every booking while subscription query fails (not just this booking).

---

## Risk

Systematic under/over-charging of commission; tier upgrades/subscriptions meaningless for rate resolution; finance reports show 10% flat rate.
