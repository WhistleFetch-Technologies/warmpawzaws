# Analytics Gap Analysis

**Sprint:** E — Analysis only  
**Date:** 2026-07-03

---

## Executive summary

Warmpawz has **mature platform, finance, and product analytics** but **immature promotion/coupon/campaign analytics**. Phase 9 discount-engine analytics (backend, feature-flagged) closes the API gap; **UI, reporting, and campaign automation gaps remain**.

---

## Functional gaps

| ID | Gap | Priority | Evidence |
|----|-----|----------|----------|
| F-01 | No unified promo/coupon analytics dashboard | **P0** | Phase 9 APIs exist; UI only has `/admin/promotions/stats` cards |
| F-02 | No `/reports` admin page | **P1** | Nav + RBAC in `AdminLayout.tsx`; backend `reports.ts` unused by UI |
| F-03 | Coupon savings not in usage table | **P1** | `coupon_usages` lacks `discount_amount` |
| F-04 | No promotion funding / settlement liability view | **P1** | Finance reports lack promo columns; Phase 7 preview not persisted |
| F-05 | No vendor promo performance dashboard | **P2** | Vendor hubs show CRUD counts only |
| F-06 | Notification campaign analytics API unused | **P2** | `/campaigns/:id/analytics` — no UI tab |
| F-07 | ROI / conversion not computed | **P2** | Phase 9 placeholders; click schema incomplete |
| F-08 | No customer savings admin view | **P2** | Phase 9 savings API only |
| F-09 | Duplicate vendor analytics routes | **P2** | `/analytics` vs `/operations/analytics` |
| F-10 | No scheduled promo aggregation | **P3** | On-demand SQL only; no EventBridge rollup |

---

## UX gaps

| ID | Gap | Priority | Notes |
|----|-----|----------|-------|
| U-01 | Marketing stats mislabeled | **P2** | `totalRevenue` = sum of discounts in `/admin/promotions/stats` |
| U-02 | Hardcoded KPI % deltas | **P3** | Literal `change: 12.5` on admin analytics page |
| U-03 | No date range on promo stats | **P2** | Marketing hub lacks period filter |
| U-04 | Product vs business analytics siloed | **P2** | Different nav, tables, mental models |
| U-05 | Empty/error states on finance reports | **P3** | Inconsistent across accrual tabs |
| U-06 | No export on promotion dashboard | **P2** | Finance tabs have CSV; promos don't |
| U-07 | Mobile analytics layout legacy | **P3** | 430px `AnalyticsDashboard` vs full `/analytics` |

**Good UX patterns to reuse:** Finance accrual date range + CSV; `/analytics` tab layout; promotion wizard lifecycle tabs.

---

## Architecture gaps

| ID | Gap | Priority | Notes |
|----|-----|----------|-------|
| A-01 | Analytics persistence | **P1** | Resolver/settlement audit in CloudWatch only |
| A-02 | Duplicate report routes | **P2** | `reports.ts` + `admin-advanced.ts` overlap |
| A-03 | Duplicate vendor analytics files | **P2** | `vendor-analytics.ts` vs `vendorAnalytics.vendor.ts` |
| A-04 | No shared chart/metric package | **P2** | Recharts duplicated per page |
| A-05 | Usage tracking scattered | **P1** | `vendor-promotion-usage.ts` vs `UsageTracker` contract unused |
| A-06 | Campaign domains split | **P2** | Commercial promos vs push notification campaigns — no unified model |

---

## Reporting gaps

| Report need | Current state | Gap |
|-------------|---------------|-----|
| Promotion performance | `/admin/promotions/stats` + Phase 9 API | No UI report, no CSV |
| Coupon performance | Phase 9 API only | No dedicated report; savings understated |
| Vendor funding | Accrual/earnings CSV | No promo funding columns |
| Settlement + promo | Settlement batch reports | No discount funding breakup |
| Campaign ROI | Notification API only | No commercial campaign ROI |
| Customer savings | Phase 9 savings API | No dashboard |

---

## Promotion analytics matrix

| Capability | Status |
|------------|--------|
| Promotion usage | **Supported** — `promotion_usages`, stats API |
| Promotion performance | **Partial** — Phase 9 engine; no UI |
| Savings | **Supported** — SUM(discount_amount) |
| Revenue influenced | **Partial** — original_amount when recorded |
| Conversions | **Missing** — no funnel tied to promos |
| Top promotions | **Partial** — Phase 9 aggregation |
| Expired promotions | **Supported** — lifecycle tabs in hub |
| Promotion lifecycle | **Supported** — wizard + dashboard tabs |

---

## Coupon analytics matrix

| Capability | Status |
|------------|--------|
| Coupon usage / redemptions | **Supported** — `coupon_usages` count |
| Coupon performance | **Partial** — Phase 9; no discount amount in table |
| Remaining uses | **Partial** — max_uses vs count in validate flow |
| Top / least used | **Partial** — Phase 9 |
| Failed coupons | **Missing** — no failed validation log table |
| Expired / disabled | **Partial** — coupon CRUD status |

---

## Vendor analytics matrix

| Capability | Status |
|------------|--------|
| Vendor promotions CRUD | **Supported** |
| Vendor promo performance | **Missing** dashboard |
| Vendor funding cost | **Missing** |
| Vendor earnings | **Supported** — earnings/settlement dashboards |
| Commission analytics | **Supported** — seller commission tab |

---

## Finance & settlement matrix

| Capability | Status |
|------------|--------|
| Settlement batch reports | **Supported** — `reports.ts`, finance hub |
| Vendor daily accrual | **Supported** |
| Booking earnings waterfall | **Supported** |
| Funding split (platform/vendor/shared) | **Partial** — Phase 7 preview only |
| Promo impact on commission | **Partial** — hook bridge when AUTHORITATIVE |

---

## Recommended sprint plan (implementation — not this sprint)

| Sprint | Focus |
|--------|-------|
| **E.1** | Admin promo analytics tab on `/analytics` or `/promotions` — wire Phase 9 AUTHORITATIVE APIs |
| **E.2** | Build `/reports` page — reuse `reports.ts` + finance CSV patterns |
| **E.3** | Finance accrual promo columns + settlement funding summary |
| **E.4** | Vendor promo performance widget in vendor hub |
| **E.5** | Notification campaign analytics UI |
| **E.6** | Campaign builder v2 (commercial) — deferred; see CAMPAIGN_CURRENT_STATE |

---

## Reuse strategy (summary)

1. **Do not duplicate SQL** — consume Phase 9 `RdsUsageReadRepository` / admin discount-engine APIs.
2. **Extend `/analytics` page** — new tab, same Recharts + KPI pattern.
3. **Extend finance CSV reports** — add columns, not new report engines.
4. **Extend `/admin/promotions/stats`** — already wired for `engineStats` when AUTHORITATIVE.
5. **Do not fork settlement math** — read Phase 7 preview / audit when persisted.

---

## Deferred (not bugs)

- Full campaign builder (multi-step journeys, A/B tests)
- Real-time analytics streaming
- Customer-facing savings history admin
- ML-based promo recommendations
- Cross-domain attribution (promo → LTV)
