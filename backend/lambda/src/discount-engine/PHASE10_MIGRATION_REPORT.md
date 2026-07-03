# Phase 10 — Commercial Campaign Engine Migration Report

**Date:** 2026-07-03  
**Scope:** Backend orchestration layer for commercial discount campaigns  
**Feature flag:** `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` (`OFF` | `SHADOW` | `AUTHORITATIVE`)

---

## 1. Architecture

The Commercial Campaign Engine lives under `backend/lambda/src/discount-engine/campaign/`. It is **pure orchestration**:

```
CampaignEngine
├── CampaignBuilder      — draft metadata from input/template
├── CampaignResolver     — active context + attribution enrichment
├── CampaignScheduler    — maps schedule → promotion start/end dates
├── CampaignFunding      — validates funding policy (no payout math)
├── CampaignTemplate     — reusable template registry (config-driven)
├── CampaignLifecycle    — state transitions
├── CampaignRegistry     — in-memory index + type/template catalog
├── CampaignAudit        — audit trail + promotion metadata enrichment
└── CampaignConfiguration — campaign types + lifecycle graph
```

**Integrations (bridges only — no engine duplication):**

| Bridge | Reuses |
|--------|--------|
| `promotion-bridge` | `buildPromotionPersistenceFromAdminBody` + `insert('promotions')` |
| `notification-bridge` | Links `notification_campaign_id` — no push engine duplication |
| `analytics-bridge` | Phase 9 `AnalyticsEngine.generateReport()` filtered by linked IDs |
| `settlement-bridge` | Phase 7 funding attribution payload — no settlement math |

**Database:** `db/migrations/1046_commercial_discount_campaigns.sql`

- `commercial_discount_campaigns`
- `commercial_campaign_promotion_links`
- `commercial_campaign_audit_log`

Distinct from `notification_campaigns`, `donation_campaigns`, `advertising_campaigns`.

---

## 2. Campaign Flow

```
Admin API → CampaignEngine.createCampaign / createFromTemplate
         → draft stored in commercial_discount_campaigns
         → lifecycle transitions (draft → review → approved → scheduled/running)
         → orchestrateCampaign (AUTHORITATIVE)
              → Promotion Bridge creates promotion(s)
              → Coupon Bridge creates coupon(s)
              → link rows in commercial_campaign_promotion_links
              → Notification Bridge (skip | link | create stub)
              → Analytics Bridge preview
              → Settlement Bridge attribution
              → CampaignAudit persisted
```

**SHADOW mode:** metadata + audit + mock promotion/coupon IDs — no `insert` into promotions/coupons.

**OFF mode:** all orchestration endpoints return 503.

---

## 3. Funding Flow

Campaign stores `funding_type` + optional `funding_split` JSONB.

Supported:

- `PLATFORM` — 100% platform
- `VENDOR` — 100% vendor
- `SHARED` / `CUSTOM` — split (e.g. 50/50, 70/30, 20/80)

`CampaignFunding.toSettlementFundingPayload()` passes policy to Settlement Engine. **Campaign Engine never calculates payouts.**

Promotion records receive `funding_type` / `funding_split` via existing promotion persistence when materialized in AUTHORITATIVE mode.

---

## 4. Notification Integration

`notification_mode`:

- `skip` — no notification action
- `link` — stores existing `notification_campaign_id`
- `create` — stub; delegates to Notification Engine API (not invoked in Phase 10)

No changes to `notification-campaigns` endpoints or scheduler.

---

## 5. Analytics Integration

`GET /admin/commercial-campaigns/:id/analytics` calls `fetchCampaignAnalytics()`:

1. Loads campaign promotion/coupon links
2. Invokes Phase 9 `AnalyticsEngine` (when `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` ≠ OFF)
3. Filters promotion/coupon metrics by linked IDs

Campaign supplies metadata; Analytics Engine aggregates. **Analytics Engine not modified.**

---

## 6. Settlement Integration

`GET /admin/commercial-campaigns/:id/settlement-attribution` returns:

- `attribution` — campaignId, name, version, template, fundingPolicy
- `fundingPayload` — for Phase 7 Settlement Engine consumption

**Settlement Engine not modified.**

---

## 7. Promotion Integration

Orchestration calls `createPromotionForCampaign()` which:

1. Enriches `metadata.campaign` with attribution
2. Uses `buildPromotionPersistenceFromAdminBody()`
3. Inserts via existing `promotions` table

Coupons created via same column mapping as `POST /admin/coupons`. Campaign attribution for coupons is via link table (coupons table has no metadata column).

**Promotion/Coupon engines not duplicated.**

---

## 8. Scheduling

`CampaignScheduler.resolveCampaignSchedule()` maps:

- `immediate` → now + default window
- `scheduled` → explicit start/end
- `recurring` → stores `recurring_rule` on campaign; promotion window for current cycle

Reuses promotion `start_date` / `end_date`. **No new EventBridge scheduler.**

---

## 9. Campaign Types & Templates

Configuration-driven registries in `campaign-configuration.ts` and `campaign-template.ts`:

Types: flash_sale, seasonal, festival, weekend_offer, first_order, referral, launch, vendor_sponsored, platform_sponsored, shared, custom.

Templates: flash_sale, weekend, holiday, black_friday, christmas, new_year, summer_sale, pet_health_week, vendor_launch, etc.

Unknown types resolve to `custom` — no hardcoded business branches.

---

## 10. New HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/commercial-campaigns/mode` | Feature flag status |
| GET | `/admin/commercial-campaigns/registry` | Types + templates catalog |
| GET | `/admin/commercial-campaigns` | List campaigns |
| GET | `/admin/commercial-campaigns/:id` | Get campaign |
| POST | `/admin/commercial-campaigns` | Create draft campaign |
| POST | `/admin/commercial-campaigns/from-template/:templateId` | Create from template |
| POST | `/admin/commercial-campaigns/:id/orchestrate` | Run orchestration |
| POST | `/admin/commercial-campaigns/:id/lifecycle/:status` | Lifecycle transition |
| GET | `/admin/commercial-campaigns/:id/analytics` | Campaign analytics (Phase 9 filter) |
| GET | `/admin/commercial-campaigns/:id/settlement-attribution` | Settlement metadata |

Registered in `handler/index.ts` via `registerCommercialCampaignEndpoints`.

---

## 11. Feature Flags

| Flag | Values | Behavior |
|------|--------|----------|
| `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | OFF (default) | Engine disabled; APIs return 503 |
| | SHADOW | Metadata + audit; mock promo/coupon IDs |
| | AUTHORITATIVE | Full orchestration with promotion/coupon inserts |

Independent of `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` (analytics preview requires analytics flag ON).

---

## 12. Files Added / Modified

**Added:**

- `db/migrations/1046_commercial_discount_campaigns.sql`
- `backend/lambda/src/discount-engine/campaign/**` (engine, bridges, repository, tests)
- `backend/lambda/src/endpoints/commercial-campaign.endpoints.ts`
- `backend/lambda/src/discount-engine/PHASE10_MIGRATION_REPORT.md`

**Modified:**

- `backend/lambda/src/discount-engine/index.ts` — export campaign module
- `backend/lambda/src/handler/index.ts` — register endpoints

**Not modified (per constraints):**

- Rule, Benefit, Priority, Stack, Settlement, Analytics, Notification engines
- Promotion resolver / pricing paths
- Admin UI

---

## 13. Rollback Strategy

1. Set `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE=OFF` on Lambda — immediate disable
2. Migration is additive (`CREATE TABLE IF NOT EXISTS`) — no rollback required for schema
3. Linked promotions/coupons remain valid standalone entities if campaign rows removed
4. Remove endpoint registration only if full code rollback needed

---

## 14. Known Limitations

- Notification `create` mode is a stub — does not call Notification Engine create API yet
- Recurring campaigns store rule metadata; cycle rotation not automated (reuse promotion scheduling later)
- Coupon campaign attribution via link table only (no coupons.metadata column)
- Analytics filtering is post-aggregation by linked IDs — requires promotions to carry campaign metadata for usage-row correlation in future
- Migration not applied to dev RDS until team runs migration script
- No UI (Sprint E / future Campaign UI consumes these APIs)

---

## 15. Future UI

Sprint E and dedicated Campaign UI should:

- Consume `/admin/commercial-campaigns/*` APIs
- Use `/registry` for type/template pickers
- Show analytics via `/analytics` tab calling campaign analytics endpoint
- Wire notification link picker to existing notification campaign admin UI

---

## 16. Tests

`backend/lambda/src/discount-engine/campaign/__tests__/`:

- `campaign-mode.test.ts` — feature flag
- `campaign-funding.test.ts` — funding validation + settlement payload
- `campaign-builder.test.ts` — templates + draft building
- `campaign-engine.test.ts` — orchestration scenarios (platform, shared, lifecycle, no pricing fields)

Run: `cd backend/lambda && npm test -- --testPathPattern=campaign`

---

## 17. Verification Checklist

- [x] Campaign Engine implemented as orchestration only
- [x] Promotion engine reused via persistence bridge
- [x] Coupon creation mirrors admin API
- [x] Notification integration via link (no duplication)
- [x] Analytics integration via Phase 9 bridge
- [x] Settlement attribution via Phase 7 payload (no math)
- [x] Funding, scheduling, templates, lifecycle supported
- [x] Feature flag implemented
- [x] Documentation completed
- [x] Tests added
- [x] No commits / pushes (local only per request)
