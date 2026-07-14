# Warmpawz Analytics — Current State

**Sprint:** E — Analysis (updated 2026-07-03)  
**Prior:** Phase 9 discovery doc (2026-07-03)  
**Scope:** Dashboards, reports, APIs, components, UX, reuse, limitations.

---

## Executive summary

Warmpawz operates **four analytics domains** that must stay separate:

| Domain | Primary UI | Data source |
|--------|------------|-------------|
| **Platform business** | Admin `/analytics`, finance hub | Bookings, orders, `vendor_earnings`, settlements |
| **Product telemetry** | Admin `/product-analytics` | `analytics_events`, Allyticas ingest |
| **Promotions & discounts** | Admin `/promotions`, `/marketing` (stats only) | `promotion_usages`, `coupon_usages`, Phase 9 engine |
| **Push campaigns** | Admin `/notification-engine` | `notification_campaigns` |

The **Discount Engine backend is complete through Phase 7**; **Phase 9 read-only analytics** adds API aggregation (feature-flagged). **No unified promo analytics dashboard exists yet.** Finance/settlement reporting is mature but **lacks promotion funding breakdown**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin / Vendor UI                        │
│  /analytics  /finance  /promotions  /marketing  /product-*   │
└───────────────┬─────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬──────────────┬─────────────────┐
    ▼           ▼           ▼              ▼                 ▼
 analytics   reports    promotions   product-analytics   notification
  .admin.ts    .ts         .ts           routes           -campaigns
    │           │           │              │                 │
    ▼           ▼           ▼              ▼                 ▼
 Bookings/    Settlement   promotion_    analytics_      notification_
 Orders       tables       usages        events          campaigns
 vendor_                   coupon_usages
 earnings
                │
                ▼
     discount-engine/analytics/  (Phase 9 — read-only)
                │
                ▼
     SettlementPreview aggregate (no recalculation)
```

---

## Dashboards

See **`docs/ANALYTICS_DASHBOARD_INVENTORY.md`** for full route/component/API tables.

### Admin (canonical)

| Route | Purpose | Promo relevance |
|-------|---------|-----------------|
| `/analytics` | Platform KPIs, revenue, vendors, behavioral | None today |
| `/product-analytics` | Mobile/web telemetry | Separate domain |
| `/finance` | Settlements, accrual, earnings, GST | No promo columns |
| `/ecommerce` | Marketplace + seller analytics | Product discounts only |
| `/promotions` | Promotion hub (CRUD + lifecycle) | Stats cards only |
| `/marketing` | Legacy marketing monolith | Coupons, banners, spotlight |
| `/notification-engine` | Push campaign builder | Not commercial promos |
| `/settlements` | Standalone settlement ops | — |
| `/enterprise` | B2B revenue | — |

**Nav gap:** `/reports` in sidebar — **no page implemented**.

### Vendor

| Route | Purpose |
|-------|---------|
| `/operations/analytics` | Performance + earnings |
| `/analytics` | Alternate metrics screen (overlap) |
| `/seller` | E-com seller analytics |
| Earnings/settlements dashboards | Finance |
| Promo hubs | CRUD only — no performance charts |

### Customer

No analytics dashboards. Telemetry ingest only.

---

## Reports

| Report | API / generator | UI |
|--------|-----------------|-----|
| Revenue, bookings, vendors, customers | `POST /admin/reports/generate` | **No dedicated page** |
| Financial summary | `/admin/reports/financial/summary` | Finance tabs (partial) |
| Settlements | `generateSettlementsReport` | Finance + `/settlements` |
| Vendor daily accrual CSV | `/admin/finance/vendor-daily-accrual/export.csv` | Finance tab |
| Booking earnings CSV | `/admin/finance/vendor-booking-earnings/export.csv` | Finance tab |
| Promotion stats | `/admin/promotions/stats` | Marketing + `/promotions` |
| Phase 9 discount analytics | `/admin/analytics/discount-engine/*` | **None** |
| E-commerce analytics | `/admin/ecommerce/analytics` | E-commerce tab |
| Notification campaign analytics | `/campaigns/:id/analytics` | **None** |

---

## Current APIs

### Platform analytics
`GET /admin/analytics/overview|kpis|revenue|categories|vendors|customers|peak-times|funnel|sales-by-role`

### Finance & settlement
`/admin/finance/*`, `/settlements/*`, `/admin/settlements/*`, accrual + earnings exports

### Promotions
`/admin/promotions/*`, `/admin/coupons/*`, `/admin/promotions/stats`, `/admin/promotions/analytics` (clicks)

### Phase 9 discount engine (local, committed)
`GET /admin/analytics/discount-engine/overview|promotions|coupons|vendors|savings|mode`  
Flag: `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` = OFF | SHADOW | AUTHORITATIVE

### Vendor
`/vendor/:id/analytics`, `/vendor/analytics/*`, commission analytics

### Product
`/admin/analytics/product/*`, `POST /analytics/v1/events`

---

## Scheduled jobs

| Job | Trigger | Promo analytics? |
|-----|---------|------------------|
| Settlement calculate-daily | EventBridge | No |
| Analytics retention | EventBridge | Product events only |
| Notification process-scheduled | EventBridge/cron | Push campaigns |
| Settlement SQS processor | SQS | No |

**No promotion aggregation cron.**

---

## Current components

| Pattern | Location | Reuse |
|---------|----------|-------|
| KPI cards + tabs | `app/analytics/page.tsx` | **Extend** for promos |
| `RevenueChart` | admin analytics components | **Reuse** |
| `VendorPerformanceTable` | admin analytics | **Extend** |
| Finance CSV reports | `VendorDailyAccrualReport` etc. | **Reuse** pattern |
| `PromotionDashboard` | promotion-management-ui | **Extend** |
| Recharts | Inline | No shared package |

---

## Current UX

| Area | Assessment |
|------|------------|
| Dashboard navigation | **Good** — role-based admin nav; vendor capability routes |
| Charts | **Good** on `/analytics`; **missing** on promos |
| Filtering | **Good** date presets on platform analytics; **missing** on promos |
| Export | **Good** on finance; **missing** on promos |
| Loading / empty / error | **Mixed** — finance better than marketing |
| Responsiveness | **Good** on main admin routes |
| Accessibility | **Needs improvement** — charts lack consistent a11y labels |

See **`docs/ANALYTICS_GAP_ANALYSIS.md`** for UX gap IDs.

---

## Reuse opportunities

1. Phase 9 discount-engine APIs — single read path for promo metrics  
2. `/analytics` tab layout — add Promotions & Discounts  
3. Finance CSV pattern — promo funding columns  
4. `PromotionDashboard` — performance sub-tab  
5. `reports.ts` — new `/reports` page (nav already exists)  
6. Notification campaign analytics API — tab on notification-engine  

See **`docs/ANALYTICS_REUSE_PLAN.md`**.

---

## Campaign state

Three campaign types: commercial promos, push notifications, content/banners.  
No unified builder. Flash sale / seasonal = promotion types.  
See **`docs/CAMPAIGN_CURRENT_STATE.md`**.

---

## Limitations

1. Promo analytics UI absent despite Phase 9 backend  
2. `coupon_usages` lacks discount amounts  
3. Settlement/promo funding not in finance reports  
4. `/reports` nav without page  
5. Duplicate vendor analytics routes  
6. `totalRevenue` in promo stats = discount sum (mislabel)  
7. ROI/conversion not implemented  
8. Resolver audit not in RDS  

---

## Related documents

| Doc | Purpose |
|-----|---------|
| `ANALYTICS_DASHBOARD_INVENTORY.md` | Full dashboard catalog |
| `ANALYTICS_GAP_ANALYSIS.md` | Gaps + sprint plan |
| `ANALYTICS_REUSE_PLAN.md` | Component/API reuse matrix |
| `CAMPAIGN_CURRENT_STATE.md` | Campaign/marketing analysis |
| `backend/.../PHASE9_MIGRATION_REPORT.md` | Phase 9 engine details |
| `PROMOTION_SYSTEM_STATUS.md` | Engine + promo system map |
| `SETTLEMENT_CURRENT_STATE.md` | Settlement architecture |
| `SETTLEMENT_REUSE_MAP.md` | Phase 7+ reuse matrix |

---

## Sprint E success criteria

- [x] Every dashboard identified  
- [x] Every reporting API identified  
- [x] Existing analytics documented  
- [x] Campaign capabilities documented  
- [x] Reuse opportunities identified  
- [x] Functional / UX / architecture gaps documented  
- [x] Blueprint for Sprint E implementation produced  

**Analysis docs are local only — not committed per Sprint E constraints.**
