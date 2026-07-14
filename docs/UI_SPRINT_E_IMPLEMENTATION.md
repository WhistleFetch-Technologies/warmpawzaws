# UI/UX Sprint E — Marketing Analytics Implementation

**Date:** 2026-07-03  
**Scope:** Admin marketing analytics dashboards consuming Phase 9 APIs  
**Status:** Implemented locally — not committed  
**Route:** `/marketing/analytics` (Marketing → Analytics)

---

## Executive Summary

Sprint E exposes the **existing Phase 9 Discount Engine Analytics** through a production-ready admin UI under Marketing. All metrics come from `/admin/analytics/discount-engine/*` and `/admin/promotions/stats` — **no duplicate SQL, no client-side discount calculations**.

---

## Architecture

```
Marketing sidebar → /marketing/analytics
  └── MarketingAnalyticsHub
        ├── useDiscountAnalytics (hook)
        ├── discount-analytics-api.ts
        └── Tabs
              ├── Overview (KPIs + top promo/coupon/vendor cards)
              ├── Promotions (table + PromotionCard drawer)
              ├── Coupons (table + CouponCard drawer)
              ├── Vendors (table)
              ├── Savings (charts + top offers)
              ├── Settlement (Phase 7 preview display-only)
              └── Campaigns (Phase 9 campaigns + Phase 10 mode gate)
```

---

## Dashboards Extended

| Dashboard | Data source |
|-----------|-------------|
| Overview | `overview` + `/admin/promotions/stats` |
| Promotions | `report.promotions` |
| Coupons | `report.coupons` |
| Vendors | `report.vendors` |
| Savings | `report.savings` |
| Settlement | `report.settlement` (preview only) |
| Campaigns | `report.campaigns` + `/admin/commercial-campaigns/mode` |

Platform `/analytics` page was **not duplicated** — marketing analytics lives under Marketing nav.

---

## APIs Consumed

| Endpoint | Usage |
|----------|--------|
| `GET /admin/analytics/discount-engine/overview` | Primary report |
| `GET /admin/analytics/discount-engine/mode` | Enablement / SHADOW guard |
| `GET /admin/promotions/stats` | Active promotion KPI |
| `GET /admin/commercial-campaigns/mode` | Campaign tab gate |

No new backend endpoints introduced.

---

## Components Reused

| Component | Source |
|-----------|--------|
| `StatCard` | `components/admin/shared/StatCard.tsx` |
| `PromotionCard`, `CouponCard` | `@warmpawz/promotion-management-ui` |
| `RevenueChart` pattern | Recharts via `DiscountAnalyticsCharts.tsx` |
| `@warmpawz/ui` Table, Tabs, Dialog, Select | shared UI package |
| `isoRangeFromPreset` | `hooks/product-analytics/useProductAnalyticsRange.ts` |
| CSV export pattern | inline `downloadCsv` (same as `/analytics`) |

---

## Files Added

- `apps/admin-web/app/marketing/analytics/page.tsx`
- `apps/admin-web/components/admin/marketing/analytics/*`
- `apps/admin-web/hooks/marketing/useDiscountAnalytics.ts`
- `apps/admin-web/lib/marketing-analytics/*`

## Files Modified

- `packages/shared-types/src/admin-portal-nav.ts`
- `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx`

---

## Charts

- **Bar:** savings by month, funding trends (stacked platform/vendor/shared)
- **Pie:** savings by category
- Recharts only — no new chart library

---

## Filters

- Date preset: 24h / 7d / 30d / 90d → `from` / `to` ISO query params
- Domain: ALL, SERVICE, MEAL, PRODUCT, PHARMACY, PACKAGE
- Vendor ID (optional)
- Persisted in `localStorage` (`warmpawz.marketing-analytics.filters`)

---

## Exports

Per-tab CSV via `MetricTable` → `downloadCsv()` (promotions, coupons, vendors, savings, settlement, campaigns).

---

## Known Limitations

1. Requires `DISCOUNT_ENGINE_V2_ANALYTICS_MODE=AUTHORITATIVE` on dev Lambda — SHADOW returns 403 with helpful message
2. Settlement tab empty when no settlement preview input in analytics engine
3. Campaign rows depend on Phase 9 campaign aggregator (promotion usage metadata)
4. ROI/conversion may be null in engine output
5. No cross-link to `/promotions` edit from analytics drawer yet

---

## Future Campaign Analytics

When commercial campaigns generate linked usage, extend Campaign tab with:
- `GET /admin/commercial-campaigns/:id/analytics`
- Timeline + ROI from campaign orchestration metadata

---

## Validation Checklist

- [x] Overview KPIs from Phase 9 + legacy stats
- [x] Promotion / coupon / vendor / savings tabs
- [x] Settlement display-only
- [x] Campaign tab with Coming Soon when engine OFF
- [x] Filters + persist + refresh
- [x] Charts (Recharts)
- [x] Tables with search + CSV export
- [x] Drill-down dialogs with PromotionCard / CouponCard
- [x] Loading / error / empty states
- [x] Responsive layout + a11y labels
- [x] No analytics engine modifications
- [x] No duplicate reporting endpoints

---

## Rollback Strategy

Remove nav entry and `/marketing/analytics` route — no backend impact.
