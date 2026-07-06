# Policy Center — Business Rules Implementation

Discount Engine V2 Policy Center enhancement: business-friendly **Discount Application Strategy**, **Winning Offer Strategy**, **Offer Combination Rules**, simulator, and validation — without modifying Promotion CRUD, Coupon CRUD, Campaign Builder, Settlement, or Analytics.

---

## Architecture

```
Policy Center UI (admin-web)
  businessRules (BusinessRulesConfiguration)
       │
       ▼ syncBusinessRulesToEngine()
  stack / priority / limits (existing engine config)
       │
       ▼ unchanged engines
  PriorityEngine + StackEngine + PolicyValidationEngine
```

Business rules are a **presentation and mapping layer**. Engine behaviour is driven by existing `StackPolicyConfiguration`, `PriorityConfiguration`, and `LimitConfiguration` — never hardcoded offer names in engine code.

Configurable **offer types** (`offerTypes[]`) future-proof the UI for campaign offers, flash sales, loyalty, referral, and membership without redesign.

---

## Business Rules

### Discount Application Strategy (Stack tab)

| UI option | Engine effect |
|-----------|---------------|
| **Apply Best Offer Only** (default) | `maxTotalDiscounts = 1`, phase `maxSelected = 1`, stack combinations blocked, matrix read-only |
| **Stack Eligible Offers** | Matrix toggles drive `allowPlatformWithVendor`, `allowCouponWithPromotion`, `allowMultipleCoupons`, `stackRules` |
| **Custom Rules** | Advanced stack flags exposed; for power users |

Helper text: *"When enabled, only one eligible promotion or coupon will be applied to a transaction."*

### Winning Offer Strategy (Priority tab)

Shown only when **Apply Best Offer Only** is active.

| UI option | Maps to `PriorityConfiguration.global.strategy` |
|-----------|--------------------------------------------------|
| Maximum Customer Savings (default) | `MAX_CUSTOMER_SAVINGS` |
| Highest Priority | `FIXED_PRIORITY_WEIGHT` |
| Lowest Platform Cost | `LOWEST_PLATFORM_COST` |
| Vendor Preferred | `VENDOR_SPOTLIGHT_FIRST` |
| Custom Priority | `ADMIN_MANUAL_ORDER` + `manualOrder` |

### Custom Priority

Drag-and-drop (HTML5 + arrow buttons) reordering of configurable offer types. Persisted in `businessRules.customPriorityOrder` and synced to `priority.global.manualOrder` / `stack.global.stackOrder`.

### Offer Combination Rules (Rule Matrix)

Six unique pairs from four default offer types:

- Vendor Promotion + Platform Promotion  
- Vendor Promotion + Vendor Coupon  
- Vendor Promotion + Platform Coupon  
- Platform Promotion + Vendor Coupon  
- Platform Promotion + Platform Coupon  
- Vendor Coupon + Platform Coupon  

When **Apply Best Offer Only**: all combinations show *"Resolved by Winning Strategy"* (non-editable).

When **Stack Eligible Offers**: administrators enable/disable combinations.

---

## Simulator

Extended with:

- Service price  
- Per-offer toggles (Vendor/Platform promotion %, Vendor/Platform coupon fixed ₹)  
- Funding split preview (vendor vs platform)  
- Settlement preview placeholder  

**Default validation scenario** (₹1000 service price):

| Offer | Value | Savings |
|-------|-------|---------|
| Vendor Promotion | 25% | ₹250 |
| Platform Promotion | 20% | ₹200 |
| Vendor Coupon | ₹100 | ₹100 |
| Platform Coupon | ₹200 | ₹200 |

**Apply Best Offer Only + Maximum Customer Savings** → Vendor Promotion wins; all others ignored.

Local preview runs when `POST /admin/discount-policy/simulate` is unavailable.

---

## Validation

Client-side `validateBusinessRulesLocally()` (fallback when validate API unavailable):

- Missing winning strategy when Best Offer Only  
- Duplicate / empty custom priority order  
- Unknown offer types in priority order  
- Matrix consistency warnings for stack mode  
- Human-readable messages (no raw rule IDs in UI)

Backend `PolicyValidationEngine` unchanged; future endpoint can merge both result sets.

---

## Publish & Rollback

Unchanged workflow: Publish → new policy version + fingerprint. Rollback uses existing history mechanism. `businessRules` travels inside the published bundle alongside stack/priority config.

---

## Runtime Display

**Runtime Policy** tab shows:

- Current Discount Application Strategy  
- Current Winning Offer Strategy (when applicable)  
- Business rules version + stack/priority versions  
- Publish metadata and feature flags  

---

## Files Changed

### Admin web — Policy Center

| File | Change |
|------|--------|
| `lib/discount-policy/business-rules-types.ts` | Offer types, strategies, matrix types |
| `lib/discount-policy/business-rules-mapper.ts` | UI ↔ engine sync |
| `lib/discount-policy/business-rules-matrix.ts` | Combination pair builder |
| `lib/discount-policy/business-rules-validation.ts` | Local validation |
| `lib/discount-policy/policy-simulator-local.ts` | Local simulator |
| `lib/discount-policy/types.ts` | `businessRules` on bundle |
| `lib/discount-policy/default-config.ts` | Default business rules + v2 draft key |
| `lib/discount-policy/option-registry.ts` | Business tab labels + strategy options |
| `lib/discount-policy/discount-policy-api.ts` | Validate fallback |
| `lib/discount-policy/useDiscountPolicyDraft.ts` | Migrate drafts without businessRules |
| `components/.../StackConfigSection.tsx` | Discount Application + matrix |
| `components/.../PriorityConfigSection.tsx` | Winning Offer Strategy + custom order |
| `components/.../PolicySimulatorSection.tsx` | Extended inputs + results |
| `components/.../ValidationSection.tsx` | Human-readable findings |
| `components/.../RuntimePolicySection.tsx` | Active strategy display |
| `components/.../shared/CustomPriorityOrder.tsx` | Drag-and-drop order |
| `components/.../shared/OfferCombinationMatrix.tsx` | Rule matrix UI |
| `components/.../PolicyCenter.tsx` | Tab order + simulator draft prop |

### Backend (extend only)

| File | Change |
|------|--------|
| `discount-engine/config/business-rules-types.ts` | Shared business rules types |
| `discount-engine/policy/runtime-policy.ts` | Optional `businessRules` on runtime policy |

---

## Reuse Summary

| Component | Status |
|-----------|--------|
| Priority Engine | Reused — strategy keys mapped from winning strategy |
| Stack Engine | Reused — matrix → stack flags + stackRules |
| Policy Validation Engine | Reused — local validation supplements until API ships |
| Policy Center shell | Extended — no new routes |
| Promotion / Coupon CRUD | Untouched |
| Campaign / Settlement / Analytics | Untouched |

---

## Future Extensions

1. **New offer types** — append to `offerTypes[]`; matrix regenerates pairs automatically.  
2. **Backend simulate/validate endpoints** — wire to unified resolver; UI already passes full bundle.  
3. **Domain-scoped business rules** — extend `BusinessRulesConfiguration.domains` mirroring stack/priority domains.  
4. **Campaign / loyalty offers** — register new offer type keys without UI redesign.

---

## Manual Test Checklist

- [ ] Default: Best Offer Only + Maximum Customer Savings  
- [ ] Simulator: only Vendor Promotion wins on ₹1000 scenario  
- [ ] Switch winning strategy to Highest Priority / Custom Priority — winner changes  
- [ ] Switch to Stack Eligible Offers — enable VP+PP, run simulator — multiple applied  
- [ ] Validate draft — no blocking errors on default config  
- [ ] Runtime tab shows active strategies  
- [ ] Save draft locally (API pending banner) — reload preserves business rules  
