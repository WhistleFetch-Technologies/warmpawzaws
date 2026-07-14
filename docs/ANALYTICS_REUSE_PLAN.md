# Analytics Reuse Plan

**Sprint:** E — Analysis only  
**Date:** 2026-07-03

Legend: **Reuse** = as-is | **Extend** = add fields/tabs | **Replace** = avoid for new work | **Duplicate** = do not build parallel

---

## Backend APIs

| Component | Current usage | Can reuse | Needs extension | Replacement | Migration |
|-----------|---------------|-----------|-----------------|-------------|-----------|
| `GET /admin/analytics/kpis` | `/analytics` page, finance dashboard | **Extend** | Promo KPI dimensions | No | Add optional promo slice |
| `GET /admin/promotions/stats` | Marketing hub, AdvancedPromotionsEngine | **Reuse** | `engineStats` when AUTHORITATIVE | No | Already extended Phase 9 |
| Phase 9 `/admin/analytics/discount-engine/*` | None (UI) | **Reuse** | Wire to dashboards | No | Enable AUTHORITATIVE on dev |
| `reports.ts` generators | No dedicated UI | **Reuse** | Add `promotions` template | No | Build `/reports` page |
| `admin-vendor-daily-accrual` | Finance tab | **Extend** | Promo funding columns | No | SQL join to usages |
| `vendor-booking-earnings-report` | Finance tab | **Extend** | Discount/funding columns | No | Extend CSV mapper |
| `settlements.ts` batch | Finance, EventBridge | **Reuse** | Audit JSON in breakup | **Replace** vendor_settlements queries | No new batch job |
| `product-analytics/` | `/product-analytics` | **Reuse** (separate domain) | — | No | Keep siloed |
| `vendorAnalytics.vendor.ts` | Vendor performance | **Extend** | Promo metrics endpoint | **Replace** legacy `vendor-analytics.ts` | Single registrar |
| `notification-campaigns` analytics | Unused in UI | **Reuse** | Dashboard tab | No | Notification-engine page |

---

## Admin UI components

| Component | Path | Can reuse | Needs extension | Owner dashboard |
|-----------|------|-----------|-----------------|-----------------|
| `RevenueChart` | `admin-web/.../RevenueChart.tsx` | **Reuse** | Promo savings series | Admin `/analytics` |
| `VendorPerformanceTable` | `admin-web/.../VendorPerformanceTable.tsx` | **Extend** | Top promos/vendors columns | Admin `/analytics` |
| `useAnalyticsData` | `admin-web/hooks/analytics/` | **Extend** | Discount-engine fetch hook | Admin |
| KPI card row | `app/analytics/page.tsx` | **Reuse** | Promo KPIs | Admin |
| `VendorDailyAccrualReport` | finance components | **Reuse** pattern | Promo columns in table | Admin finance |
| `PromotionDashboard` | `@warmpawz/promotion-management-ui` | **Extend** | Analytics tab / stats panel | Admin `/promotions` |
| `ECommerceAnalytics` | ecommerce components | **Extend** | Seller promo slice | Admin e-commerce |
| `SettlementDashboard` | finance/settlements | **Extend** | Funding summary card | Admin finance |
| `CampaignPreview` | notification-engine | **Reuse** | N/A (push only) | Admin notifications |

---

## Vendor UI components

| Component | Can reuse | Extension |
|-----------|-----------|-----------|
| `SellerAnalytics` | **Extend** | Promo redemption counts |
| `VendorAnalytics` | **Extend** | Offer performance tab |
| `ServicePromotionsHub` | **Extend** | Link to performance metrics |
| `VendorEarningsSettlementDashboard` | **Reuse** | Show promo-adjusted receivable when API ready |

---

## Shared packages

| Package | Reuse | Notes |
|---------|-------|-------|
| `@warmpawz/ui` | **Reuse** | Cards, tables, tabs |
| `@warmpawz/promotion-management-ui` | **Extend** | Dashboard + wizard — add analytics panel |
| Recharts | **Reuse** | Consider extracting `MetricCard` + `TrendChart` later — not P0 |

---

## Data layer

| Source | Reuse | Extension |
|--------|-------|-----------|
| `promotion_usages` | **Reuse** | Primary Phase 9 read path |
| `coupon_usages` | **Extend** | Add `discount_amount` migration (future) |
| `vendor_earnings` | **Extend** | Promo metadata JSON |
| `SettlementPreview` | **Reuse** | Aggregate only — never recalculate |
| `analytics_events` | **Separate** | Product telemetry — do not merge |

---

## Migration strategy by owner dashboard

### Admin — Platform analytics (`/analytics`)

1. Add tab **Promotions & Discounts**.
2. Hook: `useDiscountEngineAnalytics()` → Phase 9 overview API.
3. Reuse KPI cards + `RevenueChart` for savings trend.
4. Reuse `VendorPerformanceTable` pattern for top vendors/promos.

### Admin — Marketing (`/promotions`)

1. Extend `PromotionDashboard` with **Performance** sub-tab when AUTHORITATIVE.
2. Reuse existing stats cards; deep link to `/analytics` promo tab.

### Admin — Finance (`/finance`)

1. Extend accrual CSV — promo funding columns (P1).
2. Optional settlement summary card from Phase 7 preview aggregates.

### Admin — Reports (new `/reports`)

1. Create page using nav permission already defined.
2. Reuse `POST /admin/reports/generate` templates.
3. Copy CSV download pattern from `VendorDailyAccrualReport`.

### Vendor — Operations analytics

1. Consolidate `/analytics` → redirect to `/operations/analytics`.
2. Add **My Offers** section using vendor-scoped Phase 9 API (future vendor endpoint).

---

## Anti-patterns (do not duplicate)

| Do not build | Use instead |
|--------------|-------------|
| New promo usage SQL in UI | Phase 9 repository |
| Second settlement calculator | Phase 7 preview |
| Parallel `/admin/marketing/analytics` API | Extend discount-engine or promotions stats |
| Customer product analytics for promos | Business analytics tab |
| New EventBridge promo cron (initially) | On-demand Phase 9 queries |
