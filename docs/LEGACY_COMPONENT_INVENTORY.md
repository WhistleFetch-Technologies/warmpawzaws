# Legacy Component Inventory — Promotions & Discount Engine

**Date:** 2026-07-06  
**Scope:** Phase 8A analysis — every legacy resolver, service, adapter, flag, and deprecated UI  
**Method:** Repository-wide search + import tracing + subagent verification

---

## Legend

| Removal readiness | Meaning |
|-------------------|---------|
| **P0 — Block cutover** | Still authoritative; must keep until V2 HTTP swap |
| **P1 — Keep through shadow parity** | Required for compare / fallback |
| **P2 — Remove after cutover** | Bridge/shadow only |
| **P3 — Safe now** | Dead code / orphan UI |

| Risk | H/M/L |
|------|-------|

---

## Tier 1 — Production-authoritative legacy engines

### `backend/lambda/src/lib/services/booking-promotion-service.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Booking promo orchestration: load vendor + platform promos, stack, financial meta builders |
| **Still used?** | **Yes** — `promotions.ts`, `bookings-enhanced.booking.ts`, `razorpay.razorpay.ts`, `discount-calculation-service.ts` |
| **V2 replacement** | `UnifiedDiscountResolver` + S1/S2 stack path |
| **Safe to remove?** | **No** — P0 |
| **Dependencies** | `service-promotion-engine`, shadow adapters, production-bridge |
| **Risk** | **H** — all service booking checkout |

### `backend/lambda/src/utils/service-promotion-engine.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Vendor service promo eligibility + discount math (combo, loyalty, platform helpers) |
| **Still used?** | **Yes** — booking-promotion-service, vendor-promotions, V2 benefit adapters |
| **V2 replacement** | Rule engine + `service-booking-benefit.adapter.ts` |
| **Safe to remove?** | **No** — P0 |
| **Dependencies** | DB `vendor_service_promotions`, shadow-adapters |
| **Risk** | **H** |

### `backend/lambda/src/utils/vendor-promotion-engine.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Vendor product/cart promo eval (BOGO, bundle, standard) |
| **Still used?** | **Yes** — ecommerce, ads-recommendations, vendor-promotions, bookings-enhanced |
| **V2 replacement** | `vendor-product-benefit.adapter.ts`, E1–E3 resolver rows |
| **Safe to remove?** | **No** — P0 |
| **Dependencies** | DB `vendor_promotions` |
| **Risk** | **H** — shop cart |

### `backend/lambda/src/lib/services/discount-calculation-service.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Thin wrapper → `resolveBookingPromotions` for pricing quotes |
| **Still used?** | **Yes** — `service-discovery.customer.ts` (`POST /customer/pricing/quote`) |
| **V2 replacement** | Resolver service domain path |
| **Safe to remove?** | **No** — P0 |
| **Dependencies** | booking-promotion-service |
| **Risk** | **M** |

### `backend/lambda/src/endpoints/promotions.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Platform promos/coupons HTTP: list, calculate-booking, validate, apply, admin CRUD, stats |
| **Still used?** | **Yes** — registered in handler; primary customer + admin surface |
| **V2 replacement** | Resolver-backed handlers per RESOLVER_MATRIX row |
| **Safe to remove?** | **No** — P0 (refactor in place, not delete) |
| **Dependencies** | All Tier 1 engines, validateCouponInternal inline |
| **Risk** | **H** |

**Inline legacy in same file:**

| Symbol | Purpose | Used? | Replacement |
|--------|---------|-------|-------------|
| `validateCouponInternal()` | Platform coupon validation + amount | Yes | coupon provider + resolver |
| Duplicate `POST /promotions/apply` | Two handlers; verify which wins in Hono | Ambiguous | Single resolver apply |
| `platform_promotions` query | Legacy table on code apply | If 2nd handler live | Migrate to `promotions`/`coupons` |

### `backend/lambda/src/endpoints/vendor/endpoints/vendor-promotions.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Vendor promo CRUD, validate-code, active-promotions, apply-vendor |
| **Still used?** | **Yes** |
| **V2 replacement** | Resolver S3/E2 paths |
| **Safe to remove?** | **No** — P0 |
| **Dependencies** | vendor-promotion-engine, service-promotion-engine, production-bridge |
| **Risk** | **H** — validate-code inline divergence (S3) |

---

## Tier 2 — V2 bridges, shadow layers, compatibility wrappers

### `discount-engine/resolver/production-bridge.ts`

| Field | Value |
|-------|-------|
| **Purpose** | `invokeResolverAlongsideLegacy` — fire-and-forget V2, log diagnostics |
| **Still used?** | **Yes** — all major calc paths |
| **Replacement when cutover** | Direct `getUnifiedDiscountResolver().resolve()` + return to HTTP |
| **Safe to remove?** | **No** — P1 until authoritative swap |
| **Risk** | **L** (removal without swap = lose V2 entirely) |

### `discount-engine/resolver/unified-discount-resolver.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Full V2 pipeline (phase-7.0) |
| **Still used?** | Via production-bridge only |
| **Safe to remove?** | **No** — this *is* V2 |
| **Risk** | N/A |

### `discount-engine/resolver/legacy-stack-adapter.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Coexistence flags when stack mode OFF/SHADOW |
| **Still used?** | Yes — resolver when stack not authoritative |
| **Replacement** | Stack Engine authoritative path |
| **Safe to remove?** | P2 — after `STACK_MODE=AUTHORITATIVE` proven |
| **Risk** | **M** — stack parity |

### `discount-engine/adapters/legacy-service-discount-calculator.adapter.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Wraps discount-calculation-service for Phase 1 DI |
| **Still used?** | discount-engine-container, tests |
| **Replacement** | Native resolver |
| **Safe to remove?** | P2 |
| **Risk** | **L** |

### `discount-engine/adapters/legacy-ecommerce-cart-discount-calculator.adapter.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Wraps `calculateBestCartPromotion` |
| **Still used?** | discount-engine-container |
| **Replacement** | E-commerce resolver path |
| **Safe to remove?** | P2 |
| **Risk** | **L** |

### `discount-engine/adapters/composite-discount-calculator.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Routes to first supporting legacy adapter |
| **Still used?** | DI container |
| **Replacement** | Unified resolver |
| **Safe to remove?** | P2 |
| **Risk** | **L** |

### `discount-engine/adapters/context-mappers.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Legacy request ↔ DiscountContext |
| **Still used?** | Legacy engines, bridge callers |
| **Replacement** | Slim HTTP mappers post-cutover |
| **Safe to remove?** | P1 — keep for migration |
| **Risk** | **M** |

### `discount-engine/rules/adapters/shadow-adapters.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Shadow eligibility; legacy always wins |
| **Still used?** | booking-promotion-service, engines, promotions.ts |
| **Replacement** | Authoritative rule engine |
| **Safe to remove?** | P2 |
| **Risk** | **M** |

### `discount-engine/rules/shadow.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Eligibility mismatch logging |
| **Still used?** | shadow-adapters |
| **Safe to remove?** | P2 |
| **Risk** | **L** |

### `discount-engine/benefits/compare.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Benefit vs legacy amount compare (±₹1) |
| **Still used?** | benefit adapters |
| **Replacement** | Authoritative benefits |
| **Safe to remove?** | P2 |
| **Risk** | **M** |

### `discount-engine/benefits/adapters/*.adapter.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Benefit math with legacyAmount fallback |
| **Still used?** | Legacy engines + promotions.ts |
| **Safe to remove?** | P2 |
| **Risk** | **M** |

### `discount-engine/di/discount-engine-container.ts` + `getDiscountEngineRegistry()`

| Field | Value |
|-------|-------|
| **Purpose** | Phase 1 DI registry |
| **Still used?** | **No HTTP imports** — tests/docs only |
| **Replacement** | Phase 13 wiring or deprecate |
| **Safe to remove?** | P3 after Phase 13 decision |
| **Risk** | **L** |

### `discount-engine/resolver/priority-shadow.ts`

| Field | Value |
|-------|-------|
| **Purpose** | @deprecated Phase 5A wrapper |
| **Still used?** | Tests only |
| **Safe to remove?** | P3 |
| **Risk** | **L** |

### `discount-engine/settlement/settlement-hook-bridge.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Read V2 settlement preview from booking meta for earnings |
| **Still used?** | vendor-earnings-on-completion, pharmacy-orders, meal-order-settlement, package-session-sync, seller-commission-rate |
| **Replacement** | Permanent integration layer (not legacy) |
| **Safe to remove?** | **No** — keep as bridge |
| **Risk** | **M** if removed before meta populated |

### `backend/lambda/src/utils/promotion-admin-persistence.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Admin payload → DB with backward-compatible fields |
| **Still used?** | admin promotions POST/PUT, campaign promotion-bridge |
| **Replacement** | Keep — normalization layer |
| **Safe to remove?** | **No** |
| **Risk** | **M** |

### `discount-engine/campaign/integrations/promotion-bridge.ts`

| Field | Value |
|-------|-------|
| **Purpose** | Campaign → create promos/coupons in shared tables |
| **Still used?** | Campaign engine |
| **Safe to remove?** | **No** — V2 integration |
| **Risk** | **L** |

---

## Tier 3 — Frontend legacy / orphan

| File | Purpose | Used? | Replacement | Removal |
|------|---------|-------|-------------|---------|
| `apps/admin-web/.../AdvancedPromotionsEngine.tsx` | Legacy admin modal | E2E only | AdminPromotionHub | P3 |
| `apps/admin-web/.../ecommerce/promotions/PromotionsManagement.tsx` | Old ecommerce grid | Orphan export | AdminPromotionHub | P3 |
| `apps/vendor-web/.../ServicePromotionsManagement.tsx` | Wrapper | Yes — VendorLandingPage | Direct hub import | P3 |
| `apps/vendor-web/.../seller/PromotionsManagement.tsx` | Wrapper | Yes — SellerHub | Direct hub import | P3 |
| `apps/customer-web/lib/promotions-engine.ts` | Client-side BOGO engine | **Zero imports** | Backend API | **P3 — safe now** |
| `apps/customer-web/lib/pricing/coupon-validation.ts` | Validation + legacy GET fallback | Yes — checkout | Unified validate-code | P1 |

---

## Tier 4 — Legacy schema / data

| Artifact | Purpose | Still used? | Replacement | Risk |
|----------|---------|-------------|-------------|------|
| `platform_promotions` table | Legacy platform promos | apply handler branch | `promotions` / `coupons` | **M** |
| `db/migrations/306_add_financial_policy_fields.sql` | Created table | Runtime query | Data migration | **M** |

---

## Tier 5 — Deprecated / shadowed HTTP handlers

| Issue | Files | Impact |
|-------|-------|--------|
| `GET /admin/promotions` shadowed | `admin-advanced.ts` overrides `promotions.ts` | Admin list simplified — **bug** |
| Duplicate `POST /promotions/apply` | `promotions.ts` | Unclear which handler active |
| `GET /vendor/:vendorId/settlements` shadowed | razorpay vs dashboard-enhanced | Vendor settlement UI may get wrong shape |
| Unregistered mirror endpoint files | vendor-dashboard-enhanced.ts (root), etc. | Dead code — P3 |

---

## Tier 6 — Old feature flags (design vs implemented)

| Flag | Documented in | Implemented in code | Production env |
|------|---------------|---------------------|----------------|
| `discount_engine_v2_priority` | STACK_POLICY §9 | `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | Not in Terraform |
| `discount_engine_v2_stack` | STACK_POLICY §9 | `DISCOUNT_ENGINE_V2_STACK_MODE` | Not in Terraform |
| `discount_engine_v2_authoritative` | STACK_POLICY §9 | **Not implemented** | — |
| `DISCOUNT_ENGINE_V2_*_MODE` family | Phase 6–10 reports | Yes — `*-mode.ts` files | Lambda env manual only |

---

## Dependency graph (legacy → V2)

```
HTTP handlers (promotions.ts, vendor-promotions.ts, ecommerce)
    ↓
booking-promotion-service | vendor-promotion-engine | service-promotion-engine
    ↓ (parallel, fire-and-forget)
invokeResolverAlongsideLegacy → UnifiedDiscountResolver
    ↓
[Rules → Benefits → Priority → Stack → Settlement]
    ↓
CloudWatch logs only (today)
```

---

## Removal sequencing (post-cutover)

1. **Phase 8B:** Implement HTTP authoritative swap — keep all Tier 1 until parity sign-off.
2. **Phase 8C:** Disable shadow compares; set legacy engines to read-only fallback behind flag.
3. **Phase 9+:** Remove shadow-adapters, benefit compare, legacy-stack-adapter when stack authoritative stable 30d.
4. **Cleanup sprint:** Orphan UI, dead `promotions-engine.ts`, mirror endpoint files, `platform_promotions` after data migration.
5. **Phase 13 decision:** Wire or delete `getDiscountEngineRegistry()`.

---

*Phase 8A artifact — local only, not committed.*
