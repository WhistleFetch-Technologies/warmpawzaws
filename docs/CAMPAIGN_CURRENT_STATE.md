# Campaign Current State

**Status:** Analysis only (no implementation)  
**Date:** 2026-07-08  
**Engine:** Commercial Discount Campaigns (Phase 10) — distinct from Notification Campaign Engine  

---

## Executive summary

Warmpawz has a **built Phase 10 Campaign Engine**: DB schema, backend orchestration modules, gated admin APIs, and a shared `CommercialCampaignHub` used from both Marketing → Campaigns and E-commerce → Campaigns.

It is **not production-active by default**. Feature flag `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` defaults to **`OFF`** → admin shows Coming Soon; mutating/list APIs return 503.

Campaigns are an **orchestration layer** that can create and link promotions/coupons. They do **not** replace the Discount Engine resolver. Checkout does not call `CampaignResolver`. Settlement receives attribution metadata only.

Domain (SERVICE vs ECOMMERCE) is **metadata-only**, filtered client-side — same pattern Campaigns must catch up to Phase E1 durable `discount_domain` on promotions/coupons.

---

## What already exists (inventory)

### Backend modules (`backend/lambda/src/discount-engine/campaign/`)

| Module | Role |
|--------|------|
| `campaign-engine.ts` | Orchestrate create + link offers |
| `campaign-mode.ts` | OFF / SHADOW / AUTHORITATIVE |
| `campaign-builder.ts` | Build record from request |
| `campaign-lifecycle.ts` | Status transitions |
| `campaign-configuration.ts` | Allowed transitions |
| `campaign-funding.ts` | PLATFORM / VENDOR / SHARED / CUSTOM |
| `campaign-scheduler.ts` | Immediate / scheduled / recurring (derivation helpers) |
| `campaign-template.ts` + `campaign-registry.ts` | Templates / types |
| `campaign-resolver.ts` | **Exported unused** at checkout |
| `campaign-audit.ts` | Fingerprint / attribution |
| `repositories/campaign-repository.ts` | Persistence |
| Bridges | promotion, coupon, notification, analytics, settlement |

HTTP: `endpoints/commercial-campaign.endpoints.ts`  
Migration: `db/migrations/1046_commercial_discount_campaigns.sql`

### Admin UI

| Piece | Path |
|-------|------|
| Hub | `CommercialCampaignHub` |
| Builder | `CampaignBuilderDialog` |
| Orchestration | `CampaignOrchestrationPanel` (embeds Promotion Wizard) |
| Details | `CampaignDetailsDrawer` |
| List / Dashboard / Templates / Funding / Audience / Schedule / Notification editors | `campaigns/` |
| Marketing entry | Promotion Center `?tab=campaigns` |
| Ecommerce entry | `/ecommerce/campaigns` |

### Separate product (do not confuse)

**Notification Campaign Engine** (`1024_notification_campaign_engine.sql`, Notification Engine admin) — push/SMS/email campaigns. Commercial campaigns can **link** an existing notification campaign id; auto-create is stubbed.

---

## Production readiness matrix

| Area | Ready? | Notes |
|------|--------|-------|
| Schema 1046 | Yes (if applied) | Additive |
| Engine + unit tests | Yes | Orchestration logic |
| Admin UI shell | Yes | Behind flag |
| Flag default OFF | Hidden | Intentional rollout gate |
| SHADOW orchestrate | Stub | Mock promo/coupon IDs |
| AUTHORITATIVE orchestrate | Ready | Inserts real offers |
| Checkout / CampaignResolver | Dead | Not wired |
| Settlement consume | Stub | Attribution payload only |
| Notification create | Stub | Link mode works |
| Domain column | Missing | Metadata only |
| Dashboard revenue KPIs | Stub | `"—"` placeholders |
| Phase 9 Campaign Analytics tab | Proxy | Top promotions, not commercial campaigns |

---

## Feature flag

```
DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = OFF | SHADOW | AUTHORITATIVE
Default: OFF
```

| Mode | Effect |
|------|--------|
| OFF | Coming Soon; APIs disabled |
| SHADOW | Create/list/lifecycle; orchestrate mocks links |
| AUTHORITATIVE | Orchestrate materializes promotions/coupons + links |

---

## Domain awareness today

- Builder stamps `metadata.domain`, `metadata.surface`, `metadata.discount_domain`.
- List API: **no** `?domain=` / `discount_domain`.
- UI: `filterCampaigns(surface)` heuristics.
- No first-class `domain` column on `commercial_discount_campaigns`.

---

## Related docs (this review package)

| Doc | Focus |
|-----|-------|
| `CAMPAIGN_ARCHITECTURE_ANALYSIS.md` | Architecture & modules |
| `CAMPAIGN_RUNTIME_ANALYSIS.md` | Runtime flow |
| `CAMPAIGN_UX_ANALYSIS.md` | Services + Ecommerce UX |
| `CAMPAIGN_ANALYTICS_ANALYSIS.md` | KPIs & reports |
| `CAMPAIGN_GAP_REPORT.md` | Gaps + final answers |
| `CAMPAIGN_REUSE_MATRIX.md` | Shared vs domain-aware |
| `CAMPAIGN_IMPLEMENTATION_BLUEPRINT.md` | Recommended build order |

*Note: older narrative in this file (pre–Phase 10 “no builder”) is obsolete — Phase 10 UI exists.*
