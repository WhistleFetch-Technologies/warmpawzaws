# Policy Center V2 — Dynamic Discount Application & Unified Offer Resolution

## Overview

Policy Center V2 separates **Offer Discovery** (find eligible offers) from **Offer Resolution** (apply Policy Center rules to pick winners). All discount application behavior is driven by published Policy Center configuration — not hardcoded promotion-first or coupon-first logic.

## Architecture

```
Customer / Admin Request
        │
        ▼
┌───────────────────┐
│ Offer Discovery   │  DefaultCandidateRepository → providers (platform/vendor promo, coupons)
│ offer-discovery.ts│  RuleEngine + BenefitEngine per candidate
└─────────┬─────────┘
          │ eligible candidates + benefit amounts
          ▼
┌───────────────────┐
│ Offer Resolution  │  Read published policy (businessRules + engine config)
│ offer-resolution  │  BEST_OFFER_ONLY → unified pool, max 1
│                   │  PROMOTION_PLUS_COUPON → best promo + best coupon
│                   │  STACK_ELIGIBLE / FULLY_CONFIGURABLE → phases + StackEngine
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ SettlementEngine  │  Funding splits per offer type (preview)
└───────────────────┘
```

### Key backend files

| Area | Path |
|------|------|
| Discovery | `backend/lambda/src/discount-engine/resolver/offer-discovery.ts` |
| Resolution | `backend/lambda/src/discount-engine/resolver/offer-resolution.ts` |
| Unified resolver | `backend/lambda/src/discount-engine/resolver/unified-discount-resolver.ts` |
| Business rules mapper | `backend/lambda/src/discount-engine/config/business-rules-mapper.ts` |
| Policy persistence | `backend/lambda/src/discount-engine/policy/policy-persistence.ts` |
| Policy APIs | `backend/lambda/src/endpoints/discount-policy.endpoints.ts` |
| Migration | `db/migrations/1061_discount_policy_center_v2.sql` |

### Admin UI

| Area | Path |
|------|------|
| Option registry | `apps/admin-web/lib/discount-policy/option-registry.ts` |
| Mapper | `apps/admin-web/lib/discount-policy/business-rules-mapper.ts` |
| Policy Center shell | `apps/admin-web/components/admin/marketing/policyCenter/` |

## Discount Application Strategies

| Strategy | Behavior |
|----------|----------|
| **BEST_OFFER_ONLY** | Single winner from unified candidate pool (promos + coupons compared together). Combination matrix hidden. |
| **PROMOTION_PLUS_COUPON** | Best auto promotion + best coupon. Matrix auto-set: promo+coupon allowed; promo+promo and coupon+coupon blocked. |
| **STACK_ELIGIBLE** | Multiple offers per combination matrix. |
| **FULLY_CONFIGURABLE** | Admin edits matrix + advanced stack flags. |

## Winning Strategy

Renamed from "Winning Offer". Applies when **BEST_OFFER_ONLY** is selected.

| UI Key | Engine Strategy |
|--------|-----------------|
| HIGHEST_CUSTOMER_SAVINGS (default) | MAX_CUSTOMER_SAVINGS |
| HIGHEST_PRIORITY | FIXED_PRIORITY_WEIGHT |
| LOWEST_PLATFORM_COST | LOWEST_PLATFORM_COST |
| VENDOR_PREFERRED | VENDOR_SPOTLIGHT_FIRST |
| CUSTOM_RULE | ADMIN_MANUAL_ORDER |

Legacy keys `MAX_CUSTOMER_SAVINGS` and `CUSTOM_RULE` are normalized for backward compatibility.

## Combination Matrix

Six unique pairs among four offer types:

- Vendor Promotion + Platform Promotion
- Vendor Promotion + Vendor Coupon
- Vendor Promotion + Platform Coupon
- Platform Promotion + Vendor Coupon
- Platform Promotion + Platform Coupon
- Vendor Coupon + Platform Coupon

**PROMOTION_PLUS_COUPON** auto-enables all promo+coupon cross pairs and blocks promo+promo and coupon+coupon.

## Funding

Reuses existing `FundingConfiguration`:

- Per-offer-type funder metadata in `offerTypes` (VENDOR / PLATFORM / SHARED)
- Presets: 50/50, 70/30, 100% platform, 100% vendor
- Campaign funding hooks via existing settlement hints (Commercial Campaign Engine separate)

## Customer UX

| Surface | Behavior |
|---------|----------|
| Service detail / listing | Show **winning promotion only** (first/best from `calculate-booking`) |
| Booking summary | **Always** show coupon input (`CheckoutCouponPanel alwaysShow`) |
| Payment page | Policy-driven coupon messages: better promo blocks coupon; winning coupon updates offer |
| Coupons on detail | Never shown on service detail — coupons only at summary/payment |

## Phase 8 APIs

| Endpoint | Status |
|----------|--------|
| `PUT /admin/discount-policy/draft` | Implemented — RDS `discount_policy_draft` |
| `POST /admin/discount-policy/publish` | Implemented — `discount_policy_versions` |
| `POST /admin/discount-policy/rollback` | Implemented |
| `GET /admin/discount-policy/history` | Implemented |
| `GET /admin/discount-policy/audit` | Implemented |
| `POST /admin/discount-policy/validate` | Wired to `PolicyValidationEngine` |
| `POST /admin/discount-policy/simulate` | Server preview (simplified amounts) |

Capabilities endpoint returns all flags `true`. Admin UI "not enabled yet" banner removed when APIs respond.

## Default Config

- **BEST_OFFER_ONLY**
- **HIGHEST_CUSTOMER_SAVINGS**
- Limits: max 1 auto promo, max 1 coupon, max 1 total
- Funding: 50/50 shared default
- Validation, runtime, simulator, audit, history enabled

## How to Configure "Best Offer Only"

1. Open Admin → Promotion Center → Policy Center
2. **Discount Application** tab → select **Best Offer Only**
3. **Winning Strategy** tab → choose e.g. **Highest Customer Savings**
4. **Validation** → confirm no errors
5. **Publish** → saves to RDS; runtime engine reads on next request

## Testing

```bash
# Admin business rules unit tests
cd apps/admin-web && npm test -- lib/discount-policy/__tests__/business-rules.test.ts

# Backend build
cd backend/lambda && npm run build

# Migration (dev)
ENVIRONMENT=dev node scripts/run-migration-rds-node.js 1061_discount_policy_center_v2.sql
```

## Rollback

1. Policy Center → **History** tab
2. Select prior `publishId` → Rollback (or `POST /admin/discount-policy/rollback`)
3. Engine cache invalidated; previous bundle becomes active

## Known Limitations

- **Migration required** on dev/prod RDS before draft/publish/history/audit persist
- Cold Lambda may use in-code defaults until first DB warm (`loadPublishedPolicyFromDb`)
- Server simulator uses simplified discount math; full resolver dry-run in booking flow is authoritative
- `validate-code` HTTP path in `vendor-promotions.ts` not yet unified (separate from this sprint)
- Commercial campaigns remain outside unified candidate pool (Phase 10 module)
- Grooming booking router still lacks coupon panel (vet/universal have `alwaysShow`)
- Domain view in Policy Center is cosmetic (no per-domain publish yet)

## Deploy

```bash
cd backend/lambda && npm run build
./scripts/deploy-lambda-direct.sh
./scripts/deploy-admin-web.sh
./scripts/deploy-customer-web.sh
```
