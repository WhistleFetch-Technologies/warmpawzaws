# Campaign Implementation Blueprint

**Status:** Analysis only — blueprint for future work (do not treat as executed)  
**Date:** 2026-07-08  

---

## Goal

Make Commercial Campaigns a **first-class** feature for Services and E-commerce without duplicating engines or UI.

---

## Phased plan

### Phase C0 — Enablement hygiene

- Confirm `1046` applied on target env.  
- Document `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE`.  
- Smoke SHADOW before AUTHORITATIVE.

### Phase C1 — Domain first-class (align with E1)

- Add `discount_domain` (or `domain`) on `commercial_discount_campaigns`.  
- Stamp in `campaign-builder` from surface.  
- `GET /admin/commercial-campaigns?discount_domain=`.  
- Prefer server filter over `filterCampaigns` heuristics.

### Phase C2 — UX correctness

- Pass `surface` through Details → Orchestration (fix marketing default leak).  
- Filter templates by surface.  
- Lifecycle verbs labeled for operators (Submit / Approve / Go live).

### Phase C3 — Offer ownership

- Lifecycle PAUSE / EXPIRE / COMPLETE → deactivate linked promotions/coupons (or link-level inactive).  
- RESUME / RUNNING → re-activate within schedule.  
- API: attach existing promo/coupon IDs.  
- Coupon bridge: write `commercialCampaignId` metadata.

### Phase C4 — Runtime attribution (optional but recommended)

- Tag resolve winners with `campaignId` when offer linked.  
- Or drop unused `CampaignResolver` from public surface until needed.

### Phase C5 — Funding & settlement

- Budget fields + spend ledger.  
- Settlement Engine consumes `fundingPayload`.  
- Exhaustion policy → auto-pause.

### Phase C6 — Analytics

- Campaign-grain reports from links + usages.  
- Domain-locked Marketing vs Ecommerce dashboards.  
- Relabel Phase 9 proxy tab.

### Phase C7 — Notifications

- Implement `create` via Notification Engine API.  
- Keep `link` / `skip`.

### Phase C8 — Policy

- Document inherit vs override.  
- Optional campaign funding override in Policy UI tied to real API (not placeholder).

---

## Non-goals

- Second Campaign Engine  
- Second Campaign Hub app  
- Campaigns replacing Discount Engine  
- Merging Notification Campaign tables into commercial campaigns  

---

## Acceptance criteria (production)

| Criterion | Done when |
|-----------|-----------|
| Domain isolation | SERVICE campaign never listed under Ecommerce (and reverse) |
| Orchestration | AUTHORITATIVE create offers with correct `discount_domain` |
| Lifecycle | Pause stops customer-facing linked discounts |
| Policy | Stack rules still from Policy Center |
| Analytics | Real campaign KPIs, not `"—"` / promotion proxy |
| Settlement | Platform/vendor share attribution for financed campaigns |
| One UI | Same hub both portals |

---

## Suggested ownership map

| Area | Owner layer |
|------|-------------|
| Orchestration | Campaign Engine |
| Price calculation | Discount Engine |
| Rules / Best Offer | Policy Center |
| Money movement | Settlement Engine |
| Messaging | Notification Engine |
| Insights | Analytics Engine |

---

## Rollback

- Set mode `OFF` → Coming Soon; offers already materialized remain as normal promotions/coupons.  
- Domain migration additive.  
- Prefer soft-deactivate links over hard deletes.
