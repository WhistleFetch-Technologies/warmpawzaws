# Campaign Reuse Matrix

**Status:** Analysis only  
**Date:** 2026-07-08  

---

## Principle

One Campaign Engine · one Discount Engine · one Policy / Settlement / Analytics / Notification stack · one Admin campaign UI. Domain = parameter, not fork.

---

## Shared (keep single)

| Asset | Shared across SERVICES + ECOMMERCE |
|-------|-----------------------------------|
| `commercial_discount_campaigns` (+ links, audit) | Yes |
| `discount-engine/campaign/*` | Yes |
| `/admin/commercial-campaigns/*` | Yes (+ domain query later) |
| `CommercialCampaignHub` | Yes |
| Builder / funding / schedule / audience / notification editors | Yes |
| Orchestration panel + Promotion Wizard | Yes (surface scopes differ) |
| Templates registry mechanism | Yes (entries differ) |
| Mode flag `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | Yes |
| Analytics Engine / Settlement Engine | Yes |

---

## Domain-aware (parameterize, don’t duplicate)

| Concern | SERVICE | ECOMMERCE |
|---------|---------|-----------|
| Nav entry | Promotion Center → Campaigns | Ecommerce → Campaigns |
| Hub `surface` | `marketing` | `ecommerce` |
| Metadata / future column | SERVICE | ECOMMERCE |
| Orchestrated offer domains | service categories, packages, meals, styles | products, pet shop categories, sellers |
| Policy inherit | SERVICE policy | ECOMMERCE policy |
| Analytics lock | SERVICE | ECOMMERCE |
| Titles | Service Campaigns | Marketplace Campaigns |
| Template subset | flash / seasonal / first booking … | marketplace / seller / product launch … |

---

## Do not duplicate

| Anti-pattern | Why |
|--------------|-----|
| Separate EcommerceCampaignEngine | Same orchestration |
| Separate campaign tables per domain | Use domain column |
| Fork hub components | Surface prop enough |
| Second resolver for campaigns | Offers already resolved |
| Parallel notification campaign tables for commercial | Link Notification Engine |

---

## Distinct systems (intentionally separate)

| System | Relation to Commercial Campaigns |
|--------|----------------------------------|
| Notification Campaign Engine | Optional link / future create |
| Spotlight / Banners (Marketing Hub) | Complementary merchandising — not campaign engine |
| Phase 9 promotion-proxy “campaign analytics” | Relabel or retire when Phase 10 analytics exist |

---

## Wire to Phase E1

Commercial campaigns must stamp and filter the same **`discount_domain`** as promotions/coupons so Services and Shop campaign lists and orchestrated offers never cross-leak.
