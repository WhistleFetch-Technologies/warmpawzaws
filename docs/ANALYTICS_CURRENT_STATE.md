# Warmpawz Analytics — Current State

**Phase:** 9 Discovery  
**Date:** 2026-07-03  
**Scope:** Read-only inventory of dashboards, reports, APIs, and reuse opportunities for Discount Engine V2 Analytics.

---

## Executive summary

Warmpawz has **general platform analytics** (bookings, revenue, vendor KPIs) and **basic promotion stats**, but **no unified discount-engine analytics module** until Phase 9. Settlement batch jobs and finance reports exist separately. Product telemetry (`analytics_events`) is a different domain and must not be conflated with promotion analytics.

Phase 9 adds `discount-engine/analytics/` as a **read-only** layer that aggregates existing usage tables and consumes settlement **previews** without recalculating discounts or settlement.

---

## Current dashboards

| Surface | Path | What it shows | Promo/coupon depth |
|---------|------|---------------|-------------------|
| Admin Marketing Hub | `apps/admin-web/app/marketing/page.tsx` | Promotions, coupons, banners | Basic stats via `/admin/promotions/stats` |
| Advanced Promotions Engine | `apps/admin-web/components/admin/marketing/AdvancedPromotionsEngine.tsx` | Promo cards + stats | Calls `/admin/promotions/stats` |
| Admin Finance Hub | `apps/admin-web/app/finance/page.tsx` | Settlement, accrual, earnings | No promo funding breakdown |
| Settlement Dashboard | `apps/admin-web/components/admin/finance/settlements/SettlementDashboard.tsx` | Batch settlements, payouts | No discount funding |
| Admin platform analytics | `apps/admin-web` (via API) | Bookings, revenue KPIs | Not promo-specific |
| Vendor analytics page | `apps/vendor-web/app/analytics/page.tsx` | Bookings, revenue | Not promo-specific |
| Vendor promo hub | `apps/vendor-web` Seller/Service promotions | CRUD + inline counts | Vendor table counters only |
| Customer promotions | `apps/customer-web/app/promotions` | Discover offers | No admin analytics |

**Reuse decision:** Extend existing admin marketing stats and finance reports — **do not** create parallel dashboard apps.

---

## Current reports

| Report | API / generator | Tables | Notes |
|--------|-----------------|--------|-------|
| Promotion stats | `GET /admin/promotions/stats` | `promotion_usages`, `promotions` | `totalRevenue` field is actually sum of discounts |
| Promotion click analytics | `GET /admin/promotions/analytics` | `promotions`, `promotion_clicks` | Click schema may be incomplete |
| Admin report templates | `GET/POST /admin/reports/*` | `reports.ts` | Revenue, bookings, **settlements**, vendors |
| Vendor daily accrual | `GET /admin/finance/vendor-daily-accrual` | `vendor_daily_accrual` | IST rollups — no promo columns yet |
| Vendor booking earnings | `GET /admin/finance/vendor-booking-earnings` | `vendor_earnings` | Waterfall CSV |
| Settlement batch report | `reports.ts` → `generateSettlementsReport` | `settlements` | Production payout ledger |
| E-commerce analytics | `GET /admin/ecommerce/analytics` | Orders/products | Seller stats |
| Vendor commission analytics | `GET /vendor/:vendorId/commission-analytics` | Commission tiers | Not promo-specific |

**Gap:** No coupon-specific report API. No promotion **funding liability** report tied to Phase 7 settlement preview.

---

## Current APIs (reuse map)

### Reuse as-is

| API | Reuse for Phase 9 |
|-----|-------------------|
| `GET /admin/promotions/stats` | Same data source; extended with `engineStats` when analytics AUTHORITATIVE |
| `GET /admin/reports/*` | Add promo report templates later — same CSV patterns |
| `GET /admin/finance/vendor-daily-accrual` | Optional future promo columns |
| Phase 7 `SettlementPreview` / audit | Settlement analytics input — **never recalculate** |

### Extend (Phase 9)

| New API | Purpose |
|---------|---------|
| `GET /admin/analytics/discount-engine/overview` | Full analytics report |
| `GET /admin/analytics/discount-engine/promotions` | Promotion performance |
| `GET /admin/analytics/discount-engine/coupons` | Coupon performance |
| `GET /admin/analytics/discount-engine/vendors/:vendorId?` | Vendor promo analytics |
| `GET /admin/analytics/discount-engine/savings` | Customer savings |
| `GET /admin/analytics/discount-engine/mode` | Feature flag diagnostics |

All gated by `DISCOUNT_ENGINE_V2_ANALYTICS_MODE`.

### Do not duplicate

| Component | Reason |
|-----------|--------|
| `reports.ts` settlement generators | Production source of truth |
| `settlements.ts` batch math | Payout pipeline |
| `analytics.admin.ts` booking KPIs | General metrics — add dimensions, don't fork |
| `product-analytics/` Allyticas | UX telemetry, different domain |
| `feeCalculator.ts` | Fees not recomputed in analytics |

---

## Data sources

| Table | Analytics use |
|-------|---------------|
| `promotion_usages` | Redemptions, savings, AOV proxy (`original_amount`) |
| `coupon_usages` | Redemption counts (no `discount_amount` column — join gap) |
| `promotions`, `coupons`, `vendor_promotions`, `vendor_service_promotions` | Dimensions |
| `vendor_earnings`, `delivery_settlements` | Future funding reconciliation (Phase 9+ read joins) |
| Resolver shadow logs | CloudWatch only today — not RDS |

---

## Scheduled jobs

| Job | Schedule | Promo analytics? |
|-----|----------|------------------|
| `POST /settlements/calculate-daily` | EventBridge daily | No |
| `settlement-processor.ts` | SQS | No |
| `analytics-retention.ts` | EventBridge | Product events only |

**No promotion aggregation cron exists.** Phase 9 uses on-demand SQL via `RdsUsageReadRepository`. Future rollups should extend `vendor-daily-accrual` compute — not a duplicate scheduler.

---

## Current gaps

1. No unified analytics engine module (addressed in Phase 9).
2. Coupon analytics lacks discount amounts in `coupon_usages` — savings may be understated until schema/join enrichment.
3. No ROI / conversion funnel wired (placeholder `null` in engine).
4. Settlement analytics requires supplied previews — historical settlement audit table not yet persisted.
5. `promotion_clicks` table referenced but migration unclear.
6. Admin/vendor/customer UI **not modified** in Phase 9 — dashboards consume APIs when AUTHORITATIVE.

---

## Reuse opportunities (priority)

| Priority | Action |
|----------|--------|
| P0 | Read `promotion_usages` / `coupon_usages` via single repository |
| P0 | Aggregate settlement from `SettlementPreview` only |
| P1 | Extend `/admin/promotions/stats` with engine totals |
| P1 | Add promo columns to vendor accrual report |
| P2 | Persist resolver audit to RDS for historical settlement analytics |
| P2 | Wire admin marketing hub to `/admin/analytics/discount-engine/*` when AUTHORITATIVE |

---

## Feature flag (Phase 9)

| Mode | Behaviour |
|------|-----------|
| `OFF` (default) | No generation; APIs return 503 |
| `SHADOW` | Generate + CloudWatch log; HTTP returns 403 (not public) |
| `AUTHORITATIVE` | HTTP exposes analytics; `/admin/promotions/stats` includes `engineStats` |

Env: `DISCOUNT_ENGINE_V2_ANALYTICS_MODE`
