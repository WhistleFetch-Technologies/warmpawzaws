# Commercial Domain Reuse Matrix

**Status:** Analysis only  
**Legend:** ✅ Shared | 🔀 Split (data/routing) | ⚠️ Partial | ❌ Gap

---

## Engines & core logic

| Component | Path / module | Services | E-Commerce | Reuse |
|-----------|---------------|----------|------------|-------|
| Discount Resolver | `discount-engine/resolver/unified-discount-resolver.ts` | `DiscountDomain.SERVICE` | `DiscountDomain.ECOMMERCE` | ✅ One engine |
| Priority engine | `discount-engine/priority/` | Domain merge | Domain merge | ✅ |
| Stack engine | `discount-engine/stack/` | Domain merge | Domain merge | ✅ |
| Limits engine | `discount-engine/limits/` | Domain merge | Domain merge | ✅ |
| Settlement engine | `discount-engine/settlement/` | booking usages | order usages | ✅ |
| Analytics engine | `discount-engine/analytics/` | `?domain=SERVICE` | `?domain=PRODUCT` | ✅ |
| Campaign orchestrator | `discount-engine/campaign/` | metadata.domain | metadata.domain | ✅ |
| Runtime policy loader | `discount-engine/policy/runtime-policy-loader.ts` | merge | merge | ⚠️ businessRules global |
| Booking promo service | `lib/services/booking-promotion-service.ts` | primary | — | 🔀 |
| Cart promo engine | `lib/services/cart-promotion-engine.ts` | — | primary | 🔀 |
| Platform coupon service | `lib/services/platform-coupon-service.ts` | validate | validate | ✅ |

---

## Storage

| Table / store | Services | E-Commerce | Reuse |
|---------------|----------|------------|-------|
| `promotions` | platform + service-targeted rows | product-targeted rows | ✅ shared table |
| `coupons` | service targeting cols | product/cart | ✅ shared table |
| `vendor_service_promotions` | ✅ | — | 🔀 |
| `vendor_promotions` | — | ✅ | 🔀 |
| `promotion_usages` | `booking_id` | `order_id` | ✅ shared |
| `coupon_usages` | `booking_id` | `order_id` | ✅ shared |
| `discount_policy_draft` | singleton | singleton | ✅ shared |
| `discount_policy_versions` | singleton active | singleton active | ⚠️ one publish |
| `commercial_discount_campaigns` | metadata | metadata | ⚠️ no DB domain col |
| `commercial_campaign_promotion_links` | both | both | ✅ |

---

## APIs

| Endpoint | Services | E-Commerce | Reuse |
|----------|----------|------------|-------|
| `POST /admin/promotions` | ✅ | ✅ | ✅ |
| `POST /admin/coupons/create` | ✅ | ✅ | ✅ |
| `GET /admin/promotions` | client filter | client filter | ⚠️ |
| `POST /promotions/calculate-booking` | ✅ | — | 🔀 |
| `POST /promotions/calculate-cart` | — | ✅ | 🔀 |
| `POST /promotions/validate-code` | orderType=service | orderType=product | ✅ |
| `GET /promotions/active` | includeCoupons | — | 🔀 |
| `GET /ecommerce/promotions/active` | — | ✅ | 🔀 |
| `GET/POST /admin/discount-policy/*` | global | global | ⚠️ |
| `GET /admin/commercial-campaigns` | client filter | client filter | ⚠️ |
| `GET /admin/analytics/discount-engine/*` | `?domain=` | `?domain=PRODUCT` | ✅ |

---

## Admin UI components

| Component | Package / path | `surface` / `domain` prop | Reuse |
|-----------|----------------|---------------------------|-------|
| `AdminPromotionHub` | admin-web | `marketing` \| `ecommerce` | ✅ |
| `PromotionDashboard` | promotion-management-ui | via hub | ✅ |
| `PromotionWizard` | promotion-management-ui | `audience`, scopes | ✅ |
| `MarketingAnalyticsHub` | admin-web | `surface` + domain lock | ✅ |
| `CommercialCampaignHub` | admin-web | `surface` | ✅ |
| `PolicyCenter` | admin-web | domain view (unwired) | ⚠️ |
| `PolicySimulatorSection` | admin-web | draft only | ⚠️ |
| `AuditViewerSection` | admin-web | global | ✅ |
| `VendorPromotionsOverview` | admin-web | `domain` prop | ✅ |
| `ECommerceSubNav` | admin-web | ecommerce routes | 🔀 nav only |
| `PromotionCenterHub` | admin-web | Marketing consolidated | 🔀 |

---

## Customer UI

| Component | Services | E-Commerce | Reuse |
|-----------|----------|------------|-------|
| `CouponSection` | booking flows | — | 🔀 |
| `CheckoutCouponPanel` | — | cart checkout | 🔀 |
| `coupon-validation.ts` | validate-code | validate-code | ✅ |
| `fetchBookingDiscountQuote` | calculate-booking | — | 🔀 |
| Cart discount quote | — | calculate-cart | 🔀 |

---

## Configuration & flags

| Config | Scope | Per-domain? |
|--------|-------|-------------|
| `surface-config.ts` | admin-web | ✅ filters |
| Policy bundle `priority.domains` | RDS JSONB | ✅ |
| Policy bundle `stack.domains` | RDS JSONB | ✅ |
| Policy bundle `limits.domains` | RDS JSONB | ✅ |
| Policy bundle `businessRules` | RDS JSONB | ❌ global |
| `DISCOUNT_ENGINE_V2_*_MODE` | Lambda env | ❌ global |
| `ENABLE_LEGACY_PROMOTION_UI` | env | ❌ global |

---

## Investigation 4 — Analytics detail

| Question | Answer |
|----------|--------|
| Filter by domain? | **Yes** — `?domain=` on Phase 9 APIs |
| Campaign analytics separated? | **Partial** — UI filters; per-campaign API weak |
| Promotion analytics separated? | **Yes** — domain param + surface lock |
| Finance reporting separated? | **Partial** — usages split by booking/order; unified settlement export |
| Schema changes for domain analytics? | **Unlikely** — domain likely on event rows; verify `discount_analytics_events` |

---

## Known gaps (do not duplicate — fix in place)

| ID | Gap | Fix type |
|----|-----|----------|
| G1 | Policy Center viewDomain not wired | UI |
| G2 | businessRules global | Bundle schema |
| G3 | Campaign no server domain filter | API + optional column |
| G4 | Campaign drawer missing surface | UI one-liner |
| G5 | Platform coupons not on shop checkout (E6) | Cart engine path |
| G6 | Platform auto promos listed not applied (E4) | Resolver integration |
| G7 | E-Commerce “Policies” tab ≠ Policy Center | Nav/docs |
| G8 | `/runtime` GET hardcodes SERVICE | API param |

---

## Reuse decision summary

| Layer | Duplicate? | Action |
|-------|------------|--------|
| Discount Engine | **Never** | Extend domain merge |
| Settlement Engine | **Never** | Keep shared |
| Analytics Engine | **Never** | Query filter |
| Campaign Engine | **Never** | Domain on rows |
| promotion-management-ui | **Never** | `surface` prop |
| Policy Center UI | **Never** | Wire domain editors |
| Vendor promo tables | **Already split** | Keep |
| Platform promo/coupon tables | **Keep shared** | Row targeting + optional domain col |

---

## Cross-reference

- [COMMERCIAL_DOMAIN_ARCHITECTURE_ANALYSIS.md](./COMMERCIAL_DOMAIN_ARCHITECTURE_ANALYSIS.md)
- [POLICY_CENTER_DOMAIN_ANALYSIS.md](./POLICY_CENTER_DOMAIN_ANALYSIS.md)
- [CAMPAIGN_DOMAIN_ANALYSIS.md](./CAMPAIGN_DOMAIN_ANALYSIS.md)
- [DOMAIN_RUNTIME_POLICY_ANALYSIS.md](./DOMAIN_RUNTIME_POLICY_ANALYSIS.md)
- [COMMERCIAL_DOMAIN_MIGRATION_PLAN.md](./COMMERCIAL_DOMAIN_MIGRATION_PLAN.md)
- [DOMAIN_UI_SEPARATION_IMPLEMENTATION.md](./DOMAIN_UI_SEPARATION_IMPLEMENTATION.md)
