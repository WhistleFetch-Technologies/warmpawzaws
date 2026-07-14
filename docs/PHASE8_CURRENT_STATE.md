# Phase 8A — Current Production State

**Date:** 2026-07-06  
**Scope:** Analysis only — production migration blueprint input  
**Branch reference:** `feature-meal-ui-promotion` (latest pushed: `64e507486`)  
**Authoritative sources:** Code inspection, `docs/PROMOTION_SYSTEM_STATUS.md`, `backend/lambda/src/discount-engine/*`, Phase 1–10 migration reports, UI Sprint A–F docs, settlement/analytics/campaign current-state docs.

---

## 1. Executive summary

Warmpawz runs a **dual-track discount platform**:

| Track | Role in production today | Customer-visible impact |
|-------|--------------------------|-------------------------|
| **Legacy runtime** | **Authoritative** for all checkout, quotes, coupon validation, usage recording | Yes — all amounts customers pay |
| **Discount Engine V2** | **Diagnostic / partial enrichment** — runs via `invokeResolverAlongsideLegacy`; internal pipeline through Phase 7 complete in code | No — HTTP responses always return legacy unless a sub-engine flag is authoritative *inside* resolver metadata only |

**Production cutover (Phase 8) is not implemented.** The design flag `discount_engine_v2_authoritative` exists in `STACK_POLICY.md` but **has no runtime implementation** in Lambda env or code paths that swap HTTP return values.

**Code vs documentation drift:** `docs/PROMOTION_SYSTEM_STATUS.md` (2026-06-30) states Phases 6–10 “not started.” The repository **contains** Phase 6 (Stack), Phase 7 (Settlement), Phase 9 (Analytics), and Phase 10 (Campaign) modules with migration reports marked “complete (local).” Phase 8 HTTP authoritative wiring remains absent.

---

## 2. End-to-end production flow map

### 2.1 Customer journey

```
Discovery / listing
  → ServicePricingDisplay / ServiceListingPrice
  → POST /promotions/calculate-booking  [LEG authoritative + V2 shadow]
  → UniversalPaymentPage / PriceBreakdown
  → POST /bookings/create (financialMeta, promo IDs)
  → Razorpay verify webhook
  → recordBookingPromotionUsageFromBooking  [LEG usage]
  → booking GET with wp_financial_meta snapshot
```

| Step | Production path | Legacy path | V2 path | Adapter / bridge | Flags |
|------|-----------------|-------------|---------|------------------|-------|
| Listing promo quote | `POST /promotions/calculate-booking` | `resolveBookingPromotions` | `invokeResolverAlongsideLegacy('resolveBookingPromotions')` | `context-mappers.ts` | Priority/Stack/Settlement modes affect resolver logs only |
| Service summary | `ServiceBookingPromoSummary` | Same API or cached quote | Shadow | — | — |
| Coupon entry | `coupon-validation.ts` → `POST /promotions/validate-code` | Inline validate in `vendor-promotions.ts` + `evaluatePromotionDiscount` | Shadow on some branches | Benefit adapters on coupon math | — |
| Legacy coupon GET | `GET /coupons/validate/:code` | `validateCouponInternal` in `promotions.ts` | Shadow via `computeCouponDiscountAmount` | — | — |
| Payment amount | `UniversalPaymentPage` | Legacy stack totals | Not used for display | `buildCheckoutPriceLines` | — |
| Post-payment truth | `extractBookingFinancial` | `wp_financial_meta` + payment row | Settlement preview in meta when settlement authoritative (not prod default) | `settlement-hook-bridge.ts` | `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` |

**Known gaps (verified in code/docs):**

- **S5:** Booking `coupon_code` stored but `resolveBookingPromotions` does not apply `coupons` table discounts.
- **E6:** Shop checkout `couponCode` searches `vendor_promotions`, not `coupons`.
- **S3:** `validate-code` service path uses simplified inline math, not full `evaluateServicePromotionDiscount`.

### 2.2 Vendor journey

```
Vendor portal → ServicePromotionsHub / SellerPromotionsHub
  → GET/POST /vendor/:id/service-promotions | /promotions
  → vendor_service_promotions | vendor_promotions tables
  → Customer flows above consume same rows at checkout
```

| Surface | Production path | V2 involvement |
|---------|-----------------|----------------|
| Service promo CRUD | `vendor-promotions.ts` | None on write |
| Seller promo CRUD | Same file, product table | None on write |
| Active promos for cart | `GET /vendors/:id/active-promotions` | Legacy query only |

### 2.3 Admin journey

```
/marketing (sidebar)     → Legacy Marketing Hub modal + CouponManagement
/promotions              → AdminPromotionHub + PromotionDashboard wizard
/ecommerce/promotions    → AdminPromotionHub (ecommerce surface)
/admin/commercial-campaigns → Phase 10 API (gated OFF by default)
```

| Surface | API | Production fidelity |
|---------|-----|---------------------|
| Legacy marketing modal | `POST /marketing/promotions` | Full coarse targeting |
| New wizard hub | `POST /admin/promotions` | Sprint A extended persistence via `promotion-admin-persistence.ts` (verify on target env) |
| Coupons | `/admin/coupons*` | Legacy table CRUD |
| Stats cards | `GET /admin/promotions/stats` | Legacy + optional V2 analytics enrichment when `isAnalyticsAuthoritative()` |

**Route shadowing:** `GET /admin/promotions` in `admin-advanced.ts` registers **after** `promotions.ts` in `handler/index.ts` and overrides the richer list handler with a simplified `SELECT * LIMIT 50`.

### 2.4 Checkout (service vs ecommerce)

| Domain | Quote endpoint | Stack logic | V2 shadow label |
|--------|----------------|-------------|-----------------|
| Service booking | `calculate-booking`, `pricing/quote` | `calculateBookingPromotionsStack` (vendor then platform on reduced base) | `resolveBookingPromotions` |
| E-commerce cart | `POST /promotions/calculate-cart` | `calculateBestCartPromotion` | `calculateBestCartPromotion-*` |
| E-commerce order | Internal in `ecommerce.ts` | Same engine | Shadow wired in engine |

### 2.5 Resolver (internal — not HTTP authoritative)

```
DiscountContext
  → CandidateRepository (4 providers)
  → Rule Engine (per candidate)
  → Benefit Engine (per eligible)
  → Priority Pipeline (DISCOUNT_ENGINE_V2_PRIORITY_MODE)
  → Stack Engine OR Legacy Stack Adapter (DISCOUNT_ENGINE_V2_STACK_MODE)
  → Settlement Engine (DISCOUNT_ENGINE_V2_SETTLEMENT_MODE)
  → Usage Preparation (metadata only — no DB writes)
  → ResolverResult → CloudWatch via production-bridge
```

**Entry:** `invokeResolverAlongsideLegacy(label, context)` — fire-and-forget; **never changes caller return value.**

**Resolver version in code:** `phase-7.0` (`unified-discount-resolver.ts`).

### 2.6 Settlement (payout — separate from discount resolver)

```
Booking/order completion
  → vendor-earnings-on-completion / meal-order-settlement / package-session-sync
  → vendor_earnings | delivery_settlements
  → POST /settlements/calculate-daily (batch)
  → settlements → payouts → Razorpay
```

V2 `settlement-hook-bridge.ts` adjusts commissionable gross **only when** `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=AUTHORITATIVE` and preview exists in `wp_financial_meta`. Production default: **OFF**.

### 2.7 Analytics

| Path | Engine | Flag | Production |
|------|--------|------|------------|
| `/admin/promotions/stats` | Legacy SQL counts | — | Active |
| `/admin/analytics/discount-engine/*` | Phase 9 `AnalyticsEngine` | `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` | Default OFF; SHADOW returns 403 on overview |
| Marketing analytics UI (Sprint E/F) | Consumes Phase 9 APIs | Requires AUTHORITATIVE | UI exists; data gated |

### 2.8 Campaign (Phase 10)

| Path | Engine | Flag | Production |
|------|--------|------|------------|
| `/admin/commercial-campaigns/*` | `CampaignEngine` | `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | Default OFF → 503 |
| Notification campaigns | `notification-campaigns.ts` | — | Separate system, live |
| Campaign → promo materialization | `promotion-bridge.ts` | AUTHORITATIVE on campaign engine | Only when campaign flag ON |

---

## 3. Discount Engine V2 component status (code-verified)

| Phase | Module | Code status | HTTP authoritative? | Default env |
|-------|--------|-------------|---------------------|-------------|
| 1 | Foundation, DI, adapters | ✅ Present | No | — |
| 2 | Benefit Engine + legacy fallback | ✅ Present | Shadow — legacy wins | — |
| 3 | Rule Engine + shadow compare | ✅ Present | Shadow — legacy wins | — |
| 3.5 | Candidate model + providers | ✅ Present | Normalization only | — |
| 4 | Unified resolver + production-bridge | ✅ Present | Diagnostic only | — |
| 5A/5B | Priority Engine | ✅ Present | Inside resolver when `PRIORITY_MODE=AUTHORITATIVE` | `AUTHORITATIVE` (in-code default) |
| 6 | Stack Engine | ✅ Present | Inside resolver when `STACK_MODE=AUTHORITATIVE` | OFF |
| 7 | Settlement Engine | ✅ Present | Preview in resolver; hooks when `SETTLEMENT_MODE=AUTHORITATIVE` | OFF |
| 8 | HTTP cutover / resolver authoritative | ❌ **Not implemented** | — | — |
| 9 | Analytics Engine + admin APIs | ✅ Present | APIs gated | OFF |
| 10 | Campaign Engine + admin APIs | ✅ Present | APIs gated | OFF |
| 11 | Unified `/discounts` public API | ❌ Deferred | — | — |
| 13 | Registry in HTTP handlers | ❌ `getDiscountEngineRegistry()` unused | — | — |

---

## 4. Feature flags (runtime — Lambda env)

| Variable | Values | In-code default | Terraform/SSM | Affects HTTP response? |
|----------|--------|-----------------|---------------|------------------------|
| `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | OFF / SHADOW / AUTHORITATIVE | AUTHORITATIVE | **Not deployed** | No |
| `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW` | true/false (legacy) | — | Not deployed | No |
| `DISCOUNT_ENGINE_V2_STACK_MODE` | OFF / SHADOW / AUTHORITATIVE | OFF | Not deployed | No |
| `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` | OFF / SHADOW / AUTHORITATIVE | OFF | Not deployed | Only earnings hooks when AUTHORITATIVE |
| `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` | OFF / SHADOW / AUTHORITATIVE | OFF | Not deployed | Stats enrichment + analytics APIs |
| `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | OFF / SHADOW / AUTHORITATIVE | OFF | Not deployed | Commercial campaign APIs |
| `discount_engine_v2_authoritative` | (design only) | — | **Not implemented** | **Required for Phase 8 cutover** |

Admin UI reads modes via `/admin/analytics/discount-engine/mode` and `/admin/commercial-campaigns/mode` (`discount-policy-api.ts`). No admin publish-to-SSM lifecycle deployed.

---

## 5. Database tables (promotion domain)

| Table | Role | Legacy / V2 / Shared | Production use |
|-------|------|----------------------|----------------|
| `promotions` | Platform promos | Shared | Canonical platform auto + coded promos |
| `coupons` | Platform coupon codes | Shared | Admin coupons; partial checkout wiring |
| `vendor_promotions` | Seller/product promos | Shared | E-commerce |
| `vendor_service_promotions` | Service provider promos | Shared | Booking stack |
| `promotion_usages` | Redemption audit | Shared | Legacy writers; V2 prepares metadata only |
| `coupon_usages` | Coupon redemptions | Shared | Legacy writers |
| `platform_promotions` | Legacy platform table | **Legacy only** | Second `POST /promotions/apply` handler (unreachable if first wins — verify Hono order) |
| `commercial_campaigns` | Phase 10 | V2 | Migration `1046_commercial_discount_campaigns.sql` |
| `commercial_campaign_promotion_links` | Campaign ↔ promo | V2 | Phase 10 |
| `commercial_campaign_audit_log` | Campaign audit | V2 | Phase 10 |
| `spotlight_offers` | Marketing spotlights | Legacy adjacent | Not discount stack |

**No separate V2 discount tables** — engine reads/writes shared promotion tables via providers and legacy persistence.

---

## 6. UI inventory summary

### Admin

| Route | UI | Status | Notes |
|-------|-----|--------|-------|
| `/marketing` | Marketing Hub (legacy modal) | **Production sidebar** | Promotions tab, coupons, vendor overview |
| `/promotions` | `AdminPromotionHub` | **Migrated** (Sprint A+) | Marketing surface; sidebar added Sprint A |
| `/ecommerce/promotions` | `AdminPromotionHub` | **Migrated** | E-commerce surface |
| `/marketing/analytics` | Sprint E discount analytics | **New** | Requires analytics flag |
| Commercial campaigns | Sprint F hub | **New** | Requires campaign flag |
| `AdvancedPromotionsEngine.tsx` | Legacy modal | **Orphan** | E2E refs only |
| `ecommerce/promotions/PromotionsManagement.tsx` | Old grid | **Orphan** | Superseded |

### Vendor

| Entry | UI | Status |
|-------|-----|--------|
| Service promotions | `ServicePromotionsHub` | **Primary** |
| Seller promotions | `SellerPromotionsHub` | **Primary** |
| Wrappers | `ServicePromotionsManagement`, seller `PromotionsManagement` | Compatibility shims |

### Customer

| Area | Components | Status |
|------|------------|--------|
| Pricing | `ServicePricingDisplay`, `PriceDisplay`, `PriceBreakdown` | Sprint 1 — production |
| Marketplace | `MarketplaceCard`, history, confirmation | Sprint 3 — partial |
| Coupons | `coupon-validation.ts`, `CartPromotionSelect` | Production with legacy fallbacks |
| Dead code | `lib/promotions-engine.ts` | **Zero imports** — cleanup candidate |

---

## 7. Resolver matrix status (S1–E6)

All rows in `RESOLVER_MATRIX.md` migration checklist remain **open at HTTP layer**. Shadow wiring exists for S1, S2, E1, E2, S5, E6 where legacy engines call `invokeResolverAlongsideLegacy`. Inline handlers (S3, S4, E5) lack full shadow parity.

---

## 8. Production readiness assessment (Phase 8A verdict)

| Question | Answer |
|----------|--------|
| Can V2 become authoritative today? | **No** — no HTTP swap; matrix gaps S5/E6/S3; no `discount_engine_v2_authoritative`; flags not in Terraform |
| Is internal pipeline ready for shadow parity testing? | **Partially** — Phases 1–7 code present; needs env flags on dev + CloudWatch comparison |
| Is admin/config ready? | **No** — policy publish, SSM, simulator missing |
| Is settlement ready for cutover? | **Partial** — preview engine exists; payout tables unchanged; hook bridge needs authoritative + meta on all order types |
| Is analytics ready? | **Partial** — APIs exist; no dashboard without AUTHORITATIVE; SHADOW hides data from HTTP |
| Is campaign ready? | **Partial** — engine + migration; default OFF; prod migration 1046 may be pending |

---

## 9. Reference documents

| Document | Path |
|----------|------|
| System status (pre–Phase 6 snapshot) | `docs/PROMOTION_SYSTEM_STATUS.md` |
| Resolver matrix | `backend/lambda/src/discount-engine/RESOLVER_MATRIX.md` |
| Stack policy | `backend/lambda/src/discount-engine/STACK_POLICY.md` |
| Phase reports | `backend/lambda/src/discount-engine/PHASE*_MIGRATION_REPORT.md` |
| Settlement state | `docs/SETTLEMENT_CURRENT_STATE.md` |
| Analytics state | `docs/ANALYTICS_CURRENT_STATE.md` |
| Campaign state | `docs/CAMPAIGN_CURRENT_STATE.md` |
| UI Sprints A–F | `docs/UI_SPRINT_*_IMPLEMENTATION.md` |
| Legacy inventory | `docs/LEGACY_COMPONENT_INVENTORY.md` |
| Migration plan | `docs/PHASE8_MIGRATION_PLAN.md` |

---

*Phase 8A analysis artifact — local only, not committed.*
