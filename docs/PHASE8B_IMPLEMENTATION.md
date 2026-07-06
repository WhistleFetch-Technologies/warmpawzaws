# Phase 8B — Production Migration Implementation

**Date:** 2026-07-06  
**Scope:** Discount Engine V2 authoritative HTTP migration (legacy preserved)  
**Status:** Implemented locally — **not committed** per instruction

---

## 1. Executive summary

Phase 8B introduces **`DISCOUNT_ENGINE_V2_RESOLVER_MODE`** and extends **`production-bridge.ts`** so production pricing endpoints can return Unified Discount Resolver results when `AUTHORITATIVE`, while **every legacy engine, adapter, and route remains intact** for OFF, SHADOW, and fallback.

**Default:** `OFF` (legacy authoritative — unchanged production behaviour until flag is raised).

---

## 2. Architecture

### Before (Phase 8A)

```
HTTP → Legacy engines → return legacy amount
              ↓ (fire-and-forget)
         Unified Resolver (diagnostics only)
```

### After (Phase 8B)

```
HTTP → resolveWithProductionMode()
         ├─ OFF           → legacy only
         ├─ SHADOW        → legacy return + parallel V2 + diagnostics
         └─ AUTHORITATIVE → try V2 → map to legacy shape
                              └─ catch → legacy fallback (logged)
```

Legacy engines (`booking-promotion-service`, `service-promotion-engine`, `vendor-promotion-engine`) are **@deprecated** but **not deleted**.

---

## 3. Resolver mode

| Variable | Values | Default (code + Terraform) |
|----------|--------|----------------------------|
| `DISCOUNT_ENGINE_V2_RESOLVER_MODE` | `OFF` \| `SHADOW` \| `AUTHORITATIVE` | `OFF` |

**Module:** `backend/lambda/src/discount-engine/policy/resolver-mode.ts`

| Mode | HTTP response | V2 execution |
|------|---------------|--------------|
| OFF | Legacy | None (`invokeResolverAlongsideLegacy` also skipped) |
| SHADOW | Legacy | Parallel async + CloudWatch diagnostics |
| AUTHORITATIVE | V2 mapped to legacy DTO | Primary; legacy on failure |

---

## 4. Feature flags (Terraform)

Added to `infra/envs/dev/main.tf` and `infra/envs/prod/main.tf` under `common_env_vars`:

```hcl
DISCOUNT_ENGINE_V2_RESOLVER_MODE    = "OFF"
DISCOUNT_ENGINE_V2_PRIORITY_MODE    = "AUTHORITATIVE"
DISCOUNT_ENGINE_V2_STACK_MODE       = "OFF"
DISCOUNT_ENGINE_V2_SETTLEMENT_MODE  = "OFF"
DISCOUNT_ENGINE_V2_ANALYTICS_MODE   = "OFF"
DISCOUNT_ENGINE_V2_CAMPAIGN_MODE    = "OFF"
```

**Rollout recommendation:** dev `SHADOW` → dev `AUTHORITATIVE` → prod `SHADOW` → prod `AUTHORITATIVE` (see `PRODUCTION_CUTOVER_CHECKLIST.md`).

Admin UI reads flags via `GET /admin/analytics/discount-engine/mode` → `engineFlags` object.

---

## 5. Production bridge extension

**File:** `backend/lambda/src/discount-engine/resolver/production-bridge.ts`

| Function | Purpose |
|----------|---------|
| `runResolverPipeline()` | Unchanged low-level V2 entry |
| `invokeResolverAlongsideLegacy()` | Now **skips V2 when OFF** |
| `resolveWithProductionMode()` | **New** — OFF/SHADOW/AUTHORITATIVE switch + fallback |
| `logProductionFallback()` | Structured fallback logging |
| `logProductionResolution()` | V2 success logging |

Fallback never throws to HTTP — checkout always gets a numeric result.

---

## 6. Result mappers

**File:** `backend/lambda/src/discount-engine/resolver/resolver-result-mappers.ts`

Maps `ResolverResult` → legacy DTOs:

- `mapResolverResultToBookingPromotion` — S1/S2/S5
- `mapResolverResultToCartPromotion` — E1/E2/E6
- `mapResolverResultToCouponValidation` — S5/E6 coupons table
- `mapResolverResultToValidateCodeResponse` — S3/S4 validate-code
- `isResolverResultAuthoritativeUsable()` — guards fallback when priority pipeline failed

---

## 7. HTTP integration (no new routes)

| Endpoint / function | Change |
|---------------------|--------|
| `resolveBookingPromotions()` | `resolveWithProductionMode` + `couponCode` param (S5) |
| `POST /promotions/calculate-booking` | Passes `couponCode` |
| Booking create validation | Passes `couponCode` to resolver |
| `discount-calculation-service` | Forwards `couponCode`; maps coupon line |
| `validateCouponInternal` / `/coupons/*` | Delegates to `platform-coupon-service.ts` |
| `POST /promotions/validate-code` | Service + platform branches use resolver helpers (S3) |
| `calculateBestCartPromotionAsync()` | New async path for AUTHORITATIVE cart (E1/E2) |
| Ecommerce order create | Uses async cart + platform coupon fallback (E6) |

---

## 8. Matrix blockers closed

| ID | Fix |
|----|-----|
| **S3** | `evaluateServiceCodeViaProductionMode`, `evaluatePlatformCodeViaProductionMode` in validate-code |
| **S5** | `couponCode` on booking resolve; candidate repo loads coupons on SERVICE+code; legacy fallback via `platform-coupon-service` |
| **E6** | `calculateBestCartPromotionAsync` + `resolveEcommercePlatformCoupon` when vendor promo code misses `coupons` table |

**E4** (platform auto on shop) — unchanged; still listing-only by design.

---

## 9. Usage tracking

**File:** `backend/lambda/src/discount-engine/adapters/legacy-usage-tracker.ts`

- `LegacyUsageTracker` implements V2 `UsageTracker` contract
- Delegates to existing `recordServicePromotionUsage`, `recordPlatformPromotionUsage`, `recordVendorPromotionUsage`, `coupon_usages`
- `commitResolverUsageEntries()` — idempotent keys per reference+discount+customer
- Wired on booking completion when `coupon_code` present without promo meta

**No new tables.**

---

## 10. Settlement

**File:** `backend/lambda/src/discount-engine/settlement/financial-meta-bridge.ts`

- `appendSettlementPreviewToFinancialMeta()` — adds preview when `SETTLEMENT_MODE=AUTHORITATIVE`
- Reuses existing Settlement Engine output on `ResolverResult.settlement`
- `settlement-hook-bridge.ts` unchanged — still reads preview from meta

---

## 11. Analytics & campaigns

- **Analytics:** `GET /admin/analytics/discount-engine/mode` returns all `engineFlags` (no duplicate aggregation)
- **Campaign:** Phase 10 engine unchanged; consumes authoritative resolver when campaign materialization runs under `CAMPAIGN_MODE=AUTHORITATIVE`

---

## 12. Monitoring & logging

Structured logs (not spam — one line per resolution/fallback):

- `[discount-resolver] production resolution` — V2 success
- `[discount-resolver] production fallback` — reason, duration, domain
- `[discount-resolver] pipeline complete` — includes `resolverMode`

Watch: fallback rate, resolver latency (`durationMs`), `pipeline failed`.

---

## 13. Security

- No auth changes — admin/coupon/campaign routes retain existing guards
- `/marketing/promotions` unguarded gap **not widened** (pre-existing — see risk register)

---

## 14. Files modified / added

### New

| File |
|------|
| `discount-engine/policy/resolver-mode.ts` |
| `discount-engine/policy/__tests__/resolver-mode.test.ts` |
| `discount-engine/resolver/resolver-result-mappers.ts` |
| `discount-engine/adapters/legacy-usage-tracker.ts` |
| `discount-engine/settlement/financial-meta-bridge.ts` |
| `lib/services/platform-coupon-service.ts` |
| `lib/services/promotion-code-validation-service.ts` |

### Modified

| File |
|------|
| `discount-engine/resolver/production-bridge.ts` |
| `discount-engine/resolver/candidate-repository.ts` |
| `discount-engine/resolver/index.ts` |
| `lib/services/booking-promotion-service.ts` |
| `lib/services/discount-calculation-service.ts` |
| `utils/vendor-promotion-engine.ts` |
| `utils/service-promotion-engine.ts` (header @deprecated) |
| `endpoints/promotions.ts` |
| `endpoints/vendor/endpoints/vendor-promotions.ts` |
| `endpoints/ecommerce/endpoints/ecommerce.ts` |
| `endpoints/booking/endpoints/bookings-enhanced.booking.ts` |
| `endpoints/discount-analytics.endpoints.ts` |
| `infra/envs/dev/main.tf`, `infra/envs/prod/main.tf` |
| `apps/admin-web/lib/discount-policy/option-registry.ts` |
| `apps/admin-web/lib/discount-policy/discount-policy-api.ts` |

### Not deleted (constraint verified)

All legacy engines, adapters, shadow layers, production bridge (extended), routes, flags, tables, tests.

---

## 15. Known limitations

1. **`calculateBestCartPromotion()` sync** — still legacy when called directly; AUTHORITATIVE requires `calculateBestCartPromotionAsync()`.
2. **E4** — platform auto promos on shop cart not applied at order create (pre-existing).
3. **`GET /admin/promotions` route shadowing** — not fixed in 8B (admin-only).
4. **Settlement meta on booking create** — bridge helper added; not yet wired into every financialMeta builder path (hook reads meta when present).
5. **Per-endpoint rollback** — single global `RESOLVER_MODE`; granular flags deferred.
6. **Terraform apply** — env vars documented in TF; requires `terraform apply` to reach Lambda (not applied in this phase).

---

## 16. Validation checklist

### Build & unit

- [x] `cd backend/lambda && npm run build` — pass
- [x] `resolver-mode.test.ts` — pass

### Manual (dev — set `DISCOUNT_ENGINE_V2_RESOLVER_MODE`)

| Test | OFF | SHADOW | AUTHORITATIVE |
|------|-----|--------|---------------|
| `POST /promotions/calculate-booking` | Legacy amounts | Same + CW logs | V2 amounts |
| Booking with coupon code | Legacy+coupon augment | Shadow compare | V2 coupon phase |
| `POST /promotions/validate-code` service | Inline legacy | Shadow | Resolver |
| Shop order + platform coupon | Vendor promo only | Shadow | Coupon table (E6) |
| Fallback on forced resolver error | N/A | N/A | Legacy + fallback log |
| Rollback to OFF | — | — | Legacy within minutes |

### End-to-end domains

- [ ] Customer service booking + payment
- [ ] Customer shop checkout + coupon
- [ ] Vendor promo CRUD (unchanged)
- [ ] Admin stats / analytics mode endpoint
- [ ] Settlement batch (no regression when SETTLEMENT OFF)

---

## 17. Rollback verification

1. Set `DISCOUNT_ENGINE_V2_RESOLVER_MODE=OFF` on Lambda (Terraform or console).
2. Confirm `invokeResolverAlongsideLegacy` stops firing.
3. Re-run calculate-booking smoke — amounts match pre-cutover fixtures.
4. See `ROLLBACK_PLAN.md`.

---

## 18. Phase 8C (future — not this phase)

- Remove shadow adapters after 30d stable AUTHORITATIVE
- Delete orphan UI / dead client `promotions-engine.ts`
- Consolidate duplicate apply handlers
- Optional: per-endpoint resolver flags

---

*Phase 8B implementation artifact — local only, not committed.*
