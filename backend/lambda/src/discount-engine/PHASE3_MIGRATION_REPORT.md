# Discount Engine V2 — Phase 3 Migration Report

**Status: Phase 3 COMPLETE (shadow mode)**

Phase 3 adds the **Rule Engine** for eligibility evaluation only. Production behaviour is unchanged: legacy eligibility functions remain authoritative; the Rule Engine runs in **shadow mode**, compares results, logs mismatches, and never alters API responses.

---

## New Components

| Area | Path | Purpose |
|------|------|---------|
| Types | `rules/types.ts` | `RuleContext`, `RuleResult`, `EligibilityResult`, `DiscountRule`, `RuleEngine`, `RuleRegistry`, `RuleGroup` |
| Core rules | `rules/definitions/core.rules.ts` | General, domain, and promotion structural rules |
| Extended rules | `rules/definitions/extended.rules.ts` | Order/booking count, customer, code-required |
| Registry | `rules/registry.ts` | Pluggable rule registration (no switch statements) |
| Engine | `rules/engine.ts` | `evaluate()` with **evaluate-all** default and optional **fail-fast** |
| Groups | `rules/groups.ts` | Group ordering: general → customer → domain → promotion |
| Shadow | `rules/shadow.ts` | Legacy vs Rule Engine comparison + structured logging |
| Context mappers | `rules/adapters/context-mappers.ts` | Legacy rows → `RuleContext` |
| Shadow adapters | `rules/adapters/shadow-adapters.ts` | Per-domain shadow entry points |
| Tests | `rules/__tests__/rule-engine.test.ts` | Rule, registry, engine, shadow coverage |

Exported from `discount-engine/index.ts` via `rules/index.ts`.

---

## Rule Catalog (Legacy → Rule Class)

Migration checklist from production eligibility to Rule Engine classes.

### Vendor product — `isPromotionEligible()` (`vendor-promotion-engine.ts`)

| Legacy check | Rule class | Notes |
|--------------|------------|-------|
| `!promo.is_active` | `ActiveRule` | |
| `!isPromotionLiveInIst(start, end)` | `DateRangeRule` (`DateRangeIstRule`) | IST bounds via `promotion-date-bounds` |
| Vendor mismatch | `VendorRule` | |
| `usage_count >= usage_limit` | `MaximumUsageRule` | |
| `target_audience === 'new_users'` / `first_order` + prior orders | `FirstOrderRule`, `AudienceRule`, `OrderCountRule` | Overlapping coverage for catalog completeness |
| `target_audience === 'returning_users'` + no prior orders | `AudienceRule`, `OrderCountRule` | |

### Vendor product — `evaluatePromotionDiscount()` (full pipeline, shadow)

| Legacy check | Rule class | Notes |
|--------------|------------|-------|
| `isPromotionEligible()` (above) | Base rules | Shadow on `isPromotionEligible` |
| `items.length === 0` | `ProductRule` (`CartItemsRule`) | Full mode only |
| `min_order_value` on cart subtotal | `MinimumAmountRule` | Full mode only |
| `promotionAppliesToLine()` / no applicable lines | `ProductRule` (`ProductScopeRule`) | |
| `category_discount` category lines | `CategoryRule` | |
| BOGO complete sets | `BOGORule` | Structural eligibility |
| Bundle all products in cart | `BundleRule` | |
| Coded promo without manual code | `CodeRequiredRule` | Cart best-promo path; optional in full shadow |

### Vendor service — `isServicePromotionEligible()` (`service-promotion-engine.ts`)

| Legacy check | Rule class | Notes |
|--------------|------------|-------|
| `!is_active` | `ActiveRule` | |
| IST date window | `DateRangeRule` (`DateRangeIstRule`) | |
| Vendor mismatch | `VendorRule` | |
| Usage limit | `MaximumUsageRule` | |
| New / first_booking audience | `FirstBookingRule`, `AudienceRule`, `BookingCountRule` | |
| Returning audience | `AudienceRule`, `BookingCountRule` | |
| `min_booking_value` | `MinimumAmountRule` (`MinimumBookingRule`) | |
| `applicable_service_styles` | `ServiceStyleRule` | Style normalization preserved |
| `applicable_services` | `ServiceRule` | |

### Vendor service — `evaluateServicePromotionDiscount()` (full pipeline, shadow)

| Legacy check | Rule class | Notes |
|--------------|------------|-------|
| Base eligibility (above) | Base rules | |
| Combo all `combo_services` selected | `ComboRule` | Full mode; `promotion_type === 'combo'` |
| Loyalty `visits_required` | `LoyaltyRule` | Full mode; `prior + 1 >= required` |

### Platform booking — `platformPromoMatchesContext()` (`booking-promotion-service.ts`)

| Legacy check | Rule class | Notes |
|--------------|------------|-------|
| UTC `start_date` / `end_date` | `DateRangeRule` (`DateRangeUtcRule`) | |
| `published === false` | `PublishedRule` | |
| `min_order_amount` vs amount | `MinimumAmountRule` | Amount > 0 guard preserved |
| `service_category` / `target_category` | `PlatformRule` (`PlatformMatchRule`) | Composite match |
| `service_style` / style tokens in `applicable_services` | `PlatformRule` | |
| Service IDs in `applicable_services` | `PlatformRule` | |

### Platform inline — `isPromotionEligible()` (`promotions.ts`)

| Legacy check | Rule class | Notes |
|--------------|------------|-------|
| UTC start / end | `DateRangeRule` (`DateRangeUtcRule`) | |
| `min_order_amount` | `MinimumAmountRule` | |
| Category in `applicable_services` | `CategoryRule` (`PlatformInlineCategoryRule`) | |
| Style tokens `style:*` | `ServiceStyleRule` (`PlatformInlineStyleRule`) | |
| UUID service IDs | `ServiceRule` (`PlatformInlineServiceRule`) | |

### Coupon — `validateCouponInternal()` (`promotions.ts`)

| Legacy check | Rule class | Notes |
|--------------|------------|-------|
| `is_active` (via DB select) | `ActiveRule` | Coupon row passed after select |
| UTC validity window | `DateRangeRule` (`DateRangeUtcRule`) | |
| `min_order_amount` | `MinimumAmountRule` | |
| `max_uses` vs `coupon_usages` count | `MaximumUsageRule` (`CouponMaxUsesRule`) | Usage count supplied from legacy query |
| Invalid / unknown code | — | **Not mapped** — fails before Rule Engine runs (no row) |

### Line-level helpers (not standalone eligibility gates)

| Legacy function | Rule class | Notes |
|-----------------|------------|-------|
| `promotionAppliesToLine()` | `ProductRule`, `CategoryRule` | Folded into full product evaluation |
| `calculateStandard` discount `<= 0` | — | **Benefit Engine (Phase 2)** — not an eligibility rule |
| `calculateStandardService` discount `<= 0` | — | **Benefit Engine** — shadow may report mismatch; documented limitation |

### Rules with no distinct legacy gate

| Rule class | Status |
|------------|--------|
| `CustomerRule` | Legacy does not enforce `customerId` on eligibility; rule records context for future admin preview |
| `CodeRequiredRule` | Only applies when coded promo evaluated in full cart context with `manualCode` |

---

## Shadow Mode

```
Legacy eligibility / discount-null check
        ↓
Map to RuleContext (domain adapter)
        ↓
Rule Engine evaluate()  [evaluate-all by default]
        ↓
Compare legacyEligible vs ruleEngine.eligible
        ↓
If mismatch → console.warn('[rule-engine] shadow eligibility mismatch …')
        ↓
Always return legacy result
```

### Wired shadow entry points

| Location | Shadow helper | Mode |
|----------|---------------|------|
| `vendor-promotion-engine.ts` → `isPromotionEligible` | `shadowVendorProductBaseEligibility` | base |
| `vendor-promotion-engine.ts` → `evaluatePromotionDiscount` | `shadowVendorProductFullEligibility` | full |
| `service-promotion-engine.ts` → `isServicePromotionEligible` | `shadowVendorServiceBaseEligibility` | base |
| `service-promotion-engine.ts` → `evaluateServicePromotionDiscount` | `shadowVendorServiceFullEligibility` | full |
| `booking-promotion-service.ts` → platform filter | `shadowPlatformPromoEligibility` | base |
| `promotions.ts` → inline `isPromotionEligible` | `shadowPlatformInlineEligibility` | base |
| `promotions.ts` → `validateCouponInternal` | `shadowCouponEligibility` | base |

---

## Verification

### Tests

- `rules/__tests__/rule-engine.test.ts` — individual rules, registry, engine (fail-fast / evaluate-all), shadow comparison
- Existing Phase 1 + Phase 2 tests unchanged

### Build

```bash
cd backend/lambda && npm run build
cd backend/lambda && npm test -- --testPathPattern=discount-engine
```

### Behaviour comparison

- No API contract changes
- No database changes
- Legacy functions retained (`isPromotionEligible`, `isServicePromotionEligible`, `platformPromoMatchesContext`, inline platform eligibility, `validateCouponInternal`)

### Known limitations

1. **Zero discount amount** — Legacy returns `null` when computed discount ≤ 0; Rule Engine does not model benefit math (Phase 2 scope). Full shadow may log mismatches for edge promos with `discount_value: 0`.
2. **Invalid coupon code** — No coupon row → Rule Engine not invoked.
3. **Duplicate `ruleName` labels** — e.g. two `ProductRule` implementations (`CartItemsRule`, `ProductScopeRule`); engine tracks each evaluation separately; `failedRules` dedupes by display name.
4. **Code-required auto-apply** — Legacy cart “best promotion” skips coded promos without a separate eligibility function; `CodeRequiredRule` applies only when full product context includes `promotionCode` / `manualCode`.

---

## Next phase (out of scope for Phase 3)

- Feature flag to promote Rule Engine to production eligibility
- Priority / stack / unified resolver
- Settlement
- Admin preview UI consuming `RuleResult.metadata`

---

**Phase 3 = COMPLETE** — Rule catalog mapped, shadow mode active, legacy remains production source.
