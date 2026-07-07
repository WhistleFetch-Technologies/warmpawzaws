# Finance Settlement Integration — Implementation (Phase S2)

**Status:** Deployed to DEV (2026-07-07) — `FINANCE_FUNDING_AWARE_SETTLEMENT=SHADOW`  
**Feature flag:** `FINANCE_FUNDING_AWARE_SETTLEMENT` = `LEGACY` | `SHADOW` | `AUTHORITATIVE` (default: `LEGACY`)

---

## Architecture

```
Finance (Tier / Subscription)
  → resolveVendorCommissionPolicy(vendorId)
  → commissionRate ONLY from Finance

Discount Engine (Promotions / Coupons / Funding)
  → discount amounts + funding types in wp_financial_meta
  → winning offer (max savings — Policy Center default)

Finance Settlement Integration Layer (backend/lambda/src/finance/settlement/)
  → deriveWinningOfferFromFinancialMeta()
  → computeFundingAwareSettlement()
  → SettlementSnapshot

Checkout
  → enrichFinancialMetaWithSettlement() → wp_financial_meta.settlementSnapshot

Booking Complete
  → createFundingAwareVendorEarnings() → vendor_earnings (+ metadata JSONB)

Daily Batch (AUTHORITATIVE)
  → fetchEligibleVendorEarningsForBatch() → aggregate only

Payout / Reports
  → read vendor_earnings (never recalculate commission)
```

Discount Engine **never** calculates commission %. Finance **never** resolves promotions.

---

## Confirmed Business Rules (Implemented)

| Rule | Implementation |
|------|----------------|
| Platform promotion → platform bears | `commissionBase = vendorBasePrice` |
| Platform coupon → platform bears | Same |
| Vendor promotion → vendor bears | `commissionBase = vendorBasePrice - discount` |
| Vendor coupon → vendor bears | Same |
| One winning offer only | `deriveWinningOfferByMaxSavings()` |
| Commission from Finance tier/subscription | `resolveVendorCommissionPolicy()` |
| Shared funding (future) | Vendor share reduces base; platform share does not |

---

## Commission Base Formula

```
commissionAmount = commissionBase × commissionRate / 100
vendorSettlement = commissionBase - commissionAmount
```

| Funding | commissionBase | platformCost | vendorCost |
|---------|----------------|--------------|------------|
| PLATFORM | vendorBasePrice | discountAmount | 0 |
| VENDOR | vendorBasePrice − discount | 0 | discountAmount |
| SHARED | vendorBasePrice − vendorShare | platformShare | vendorShare |

---

## Feature Flag Rollout

| Mode | Checkout snapshot | vendor_earnings | Daily batch |
|------|-------------------|-----------------|-------------|
| **LEGACY** (default) | Optional in SHADOW only | Legacy path | Legacy booking recalc |
| **SHADOW** | Persist + log compare | Legacy writes | Legacy |
| **AUTHORITATIVE** | Persist | Funding-aware INSERT | Ledger aggregation |

Rollback: set `FINANCE_FUNDING_AWARE_SETTLEMENT=LEGACY`.

### DEV rollout (2026-07-07)

- Terraform: `infra/envs/dev/main.tf` sets `FINANCE_FUNDING_AWARE_SETTLEMENT = "SHADOW"`.
- Lambda env updated via deploy + AWS CLI merge.
- **Not** set to AUTHORITATIVE until shadow logs validated on fresh bookings.
- See `docs/P0_P1_STABILIZATION_IMPLEMENTATION.md` for validation checklist.

---

## Metadata Structure

### wp_financial_meta (booking notes)

```json
{
  "servicePrice": 1500,
  "vendorDiscount": 375,
  "settlementSnapshot": {
    "version": "2.0.0",
    "vendorBasePrice": 1500,
    "winningOffer": { "offerType": "VENDOR_PROMOTION", "fundingType": "VENDOR", "discountAmount": 375 },
    "commissionBase": 1125,
    "commissionRate": 20,
    "commissionAmount": 225,
    "vendorSettlement": 900,
    "platformCost": 0,
    "vendorCost": 375,
    "fundingSummary": { "vendorPaid": 375, "platformPaid": 0, "sharedVendorPaid": 0, "sharedPlatformPaid": 0, "campaignPaid": 0 }
  },
  "commissionBase": 1125,
  "commissionRate": 20,
  "vendorSettlement": 900
}
```

### vendor_earnings.metadata (migration 1058)

```json
{
  "settlementSnapshot": { "...": "full snapshot" },
  "commissionBase": 1125,
  "vendorSettlement": 900,
  "fundingSummary": { "vendorPaid": 375, "platformPaid": 0 },
  "winningOffer": { "offerType": "VENDOR_PROMOTION" },
  "integrationVersion": "2.0.0"
}
```

---

## Database Changes

| Migration | Change |
|-----------|--------|
| `1058_vendor_earnings_settlement_metadata.sql` | `vendor_earnings.metadata JSONB DEFAULT '{}'` |

Apply on dev before AUTHORITATIVE testing:

```bash
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1058_vendor_earnings_settlement_metadata.sql
```

---

## Files Changed

### New — Finance module

| File | Purpose |
|------|---------|
| `finance/commission/resolve-vendor-commission-policy.ts` | Authoritative commission resolver |
| `finance/settlement/finance-settlement-mode.ts` | Feature flag |
| `finance/settlement/types.ts` | Snapshot types |
| `finance/settlement/compute-funding-aware-settlement.ts` | Commission base math |
| `finance/settlement/derive-winning-offer.ts` | Winning offer selection |
| `finance/settlement/persist-settlement-snapshot.ts` | Meta parse/attach |
| `finance/settlement/build-settlement-snapshot.ts` | Checkout snapshot builder |
| `finance/settlement/create-vendor-earnings-from-snapshot.ts` | Earnings INSERT |
| `finance/settlement/aggregate-vendor-earnings-batch.ts` | Batch aggregation |
| `finance/settlement/__tests__/funding-aware-settlement.test.ts` | Scenarios A–F |
| `finance/index.ts` | Public exports |

### Modified

| File | Change |
|------|--------|
| `utils/vendor-commission-rate.ts` | Delegates to resolver |
| `utils/vendor-tier-commission.ts` | Delegates to resolver |
| `utils/vendor-earnings-on-completion.ts` | Funding-aware path when flag on |
| `endpoints/settlement&payouts/.../settlements.ts` | Ledger aggregation path |
| `endpoints/booking/.../bookings-enhanced.booking.ts` | Persist snapshot at create |
| `lib/services/booking-promotion-service.ts` | Extended financial meta types |

### Documentation

| File | Purpose |
|------|---------|
| `docs/FINANCE_SETTLEMENT_CONFLICT_REPORT.md` | Pre-implementation conflicts |
| `docs/FINANCE_SETTLEMENT_INTEGRATION_IMPLEMENTATION.md` | This document |

---

## Validation Scenarios (Unit Tests)

| Scenario | Input | Expected |
|----------|-------|----------|
| A | ₹1500, platform promo 20%, tier 20% | Base ₹1500, commission ₹300, settlement ₹1200 |
| B | ₹1500, vendor promo 25%, tier 20% | Base ₹1125, commission ₹225, settlement ₹900 |
| C | ₹1500, vendor coupon ₹100, tier 20% | Base ₹1400, commission ₹280, settlement ₹1120 |
| D | ₹1500, platform coupon ₹100, tier 20% | Base ₹1500, commission ₹300, settlement ₹1200 |
| E | Multiple offers | Vendor promo wins (max savings) |
| F | Shared 200 (80/120 split) | Base reduced by vendor share only |

Run:

```bash
cd backend/lambda && npm test -- finance/settlement/__tests__/funding-aware-settlement.test.ts
```

---

## Future Shared Funding / Campaigns

Offer types are configurable (`SettlementOfferType`). Campaign funding maps to `SHARED` / `CAMPAIGN` with `fundingSummary.campaignPaid`. No settlement redesign required — extend `WinningOfferSnapshot` and candidate list at checkout.

---

## Related Documents

- `docs/FINANCE_SETTLEMENT_CONFLICT_REPORT.md`
- `docs/SETTLEMENT_MIGRATION_PLAN.md`
- `docs/SETTLEMENT_ARCHITECTURE_ANALYSIS.md`
