# Commercial Domain Architecture Analysis

**Status:** Analysis only (no implementation)  
**Date:** 2026-07-08  
**Scope:** Services (Marketing) vs E-Commerce commercial engine separation

---

## Executive summary

Warmpawz already runs **one Discount Engine V2**, **one Settlement Engine**, and **one Analytics Engine** with `DiscountDomain.SERVICE` vs `DiscountDomain.ECOMMERCE` runtime context. Separation today is primarily **admin UI surface filtering** (`surface-config.ts`) plus **physically split vendor tables** (`vendor_service_promotions` vs `vendor_promotions`).

**Policy Center** and **Commercial Campaigns** are **shared globally** at storage and API level. Runtime policy supports **per-domain overrides** for priority, stack, and limits inside a **single published bundle**, but **business rules** (Best Offer Only, winning strategy, combination matrix) are **global** in the bundle. The Policy Center UI domain selector is **view-only** and does not yet scope draft edits.

The recommended long-term shape is **independent business configuration per commercial domain** on top of **shared engines and shared UI components**—not duplicate resolvers or duplicate admin wizards.

---

## Investigation 1 — Current navigation

### Marketing portal

| Entry | Route | Owner component |
|-------|-------|-----------------|
| Promotion Center (canonical hub) | `/promotion-center?tab=*` | `PromotionCenterHub` |
| Platform promos & coupons | `?tab=platform` | `AdminPromotionHub surface="marketing"` |
| Vendor promotions | `?tab=vendor` | `VendorPromotionsOverview domain="SERVICE"` |
| Policy Center | `?tab=policy` | `PolicyCenter` (embedded) |
| Analytics | `?tab=analytics` | `MarketingAnalyticsHub surface="marketing"` |
| Campaigns | `?tab=campaigns` | `CommercialCampaignHub surface="marketing"` |
| Marketing content hub | `/marketing` | Banners, spotlight, articles (non-promo) |

Legacy routes (`/promotions`, `/policy-center`, `/marketing/campaigns`, etc.) redirect into Promotion Center when `ENABLE_LEGACY_PROMOTION_UI` is off.

**Sidebar:** Flat links — Marketing Hub, Promotion Center, Notification Engine (`marketing-portal-nav.ts`).

### E-Commerce portal

| Entry | Route | Owner component |
|-------|-------|-----------------|
| Promotions & coupons | `/ecommerce/promotions` | `AdminPromotionHub surface="ecommerce"` |
| Seller promotions | `/ecommerce/seller-promotions` | `VendorPromotionsOverview domain="ECOMMERCE"` |
| Campaigns | `/ecommerce/campaigns` | `CommercialCampaignHub surface="ecommerce"` |
| Promotion analytics | `/ecommerce/analytics` | `MarketingAnalyticsHub surface="ecommerce"` |
| Marketplace ops | `/ecommerce?tab=*` | Orders, sellers, refund/commission policies |

**Subnav:** `ECommerceSubNav` inside `ECommercePromoLayout`.  
**RBAC:** `admin.ecommerce` vs Marketing `admin.integrations`.

### Reuse pattern

```
@warmpawz/promotion-management-ui
        ↑ scope.smartTargetSurface ('marketing' | 'ecommerce')
apps/admin-web/lib/promotion-domain/surface-config.ts
        ↑ row filters, wizard scopes, analytics domain lock
AdminPromotionHub | MarketingAnalyticsHub | CommercialCampaignHub
        ↑ surface prop only — same APIs underneath
```

### Recommended future navigation

1. **Keep two portals** (Marketing vs E-Commerce) — matches operator mental models and RBAC.
2. **Symmetrize hubs:** Either E-Commerce tabbed hub at `/ecommerce/promotion-center` or deep-link E-Commerce subnav to Promotion Center policy tab with `?domain=ecommerce`.
3. **Expose Policy Center to E-Commerce admins** — link from `ECommerceSubNav` to discount policy (today only reachable via Marketing → Promotion Center → Policy).
4. **Rename analytics** — distinguish “Promotion Analytics” (`/ecommerce/analytics`) from “Marketplace Analytics” (`/ecommerce?tab=analytics`).
5. **Centralize nav config** — single `promo-portal-nav.ts` mapping route → component → surface → permission to prevent Marketing/E-Commerce drift.

See also: [DOMAIN_UI_SEPARATION_IMPLEMENTATION.md](./DOMAIN_UI_SEPARATION_IMPLEMENTATION.md)

---

## Investigation 5 — Promotion engine separation

### What exists today

| Layer | Services (Marketing) | E-Commerce | Shared? |
|-------|------------------------|------------|---------|
| Admin UI | `surface="marketing"` | `surface="ecommerce"` | Same `AdminPromotionHub` |
| Platform storage | `promotions` table | Same table | **Shared** — row-scoped via `applicable_to`, `service_category`, `metadata` |
| Vendor storage | `vendor_service_promotions` | `vendor_promotions` | **Split tables** |
| Admin API | `POST /admin/promotions` | Same | **Shared** |
| Customer discovery | `/promotions/active`, `/promotions/applicable` | `/ecommerce/promotions/active` | Shared handlers, different filters |
| Booking quote | `POST /promotions/calculate-booking` | N/A | SERVICE only |
| Cart quote | N/A | `POST /promotions/calculate-cart` | ECOMMERCE |
| Resolver entry | `resolveBookingPromotions` | `calculateBestCartPromotion` | Same engine, different domain |

### Client-side classification

`isMarketingPromotionRow` / `isEcommercePromotionRow` in `surface-config.ts` use heuristics: `applicable_products`, `seller_id`, `domain`, `service_category`, promotion type strings.

**Gap:** Creating a promo in Marketing hub uses the same API; mis-targeted rows can appear in the wrong surface if targeting fields are ambiguous.

### Platform auto-promos on shop

Platform `promotions` rows with product scope may appear in discovery (`E4` in resolver matrix) but are **not always applied** at ecommerce checkout — documented gap.

---

## Investigation 6 — Coupon engine separation

| Layer | Services | E-Commerce | Notes |
|-------|----------|------------|-------|
| Platform storage | `coupons` table | Same | `applicable_to`, `service_category`, `applicable_services` (migration 1062) |
| Admin create | `POST /admin/coupons/create` | Same | Targeting via `buildCouponTargetingFromAdminBody` |
| Validate | `POST /promotions/validate-code` | Same | `orderType` → `DiscountDomain` |
| Booking augment | `validateCouponForAmount(..., SERVICE)` | — | Service category enforcement added |
| Shop checkout | — | `couponCode` → `vendor_promotions` | Platform `coupons` table gap at shop (E6) |
| Normalizer domain | Mapped `ECOMMERCE` | Same | SERVICE validation uses category rules |

Coupons are **not table-split**; domain behavior is runtime + row targeting.

---

## Investigation 10 — Database overview

### Already domain-aware (or split)

| Table | Domain model |
|-------|----------------|
| `vendor_service_promotions` | SERVICE only |
| `vendor_promotions` | ECOMMERCE only |
| `promotion_usages` | `booking_id` OR `order_id` |
| `coupon_usages` | `booking_id` OR `order_id` |
| `discount_policy_versions.bundle` | JSONB with `priority.domains`, `stack.domains`, `limits.domains` overrides |
| `commercial_discount_campaigns.metadata` | `domain`, `surface` (optional, client-set) |

### Shared, row-scoped (not table-split)

| Table | Scoping mechanism |
|-------|-------------------|
| `promotions` | `applicable_to`, `service_category`, `applicable_services`, `metadata` |
| `coupons` | Same + migration 1062 columns |
| `discount_policy_draft` | Singleton — one draft for all domains |
| `discount_policy_versions` | Singleton active publish |
| `commercial_campaign_promotion_links` | Links to promo/coupon IDs |

### Recommended additive columns (only if heuristics fail)

- `commercial_discount_campaigns.domain` — indexed `SERVICE` | `ECOMMERCE` (backfill from metadata)
- `promotions.discount_domain` / `coupons.discount_domain` — optional persisted domain (avoid if metadata convention suffices)

**Do not** duplicate policy or campaign tables per domain.

---

## Investigation 11 — API model summary

| API group | Global? | Domain support today | Extension needed |
|-----------|---------|----------------------|------------------|
| `/admin/promotions`, `/admin/coupons` | Global list | Client filter only | Optional `?domain=` |
| `/admin/discount-policy/*` | Global singleton | Runtime merge per `DiscountDomain` | Per-domain publish or bundle sections |
| `/admin/commercial-campaigns` | Global list | metadata only | `?domain=` query |
| `/admin/analytics/discount-engine/*` | Global | `?domain=SERVICE\|PRODUCT\|...` | Already domain-aware |
| `/promotions/calculate-booking` | — | SERVICE | — |
| `/promotions/calculate-cart` | — | ECOMMERCE | — |
| `/promotions/validate-code` | Global | `orderType` + `serviceCategory` | — |

---

## Final recommendations (summary)

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Policy Center global or domain-specific? | **Domain-specific configuration** inside one Policy Center; business rules should support per-domain values. Single publish workflow can remain if bundle is structured per domain. |
| 2 | Campaigns global or domain-specific? | **Domain-specific** campaigns (data + API filter); **shared** orchestration engine. |
| 3 | One Discount Engine? | **Yes** — already implemented via `DiscountDomain`. |
| 4 | One Settlement Engine? | **Yes** — parameterized by domain; funding split largely shared. |
| 5 | One Analytics Engine? | **Yes** — `?domain=` filter; separate marketplace order analytics stays distinct KPI layer. |
| 6 | UI fully reusable? | **Yes** — `surface` / `domain` props on shared hubs; no second wizard. |
| 7 | DB changes required? | **Minimal additive** — campaign `domain` column; optional promo/coupon domain column; policy bundle JSON structure extension (no new engine tables). |
| 8 | APIs to extend? | Campaign list filter; policy draft scoped by domain; optional admin promo list filter. |
| 9 | Break existing promotions? | **No** — additive migrations, client filters become server filters gradually. |
| 10 | Long-term architecture | See diagram below and [COMMERCIAL_DOMAIN_MIGRATION_PLAN.md](./COMMERCIAL_DOMAIN_MIGRATION_PLAN.md) |

### Recommended long-term architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     SHARED ENGINES (single codebase)                     │
│  Discount Resolver │ Settlement │ Analytics │ Campaign Orchestrator   │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ DiscountDomain + published bundle
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
   │  SERVICES    │          │  E-COMMERCE  │          │  (future)    │
   │  config      │          │  config      │          │  meals etc.  │
   ├──────────────┤          ├──────────────┤          └──────────────┘
   │ promos/coupons│         │ promos/coupons│
   │ vendor_svc_*  │         │ vendor_promo  │
   │ policy slice  │         │ policy slice  │
   │ campaigns     │         │ campaigns     │
   │ analytics     │         │ analytics     │
   └──────────────┘          └──────────────┘
          │                         │
          └──────── shared UI (surface prop) ────────┘
```

---

## Related documents

- [POLICY_CENTER_DOMAIN_ANALYSIS.md](./POLICY_CENTER_DOMAIN_ANALYSIS.md)
- [CAMPAIGN_DOMAIN_ANALYSIS.md](./CAMPAIGN_DOMAIN_ANALYSIS.md)
- [DOMAIN_RUNTIME_POLICY_ANALYSIS.md](./DOMAIN_RUNTIME_POLICY_ANALYSIS.md)
- [COMMERCIAL_DOMAIN_MIGRATION_PLAN.md](./COMMERCIAL_DOMAIN_MIGRATION_PLAN.md)
- [COMMERCIAL_DOMAIN_REUSE_MATRIX.md](./COMMERCIAL_DOMAIN_REUSE_MATRIX.md)
