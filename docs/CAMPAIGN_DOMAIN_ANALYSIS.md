# Campaign Domain Analysis

**Status:** Analysis only  
**Phase:** Commercial Campaign Engine (Phase 10)

---

## What the Campaign Engine is

Orchestration layer above raw promotions/coupons:

- Campaign lifecycle (draft → scheduled → active → archived)
- Template-based creation
- Links to `promotions` / `coupons` via `commercial_campaign_promotion_links`
- Funding attribution preview
- Audit log per orchestration run

**Not** a separate discount calculator—it calls existing promotion bridges.

---

## Storage (`1046_commercial_discount_campaigns.sql`)

### `commercial_discount_campaigns`

| Column | Domain relevance |
|--------|------------------|
| `campaign_type` | Shared registry (flash_sale, vendor_sponsored, …) |
| `metadata` | **`domain`**, **`surface`** set by `CampaignBuilderDialog` on create |
| `vendor_id` | Optional seller/vendor scope |
| `policy_fingerprint` | Links to Policy Center at orchestration time |
| `funding_type`, `funding_split` | Shared funding model |

**No dedicated `domain` column or index.**

### Related tables

- `commercial_campaign_promotion_links` — `promotion_id` OR `coupon_id`
- `commercial_campaign_audit_log` — orchestration audit JSON

---

## Is campaign domain-aware?

| Layer | Domain-aware? | Mechanism |
|-------|---------------|-----------|
| Create (builder UI) | **Yes** | `metadata: { domain: 'service'\|'ecommerce', surface }` |
| List API | **No** | Returns all campaigns |
| List UI | **Partial** | `filterCampaigns(rows, surface)` client-side |
| Templates/registry | **No** | Same `CAMPAIGN_TYPE_REGISTRY` for both surfaces |
| Orchestration panel | **Partial** | `surface` prop scopes wizard; **drawer omits surface** (bug) |
| Per-campaign analytics | **No** | `generateReport()` without domain filter |
| Feature gate | Global | `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` |

### E-Commerce campaign type filter (UI only)

`surface-config.ts` includes types like `marketplace`, `vendor_sponsored` for ecommerce surface—these are **not** all present in backend `campaign-configuration.ts`.

---

## APIs

| Method | Path | Domain filter |
|--------|------|---------------|
| GET | `/admin/commercial-campaigns` | `?status`, `?vendorId` only |
| POST | `/admin/commercial-campaigns` | Sets metadata from client |
| POST | `/:id/orchestrate` | Creates promos via `promotion-bridge` |
| GET | `/:id/analytics` | Filters report by linked promo IDs only |
| GET | `/admin/commercial-campaigns/mode` | Diagnostics |

**Gated:** `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` — `OFF` returns 503 on mutating routes.

---

## UI surfaces

| Surface | Route | Component |
|---------|-------|-----------|
| Marketing | `/promotion-center?tab=campaigns` | `CommercialCampaignHub surface="marketing"` |
| E-Commerce | `/ecommerce/campaigns` | `CommercialCampaignHub surface="ecommerce"` |

Shared: `CampaignBuilderDialog`, `CampaignOrchestrationPanel`, `CampaignDetailsDrawer`.

---

## Work required for independent Services vs E-Commerce campaigns

### P0 — Data & API

1. Add `domain TEXT` column to `commercial_discount_campaigns` (indexed); backfill from `metadata.domain`.
2. `GET /admin/commercial-campaigns?domain=ECOMMERCE` server-side filter.
3. Set `domain` in `campaign-builder.ts` server-side, not only UI metadata.

### P1 — UI completeness

4. Pass `surface` to `CampaignDetailsDrawer` → orchestration panel.
5. Surface-specific template subsets (or filter registry in UI).
6. `POST /admin/commercial-campaigns/:id/links` — attach existing promo IDs without re-orchestration.

### P2 — Analytics truth

7. Campaign analytics tab should query `commercial_discount_campaigns` + links, not top-promotion proxy.
8. Pass `domain` into per-campaign analytics bridge.

### P3 — Promotion persistence

9. When orchestrating from ecommerce campaign, set `discount_domain` or reliable metadata on created `promotions`/`coupons` rows.

---

## Should campaigns remain global or become domain-specific?

**Recommendation: domain-specific campaigns, shared engine.**

| Keep shared | Split per domain |
|-------------|------------------|
| Orchestration code | Campaign rows |
| Template engine (with filtered templates) | List/filter API |
| Link table schema | Analytics grouping |
| Audit log | Admin nav ownership (already split) |

Operators already think in “Service Campaigns” vs “Marketplace Campaigns”—the UI titles reflect this; **backend should match**.

---

## Conflict with Policy Center

Campaign orchestration snapshots `policy_fingerprint` at run time from **global** active publish. If Services and E-Commerce need different stack rules, campaigns orchestrated under the same publish may apply wrong policy until per-domain business rules exist (see [POLICY_CENTER_DOMAIN_ANALYSIS.md](./POLICY_CENTER_DOMAIN_ANALYSIS.md)).

---

## Migration note

Migration `1046_commercial_discount_campaigns.sql` must be applied on prod before `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE=AUTHORITATIVE` (team rule). Domain column would be a **new additive migration** (e.g. `1063_campaign_domain_column.sql`).
