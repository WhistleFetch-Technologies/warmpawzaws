# Discount Engine V2 — Phase 4 Migration Report

**Phase:** Unified Discount Resolver  
**Status:** Complete (shadow / diagnostic mode — legacy remains authoritative)  
**Date:** 2026-06-30

---

## Resolver Architecture

Phase 4 introduces `discount-engine/resolver/` as the **single orchestration point** for discount evaluation. The resolver coordinates existing Phase 1–3.5 components. It contains **no business rules**, **no discount math**, **no stacking**, and **no settlement**.

```
DiscountContext
        ↓
Candidate Providers  (load raw rows — no eligibility / math)
        ↓
Candidate Normalizer (rows → DiscountCandidate[])
        ↓
Rule Engine          (eligibility per candidate)
        ↓
Benefit Engine       (discount amount per eligible candidate)
        ↓
Usage Preparation    (metadata only — no DB writes)
        ↓
ResolverResult
```

### Module map

| File | Role |
|------|------|
| `resolver/unified-discount-resolver.ts` | `DefaultUnifiedDiscountResolver.resolve()` — pipeline orchestration |
| `resolver/candidate-repository.ts` | Provider selection, load, normalize, trigger/owner filter |
| `resolver/context-runtime.ts` | `DiscountContext` → load / rule / benefit runtime mappers |
| `resolver/usage-preparation.ts` | Prepare usage metadata (Phase 6 settlement) |
| `resolver/production-bridge.ts` | `runResolverPipeline`, `invokeResolverAlongsideLegacy` |
| `resolver/types.ts` | `ResolverResult`, `CandidateRuleOutcome`, `CandidateBenefitOutcome` |

### Entry point

```typescript
import { getUnifiedDiscountResolver } from './discount-engine/resolver';

const result = await getUnifiedDiscountResolver().resolve(discountContext);
```

---

## Flow Mapping

Legend: **Migrated** = production path invokes resolver (diagnostic, legacy return unchanged) · **Pending** = known gap, resolver not yet meaningful · **Deferred** = out of Phase 4 scope

| ID | Flow | Status | Production adapter |
|----|------|--------|-------------------|
| **S1** | Service · Vendor Promotion · AUTO | **Migrated** | `resolveBookingPromotions`, `evaluateServicePromotionDiscount`, `listApplicableBookingPromotions`, `discountCalculationService` |
| **S2** | Service · Platform Promotion · AUTO | **Migrated** | Same as S1 (combined provider load) |
| **S3** | Service · Vendor Promotion · CODE | **Migrated** | `POST /promotions/validate-code` (service branch), `evaluateServicePromotionDiscount` |
| **S4** | Service · Platform Promotion · CODE | **Migrated** | `POST /promotions/validate-code` (platform branch) |
| **S5** | Service · Platform Coupon · CODE | **Migrated** | `validateCouponInternal`, `GET/POST /coupons/*` |
| **S6** | Service · Vendor Coupon · CODE | **Migrated** | Same as S3 (coded `vendor_service_promotions` row) |
| **E1** | E-commerce · Vendor Promotion · AUTO | **Migrated** | `calculateBestCartPromotion`, `evaluatePromotionDiscount`, order create |
| **E2** | E-commerce · Vendor Promotion · CODE | **Migrated** | `calculateBestCartPromotion` (`manualCode`), `validate-code` product branch |
| **E3** | E-commerce · Vendor Coupon · CODE | **Migrated** | Alias of E2 (coded `vendor_promotions` row) |
| **E4** | E-commerce · Platform Promotion · AUTO | **Deferred** | Listed in applicable API only — not applied at checkout (product decision) |
| **E5** | E-commerce · Platform Promotion · CODE | **Migrated** | `POST /promotions/validate-code` (platform branch) |
| **E6** | E-commerce · Platform Coupon · CODE | **Migrated** | `validateCouponInternal` |
| **—** | Booking `coupon_code` stack | **Pending** | `resolveBookingPromotions` ignores `coupons` table (pre-existing gap) |
| **—** | Shop checkout → `coupons` table | **Pending** | Checkout `couponCode` searches vendor promos only (pre-existing gap) |
| **—** | `POST /promotions/apply` legacy | **Deferred** | Legacy handler; Phase 5+ cutover |
| **—** | `platform_promotions` table | **Deferred** | Compatibility loader in Phase 5+ |

---

## Provider Summary

| Provider | Table / entity | Loads |
|----------|----------------|-------|
| **PlatformPromotionCandidateProvider** | `promotions` | Platform promotions (auto + coded) |
| **VendorPromotionCandidateProvider** | `vendor_promotions` | E-commerce vendor promos / vendor coupons |
| **VendorServicePromotionCandidateProvider** | `vendor_service_promotions` | Service vendor promos / vendor coupons |
| **CouponCandidateProvider** | `coupons` | Platform coupons (always code-triggered) |

Providers **only load rows**. Optional `metadata.preloadedRows` skips DB (tests / handler preloads). The resolver **never queries tables directly**.

---

## Resolver Responsibilities

### What the resolver does

1. Select candidate providers from `DiscountContext` (domain, trigger, owner, code)
2. Load raw entities via providers
3. Normalize every row to `DiscountCandidate`
4. Invoke **Rule Engine** for each candidate → eligible / rejected
5. Invoke **Benefit Engine** for each eligible candidate
6. Prepare usage metadata (no writes)
7. Return `ResolverResult` with diagnostics

### What the resolver must never do

- Implement eligibility business rules (Rule Engine)
- Calculate discount amounts (Benefit Engine)
- Choose a winning promotion (Priority Engine — Phase 5)
- Stack vendor + platform discounts (Stack Engine — Phase 5)
- Record usage or settlement (Phase 6)
- Query database tables directly
- Change public API responses (Phase 4 uses shadow/diagnostic mode)

### Phase 4 temporary behaviour

Until Phase 5, the resolver returns **all eligible candidates** in `appliedCandidates`. No winner selection, removal, stacking, or prioritization.

---

## Production Integration (shadow mode)

Legacy paths remain **authoritative** for returned discount amounts. Each wired production function calls `invokeResolverAlongsideLegacy(label, context)` which runs the full pipeline asynchronously and logs diagnostics.

| Legacy surface | Resolver label |
|----------------|----------------|
| `resolveBookingPromotions` | `resolveBookingPromotions` |
| `listApplicableBookingPromotions` | `listApplicableBookingPromotions` |
| `evaluateServicePromotionDiscount` | `evaluateServicePromotionDiscount-auto` / `-code` |
| `evaluatePromotionDiscount` | `evaluatePromotionDiscount-auto` / `-code` |
| `calculateBestCartPromotion` | `calculateBestCartPromotion-auto` / `-code` |
| `validateCouponInternal` | `validateCouponInternal-service` / `-ecommerce` |
| `POST /promotions/validate-code` | `validate-code-service-vendor` / `validate-code-platform` |

Context builders live in `discount-engine/adapters/context-mappers.ts`.

---

## Known Limitations

The following are **explicitly out of scope** for Phase 4 and belong to later phases:

| Component | Phase |
|-----------|-------|
| Priority Engine (best promo selection, spotlight) | Phase 5 |
| Stack Engine (vendor → platform sequential) | Phase 5 |
| Settlement / usage recording | Phase 6 |
| Campaigns | Later |
| Feature flags / cutover | Phase 5+ |
| Database schema changes | None planned in V2 |
| Public API changes | None in Phase 4 |
| Inline `validate-code` math replacement | Phase 5 (resolver wired; legacy inline math retained) |
| Booking coupon stack (`coupon_code` + promotions) | Product decision + Phase 5 |

---

## Tests

Integration tests: `resolver/__tests__/resolver.integration.test.ts`

Coverage:

- Service platform / vendor promotion (auto)
- Service platform / vendor coupon (code)
- E-commerce platform / vendor promotion and coupon flows
- Mixed candidate loading
- Candidate normalization (no raw rows in engine inputs)
- Rule evaluation (reject inactive)
- Benefit evaluation per eligible candidate
- `ResolverResult` diagnostics shape

Run:

```bash
cd backend/lambda && npm test -- --testPathPattern=discount-engine
```

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | Phase 4 unified resolver + production shadow wiring |

**Next step (Phase 5):** Priority Engine, Stack Engine, feature-flag cutover, and replace inline validate-code math with resolver-authoritative results.
