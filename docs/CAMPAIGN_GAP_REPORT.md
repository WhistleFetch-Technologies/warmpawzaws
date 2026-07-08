# Campaign Gap Report

**Status:** Analysis only  
**Date:** 2026-07-08  

---

## Final answers

### 1. What Campaign functionality already exists?

Phase 10 Commercial Campaign Engine: schema, repository, builder, funding, schedule, audience, templates, lifecycle transitions, orchestration (materialize promos/coupons in AUTHORITATIVE), bridges (promo/notification/analytics/settlement attribution), admin hub shared by Marketing and Ecommerce, unit tests, feature-flag rollout.

### 2. What is hidden?

Default `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE=OFF` → Coming Soon + API 503. Operators do not see a live campaign product until SHADOW/AUTHORITATIVE.

### 3. What is incomplete?

Domain column & API filters; offer activate/deactivate on lifecycle; attach existing links; CampaignResolver wiring; settlement consumption; budgets/exhaustion; notification create; audit UI; real KPIs; recurring auto-transitions; Policy Center campaign override; drawer `surface` bug; coupon campaign metadata parity; template registry alignment.

### 4. How should Campaigns work for Services?

Marketing → Campaigns: `discount_domain=SERVICE`. Orchestrate service promotions/coupons (platform + link vendor service promos). Audience + funding + schedule on campaign. Inherit SERVICE Policy Center for stack/Best Offer. Analytics/settlement attributed to SERVICE.

### 5. How should Campaigns work for E-commerce?

Ecommerce → Campaigns: `discount_domain=ECOMMERCE`. Orchestrate Shop offers (All Products / product categories / sellers / products). Seller-funded / marketplace templates. Inherit ECOMMERCE policy. Separate lists from Services. Same UI hub.

### 6. Should Campaigns reuse one engine?

**Yes.** One Campaign Engine + one Discount Engine.

### 7. Should Campaigns reuse one UI?

**Yes.** One `CommercialCampaignHub` (+ drawer/builder/orchestration), parameterized by `surface`.

### 8. Integration recommendations

| System | Integration |
|--------|-------------|
| Promotions / Coupons | Campaign creates and/or links; pause ↔ deactivate; durable domain on offers |
| Policy Center | Inherit domain policy; campaign may override **funding/budget only** |
| Funding | PLATFORM / VENDOR / SHARED + future budget ledger |
| Analytics | Campaign-id grain; domain-filtered dashboards |
| Notifications | Link Notification Engine campaigns; implement `create` later |
| Settlement / Finance | Consume attribution + fundingPayload on usage |

### 9. Required before production ready

1. Apply migration `1046` (if not on env).  
2. Set mode SHADOW → validate → AUTHORITATIVE.  
3. Persist durable domain + server list filter.  
4. Fix drawer/orchestration `surface` leak.  
5. Lifecycle sync to linked offer active flags.  
6. Replace stub dashboard KPIs with linked metrics.  
7. Document runbooks; align template registry.  
8. Decide: settle campaign funding in Settlement Engine (minimum for “financed” campaigns).

### 10. Recommended architecture

```
                    ┌─────────────────────────┐
                    │  Commercial Campaign    │
                    │  Engine (one)           │
                    │  domain=SERVICE|ECOMMERCE│
                    └───────────┬─────────────┘
           orchestrate/link     │     schedule/lifecycle
                    ┌───────────▼─────────────┐
                    │ Promotions & Coupons    │
                    │ (domain-stamped)        │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
     Discount Engine     Policy Center      Settlement
     (resolve)           (inherit)          (funding)
              │
     Analytics + Notification Engine (opt-in link)
```

---

## Functional gaps (checklist)

1. Flag default OFF  
2. No durable campaign domain column / API `?domain=`  
3. Lifecycle ≠ offer activation  
4. No attach-existing promo/coupon API  
5. CampaignResolver unused  
6. Settlement not consuming attribution  
7. No budget / cap / exhaustion  
8. Audience not applied at eligibility  
9. Notification create stub  
10. Audit GET + UI missing  
11. Analytics proxy / stub KPIs  
12. Details drawer missing `surface`  
13. Template type mismatch ecommerce vs registry  
14. Recurring schedule not automated  
15. Coupon bridge attribution weaker than promo  
16. Policy Center campaign override placeholder  
17. No PATCH update / DELETE campaign APIs (lifecycle-only evolution)  
18. Phase 9 naming collision (“campaigns” = promotions)

---

## UI/UX issues

1. Coming Soon until flag on  
2. Marketing/Ecommerce visual twins with wrong domain leakage risk  
3. Placeholder revenue tiles  
4. Empty analytics chart  
5. Orchestration in drawer defaults marketing on ecommerce surface  
6. Bulk archive without offer cleanup  
7. Templates may confuse service vs shop operators  

---

## Investigation 9 — Notifications (summary)

Commercial campaigns **can link** Notification Engine campaigns; **cannot create** push/SMS/email/in-app from orchestrate (stub). Banner/spotlight remain separate Marketing Hub tooling.

---

## Investigation 14 — Settlement / finance (summary)

Attribution endpoint exists; Settlement Engine does not apply campaign funding math. Platform spend / vendor earnings / commission reports lack campaign-level dimension until wiring lands.

---

## Investigation 15 — AI readiness (summary)

`metadata` is flexible; today only domain/surface tags. Enough to attach `commercialCampaignId` and funding for future “explain / recommend / investigate” assistants — **not** an AI product surface yet. Recommend enriching metadata with goals, budget, KPI defs before AI assistants.
