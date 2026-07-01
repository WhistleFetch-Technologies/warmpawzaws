# Discount Engine V2 — Resolver Matrix (Phase 4 Blueprint)

**Purpose:** Map every production discount request path before implementing the **Unified Resolver**.  
**Status:** Design / review artifact — no runtime changes.  
**Audience:** Phase 4 implementers and reviewers.

This matrix answers, for each real incoming discount flow:

1. **Source** — where the discount entity lives  
2. **Trigger** — auto-apply vs code entry  
3. **Domain** — service booking vs e-commerce  
4. **Current validation** — eligibility today  
5. **Current benefit calculation** — discount math today  
6. **Current usage tracking** — counters / audit rows today  
7. **Target unified resolver path** — intended Phase 4 pipeline  

---

## Taxonomy (Warmpawz production)

| Source | DB / entity | Typical `DiscountOwner` | Notes |
|--------|-------------|---------------------------|-------|
| **Platform Promotion** | `promotions` | `PLATFORM` | Auto stack on bookings; may have optional `code` |
| **Vendor Promotion** | `vendor_promotions` (product) / `vendor_service_promotions` (service) | `VENDOR` | Auto when `code` IS NULL; structural types (BOGO, bundle, combo, loyalty) |
| **Platform Coupon** | `coupons` | `PLATFORM` | Admin coupon entity; always code-triggered |
| **Vendor Coupon** | Same tables as vendor promotion (`code` IS NOT NULL) | `VENDOR` | Not a separate table — coded vendor promo row |

**Legacy third table:** `platform_promotions` is still queried by `POST /promotions/apply` only. Phase 4 should treat it as a **compatibility loader** or migrate rows into `promotions` / `coupons` before resolver cutover.

**Trigger**

| Trigger | Meaning in production |
|---------|----------------------|
| **Auto** | No user code; best eligible promo selected (`!promo.code` gate for vendor promos) |
| **Code** | User enters code; lookup by `code` column |

**Domain**

| Domain | `DiscountDomain` | Primary amount basis |
|--------|------------------|----------------------|
| **Service** | `SERVICE` | Booking base / selected services total |
| **E-commerce** | `ECOMMERCE` | Cart line subtotal |

---

## Target unified resolver (Phase 4 — not implemented)

All rows below converge on the same pipeline. Production today **does not** call this yet.

```
HTTP handler / domain service
        ↓
build DiscountContext (domain, trigger, owner, amount, items, couponCode, metadata)
        ↓
UnifiedDiscountResolver.resolve(context)
        ├─ Load candidates     (promotion/coupon repository by source + domain)
        ├─ RuleEngine          (Phase 3 — replaces legacy eligibility)
        ├─ PriorityEngine      (Phase 4+ — spotlight, best-value selection)
        ├─ StackEngine         (Phase 4+ — vendor → platform sequential stack on service)
        ├─ BenefitCalculator   (Phase 2 — %, flat, BOGO, bundle, combo, loyalty)
        └─ UsageTracker        (Phase 4+ — record after commit; dry-run for preview)
        ↓
DiscountEngineResult (eligible, applied[], amounts, metadata for settlement)
        ↓
[Shadow compare vs legacy during migration — same pattern as Phase 2/3]
        ↓
Return legacy or resolver result per feature flag
```

**Registry entry point (today):** `getDiscountEngineRegistry().calculator` → `CompositeDiscountCalculator` (service + ecommerce legacy adapters only). Phase 4 adds `UnifiedDiscountResolver` and wires `eligibilityEngine` + `usageTracker` slots already defined in `discount-engine/di/`.

---

## Resolver matrix

Legend:

- **Shadow** = Phase 3 rule engine runs in parallel; legacy still wins  
- **Gap** = behaviour incomplete or split across endpoints; Phase 4 must explicitly preserve or fix  
- **Target** = `UnifiedDiscountResolver` sub-path shorthand  

| ID | Source | Trigger | Domain | Entry points (request origin) | Current validation path | Current benefit path | Current usage path | Target unified resolver path |
|----|--------|---------|--------|------------------------------|-------------------------|----------------------|--------------------|------------------------------|
| **S1** | Vendor Promotion | Auto | Service | `POST /promotions/calculate-booking`; `POST /customer/pricing/quote`; `GET /promotions/applicable` (with `vendorId`); booking create (`resolveBookingPromotions` validation) | `booking-promotion-service.loadVendorServicePromotions` → `isServicePromotionEligible` (+ Phase 3 shadow) → filter `autoApplyEligible` (`!code`) | `evaluateServicePromotionDiscount` → combo/loyalty/standard → `computeService*DiscountAmount` benefit adapters (Phase 2 shadow) → `calculateBestBookingPromotion` picks max | After payment: `razorpay` webhook → `recordBookingPromotionUsageFromBooking` → `recordServicePromotionUsage` (`vendor_service_promotions.usage_count`, `promotion_usages`) | `resolve(SERVICE, AUTO, VENDOR)` → rules:service → benefits:service → priority:best → stack:n/a |
| **S2** | Platform Promotion | Auto | Service | Same as S1 (platform leg of stack); `listApplicableBookingPromotions` platform offers | `loadPlatformPromotions` → `platformPromoMatchesContext` (+ Phase 3 shadow) → UTC dates, published, category/style/service targeting | `calculatePlatformDiscount` on **post-vendor** amount → `computePlatformPromotionDiscountAmount` | Same webhook path → `recordPlatformPromotionUsage` (`promotions.usage_count`, `promotion_usages` type `platform`) | `resolve(SERVICE, AUTO, PLATFORM)` → rules:platform → benefits:platform → stack:after(vendor) |
| **S3** | Vendor Promotion | Code | Service | `POST /promotions/validate-code` (`orderType` ≠ product); vendor app promo CRUD | **Inline** in `vendor-promotions.ts`: DB by `code`, `min_booking_value`, `usage_limit` — **does not** call `isServicePromotionEligible` / full engine | **Inline** %/fixed in validate-code — **does not** use `evaluateServicePromotionDiscount` or benefit adapters | `POST /promotions/apply-vendor` increments `vendor_service_promotions.usage_count` + `promotion_usages` (client-driven; not always called from booking) | `resolve(SERVICE, CODE, VENDOR)` → rules:service + CodeRequired → benefits:service → **must match S1 math** |
| **S4** | Platform Promotion | Code | Service | `POST /promotions/validate-code` (promotions table branch); `POST /promotions/apply` (legacy) | Inline: `promotions` by `code`, active, published, dates, `min_order_amount` | Inline %/fixed + cap — **not** `calculatePlatformDiscount` / benefit adapter | `POST /promotions/apply` (promotions.ts) — usage unclear / inconsistent with booking stack | `resolve(SERVICE, CODE, PLATFORM)` → rules:platform_inline + CodeRequired → benefits:platform |
| **S5** | Platform Coupon | Code | Service | `GET /coupons/validate/:code`; `POST /coupons/apply`; booking stores `coupon_code` on row | `validateCouponInternal`: `coupons` select, UTC dates, min order, `coupon_usages` count (+ Phase 3 shadow) | `computeCouponDiscountAmount` (Phase 2 benefit adapter) | `POST /coupons/apply` → `insert coupon_usages`; booking create **does not** validate coupon against amount | **Gap:** `resolveBookingPromotions` ignores `couponCode`. Target: `resolve(SERVICE, CODE, COUPON)` → rules:coupon → benefits:coupon → stack:policy(TBD) |
| **S6** | Vendor Coupon | Code | Service | Same as S3 (coded row in `vendor_service_promotions`) | Same as S3 | Same as S3 | Same as S3 | Same as S3 — `DiscountTrigger.CODE` + `owner:VENDOR`; entity loader maps `code` row |
| **E1** | Vendor Promotion | Auto | E-commerce | `POST /promotions/calculate-cart`; ecommerce `POST` order create (auto branch); `POST /ads-recommendations` calculate-cart | `vendor_promotions` query → `isPromotionEligible` (+ shadow) → `evaluatePromotionDiscount` (+ shadow) → `autoApplyEligible` filter | `calculateBestCartPromotion` (no `manualCode`) → standard/BOGO/bundle → vendor benefit adapters | Order create → `recordVendorPromotionUsage` (`vendor_promotions.usage_count`, `promotion_usages` type `product`) | `resolve(ECOMMERCE, AUTO, VENDOR)` → rules:product → benefits:product → priority:best |
| **E2** | Vendor Promotion | Code | E-commerce | Order create with `couponCode`; `POST /promotions/validate-code` (product); calculate-cart with `manualCode` | `calculateBestCartPromotion` with `manualCode` OR `evaluatePromotionDiscount` + `isPromotionEligible` (+ shadows) | Same engine path; code must match `promo.code` | Same as E1 (`recordVendorPromotionUsage`) | `resolve(ECOMMERCE, CODE, VENDOR)` → rules + CodeRequired → benefits:product |
| **E3** | Vendor Coupon | Code | E-commerce | Same as E2 — `couponCode` in checkout maps to **vendor promo code**, not `coupons` table | Same as E2 | Same as E2 | Same as E2 | Same as E2 — document alias: customer “coupon” = vendor coded promo |
| **E4** | Platform Promotion | Auto | E-commerce | `GET /promotions/applicable` **without** `vendorId` (listing only) | Inline `isPromotionEligible` in `promotions.ts` (+ shadow) — display filter, **not** applied at checkout | **Not applied** on ecommerce order create today | **None** on shop orders | **Gap / product decision:** `resolve(ECOMMERCE, AUTO, PLATFORM)` or explicitly out-of-scope |
| **E5** | Platform Promotion | Code | E-commerce | `POST /promotions/validate-code` platform branch; `POST /promotions/apply` | Inline validation on `promotions` / `platform_promotions` | Inline %/fixed in handler | `POST /promotions/apply` — generic, not wired to shop order flow | `resolve(ECOMMERCE, CODE, PLATFORM)` → rules:platform_inline → benefits:platform |
| **E6** | Platform Coupon | Code | E-commerce | `GET/POST /coupons/*` (generic); **not** wired in `ecommerce/orders` | `validateCouponInternal` (+ shadow) | `computeCouponDiscountAmount` | `POST /coupons/apply` → `coupon_usages` | **Gap:** shop checkout does not call coupon table. Target: `resolve(ECOMMERCE, CODE, COUPON)` |

---

## Stack & priority (service domain only)

| Concern | Current implementation | Target resolver component |
|---------|------------------------|---------------------------|
| Vendor then platform order | `calculateBookingPromotionsStack`: vendor discount on original; platform on `current` after vendor | `StackEngine.applySequential([VENDOR, PLATFORM])` |
| Best vendor promo | `calculateBestBookingPromotion`: max `discountAmount` among auto-eligible | `PriorityEngine.selectBest(candidates, 'max_discount')` |
| Best platform promo | Spotlight first, then max discount | `PriorityEngine` with `is_spotlight` weight |
| E-commerce best promo | Max of auto vs code path in order create; calculate-cart picks best auto or manual match | `PriorityEngine` + explicit `trigger` branch |
| Coupon + promotion stack | **Not composed** — booking stores `coupon_code` but stack ignores it | Phase 4 policy required (exclusive vs stack) |

---

## Endpoint → matrix row index

| Endpoint / function | Rows |
|---------------------|------|
| `resolveBookingPromotions` | S1, S2 |
| `listApplicableBookingPromotions` | S1, S2 (preview) |
| `discountCalculationService.calculateDiscounts` | S1, S2 (wrapper) |
| `POST /promotions/calculate-booking` | S1, S2 |
| `POST /customer/pricing/quote` | S1, S2 |
| Booking create promotion validation | S1, S2 |
| `POST /promotions/validate-code` | S3, S4, E2, E5 (+ E3 alias) |
| `GET/POST /coupons/*` | S5, E6 |
| `POST /promotions/apply` (promotions.ts) | S4, E5 (legacy) |
| `POST /promotions/apply-vendor` | S3, E1/E2 (manual usage bump) |
| `calculateBestCartPromotion` / order create | E1, E2, E3 |
| `POST /promotions/calculate-cart` | E1, E2 |
| `GET /promotions/applicable` (no vendor) | E4 (list only) |

---

## Phase 3 / Phase 2 alignment (already in place)

| Layer | Module | Shadow? | Used in matrix rows |
|-------|--------|---------|---------------------|
| Eligibility | `discount-engine/rules` | Yes — legacy wins | All rows (partial for inline handlers) |
| Benefit math | `discount-engine/benefits` | Yes — legacy wins | S1, S2, E1, E2, S5, E6 where adapter wired |
| **Not wired** | Inline validate-code / promotions apply | No shadow | S3, S4, E5 — **Phase 4 must route through resolver** |

---

## Migration checklist (per row)

Use this when implementing Phase 4. Do not mark a row **done** until all columns match legacy in shadow mode.

- [ ] **S1** — Service vendor auto: resolver + stack vendor leg  
- [ ] **S2** — Service platform auto: resolver + stack platform leg on reduced base  
- [ ] **S3/S6** — Service vendor code: replace inline validate-code with resolver; unify benefit math with S1  
- [ ] **S4** — Service platform promo code: replace inline calc; define usage recording  
- [ ] **S5** — Service platform coupon: wire `couponCode` into booking resolve; define stack policy vs S1/S2  
- [ ] **E1** — E-commerce vendor auto  
- [ ] **E2/E3** — E-commerce vendor code (coupon alias)  
- [ ] **E4** — Decide: platform auto on shop cart in or out of scope  
- [ ] **E5** — E-commerce platform promo code  
- [ ] **E6** — E-commerce platform coupon: wire shop checkout to `coupons` table or deprecate  
- [ ] **Usage** — Single `UsageTracker` implementing `recordVendorPromotionUsage`, `recordServicePromotionUsage`, `recordPlatformPromotionUsage`, `coupon_usages`  
- [ ] **Legacy tables** — `platform_promotions` compatibility or migration  
- [ ] **Feature flag** — Per-row or per-domain cutover after shadow parity  

---

## Known gaps to resolve in design review

1. **Platform coupon on bookings (S5):** `coupon_code` persisted on `bookings` but `resolveBookingPromotions` never applies `coupons` table discounts.  
2. **Platform coupon on shop (E6):** Checkout `couponCode` only searches `vendor_promotions`, not `coupons`.  
3. **Validate-code service path (S3):** Simplified math bypasses `evaluateServicePromotionDiscount` (combo/loyalty/style rules may diverge).  
4. **Platform auto on ecommerce (E4):** Listed in applicable API but not deducted at order create.  
5. **`discountCalculationService.couponCode`:** Parameter exists but is **unused** — dead API surface.  
6. **Duplicate platform entities:** `promotions`, `coupons`, `platform_promotions` — resolver needs a **candidate loader** that normalizes to `DiscountContext.metadata.candidate`.  
7. **Zero-discount edge:** Benefit ≤ 0 returns null in legacy engines but rules may pass — document in stack/priority layer.  

---

## Suggested `DiscountContext` mapping (Phase 4)

| Matrix row | `domain` | `trigger` | `owner` | `couponCode` | `metadata` hints |
|------------|----------|-----------|---------|--------------|------------------|
| S1, E1 | SERVICE / ECOMMERCE | AUTO | VENDOR | — | `evaluationMode: full`, `priorVendor*Count` |
| S2 | SERVICE | AUTO | PLATFORM | — | `platformRow`, post-vendor `amount` |
| S3, S6, E2, E3 | * | CODE | VENDOR | code | `manualPromotionId` optional |
| S4, E5 | * | CODE | PLATFORM | code | `promotions` row |
| S5, E6 | * | CODE | PLATFORM | code | `coupons` row, `couponUsageCount` |
| S1–S2 stack | SERVICE | AUTO | MULTI | — | `stackPolicy: vendor_then_platform` |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | Initial resolver matrix for Phase 4 design review |

**Next step:** Review gaps (especially S5, E6, S3 inline divergence) and sign off stack policy for coupon + promotion before implementing `UnifiedDiscountResolver`.
