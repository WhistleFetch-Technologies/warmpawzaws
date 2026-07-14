# Campaign UX Analysis

**Status:** Analysis only  
**Date:** 2026-07-08  

---

## Investigation 11 — Services Campaign UX

### Entry

Marketing → Promotion Center → **Campaigns** tab → `CommercialCampaignHub surface="marketing"`.

### Current UI

- Dashboard (status counts; revenue/savings placeholders)  
- Campaign list + bulk archive  
- Template grid  
- Builder dialog (name, type, funding, schedule, audience, notifications, domain metadata)  
- Details drawer (overview, links, analytics stub chart, orchestration panel)  

### Workflows that work (when mode ≠ OFF)

Create → edit funding/schedule → orchestrate offers (marketing catalog) → lifecycle transitions → view linked promos.

### Missing / weak

- Validation checklist UX before approve  
- Explicit Publish action  
- Pause that stops customer discounts  
- Attach **existing** platform/vendor offers  
- Audit history UI  
- Honest KPI dashboard  
- Template list filtered to service types only (registry alignment)  
- Coming Soon when flag OFF (expected until go-live)

### Recommended Services UX (reuse hub)

1. Campaign as **season container** for service promotions/coupons.  
2. Orchestrate with marketing smart targeting (categories → services/packages/meals/styles).  
3. Lifecycle actions: Submit review → Approve → Go live → Pause → Complete → Archive.  
4. Details: linked offers, notification link, funding, schedule, domain-locked SERVICE analytics.

---

## Investigation 12 — E-commerce Campaign UX

### Entry

E-commerce → **Campaigns** → same hub `surface="ecommerce"`.

### Current UI

Identical components; title/subtitle differ; client `filterCampaigns`.

### Gaps specific to Shop

| Issue | Detail |
|-------|--------|
| Domain filter | Client heuristics; metadata-only |
| Templates | UI may show types not in backend registry / marketing-skewed |
| Details drawer | **Does not pass `surface`** → orchestration defaults to **marketing** scopes (bug) |
| Inventory language | Should say sellers / product categories / products (E1) |
| Seller campaigns | `vendor_id` supported in model; UX shallow |

### Recommended Ecommerce UX (same components)

1. `surface="ecommerce"` everywhere including drawer/orchestration.  
2. Templates: marketplace / seller-sponsored / product launch (aligned with registry).  
3. Orchestrate with ECOMMERCE discount_domain + Shop targeting (All Products / Pet Shop categories / Sellers / Products).  
4. Optional: deep-link to Seller Promotions for vendor-funded legs.

---

## Investigation 13 — Shared component reuse

| Component | Shared? | Domain-aware? |
|-----------|---------|----------------|
| `CommercialCampaignHub` | Yes | Titles + `filterCampaigns` |
| `CampaignBuilderDialog` | Yes | Stamps metadata domain |
| Editors (funding, schedule, audience, notification) | Yes | Mostly shared |
| `CampaignOrchestrationPanel` | Yes | Must receive `surface` |
| `CampaignDetailsDrawer` | Yes | **Must receive `surface`** |
| Dashboard / List / Templates | Yes | Filter templates by surface |
| Analytics tab (Phase 9) | Marketing shell | Should filter commercial campaigns by domain |

**Rule:** One UI. Parameterize by `surface` / `discount_domain`. Do **not** fork Marketing vs Ecommerce campaign apps.
