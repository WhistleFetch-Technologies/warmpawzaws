# Discount Engine V2 — Phase 1 Migration Report

**Date:** 2026-06-30  
**Branch:** `feature-meal-ui-promotion`  
**Scope:** Foundation layer only — no API, DB, UI, or settlement changes.

**Phase status:** **Phase 1 = COMPLETE**

---

## Summary

Phase 1 introduces `backend/lambda/src/discount-engine/` as the unified discount engine **foundation**. Existing promotion and coupon calculation paths are **unchanged**; legacy engines are wrapped behind `DiscountCalculator` adapters and registered via a DI container for future replacement.

**Gap closure (2026-06-30):** `serviceStyle` and all `POST /promotions/calculate-booking` fields now map completely between legacy booking requests and `DiscountContext`. Ecommerce adapter passes full `EvaluateContext` fields available on `DiscountContext` (`vendorId`, `priorVendorOrderCount` via metadata).

---

## Files Added (initial Phase 1)

| Path | Purpose |
|------|---------|
| `discount-engine/index.ts` | Public module exports |
| `discount-engine/enums/*.ts` | `DiscountDomain`, `DiscountOwner`, `DiscountFunding`, `DiscountTrigger`, `DiscountStatus` |
| `discount-engine/models/discount-context.ts` | Unified input model |
| `discount-engine/models/discount-result.ts` | `DiscountEngineResult` |
| `discount-engine/contracts/*.ts` | Interface contracts only |
| `discount-engine/adapters/*.ts` | Legacy wrappers + mappers |
| `discount-engine/di/*.ts` | Registry + singleton DI |
| `discount-engine/__tests__/discount-engine-phase1.test.ts` | Adapter + mapping tests |
| `discount-engine/PHASE1_MIGRATION_REPORT.md` | This document |

## Files Modified (gap closure)

| Path | Change |
|------|--------|
| `discount-engine/adapters/context-mappers.ts` | `serviceStyle` in legacy params; bidirectional booking mappers; ecommerce evaluate context helper |
| `discount-engine/adapters/legacy-ecommerce-cart-discount-calculator.adapter.ts` | Uses `ecommerceContextToLegacyEvaluateContext` (vendorId, audience metadata) |
| `discount-engine/adapters/index.ts` | Export new mapper helpers |
| `discount-engine/__tests__/discount-engine-phase1.test.ts` | Tests for `serviceStyle` + round-trip booking fields |
| `discount-engine/PHASE1_MIGRATION_REPORT.md` | This update |

**Not modified:** `promotions.ts`, `booking-promotion-service.ts`, `service-promotion-engine.ts`, APIs, SQL, or database schema.

---

## Legacy → DiscountContext Mapping Summary

| Legacy field (`POST /promotions/calculate-booking`) | DiscountContext property | Status |
|---------------------------------------------------|--------------------------|--------|
| `vendorId` / `vendor_id` | `vendorId` | ✅ |
| `customerId` / `customer_id` | `customerId` | ✅ |
| `amount` / `bookingAmount` | `amount` | ✅ |
| `serviceIds` / `service_ids` / `selectedServiceIds` / `serviceId` | `booking.serviceIds` | ✅ |
| `serviceCategory` / `service_category` / `category` | `booking.serviceCategory` | ✅ |
| `serviceStyle` / `service_style` | `booking.serviceStyle` | ✅ (gap closed) |
| `bookingId` / `booking_id` | `booking.bookingId` | ✅ |
| _(implicit)_ | `domain` = `SERVICE` | ✅ |
| _(implicit)_ | `trigger` = `AUTO` | ✅ |
| `couponCode` (discount-calculation-service only) | `couponCode` | ✅ |

### Ecommerce cart (`POST /promotions/calculate-cart` shape)

| Legacy field | DiscountContext property | Status |
|--------------|--------------------------|--------|
| `vendorId` | `vendorId` | ✅ |
| `customerId` | `customerId` | ✅ |
| `items[]` | `items` / `metadata.cartLines` | ✅ |
| `manualCode` | `couponCode` when `trigger=CODE` | ✅ |
| Preloaded promos | `metadata.promotionRows` | ✅ |
| `priorVendorOrderCount` (computed by endpoint) | `metadata.priorVendorOrderCount` | ✅ |

### Mapper functions

| Function | Direction |
|----------|-----------|
| `parseLegacyBookingCalculateRequest` | HTTP body → normalized request |
| `bookingCalculateRequestToDiscountContext` | Normalized request → `DiscountContext` |
| `resolveBookingParamsToDiscountContext` | `ResolveBookingPromotionsParams` → `DiscountContext` |
| `discountContextToResolveBookingParams` | `DiscountContext` → `ResolveBookingPromotionsParams` |
| `serviceContextToLegacyParams` | `DiscountContext` → `discount-calculation-service` params |
| `ecommerceContextToLegacyEvaluateContext` | `DiscountContext` → `vendor-promotion-engine` evaluate ctx |

---

## Architecture Decisions

### 1. Separate module, not a rewrite

New code lives under `discount-engine/` rather than refactoring legacy engines. Preserves backward compatibility.

### 2. `DiscountEngineResult` vs legacy `DiscountResult`

V2 uses **`DiscountEngineResult`** to prevent import collisions with `discount-calculation-service.ts`.

### 3. Adapters delegate; they do not reimplement

| Adapter | Legacy engine | Domain |
|---------|---------------|--------|
| `LegacyServiceDiscountCalculatorAdapter` | `discountCalculationService.calculateDiscounts` → `resolveBookingPromotions` | `SERVICE` |
| `LegacyEcommerceCartDiscountCalculatorAdapter` | `calculateBestCartPromotion` | `ECOMMERCE` |

### 4. Contracts without implementations

`DiscountRule`, `DiscountBenefit`, `EligibilityEngine`, `PriorityEngine`, `StackEngine`, `SettlementEngine`, `UsageTracker` — interfaces only until Phases 2–7.

### 5. Coupon adapter deferred

`validateCouponInternal` in `promotions.ts` is not exported. Phase 4 will extract and wrap.

### 6. DI container

`getDiscountEngineRegistry()` returns legacy adapters by default. Not wired to HTTP handlers yet (Sprint 1 / Phase 13).

---

## Verification

```bash
cd backend/lambda && npm run build
cd backend/lambda && npm test -- discount-engine-phase1
cd backend/lambda && npm test -- service-promotion-engine
```

| Check | Result |
|-------|--------|
| TypeScript build | ✅ Pass |
| Phase 1 unit tests (6) | ✅ Pass |
| Service promotion engine tests | ✅ Pass |
| Business logic changed | ❌ No |
| API contract changed | ❌ No |
| Database schema changed | ❌ No |
| Discount calculation changed | ❌ No |

---

## Remaining work before Phase 2 (non-blockers)

These are **intentionally out of Phase 1** scope:

| Item | Phase |
|------|-------|
| Wire `getDiscountEngineRegistry()` behind feature flag in handlers | Sprint 1 / Phase 13 |
| Coupon adapter (`validateCouponInternal` extraction) | Phase 4 |
| Rule engine implementations | Phase 2 |
| Settlement computation | Phase 7 |

**No remaining Phase 1 foundation blockers.**

---

## Future Phases Impacted

| Phase | Builds on Phase 1 |
|-------|-------------------|
| **2 — Rule Engine** | `DiscountContext` + `DiscountRule.evaluate(context)` |
| **3 — Benefit Engine** | `DiscountBenefit.calculate(context, amount)` |
| **4 — Promotion & Coupon** | Unified trigger; coupon adapter |
| **5–6 — Priority / Stack** | Replace ad-hoc stacking |
| **7 — Settlement** | `SettlementEngine.compute` |
| **11 — API** | `/discounts` routes via registry |
| **13 — Migration** | Feature-flagged cutover |
