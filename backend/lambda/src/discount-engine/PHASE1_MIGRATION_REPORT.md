# Discount Engine V2 — Phase 1 Migration Report

**Date:** 2026-06-30  
**Branch:** `develop`  
**Scope:** Foundation layer only — no API, DB, UI, or settlement changes.

---

## Summary

Phase 1 introduces `backend/lambda/src/discount-engine/` as the unified discount engine **foundation**. Existing promotion and coupon calculation paths are **unchanged**; legacy engines are wrapped behind `DiscountCalculator` adapters and registered via a DI container for future replacement.

---

## Files Added

| Path | Purpose |
|------|---------|
| `discount-engine/index.ts` | Public module exports |
| `discount-engine/enums/*.ts` | `DiscountDomain`, `DiscountOwner`, `DiscountFunding`, `DiscountTrigger`, `DiscountStatus` |
| `discount-engine/models/discount-context.ts` | Unified input model |
| `discount-engine/models/discount-result.ts` | `DiscountEngineResult` (avoids collision with legacy `DiscountResult`) |
| `discount-engine/contracts/*.ts` | Interface contracts only (no business logic) |
| `discount-engine/adapters/context-mappers.ts` | Legacy ↔ V2 shape mapping |
| `discount-engine/adapters/legacy-service-discount-calculator.adapter.ts` | Wraps `discount-calculation-service` |
| `discount-engine/adapters/legacy-ecommerce-cart-discount-calculator.adapter.ts` | Wraps `vendor-promotion-engine.calculateBestCartPromotion` |
| `discount-engine/adapters/composite-discount-calculator.ts` | Domain router over adapters |
| `discount-engine/di/discount-engine-container.ts` | Registry + singleton DI |
| `discount-engine/di/types.ts` | `DiscountEngineRegistry` type |
| `discount-engine/__tests__/discount-engine-phase1.test.ts` | Adapter mapping + DI smoke tests |
| `discount-engine/PHASE1_MIGRATION_REPORT.md` | This document |

## Files Modified

**None.** Phase 1 is additive. No existing handlers, APIs, or legacy engines were edited.

---

## Architecture Decisions

### 1. Separate module, not a rewrite

New code lives under `discount-engine/` rather than refactoring `discount-calculation-service.ts` or `vendor-promotion-engine.ts`. This preserves backward compatibility and allows sprint-by-sprint migration.

### 2. `DiscountEngineResult` vs legacy `DiscountResult`

The legacy service layer already exports `DiscountResult` from `discount-calculation-service.ts`. V2 uses **`DiscountEngineResult`** to prevent import collisions and to carry future fields (`settlement`, `warnings`, `benefits`).

### 3. Adapters delegate; they do not reimplement

| Adapter | Legacy engine | Domain |
|---------|---------------|--------|
| `LegacyServiceDiscountCalculatorAdapter` | `discountCalculationService.calculateDiscounts` | `SERVICE` |
| `LegacyEcommerceCartDiscountCalculatorAdapter` | `calculateBestCartPromotion` | `ECOMMERCE` |

Ecommerce adapter expects promotion rows in `context.metadata.promotionRows` — same responsibility as `ads-recommendations.ts` and ecommerce endpoints today (no duplicated DB fetch in Phase 1).

### 4. Contracts without implementations

These interfaces are defined but **not implemented** in Phase 1:

- `DiscountRule`, `DiscountBenefit` — Phase 2–3
- `EligibilityEngine` — Phase 2
- `PriorityEngine`, `StackEngine` — Phase 5–6
- `SettlementEngine` — Phase 7 (shape exists on `DiscountSettlementPreview` only)
- `UsageTracker` — Phase 4 (service promotion usage on `feature-meal-ui-promotion` branch)

### 5. Coupon path deferred

`validateCouponInternal` in `promotions.ts` is not exported. A coupon adapter will be added in **Phase 4** after extraction to a shared service. Until then, coupons continue through existing API handlers unchanged.

### 6. DI container pattern

`getDiscountEngineRegistry()` returns a singleton with legacy adapters as defaults. `setDiscountEngineRegistry()` allows tests and future feature flags to swap implementations without touching call sites.

### 7. Funding model is type-only

`DiscountFunding` (`PLATFORM` | `VENDOR` | `SHARED`) is introduced on enums/context but not computed — settlement is Phase 7.

---

## Existing Engines (unchanged)

| Engine | Location | Used for |
|--------|----------|----------|
| Service discount stack | `lib/services/discount-calculation-service.ts` | Bookings / service pricing |
| Ecommerce cart promos | `utils/vendor-promotion-engine.ts` | Shop cart, vendor product promos |
| Platform `promotions` table | `endpoints/promotions.ts` | Platform coupons / promos |
| Service promos (feature branch) | `utils/service-promotion-engine.ts` | On `feature-meal-ui-promotion` only |

---

## Future Phases Impacted

| Phase | Builds on Phase 1 |
|-------|-------------------|
| **2 — Rule Engine** | Implement `DiscountRule` + `EligibilityEngine`; replace inline `if` checks |
| **3 — Benefit Engine** | Implement `DiscountBenefit`; unify %, flat, BOGO, bundle math |
| **4 — Promotion & Coupon** | Single entity with `DiscountTrigger`; extract coupon validator adapter |
| **5 — Priority** | Implement `PriorityEngine`; replace highest-discount-only |
| **6 — Stack** | Implement `StackEngine`; configurable vendor+platform stacking |
| **7 — Settlement** | Implement `SettlementEngine`; populate `DiscountSettlementPreview` |
| **8 — Admin UI** | Consumes unified `/discounts` APIs (Phase 11) |
| **9 — Analytics** | Usage + ROI on `discount_usage` (future table) |
| **10 — Scheduler** | Lifecycle via scheduler, not cron `is_active` toggles |
| **11 — API** | Wire handlers to `getDiscountEngineRegistry().calculator` |
| **12 — Testing** | Expand coverage using DI swaps |
| **13 — Migration** | Sprint 1: opt-in adapter routing behind feature flag |

---

## Integration Checklist (next sprint)

1. Add feature flag `DISCOUNT_ENGINE_V2_ENABLED` (env, similar to `PLATFORM_TAX_DOCUMENTS_ENABLED`).
2. In one endpoint (e.g. `POST /promotions/calculate-booking` on merged service promo branch), call `getDiscountEngineRegistry().calculator.calculate(context)` behind flag.
3. Compare V2 adapter output vs legacy response in logs before cutover.
4. Merge `feature-meal-ui-promotion` service engine → add `LegacyServicePromotionEngineAdapter` when that code lands on `develop`.

---

## Verification

```bash
cd backend/lambda && npm run build
cd backend/lambda && npm test -- discount-engine-phase1
```

Both must pass before Phase 2 work begins.
