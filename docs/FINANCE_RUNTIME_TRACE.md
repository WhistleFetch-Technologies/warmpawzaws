# Finance Runtime Trace — Booking e8584dfb

End-to-end trace of finance-related code paths for booking `e8584dfb-3fd0-4c9b-abe0-275cd89cecbb`.

---

## Problem

Trace why vendor received ₹99 net (10% on ₹110) instead of funding-aware settlement on ₹200 list price at 20% Basic tier.

---

## Expected

### At booking create (with Finance S2 enabled)

```
POST /bookings (create)
  → resolveBookingPromotions (V2 AUTHORITATIVE)
  → enrichFinancialMetaWithSettlement (if FINANCE_FUNDING_AWARE_SETTLEMENT ≠ LEGACY)
       → resolveVendorCommissionPolicy → 20% Basic
       → resolveWinningOfferFromFinancialMeta → PLATFORM_PROMOTION ₹100
       → computeFundingAwareSettlement
            commissionBase = 200, commissionRate = 20%, vendorSettlement = 160
  → serializeBookingFinancialMeta → wp_financial_meta with settlementSnapshot
```

### At booking complete

```
ensureVendorEarningsForCompletedBooking
  → isFinanceFundingAwareSettlementEnabled() === true
  → createFundingAwareVendorEarnings
       → resolveSettlementSnapshotForBooking (from notes or recompute)
       → insertVendorEarningsFromSettlementSnapshot (with metadata JSON)
```

---

## Actual trace (observed)

### T0 — Booking create `2026-07-07 13:11:12`

| Step | Function | Outcome |
|------|----------|---------|
| 1 | `resolveBookingPromotions` | No `wp_promo_meta` persisted → resolver null or zero savings |
| 2 | Client `financialMeta` | `platformDiscount:100`, `servicePrice:200`, `finalPaid:110` written |
| 3 | `enrichFinancialMetaWithSettlement` | `shouldPersistFundingAwareSnapshot()` → **false** (FINANCE flag LEGACY) → flat meta only |
| 4 | `bookingData.discount_amount` | 100 (from body or resolver) |
| 5 | `promotion_id` | NULL |

Persisted notes:

```
Pet: Scooby | wp_financial_meta:{...platformDiscount:100, finalPaid:110...}
```

### T1 — Payment `2026-07-07 13:11:38`

| Step | Function | Outcome |
|------|----------|---------|
| 1 | Razorpay webhook | `payment_status=completed`, amount ₹110 |
| 2 | `recordBookingPromotionUsageFromBooking` | Early exit — no `wp_promo_meta` / `promotion_id` |

### T2 — Booking complete `2026-07-07 13:12:50`

| Step | Function | Outcome |
|------|----------|---------|
| 1 | `ensureVendorEarningsForCompletedBooking` | Called on completion |
| 2 | `isFinanceFundingAwareSettlementEnabled()` | **false** → skip funding-aware branch |
| 3 | `resolveLedgerGrossForVendorCommission` | checkoutGross=110, visible=200 → returns **110** |
| 4 | `getVendorCommissionRate` → `resolveVendorCommissionPolicy` | SQL error on `expires_at` → catch → **10%** |
| 5 | Legacy INSERT `vendor_earnings` | base=110, rate=10%, commission=11, vendor=99, metadata={} |

---

## Root Cause

1. **Finance S2 flag off** — entire funding-aware branch skipped at create and complete.
2. **Commission policy SQL bug** — 10% fallback instead of 20% tier.
3. **Legacy gross resolver** — commissions on post-discount checkout (₹110) not list price (₹200).
4. **Missing promo linkage** — no winning offer / platform promotion ID in persisted meta.

---

## Evidence

### `resolveLedgerGrossForVendorCommission` logic

```typescript
// vendor-earnings-on-completion.ts
const checkoutGross = resolveBookingGrossForVendorEarnings(merged); // 110
const visible = resolveVendorVisibleBookingAmount(...);             // 200
if (visible > 0 && (checkoutGross <= 0 || visible <= checkoutGross + 0.01)) {
  return visible;
}
return checkoutGross; // → 110 for this booking
```

### `createFundingAwareVendorEarnings` gate

```typescript
// finance-settlement-mode.ts
export function useFundingAwareVendorEarnings(): boolean {
  return isFinanceFundingAwareSettlementAuthoritative(); // false when env unset
}
```

### `computeFundingAwareSettlement` (would apply if enabled)

Platform-funded offer (`fundingType: PLATFORM`):

- `commissionBase` = `vendorBasePrice` (200)
- `commissionAmount` = base × rate
- `vendorSettlement` = base − commission

---

## Files

| Phase | File | Key symbols |
|-------|------|-------------|
| Create meta | `bookings-enhanced.booking.ts` | `enrichFinancialMetaWithSettlement`, `serializeBookingFinancialMeta` |
| Settlement build | `build-settlement-snapshot.ts` | `shouldPersistFundingAwareSnapshot` |
| Commission policy | `resolve-vendor-commission-policy.ts` | `resolveVendorCommissionPolicy` |
| Winning offer | `derive-winning-offer.ts` | `resolveWinningOfferFromFinancialMeta` |
| Settlement math | `compute-funding-aware-settlement.ts` | `computeFundingAwareSettlement` |
| Earnings | `vendor-earnings-on-completion.ts` | `ensureVendorEarningsForCompletedBooking` |
| Funding INSERT | `create-vendor-earnings-from-snapshot.ts` | `createFundingAwareVendorEarnings` |
| Payment hook | `razorpay.razorpay.ts` | `recordBookingPromotionUsageFromBooking` |

---

## Environment

```
DISCOUNT_ENGINE_V2_* = AUTHORITATIVE (all)
FINANCE_FUNDING_AWARE_SETTLEMENT = (unset → LEGACY)
UAT_MODE = true
```

---

## Recommended Fix

| Order | Action |
|-------|--------|
| 1 | Fix `resolveVendorCommissionPolicy` (`end_date`) |
| 2 | Set `FINANCE_FUNDING_AWARE_SETTLEMENT=SHADOW` on dev; verify shadow logs |
| 3 | Fix promo ID persistence + category fallback |
| 4 | Promote to `FINANCE_FUNDING_AWARE_SETTLEMENT=AUTHORITATIVE` |
| 5 | `realignPendingVendorEarningsForBooking('e8584dfb-...')` |
| 6 | Optional: backfill `promotion_usages` |

### Corrected numbers (after fixes, platform-funded)

| Metric | Value |
|--------|-------|
| vendorBasePrice | 200 |
| platformCost | 100 |
| commissionBase | 200 |
| commissionRate | 20% |
| commissionAmount | 40 |
| vendorSettlement | 160 |

---

## Priority

**P1**

---

## Risk

Without trace alignment, partial fixes (e.g. enabling discount flags only) leave earnings incorrect and promotion usage unrecorded.
