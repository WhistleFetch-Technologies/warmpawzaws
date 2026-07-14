# Phase 9 Migration Report — Analytics Engine

**Status:** Complete (local — not committed)  
**Analytics version:** `1.0.0`  
**Settlement version consumed:** `1.0.0` (preview aggregation only)

---

## Summary

Phase 9 implements a **read-only Analytics Engine** under `discount-engine/analytics/` that aggregates promotion and coupon usage from existing RDS tables and consumes **precomputed** `SettlementPreview` objects from Phase 7. It does **not** modify Rule, Benefit, Priority, Stack, or Settlement engines, checkout, payment, resolver, or any UI.

---

## Architecture

### Pipeline (read-only)

```
promotion_usages ──┐
coupon_usages ─────┼──► UsageReadRepository (read-only SQL)
                   │
SettlementPreview[]┘ (optional input — never recalculated)
                   │
                   ▼
         Domain adapters (SERVICE / PRODUCT / MEAL / …)
                   │
                   ▼
    PromotionAnalytics / CouponAnalytics / VendorAnalytics
    SavingsAnalytics / CampaignAnalytics / SettlementAnalytics
                   │
                   ▼
              AnalyticsEngine.generateReport()
                   │
                   ▼
              AnalyticsAudit + HTTP (when AUTHORITATIVE)
```

| Component | Responsibility |
|-----------|----------------|
| **AnalyticsEngine** | Orchestrates report generation |
| **AnalyticsAggregator** | Pure aggregation helpers |
| **PromotionAnalytics** | Promotion performance rows |
| **CouponAnalytics** | Coupon redemption metrics |
| **VendorAnalytics** | Per-vendor funding summary |
| **SavingsAnalytics** | Customer savings breakdown |
| **CampaignAnalytics** | Campaign-level rollup (from promotions) |
| **SettlementAnalytics** | Funding totals from previews only |
| **AnalyticsAudit** | Policy fingerprint, IDs, filters, mode |
| **AnalyticsRegistry** | Domain adapters + filters |
| **RdsUsageReadRepository** | Read `promotion_usages`, `coupon_usages` |

---

## Analytics flow

1. Check `DISCOUNT_ENGINE_V2_ANALYTICS_MODE`.
2. Load usage snapshot from RDS (parameterized date/vendor/customer filters).
3. Apply domain adapter filter (`SERVICE`, `PRODUCT`, `MEAL`, `PACKAGE`, `PHARMACY`, `ALL`).
4. Aggregate metrics in memory — **never re-run discount or settlement math**.
5. Optionally aggregate supplied `SettlementPreview[]` for funding breakdown.
6. Attach `AnalyticsAudit` with runtime policy fingerprint.
7. **SHADOW:** log summary to CloudWatch; HTTP returns 403.
8. **AUTHORITATIVE:** expose via admin APIs; extend `/admin/promotions/stats`.

---

## Aggregation strategy

| Metric | Source | Notes |
|--------|--------|-------|
| Usage count | `COUNT(*)` grouped by promotion/coupon ID | From usage tables |
| Savings | `SUM(discount_amount)` | Promotions only; coupons may lack amount |
| Average discount | `savings / usageCount` | |
| Vendor vs platform savings | `promotion_type` dimension | |
| Settlement funding | Sum of preview fields | `vendorDiscountShare`, `platformCost`, etc. |
| ROI / conversion | `null` placeholder | Requires click/funnel schema |

Historical rollups: on-demand queries capped at 10k rows. No new EventBridge job in Phase 9.

---

## Dashboard integration

| Dashboard | Phase 9 change |
|-----------|----------------|
| Admin Marketing Hub | **No UI change** — can consume `/admin/analytics/discount-engine/*` when AUTHORITATIVE |
| `/admin/promotions/stats` | Extended with optional `engineStats.totals` when AUTHORITATIVE |
| Finance / Settlement dashboards | Unchanged — settlement analytics accepts previews for future wiring |
| Vendor dashboard | Unchanged — vendor endpoint available at `/admin/analytics/discount-engine/vendors/:id` |

---

## Reuse map

| Existing | Phase 9 relationship |
|----------|------------------------|
| `GET /admin/promotions/stats` | **Extended** — same tables + optional engine totals |
| `reports.ts` | **Not duplicated** — future promo report template can call engine |
| `settlements.ts` | **Not touched** — settlement analytics reads previews only |
| Phase 7 `SettlementPreview` | **Consumed** — `buildSettlementAnalytics()` |
| `production-bridge.ts` | **Not modified** — shadow resolver logs unchanged |
| Allyticas product analytics | **Separate domain** |

---

## New HTTP endpoints

| Method | Path | Auth | Mode |
|--------|------|------|------|
| GET | `/admin/analytics/discount-engine/overview` | Admin | AUTHORITATIVE |
| GET | `/admin/analytics/discount-engine/promotions` | Admin | AUTHORITATIVE |
| GET | `/admin/analytics/discount-engine/coupons` | Admin | AUTHORITATIVE |
| GET | `/admin/analytics/discount-engine/vendors/:vendorId?` | Admin | AUTHORITATIVE |
| GET | `/admin/analytics/discount-engine/savings` | Admin | AUTHORITATIVE |
| GET | `/admin/analytics/discount-engine/mode` | Admin | Always (diagnostics) |

Registrar: `endpoints/discount-analytics.endpoints.ts`  
Registered in `handler/index.ts` after `registerAnalyticsEndpoints`.

---

## Files added / modified

### Added

```
discount-engine/analytics/
├── analytics-engine.ts
├── analytics-aggregator.ts
├── analytics-audit.ts
├── analytics-configuration.ts
├── analytics-mode.ts
├── analytics-registry.ts
├── promotion-analytics.ts
├── coupon-analytics.ts
├── vendor-analytics.ts
├── campaign-analytics.ts
├── savings-analytics.ts
├── settlement-analytics.ts
├── types.ts
├── index.ts
├── repositories/usage-read-repository.ts
└── __tests__/analytics-engine.test.ts

endpoints/discount-analytics.endpoints.ts
docs/ANALYTICS_CURRENT_STATE.md
docs/.../PHASE9_MIGRATION_REPORT.md (this file)
```

### Modified

| File | Change |
|------|--------|
| `handler/index.ts` | Register discount analytics endpoints |
| `endpoints/promotions.ts` | Optional `engineStats` on `/admin/promotions/stats` when AUTHORITATIVE |

**Not modified:** Resolver, stack, settlement engines, checkout, payment, booking, admin/vendor/customer UI.

---

## Feature flag

**`DISCOUNT_ENGINE_V2_ANALYTICS_MODE`**

| Mode | Generation | HTTP exposure | `/admin/promotions/stats` |
|------|------------|---------------|---------------------------|
| `OFF` (default) | None | 503 | Legacy stats only |
| `SHADOW` | Yes + CloudWatch | 403 | Legacy stats only |
| `AUTHORITATIVE` | Yes | Full JSON | Includes `engineStats` |

Helpers: `getAnalyticsMode()`, `isAnalyticsEnabled()`, `isAnalyticsPubliclyExposed()`.

---

## Testing

```bash
cd backend/lambda && npm test -- discount-engine/analytics
```

| Test file | Coverage |
|-----------|----------|
| `analytics/__tests__/analytics-engine.test.ts` | Aggregator, settlement preview consumption, engine modes, mock repository |

Scenarios covered:
- Promotion aggregation (platform/vendor)
- Coupon remaining uses
- Combined savings
- Settlement preview aggregation (no recalculation)
- OFF / SHADOW / AUTHORITATIVE modes

**Verified:** Analytics code path does not import or invoke resolver settle/booking create flows.

---

## Known limitations

1. **`coupon_usages` has no `discount_amount`** — coupon savings may be zero until join to orders/bookings or schema extension.
2. **ROI / conversion** — placeholders; need click schema + funnel data.
3. **Historical settlement analytics** — requires persisted `SettlementAudit` rows (Phase 7 shadow logs are CloudWatch-only today).
4. **Vendor ID on promotion_usages** — not in base migration; repository uses NULL until join enrichment.
5. **No scheduled rollup job** — large date ranges capped at 10k rows per query.
6. **UI not wired** — dashboards unchanged; APIs ready for AUTHORITATIVE rollout.

---

## Rollback strategy

| Step | Action |
|------|--------|
| Immediate | Set `DISCOUNT_ENGINE_V2_ANALYTICS_MODE=OFF` on Lambda |
| HTTP | New endpoints return 503; existing dashboards unaffected |
| Stats extension | `engineStats` omitted when not AUTHORITATIVE — backward compatible |
| Code | Remove `registerDiscountAnalyticsEndpoints` registration if full revert needed |

No migrations required. No booking or payment behaviour change.

---

## Success criteria checklist

- [x] Analytics Engine implemented (`AnalyticsEngine`)
- [x] Existing dashboards not duplicated (UI unchanged)
- [x] Existing `/admin/promotions/stats` reused and extended
- [x] Promotion analytics available
- [x] Coupon analytics available
- [x] Vendor analytics available
- [x] Settlement analytics from previews (no recalculation)
- [x] Customer savings analytics available
- [x] No impact on booking/payment/resolver flows
- [x] Feature flag OFF / SHADOW / AUTHORITATIVE
- [x] Unit tests added
- [x] Documentation (`ANALYTICS_CURRENT_STATE.md`, this report)
