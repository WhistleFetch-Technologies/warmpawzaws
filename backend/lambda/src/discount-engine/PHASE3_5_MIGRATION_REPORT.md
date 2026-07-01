# Discount Engine V2 — Phase 3.5 Migration Report

**Status: Phase 3.5 COMPLETE (candidate foundation only)**

Phase 3.5 introduces the **DiscountCandidate** canonical model and decouples Rule / Benefit engines from database-specific row types. **No production endpoints, APIs, or business behaviour were changed.**

---

## Candidate Model

### Why it exists

Discounts today originate from four tables (`promotions`, `vendor_promotions`, `vendor_service_promotions`, `coupons`) with different column names and semantics. Phase 4’s Unified Resolver needs a single in-memory shape so:

- **Rule Engine** evaluates eligibility without knowing the source table  
- **Benefit Engine** calculates discounts without `PromotionRow` / coupon row types  
- **Priority / Stack / Settlement** (Phases 5–6) operate on one contract  

`DiscountCandidate` is that shape. `originalEntity` retains the raw row for audit, shadow comparison, and settlement.

### Core type

Path: `discount-engine/candidates/types.ts`

| Property | Purpose |
|----------|---------|
| `id`, `name`, `code` | Identity |
| `source` | `DiscountSource` — which loader produced the row |
| `owner` | `PLATFORM` \| `VENDOR` |
| `domain` | `SERVICE` \| `ECOMMERCE` |
| `trigger` | `AUTO` \| `CODE` |
| `status` | `DiscountStatus` (from `is_active`) |
| `priority`, `stackable`, `exclusive` | Future priority/stack (optional today) |
| `rules` | Eligibility / targeting payload |
| `benefits` | Calculation payload |
| `startDate`, `endDate`, `usage` | Lifecycle |
| `funding`, `createdBy`, `metadata` | Settlement / admin |
| `originalEntity` | Full DB row |

---

## Entity Mapping

### `promotions` → `DiscountCandidate`

| DB column | DiscountCandidate property | Notes |
|-----------|---------------------------|-------|
| `id` | `id` | |
| `name` / `title` | `name` | |
| `code` | `code` | Empty → `trigger: AUTO` |
| — | `source` | `PLATFORM_PROMOTION` |
| — | `owner` | `PLATFORM` |
| — | `domain` | `SERVICE` |
| `code` present | `trigger` | `CODE` or `AUTO` |
| `is_active` | `status` | `ACTIVE` / `PAUSED` |
| `priority` | `priority` | |
| `published` | `rules.published` | |
| `applicable_services` | `rules.applicableServices` | Parsed JSON array |
| `service_category` / `target_category` | `rules.rowServiceCategory` | |
| `service_style` / `target_service_style` | `rules.rowServiceStyle` | |
| `min_order_amount` | `rules.minOrderValue`, `benefits.minOrderAmount` | |
| `promotion_type` | `benefits.type` | |
| `discount_type` | `benefits.discountType` | `percentage` \| `fixed` |
| `discount_value` | `benefits.value` | |
| `max_discount_amount` | `benefits.maxDiscount` | |
| `start_date` | `startDate` | |
| `end_date` | `endDate` | |
| `usage_limit` / `usage_count` | `usage.limit` / `usage.count` | |
| `is_spotlight` | `metadata.isSpotlight` | |
| `description` | `metadata.description` | |
| *(full row)* | `originalEntity` | |
| `stackable` | `stackable` | **Unmapped in DB today** — optional |
| `exclusive` | `exclusive` | **Unmapped in DB today** — optional |
| `created_by` | `createdBy` | **Often unmapped** — optional |

### `vendor_promotions` → `DiscountCandidate`

| DB column | DiscountCandidate property | Notes |
|-----------|---------------------------|-------|
| `id` | `id` | |
| `name` | `name` | |
| `code` | `code` | Non-empty → `VENDOR_COUPON` + `CODE` |
| — | `source` | `VENDOR_PROMOTION` or `VENDOR_COUPON` |
| — | `owner` | `VENDOR` |
| — | `domain` | `ECOMMERCE` |
| `vendor_id` | `rules.vendorId` | |
| `target_audience` | `rules.targetAudience` | |
| `applicable_products` | `rules.applicableProducts` | JSONB array |
| `applicable_categories` | `rules.applicableCategories` | JSONB array |
| `min_order_value` | `rules.minOrderValue` | |
| `promotion_type` | `benefits.type` | flash_sale, category_discount, buy_x_get_y, bundle, first_order |
| `discount_type` | `benefits.discountType` | |
| `discount_value` | `benefits.value` | |
| `max_discount_amount` | `benefits.maxDiscount` | |
| `buy_quantity` | `benefits.buyQuantity` | BOGO |
| `get_quantity` | `benefits.getQuantity` | BOGO |
| `get_discount_percent` | `benefits.getDiscountPercent` | BOGO |
| `bundle_products` | `benefits.bundleProductIds` | |
| `bundle_discount` | `benefits.bundleDiscountPercent` | |
| `start_date` / `end_date` | `startDate` / `endDate` | IST in production |
| `usage_limit` / `usage_count` | `usage.limit` / `usage.count` | |
| `description` | *(not mapped)* | **Unmapped** — remains in `originalEntity` only |
| `conversions`, `revenue_generated`, `views` | *(not mapped)* | **Analytics — unmapped** |
| *(full row)* | `originalEntity` | |

### `vendor_service_promotions` → `DiscountCandidate`

| DB column | DiscountCandidate property | Notes |
|-----------|---------------------------|-------|
| `id` | `id` | |
| `name` | `name` | |
| `code` | `code` | Non-empty → `VENDOR_COUPON` |
| — | `source` | `VENDOR_PROMOTION` or `VENDOR_COUPON` |
| — | `domain` | `SERVICE` |
| `vendor_id` | `rules.vendorId` | |
| `target_audience` | `rules.targetAudience` | |
| `applicable_services` | `rules.applicableServices` | |
| `applicable_service_styles` | `rules.applicableServiceStyles` | |
| `min_booking_value` | `rules.minBookingValue` | |
| `promotion_type` | `benefits.type` | combo, loyalty, first_booking, flash_sale, … |
| `discount_type` | `benefits.discountType` | |
| `discount_value` | `benefits.value` | |
| `max_discount_amount` | `benefits.maxDiscount` | |
| `combo_services` | `benefits.comboServiceIds` | |
| `combo_discount` | `benefits.comboDiscountPercent` | |
| `visits_required` | `benefits.visitsRequired` | Loyalty |
| `loyalty_discount` | `benefits.loyaltyDiscountPercent` | |
| `start_date` / `end_date` | `startDate` / `endDate` | |
| `usage_limit` / `usage_count` | `usage.limit` / `usage.count` | |
| `description` | *(not mapped)* | **Unmapped** |
| *(full row)* | `originalEntity` | |

### `coupons` → `DiscountCandidate`

| DB column | DiscountCandidate property | Notes |
|-----------|---------------------------|-------|
| `id` | `id` | |
| `code` | `code` | |
| `name` | `name` | |
| — | `source` | `PLATFORM_COUPON` |
| — | `owner` | `PLATFORM` |
| — | `domain` | `ECOMMERCE` (table is cross-used for bookings — Phase 4 policy) |
| — | `trigger` | Always `CODE` |
| `is_active` | `status` | |
| `min_order_amount` | `rules.minOrderValue`, `benefits.minOrderAmount` | |
| `discount_type` | `benefits.discountType` | |
| `discount_value` | `benefits.value` | |
| `max_discount_amount` | `benefits.maxDiscount` | |
| `max_uses` | `usage.limit` | Count supplied at runtime from `coupon_usages` |
| `start_date` / `end_date` | `startDate` / `endDate` | UTC in production |
| `created_by` | `createdBy` | |
| `description` | `metadata.description` | |
| *(full row)* | `originalEntity` | |
| `customer_id`, `vendor_id` scoping | *(not mapped)* | **Unmapped** — if columns exist, Phase 4 loader |

### Legacy table not yet normalized

| Table | Status |
|-------|--------|
| `platform_promotions` | **Not mapped** — used only by `POST /promotions/apply`; Phase 4 loader or deprecation required |

---

## Provider Architecture

Path: `discount-engine/candidates/providers/`

| Provider | Source | Loads from |
|----------|--------|------------|
| `PlatformPromotionCandidateProvider` | `PLATFORM_PROMOTION` | `promotions` |
| `VendorPromotionCandidateProvider` | `VENDOR_PROMOTION` | `vendor_promotions` |
| `VendorServicePromotionCandidateProvider` | `VENDOR_PROMOTION` | `vendor_service_promotions` |
| `CouponCandidateProvider` | `PLATFORM_COUPON` | `coupons` |

**Responsibilities**

- Load raw rows only (SQL or `preloadedRows` for tests)  
- **No** eligibility, benefit math, or normalization  

**Normalizer** (`CandidateNormalizer`) converts raw → `DiscountCandidate`.

**Bridges**

- `candidateToRuleContext` → Rule Engine  
- `candidateToBenefitContext` / `computeBenefitFromCandidate` → Benefit Engine  

**Internal refactors (discount-engine only)**

- `rules/adapters/context-mappers.ts` — row → normalizer → bridge  
- `benefits/adapters/*` — runtime params → `buildRuntimeBenefitCandidate` → `computeBenefitFromCandidate`  

Production legacy engines (`vendor-promotion-engine.ts`, etc.) are **unchanged**.

---

## Future Resolver Architecture

```
DiscountContext
        ↓
Candidate Providers (parallel load)
        ↓
CandidateNormalizer
        ↓
DiscountCandidate[]
        ↓
RuleEngine.evaluateCandidateEligibility (per candidate)
        ↓
BenefitCalculator.computeBenefitFromCandidate (per eligible)
        ↓
PriorityEngine          [Phase 5]
        ↓
StackEngine             [Phase 5]
        ↓
SettlementEngine        [Phase 6]
        ↓
ResolverResult
```

**Interfaces only (Phase 3.5):** `UnifiedDiscountResolver`, `CandidateRepository`, `ResolverResult` in `candidates/resolver/types.ts`.

---

## New Enums

`DiscountSource` (`enums/discount-source.ts`):

- `PLATFORM_PROMOTION`, `VENDOR_PROMOTION`, `PLATFORM_COUPON`, `VENDOR_COUPON`  
- Reserved: `LOYALTY`, `REFERRAL`, `MEMBERSHIP`, `GIFT_CARD`  

Existing Phase 1 enums reused: `DiscountOwner`, `DiscountTrigger`, `DiscountDomain`, `DiscountStatus`, `DiscountFunding`.

---

## Verification

| Check | Result |
|-------|--------|
| `candidates/__tests__/candidate-normalizer.test.ts` | All promotion types + coupon normalization |
| Rule tests via `evaluateCandidateEligibility` | Parity with bridged `RuleContext` |
| Phase 1–3 tests | Must still pass |
| Production handlers | **Not modified** |
| APIs / DB | **Not modified** |

```bash
cd backend/lambda && npm test -- --testPathPattern=discount-engine
cd backend/lambda && npm run build
```

---

## Known Limitations

1. **No Unified Resolver implementation** — interfaces only; orchestration is Phase 4.  
2. **Providers not wired to HTTP handlers** — load helpers exist for Phase 4 / tests via `preloadedRows`.  
3. **`platform_promotions` table** — not normalized; see RESOLVER_MATRIX.md.  
4. **Coupon domain** — `coupons` normalized as `ECOMMERCE`; booking coupon flows need Phase 4 stack policy.  
5. **Runtime benefit candidates** — legacy adapters without full rows use `buildRuntimeBenefitCandidate` (synthetic id `runtime`); full row path uses normalizer.  
6. **Analytics columns** (`views`, `conversions`, `revenue_generated`) — not on `DiscountCandidate`; remain in `originalEntity`.  
7. **Production behaviour identical** — all changes are inside `discount-engine/` module boundaries.

---

**Phase 3.5 = COMPLETE** — Ready for Phase 4 Unified Resolver implementation per `RESOLVER_MATRIX.md`.
