# Discount Engine V2 — Phase 2 Migration Report

**Date:** 2026-06-30  
**Branch:** `feature-meal-ui-promotion`  
**Scope:** Benefit Engine — centralized discount calculation only.

**Phase status:** **Phase 2 = COMPLETE**

---

## Summary

Phase 2 introduces `discount-engine/benefits/` as the **single calculation layer** for discount math. Legacy engines (`vendor-promotion-engine`, `service-promotion-engine`, `validateCouponInternal`) delegate to benefit strategies via adapters. Each call compares benefit output to the inline legacy result; on mismatch, logs a warning and **returns the legacy amount** (production behaviour preserved).

Eligibility, APIs, database, stacking, and priority are **unchanged**.

---

## New Components

### Types & contracts (`benefits/types.ts`)

| Type | Purpose |
|------|---------|
| `BenefitContext` | Calculation input (amounts, items, discount config) |
| `BenefitResult` | `discountAmount`, `finalAmount`, `appliedBenefit`, metadata |
| `BenefitStrategy` | Strategy pattern contract (`supports`, `calculate`) |
| `BenefitCalculator` | Registry router over strategies |
| `DiscountBenefit` | Alias for `BenefitStrategy` |

### Math utilities (`benefits/math.ts`)

| Function | Purpose |
|----------|---------|
| `safeCurrencyMath` | NaN / non-finite guard |
| `clampNonNegative` | Floor at zero |
| `computePercentageDiscount` | `(base × percent) / 100` |
| `computeFlatDiscount` | Fixed amount |
| `applyMaximumDiscount` | Max cap + clamp to base (legacy `capDiscount`) |
| `calculateRemainingAmount` | `original - discount` floored at 0 |
| `benefitAmountsWithinTolerance` | ±1 tolerance (matches promotion engine) |
| `lineItemsSubtotal` | Cart line sum |

### Compare (`benefits/compare.ts`)

| Function | Purpose |
|----------|---------|
| `resolveDiscountWithLegacyFallback` | Log + return legacy on mismatch |
| `resolveBenefitResultWithLegacyFallback` | Full result wrapper |

### Strategies (`benefits/strategies/`)

| Class | `benefitType` |
|-------|---------------|
| `PercentageBenefitStrategy` | `percentage` |
| `FlatBenefitStrategy` | `flat` |
| `BogoBenefitStrategy` | `buy_x_get_y` |
| `BundleBenefitStrategy` | `bundle` |
| `ComboBenefitStrategy` | `combo` |
| `LoyaltyBenefitStrategy` | `loyalty` |

### Calculator (`benefits/benefit-calculator.ts`)

| Class / function | Purpose |
|----------------|---------|
| `DefaultBenefitCalculator` | Strategy registry + `calculate` / `calculateWithStrategy` |
| `getBenefitCalculator()` | Singleton accessor (DI-ready) |

### Legacy adapters (`benefits/adapters/`)

| Module | Functions |
|--------|-----------|
| `vendor-product-benefit.adapter.ts` | `computeVendorStandardDiscountAmount`, `computeVendorBogoDiscountAmount`, `computeVendorBundleDiscountAmount` |
| `service-booking-benefit.adapter.ts` | `computeServiceStandardDiscountAmount`, `computeServiceComboDiscountAmount`, `computeServiceLoyaltyDiscountAmount`, `computePlatformPromotionDiscountAmount` |
| `coupon-benefit.adapter.ts` | `computeCouponDiscountAmount` |

---

## Legacy Mapping

| Legacy function | Benefit strategy / adapter |
|---------------|---------------------------|
| `capDiscount()` (vendor + service) | `applyMaximumDiscount()` |
| `calculateStandard()` % / flat | `PercentageBenefitStrategy` / `FlatBenefitStrategy` via `computeVendorStandardDiscountAmount` |
| `calculateBogo()` | `BogoBenefitStrategy` via `computeVendorBogoDiscountAmount` |
| `calculateBundle()` | `BundleBenefitStrategy` via `computeVendorBundleDiscountAmount` |
| `calculateStandardService()` | `computeServiceStandardDiscountAmount` |
| `calculateCombo()` | `ComboBenefitStrategy` via `computeServiceComboDiscountAmount` |
| `calculateLoyalty()` | `LoyaltyBenefitStrategy` via `computeServiceLoyaltyDiscountAmount` |
| `calculatePlatformDiscount()` | `computePlatformPromotionDiscountAmount` |
| `validateCouponInternal()` discount block | `computeCouponDiscountAmount` |

---

## Files Modified

| File | Change |
|------|--------|
| `utils/vendor-promotion-engine.ts` | Delegate cap + standard/BOGO/bundle math to benefit adapters |
| `utils/service-promotion-engine.ts` | Delegate cap + standard/combo/loyalty/platform math |
| `endpoints/promotions.ts` | `validateCouponInternal` discount block only |
| `discount-engine/index.ts` | Export `benefits` module |

**Not modified:** eligibility functions, API routes, SQL, booking-promotion-service orchestration, stack/priority logic.

---

## Tests Added

| File | Coverage |
|------|----------|
| `benefits/__tests__/benefit-engine.test.ts` | Math utils, all strategies, legacy fallback |

Existing suites must continue passing:

- `vendor-promotion-engine.test.ts`
- `service-promotion-engine.test.ts`
- `discount-engine-phase1.test.ts`

---

## Verification

```bash
cd backend/lambda && npm run build
cd backend/lambda && npm test -- benefit-engine
cd backend/lambda && npm test -- vendor-promotion-engine
cd backend/lambda && npm test -- service-promotion-engine
cd backend/lambda && npm test -- discount-engine-phase1
```

| Check | Expected |
|-------|----------|
| Business logic (eligibility) | Unchanged |
| API contracts | Unchanged |
| Database | Unchanged |
| Discount output | Identical (legacy fallback on any drift) |
| Build | Pass |
| Existing tests | Pass |

---

## Known Limitations

| Item | Phase |
|------|-------|
| Inline % / flat in `promotions.ts` `validate-code` handler | Phase 4 coupon unification |
| `POST /promotions/apply` duplicate handler math | Out of scope |
| Benefit engine not wired to `getDiscountEngineRegistry()` HTTP path | Phase 13 |
| Rule engine (eligibility as rules) | Phase 2 (rules) — **not this phase** |
| Settlement | Phase 7 |

---

## Phase 3+ Readiness

Benefit strategies are pluggable via `DefaultBenefitCalculator` constructor / `setBenefitCalculator()`. Phase 3 can add cashback, wallet credit, etc. as new strategies without touching legacy engines.
