# Campaign Architecture Analysis

**Status:** Analysis only  
**Date:** 2026-07-08  

---

## Investigation 1 — Campaign architecture

### Layering (intended)

```
Commercial Campaign Engine (orchestration)
        │
        ├─► creates/links ► Platform Promotions & Coupons
        ├─► optional link ► Notification Campaign Engine
        ├─► attribution  ► Analytics (Phase 9 filter)
        └─► funding meta ► Settlement (Phase 7 — not consumed yet)
                │
        Discount Engine V2 (resolver) ◄── independent of campaign status
        Policy Center (publish) ◄── campaigns do not override yet
```

Campaigns **group and create** commercial offers. They are **not** a second discount calculator.

### Modules already implemented

**Engine package:** builder, lifecycle, funding, scheduler, templates, registry, repository, audit, bridges, resolver (unused), mode gate.

**Admin:** shared hub + builder + editors + orchestration panel using existing Promotion Wizard (`@warmpawz/promotion-management-ui`).

**What is stubbed / hidden**

| Item | State |
|------|-------|
| Default mode OFF | Hidden from operators |
| SHADOW materialization | Stub IDs |
| Notification `create` | Stub message |
| `CampaignResolver` | Dead code path |
| Settlement bridge | Emit-only stub |
| Dashboard KPI tiles | Placeholder |
| Policy campaign override UI | Placeholder copy |
| Attach existing promo API | Missing |
| Offer sync on pause/resume | Missing |

### Production-ready pieces (when AUTHORITATIVE + migration applied)

- Create campaign draft from template / blank / clone  
- Funding + schedule + audience editors  
- Orchestrate → insert promotions/coupons + link rows  
- Lifecycle transitions (status on campaign row)  
- Dual UI entry (Marketing / Ecommerce) sharing one hub  

---

## Investigation 2 — Data model

### Tables (`1046_commercial_discount_campaigns.sql`)

| Table | Purpose |
|-------|---------|
| `commercial_discount_campaigns` | Campaign header |
| `commercial_campaign_promotion_links` | Links to `promotion_id` or `coupon_id` |
| `commercial_campaign_audit_log` | Audit JSON blob |

### Campaign header fields

| Field | Domain-aware? |
|-------|----------------|
| `status` | Lifecycle |
| `funding_type` / `funding_split` | Funding |
| `schedule_*` / `recurring_rule` | Scheduling |
| `audience` JSONB | Customer segments (not inventory) |
| `notification_*` | Notification link |
| `vendor_id` | Seller-scoped campaigns |
| `metadata` | **Holds domain/surface today** |
| `policy_fingerprint` | Local hash — not Policy Center publish FP |

**No columns for:** `discount_domain`, budget, spend, inventory targeting (products/services).

### Domain awareness verdict

Campaigns are **metadata-tagged**, not **domain-column first-class** (unlike Phase E1 promotions/coupons direction). Still effectively **global table** with client filters.

---

## Investigation 3 — Lifecycle

### Exists in code

```
draft → review → approved → scheduled | running
                         ↘ paused | completed | cancelled | expired → archived
```

| Requested name | Actual |
|----------------|--------|
| Draft | `draft` |
| Validation | `review` |
| Approval | `approved` |
| Publish | **Missing as verb** — go to `running` / `scheduled` |
| Active | `running` |
| Paused / Completed / Archived | Yes |

### Gaps

- No automated scheduler job to flip `scheduled → running` / `running → expired`  
- Lifecycle **does not** toggle linked promotion/coupon `is_active`  
- No separate “publish” gate with validation checklist beyond status  

---

## Investigation 4 — Promotion / coupon integration

| Question | Answer |
|----------|--------|
| Own offers or group them? | **Both:** AUTHORITATIVE create + link; no attach-existing API |
| How activate? | Only if created offers are active; campaign `running` alone does nothing |
| How deactivate? | **Not automatic** on pause |
| Coupon attribution metadata | Weaker than promotions (promo gets `commercialCampaignId`) |

Orchestration embeds Promotion Wizard scoped by `surface` (`scopeForSurface`) — Services inventory vs product domains for **new** offers under the campaign.

---

## Investigation 5 — Policy Center

| Question | Recommendation |
|----------|----------------|
| Can campaigns override policy? | **Not today** |
| Should they? | **Limited:** funding split & budget at campaign; stack / Best Offer / combination matrix stay Policy Center |
| Funding / Priority / Winning / Application | Campaign stores funding; should **inherit** stack/priority/rules from domain Policy |

`policy_fingerprint` on campaign ≠ published Policy Center fingerprint.

---

## Investigation 6 — Funding

**Supported:** PLATFORM, VENDOR, SHARED, CUSTOM with % split validation.

**Missing:** campaign budgets, spend caps, exhaustion stop-rules, real settlement drawdown.

**Future architecture:** campaign budget ledger + settlement consume `fundingPayload` + stop orchestration / deactivate links when exhausted.

---

## Investigation 7 — Targeting

| Layer | Services | E-commerce |
|-------|----------|------------|
| Audience editor | Shared customer kinds | Shared |
| Offer wizard (orchestrate) | Categories, services, packages, meals, styles | Products / categories / sellers (per E1 surface) |
| Campaign-level inventory targets | **None** | **None** |
| Collections | N/A | Not present |

Targeting is **domain-aware only when creating offers**, not as a first-class campaign target model.

---

## Shared engines (must keep single)

Campaign Engine · Discount Engine · Policy Engine · Settlement Engine · Analytics Engine · Notification Engine — **one each**, surface-parameterized.
