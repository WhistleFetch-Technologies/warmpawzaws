# Commercial Campaign Completion — Phase C1 Implementation

**Status:** Implemented locally (not committed / not pushed)  
**Date:** 2026-07-08  

Based on CAMPAIGN_* analysis package + Phase E1 `discount_domain` architecture.

---

## Architecture

```
CommercialCampaignHub (surface = marketing | ecommerce)
        │
        ▼
Campaign Engine (orchestration only)
  create / link / schedule / fund / monitor / lifecycle
        │
        ├─► Promotions & Coupons (Discount Engine prices these)
        ├─► Policy Center (inherit — no Best Offer / stack override)
        ├─► Settlement (consumes fundingPayload)
        ├─► Analytics Engine (campaign-grain KPIs from links)
        └─► Notification Engine (skip | link | create)
```

**Rule:** Campaigns never calculate discounts. Discount Engine remains the only pricing engine.

---

## Domain model

| Field | Values | Persistence |
|-------|--------|-------------|
| `discount_domain` | `SERVICE` \| `ECOMMERCE` | Column (migration 1064) |
| `surface` | `marketing` \| `ecommerce` | Column |
| `budget_cap` / `budget_spent` | numeric | Column |
| `goal` / `objective` | text | Column |
| AI-ready metadata | funding, budget, audience, domain, surface, policy FP | JSONB |

Legacy rows: metadata fallback via `resolveCampaignDiscountDomain`.

Migration: `db/migrations/1064_commercial_campaigns_discount_domain_budget.sql`

---

## Lifecycle

Authoritative transitions sync linked offers:

| Status | Linked offers |
|--------|---------------|
| `running` / `scheduled` | Activate |
| `paused` / `completed` / `cancelled` / `expired` / `archived` | Deactivate |

Budget exhaustion on spend recording → auto-pause.

---

## Offer ownership

| Action | API |
|--------|-----|
| Create during orchestrate | `POST …/:id/orchestrate` |
| Attach existing | `POST …/:id/links` |
| Detach | `DELETE …/:id/links?promotionId=` / `couponId=` |

Created offers inherit campaign `discount_domain`. Soft `is_active` on link rows.

---

## Runtime

Customer never sees campaigns — only promotions/coupons.  
`CampaignResolver` remains attribution-only (not a second price resolver).

---

## Funding & Settlement

Platform / Vendor / Shared / Custom split unchanged.  
Settlement payload now includes domain, budget remaining, goal, policy fingerprint.  
`POST …/:id/spend` records spend (Settlement / Analytics callers).

---

## Analytics

`GET …/:id/analytics` returns first-class KPIs:

redemptions · discountSpend · platformSpend · vendorSpend · ROI · budget · topOffers  

No “top promotions as campaigns” proxy for this endpoint.

---

## Notifications

| Mode | Behavior |
|------|----------|
| skip | No-op |
| link | Requires existing notification campaign id |
| create | Inserts draft `notification_campaigns` row when table present |

---

## Policy integration

Campaigns **inherit** published Policy Center for Best Offer, stack, combination, limits.  
Campaigns may set **funding, budget, schedule, goal only**.

---

## Admin UX

Shared `CommercialCampaignHub` for Marketing and E-commerce.  
Server list filter `?discount_domain=`.  
Details drawer passes `surface` into orchestration (Shop targeting for ecommerce).

---

## Feature flags (Terraform)

| Env | File | Value |
|-----|------|-------|
| Dev | `infra/envs/dev/main.tf` | `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = "AUTHORITATIVE"` |
| Prod | `infra/envs/prod/main.tf` | `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = "OFF"` |

**Rollout path:** `OFF` → `SHADOW` → `AUTHORITATIVE`

Apply via Terraform (or `_deploy-dev-all.ps1` default fill). **Do not** edit Lambda console manually.

Reader: `campaign-mode.ts`  
Mode endpoint documents rollout + Terraform keys: `GET /admin/commercial-campaigns/mode`

---

## AWS deployment notes

1. Apply migration 1064 (RDS Data API if no VPC):  
   `ENVIRONMENT=dev node scripts/run-migration-rds-data-api.js` style, or add dedicated 1064 helper mirroring 1063.  
2. Confirm Lambda env from Terraform / deploy script.  
3. Smoke: create Marketing + Ecommerce campaigns → verify domain columns → pause → linked offers inactive.

---

## Testing checklist

- [ ] Marketing create → `discount_domain=SERVICE` only in Marketing list  
- [ ] Ecommerce create → `ECOMMERCE` only under Ecommerce Campaigns  
- [ ] Orchestrate creates offers with matching domain  
- [ ] Pause deactivates linked promos/coupons  
- [ ] Resume / running reactivates  
- [ ] Attach / detach APIs  
- [ ] Analytics returns `kpis` object  
- [ ] Settlement attribution includes fundingPayload + budget  
- [ ] Policy rules still control checkout pricing  
- [ ] Notification create / link paths  

---

## Rollback

1. Set `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE=OFF` via Terraform.  
2. Migration 1064 is additive — leave columns.  
3. Lifecycle deactivation is reversible by running again.

---

## Part 19 — Vendor & Seller Campaign Visibility

**Same component, different permissions** — no separate Vendor Campaign module.

| Portal | Component | Access |
|--------|-----------|--------|
| Admin | `CommercialCampaignHub` (`readOnly=false`) | Full create / fund / schedule / publish / manage |
| Vendor (service) | Same hub via `VendorCommercialCampaigns` (`readOnly=true`, `surface=marketing`) | Participation + own performance |
| Seller | Same hub (`readOnly=true`, `surface=ecommerce`) | Participation + own performance |
| Customer | — | Never sees campaigns — only promotions/coupons |

Shared package: `packages/commercial-campaign-ui`  
Vendor entry: Promotions → **Campaigns** tab; Seller Hub → **Campaigns** nav.

### APIs

| Route | Purpose |
|-------|---------|
| `GET /vendor/:vendorId/commercial-campaigns` | Participant-scoped list (+ health) |
| `GET /seller/:vendorId/commercial-campaigns` | Alias |
| `GET …/:id`, `…/analytics`, `…/health` | Read-only detail |
| `POST …/:id/lifecycle/:status` | **Owner only** (403 for participants) |
| `GET /admin/…/:id/validate` | Pre-publish validation |
| `GET /admin/…/:id/health` | Health report |
| `POST /admin/…/:id/duplicate` | Copy → Draft |

### Labels

- Platform campaigns → **Participating**
- `vendor_id` match → **Owned by You**

### Notifications

On publish (`approved` / `scheduled` / `running`) and attach while live: insert into existing `notifications` table (`campaign_enrollment`). Reuses vendor inbox — no new notification system.

### Validation (before publish)

Blocks on: domain mix, missing/inactive offers, funding, budget, schedule.  
**Overlap** on same promotion/coupon → **warn** (does not block unless policy requires).

### Health / Timeline / Calendar / Duplicate / AI metadata

- Health: Healthy / Warning / Critical (budget, schedule, offers, policy, notification, funding, state)
- Timeline in details: Created → … → Archived
- Calendar view: visualization only over same campaign list
- Duplicate: schedule (optional), funding, audience, offers, notifications, goal, budget → Draft
- AI readiness metadata: businessObjective, expectedOutcome, owner, notes, successCriteria, campaignHealth, timeline (no AI runtime)

---

## Future enhancements

- Collections targeting  
- Recurring schedule worker  
- Settlement live consumption of spend ledger  
- Stronger notification channel templates  
- AI assistant on enriched metadata  

