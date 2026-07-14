# Domain UI Separation — Marketing vs E-Commerce

## Principle

**One Discount Engine V2.** Two operator surfaces:

| Surface | Audience | Routes |
|---------|----------|--------|
| **Marketing** | Service businesses (vet, grooming, meals, packages, …) | `/promotions`, `/marketing/campaigns`, `/marketing/analytics`, `/policy-center` |
| **E-Commerce** | Marketplace sellers & products | `/ecommerce/promotions`, `/ecommerce/coupons`, `/ecommerce/campaigns`, `/ecommerce/analytics` |

No backend changes. No duplicate engines, APIs, or wizards.

---

## Architecture

```
lib/promotion-domain/surface-config.ts   ← scopes, row filters, catalog subsets
AdminPromotionHub(surface)               ← wraps PromotionDashboard
MarketingAnalyticsHub(surface)           ← Phase 9 with domain lock
CommercialCampaignHub(surface)         ← Phase 10 with client filter
PolicyCenter + PolicyCenterDomainView    ← single policy UI, domain view selector
ECommerceSubNav + ECommercePromoLayout   ← extended e-commerce sidebar
```

---

## Navigation Changes

### Marketing (unchanged routes)

- **Promotions** → `/promotions` — service promotions & service coupons only
- **Campaigns** → `/marketing/campaigns` — service campaigns
- **Analytics** → `/marketing/analytics` — SERVICE / PACKAGE / MEAL / PHARMACY domains
- **Policy Center** → `/policy-center` — domain view selector (Services, E-Commerce, Meals, Pharmacy)

### E-Commerce (extended module)

Existing hub `/ecommerce` + new sub-routes in **E-Commerce sub-nav**:

| Tab | Route |
|-----|-------|
| Seller Promotions | `/ecommerce/promotions` |
| Seller Coupons | `/ecommerce/coupons` |
| Seller Campaigns | `/ecommerce/campaigns` |
| Promotion Analytics | `/ecommerce/analytics` |
| Marketplace Analytics | `/ecommerce?tab=analytics` (orders/sellers — existing) |

---

## Components Reused (not duplicated)

- `PromotionDashboard`, `PromotionWizard`, `PromotionCard`, `CouponCard`
- `CommercialCampaignHub` (+ builder, drawer, editors)
- `MarketingAnalyticsHub` (+ MetricTable, Recharts)
- `PolicyCenter` sections
- Sprint D funding presets

## Components Extended

| File | Change |
|------|--------|
| `AdminPromotionHub.tsx` | `surface`, `initialTab`, domain row filters |
| `MarketingAnalyticsHub.tsx` | `surface`, locked PRODUCT domain for e-commerce |
| `CommercialCampaignHub.tsx` | `surface`, campaign filter, metadata on create |
| `PromotionDashboard.tsx` | `initialTab` prop |
| `PolicyCenter.tsx` | `PolicyCenterDomainView` |
| `ECommerceSubNav.tsx` | promotion tabs + route links |

---

## Domain Mapping

### Client-side promotion/coupon classification

Uses existing row fields: `applicable_products`, `seller_id`, `service_category`, `domain`, promotion type hints.

### Wizard target scopes

| Surface | `enabledTargetScopes` |
|---------|------------------------|
| Marketing | services, packages, meal_plans, styles, vendors, categories |
| E-Commerce | products, vendors, categories |

### Analytics API filter

| Surface | Default `domain` query |
|---------|------------------------|
| Marketing | `SERVICE` (user can switch SERVICE/PACKAGE/MEAL/PHARMACY) |
| E-Commerce | `PRODUCT` (locked) |

Same `GET /admin/analytics/discount-engine/overview?domain=…` endpoint.

---

## Migration Strategy

- Legacy `/marketing` hub links unchanged → Promotion Hub, Campaigns, Analytics, Policy Center
- `/promotions` now shows **service-only** rows (e-commerce promos visible under `/ecommerce/promotions`)
- No route removals — additive e-commerce paths only

---

## Known Limitations

1. Row classification is heuristic until promotions persist an explicit `domain` column on all records.
2. Policy Center domain view is **UI context only** until Phase 8 per-domain draft APIs.
3. Campaign filter uses `campaignType` + `metadata.domain` — older campaigns without metadata appear on marketing side.
4. E-Commerce sub-nav on `/ecommerce?tab=*` does not highlight query-tab items (pathname-based active state).

---

## Validation Checklist

- [ ] `/promotions` — no product-only promotions
- [ ] `/ecommerce/promotions` — product/seller promotions only
- [ ] `/ecommerce/coupons` — opens on coupons tab
- [ ] `/marketing/analytics` — service domain options
- [ ] `/ecommerce/analytics` — PRODUCT locked, no Vendors tab
- [ ] `/marketing/campaigns` vs `/ecommerce/campaigns` — filtered lists
- [ ] Policy Center domain selector visible
- [ ] Promotion Wizard shows correct target tabs per surface
- [ ] E-Commerce sub-nav links work

---

## Rollback

1. Revert `AdminPromotionHub` to single `PLATFORM_SCOPE` without filtering.
2. Remove `app/ecommerce/promotions|coupons|campaigns|analytics` pages.
3. Remove `lib/promotion-domain/` and e-commerce sub-nav additions.

UI-only — no DB or Lambda rollback required.
