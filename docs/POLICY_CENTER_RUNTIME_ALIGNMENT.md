# Policy Center Runtime Alignment

## Overview

This document describes the **runtime alignment** between Policy Center (published configuration), the Unified Discount Resolver, and all customer/admin surfaces. The frontend **never** decides promotion wins, coupon wins, stacking, or best-offer logic — it only renders resolver results.

```
Published Policy Center
        │
        ▼
Runtime Policy Loader (RDS + cache)
        │
        ▼
Unified Discount Resolver
  ├── Offer Discovery (candidates + eligibility + benefits)
  ├── Offer Resolution (policy-driven winners)
  ├── Stack Engine (when authoritative)
  └── Settlement Engine (preview)
        │
        ▼
Unified Resolver Response (single contract)
        │
        ├── Service listing / detail (promos only)
        ├── Booking summary (coupon input + apply → resolver)
        ├── Payment page (same quote + coupon)
        ├── Admin simulator
        └── Audit viewer (via policy APIs)
```

See also: [POLICY_CENTER_DYNAMIC_CONFIGURATION_IMPLEMENTATION.md](./POLICY_CENTER_DYNAMIC_CONFIGURATION_IMPLEMENTATION.md) for Policy Center V2 admin configuration.

---

## Responsibilities

| Layer | Responsibility | Must NOT do |
|-------|----------------|-------------|
| **Policy Center (Admin)** | Draft, validate, publish discount application strategy, winning strategy, combination matrix, funding, limits | Apply discounts at checkout |
| **Runtime Policy Loader** | Load published bundle; fingerprint; invalidate on publish/rollback | Pick offer winners |
| **Unified Resolver** | Discover candidates; resolve per policy; stack/settle when enabled | Render UI |
| **API (`calculate-booking`)** | Map resolver output → `UnifiedResolverResponse` | Hardcode BEST_OFFER_ONLY |
| **Customer Frontend** | Display applied/rejected offers, savings, messages | Compare promo vs coupon client-side |
| **Admin Simulator** | Call same `resolveOffers` path with synthetic offers | Separate simulation math (fallback only when API down) |

---

## Unified Resolver Response Contract

Shared shape (backend: `backend/lambda/src/discount-engine/resolver/unified-resolver-response.ts`, frontend: `apps/customer-web/lib/pricing/unified-resolver-response.ts`):

| Field | Description |
|-------|-------------|
| `currentPolicy` | Application strategy, winning strategy, fingerprint, engine modes |
| `appliedOffers` | Offers applied by resolver (ordered) |
| `rejectedOffers` | Offers rejected with `reason` / `reasonCode` |
| `savings` | `originalAmount`, `totalSavings`, `finalAmount`, vendor/platform/coupon splits |
| `funding` | Platform/vendor cost preview when settlement enabled |
| `displayMessages` | User-facing info/success/warning/error messages |
| `settlementPreview` | Settlement engine output |
| `resolverSource` | `v2` (authoritative resolver) or `legacy` (OFF/fallback) |

Legacy aliases retained for backward compatibility: `totalSavings`, `applied`, `bestPromotion`, `vendorPromotionId`, `platformPromotionId`.

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /promotions/calculate-booking` | **Primary customer quote** — promos only (`displayPromotionsOnly: true`) or full quote with optional `couponCode` |
| `GET /admin/discount-policy/runtime` | Published bundle (admin) |
| `GET /admin/discount-policy/runtime/diagnostics` | Read-only runtime: strategy, matrix, engine modes, fingerprint |
| `POST /admin/discount-policy/simulate` | Admin simulator — uses `resolveOffers` + settlement (same resolution path) |

### calculate-booking request

```json
{
  "vendorId": "uuid",
  "serviceIds": ["uuid"],
  "amount": 1500,
  "serviceStyle": "at_home",
  "serviceCategory": "grooming",
  "customerId": "uuid",
  "couponCode": "SAVE10",
  "displayPromotionsOnly": false
}
```

### Response (excerpt)

```json
{
  "success": true,
  "resolverSource": "v2",
  "currentPolicy": {
    "applicationStrategy": "BEST_OFFER_ONLY",
    "winningStrategy": "HIGHEST_CUSTOMER_SAVINGS",
    "policyFingerprint": "abc123"
  },
  "appliedOffers": [{ "id": "...", "name": "...", "discountAmount": 200, "trigger": "AUTO" }],
  "rejectedOffers": [{ "id": "...", "reason": "BEST_OFFER_ONLY: not highest-ranked" }],
  "savings": { "originalAmount": 1500, "totalSavings": 200, "finalAmount": 1300 },
  "displayMessages": [{ "type": "warning", "message": "..." }]
}
```

---

## Customer UX Flows

### Service detail / listing

1. `ServiceListingPrice` → `fetchBookingDiscountQuote({ displayPromotionsOnly: true })`
2. Shows **winning auto promotion only** (first AUTO offer from resolver)
3. No coupon input on service pages

### Booking summary

1. `ServiceBookingPromoSummary` — promos-only quote
2. `CheckoutCouponPanel` with **`alwaysShow`** — coupon field always visible
3. On Apply → `calculate-booking` with `couponCode` (not client-side promo/coupon comparison)

### Payment page

1. `UniversalPaymentPage` loads quote via unified API
2. Coupon apply/remove re-calls resolver with `bypassCache`
3. Renders `displayMessages` for rejected coupons
4. Price breakdown uses `savings.*` from resolver — **no `couponWinsBookingOffer`**

---

## Validation Scenarios

| # | Scenario | Expected resolver behavior | Frontend |
|---|----------|---------------------------|----------|
| 1 | Platform + vendor promo | Best promotion per policy | Show one winning promo on listing |
| 2 | Platform promo + platform coupon (BEST_OFFER_ONLY) | Promo wins; coupon rejected with reason | Show rejection message |
| 3 | Platform promo + vendor coupon | Coupon wins if higher savings | Payment shows coupon applied |
| 4 | Policy = PROMOTION_PLUS_COUPON | Both applied | Show both lines — no code change |
| 5 | Policy = HIGHEST_PRIORITY | Winner changes per priority config | Render new winner from API |

---

## Feature Flags & Legacy Support

| Env var | Values | Effect |
|---------|--------|--------|
| `DISCOUNT_ENGINE_V2_RESOLVER_MODE` | OFF / SHADOW / AUTHORITATIVE | OFF = legacy stack; AUTHORITATIVE = unified resolver |
| `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | OFF / SHADOW / AUTHORITATIVE | Policy-driven priority |
| `DISCOUNT_ENGINE_V2_STACK_MODE` | OFF / SHADOW / AUTHORITATIVE | Stack engine |
| `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` | OFF / SHADOW / AUTHORITATIVE | Settlement preview |

Legacy path retained: `resolveBookingPromotionsLegacy`, `collapseBookingPromotionToSingleWinner` (only when `BEST_OFFER_ONLY` or legacy source).

---

## Testing

```bash
# Backend build
cd backend/lambda && npm run build

# Customer web
cd apps/customer-web && npm run build

# Admin web + business rules tests
cd apps/admin-web && npm test -- lib/discount-policy/__tests__/business-rules.test.ts
cd apps/admin-web && npm run build

# Dev migration (if not applied)
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1061_discount_policy_center_v2.sql
```

Manual smoke test (dev API):

1. Service listing — verify promo badge matches `calculate-booking` with `displayPromotionsOnly: true`
2. Booking payment — apply coupon; verify rejected/applied messages match policy
3. Admin Policy Center → Simulator → Run — verify applied/rejected match policy strategy
4. Change policy to PROMOTION_PLUS_COUPON, publish, repeat without frontend deploy

---

## Rollback

1. **Policy rollback:** Admin → History → Rollback prior `publishId` (or `POST /admin/discount-policy/rollback`)
2. **Resolver rollback:** Set `DISCOUNT_ENGINE_V2_RESOLVER_MODE=OFF` on Lambda (legacy path)
3. **Frontend rollback:** Deploy previous customer-web build (API remains backward compatible via legacy fields)

---

## Known Limitations / Remaining Work

- **`validate-code` path** for non-booking flows still uses legacy coupon validation (not unified resolver)
- **Resolver authoritative mode** requires Lambda env `DISCOUNT_ENGINE_V2_RESOLVER_MODE=AUTHORITATIVE` on dev/prod
- **Commercial campaigns** remain outside unified candidate pool (Phase 10)
- **Grooming booking router** may still lack `alwaysShow` coupon panel (vet/universal have it)
- **Ecommerce cart** uses separate resolver wiring — not fully aligned in this sprint
- **Full DB discovery in simulator** — admin simulator uses synthetic offers through `resolveOffers`; live booking uses full discovery pipeline

---

## Key Files

| Area | Path |
|------|------|
| Unified response mapper | `backend/lambda/src/discount-engine/resolver/unified-resolver-response.ts` |
| Policy simulator | `backend/lambda/src/discount-engine/resolver/policy-simulator.ts` |
| Booking quote service | `backend/lambda/src/lib/services/booking-promotion-service.ts` |
| Customer quote API | `backend/lambda/src/endpoints/promotions.ts` |
| Admin simulate API | `backend/lambda/src/endpoints/discount-policy.endpoints.ts` |
| Customer types/helpers | `apps/customer-web/lib/pricing/unified-resolver-response.ts` |
| Customer quote client | `apps/customer-web/lib/service-booking-pricing.ts` |
| Payment page | `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx` |
| Runtime policy UI | `apps/admin-web/components/admin/marketing/policyCenter/sections/RuntimePolicySection.tsx` |
| Simulator UI | `apps/admin-web/components/admin/marketing/policyCenter/sections/PolicySimulatorSection.tsx` |
