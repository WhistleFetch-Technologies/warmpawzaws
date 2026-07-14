# Analytics Dashboard Inventory

**Sprint:** E — Analysis only  
**Date:** 2026-07-03  
**Scope:** Every dashboard-like surface in admin-web, vendor-web, customer-web.

---

## Admin Web

### Platform analytics

| Route | Component | Widgets / charts | Filters | Export | APIs |
|-------|-----------|------------------|---------|--------|------|
| `/analytics` | `app/analytics/page.tsx` | KPI cards (GMV, commission, customers, vendors); tabs Overview / Revenue / Vendors / Customers / Behavioral / Sales; Recharts Pie + Bar; `RevenueChart`; `VendorPerformanceTable` | Date preset Select (24h–1y) | Client CSV | `/admin/analytics/kpis`, `/revenue`, `/categories`, `/vendors`, `/peak-times`, `/funnel`, `/sales-by-role` |

**Reuse:** Primary pattern for new promo analytics tab — KPI cards + Recharts + `useAnalyticsData`.

### Product telemetry (Allyticas)

| Route | Component | Widgets | Filters | Export | APIs |
|-------|-----------|---------|---------|--------|------|
| `/product-analytics` | `app/product-analytics/page.tsx` | Summary, events, screens, errors, performance, funnel, flows, search, retention; error triage table | App filter, datetime-local, presets | — | `/admin/analytics/product/*`, `/admin/analytics/error-cases/*` |

**Note:** Separate domain from business/promo analytics — uses `analytics_events` table.

### Finance & settlement

| Route | Component | Widgets | Filters | Export | APIs |
|-------|-----------|---------|---------|--------|------|
| `/finance` | `app/finance/page.tsx` | Stat cards; tabs: settlements, payouts, tiers, accrual, GST, policies, fees, schedule | Per-tab | CSV on accrual tabs | `/admin/settlements/stats`, `/admin/analytics/kpis`, finance endpoints |
| `/finance?tab=settlements` | `SettlementDashboard` | Settlement list, payment analytics cards, process actions | Status | — | `/admin/finance/settlements`, `/admin/payments/analytics`, `/settlements/summary` |
| `/finance?tab=vendor-daily-accrual` | `VendorDailyAccrualReport` | IST accrual table | Date range | CSV | `/admin/finance/vendor-daily-accrual`, `/compute`, `export.csv` |
| `/finance?tab=vendor-monthly-accrual` | `VendorMonthlyAccrualReport` | Monthly rollup | Month | CSV | `/admin/finance/vendor-daily-accrual/monthly*` |
| `/finance?tab=vendor-booking-earnings` | `VendorBookingEarningsReport` | Booking earnings waterfall | Date range | CSV | `/admin/finance/vendor-booking-earnings`, `export.csv` |
| `/settlements` | `app/settlements/page.tsx` | Standalone settlement ops, bulk process, detail modal | Status, 30d | — | `/settlements`, `/settlements/summary`, POST process |

**Reuse:** Finance report pattern (date inputs + table + server CSV) for promo funding reports.

### E-commerce

| Route | Component | Widgets | Filters | Export | APIs |
|-------|-----------|---------|---------|--------|------|
| `/ecommerce` tab=dashboard | `ECommerceDashboard` | Marketplace KPIs, recent orders/sellers | — | — | `/admin/ecommerce/analytics/platform`, `/admin/orders` |
| `/ecommerce` tab=analytics | `ECommerceAnalytics` | Revenue, orders, sellers, products metrics | Period (days) | Export button | `/admin/ecommerce/analytics?days=` |
| `/ecommerce` GST | `GSTDashboard` | GST summary, monthly, invoices | — | Download | `/admin/gst/summary`, `/monthly`, `/invoices` |
| `/ecommerce` settlements | `SettlementsDashboard` | E-com settlement list | — | — | `/settlements`, `/admin/settlements/analytics` |

### Marketing & promotions

| Route | Component | Widgets | Filters | Export | APIs |
|-------|-----------|---------|---------|--------|------|
| `/marketing` | `app/marketing/page.tsx` | Tabs: promotions, vendor-promotions, UI config, spotlight, coupons, banners, articles, announcements | Tab-level | — | Banners `/admin/banners*`, coupons CRUD, vendor promo overview |
| `/promotions` | `AdminPromotionHub` → `PromotionDashboard` | Lifecycle tabs (active/scheduled/expired/draft/coupons); wizard | Search, kind filters | Copy code | `/admin/promotions`, `/admin/coupons`, `/admin/promotions/stats` |
| `/banners` | Banner management | Banner CRUD, analytics hook | — | — | `/admin/banners/analytics` |

**Gap:** No dedicated promotion performance charts — stats cards only via `/admin/promotions/stats`.

### Notification campaigns (push)

| Route | Component | Widgets | Filters | Export | APIs |
|-------|-----------|---------|---------|--------|------|
| `/notification-engine` | `app/notification-engine/page.tsx` | Campaign builder, audience estimate, schedule/send, `CampaignPreview` | Segments, regions, templates | — | `/admin/notifications/campaigns*`, `/estimate-audience`, `/templates` |

**Gap:** `/campaigns/:id/analytics` API exists; no analytics tab in UI.

### Enterprise & insights

| Route | Component | APIs |
|-------|-----------|------|
| `/enterprise` | Enterprise revenue stats, customer table | `/admin/enterprise/revenue/stats` |
| `/vendors` insights tab | `VendorInsightsDashboard` | `/admin/vendors/insights?range=` |
| `/customers` insights tab | `CustomerInsightsDashboard` | `/admin/customers/insights?range=` |
| `/support` | Ticket stats, agent analytics | `/crm/stats`, `/crm/analytics/agents` |

### Nav gap

| Nav item | Route | Status |
|----------|-------|--------|
| Reports (`admin.reports`) | `/reports` | **Nav defined in `AdminLayout.tsx` — no `app/reports/page.tsx`** |

### Legacy / embedded

`AdminDashboard`, `OperationsDashboard`, `FinanceDashboard`, `AnalyticsDashboard` (mobile 430px layout) — older shells; canonical routes above.

---

## Vendor Web

| Route | Component | Purpose | APIs |
|-------|-----------|---------|------|
| `/` | `VendorDashboard` | Appointments, stats by timeframe, meal orders | `/vendor/:id/dashboard?timeframe=` |
| `/operations/analytics` | `VendorAnalytics` | Performance + earnings tabs, booking/revenue charts | `/vendor/:id/analytics?period=` |
| `/analytics` | `PerformanceMetricsScreen` | Metrics cards, week/month/quarter | `/vendor/analytics/performance?timeframe=` |
| `/settlements`, `/earnings`, `/finance/settlements` | `VendorEarningsSettlementDashboard` | Tier, revenue, settlements, payout request | `/vendor/:id/settlements`, `/tier`, POST `/settlements/request` |
| `/seller` | `SellerHub` → `SellerDashboard`, `SellerAnalytics` | E-com seller KPIs, top products | `/vendor/:id/analytics/sales`, `/products` |
| `/finance/wallet` | `VendorWalletDashboard` | Wallet balance/history | Wallet endpoints |
| Promotions hubs | `ServicePromotionsHub`, `SellerPromotionsHub` | Promo/coupon CRUD + inline counts | Vendor promotion APIs |

**Overlap:** `/analytics` vs `/operations/analytics` — two entry points, different components.

**Gap:** No vendor promo ROI / funding analytics dashboard.

---

## Customer Web

No admin-style analytics dashboards. Relevant surfaces:

| Surface | Type |
|---------|------|
| `/promotions` | Offer discovery (not metrics) |
| `HomeServicesDashboard`, `WalkerDashboard`, etc. | Operational UX |
| `lib/analytics.ts`, Allyticas ingest | Product telemetry only |

---

## Reusable component index

| Path | Reuse for Sprint E |
|------|-------------------|
| `admin-web/components/admin/analytics/RevenueChart.tsx` | Trend charts |
| `admin-web/components/admin/analytics/VendorPerformanceTable.tsx` | Top vendors/promos table |
| `admin-web/hooks/analytics/useAnalyticsData.ts` | Data fetching pattern |
| `admin-web/components/admin/finance/VendorDailyAccrualReport.tsx` | Date range + CSV export |
| `packages/promotion-management-ui/PromotionDashboard.tsx` | Promo lifecycle UI |
| `@warmpawz/ui` Card, Table, Tabs, Select | Layout primitives |
| Recharts (inline in pages) | Charts — not packaged |

---

## Summary counts

| App | Analytics dashboards | Promo-specific | Finance/settlement |
|-----|---------------------|----------------|------------------|
| Admin | 12+ routes | 2 (marketing, promotions) — stats only | 6+ |
| Vendor | 4 performance/finance | 2 promo hubs — CRUD only | 3 |
| Customer | 0 | 0 | 0 |
