# Campaign Analytics Analysis

**Status:** Analysis only  
**Date:** 2026-07-08  

---

## Investigation 8 — Campaign analytics

### Surfaces today

| Surface | Source | Quality |
|---------|--------|---------|
| Hub dashboard tiles | Client status counts; Revenue/Savings = `"—"` | Stub |
| Campaign details → Analytics | `GET .../campaigns/:id/analytics` → linked promo/coupon metrics via Phase 9 filters | Partial |
| Marketing Analytics → Campaign tab | Phase 9 `buildCampaignAnalytics` | **Proxy:** top promotions labeled as campaigns |
| Timeline chart in drawer | Empty data array | Stub |

### Phase 9 “campaign” analytics (`discount-engine/analytics/campaign-analytics.ts`)

Builds pseudo-campaign rows from **promotion usage aggregates**, not from `commercial_discount_campaigns`. Misleading once Phase 10 commercial campaigns exist.

### Current KPI coverage

| KPI | Present? |
|-----|----------|
| Campaign count by status | Yes (dashboard) |
| Linked offer usage | Partial (if analytics AUTHORITATIVE + links) |
| Conversion | Via promotion metrics if available |
| Discount savings / revenue | Placeholder / promotion-level |
| Spend / budget burn | Missing |
| ROI | Missing |
| Settlement / platform vs vendor funding impact | Attribution payload only — not finance report |
| Domain split SERVICE vs ECOMMERCE | Client filter only |

### Recommended campaign analytics (reuse Analytics Engine)

1. **Primary grain:** commercial campaign id (+ linked promotion/coupon ids).  
2. **Metrics:** impressions (if notification linked), redemptions, GMV influenced, discount amount, platform cost, vendor cost (from funding split), ROI = incremental GMV / platform cost.  
3. **Domain filters:** SERVICE vs ECOMMERCE using durable domain (same as E1).  
4. **Dashboards:** Marketing Analytics locked SERVICE; Ecommerce Analytics locked ECOMMERCE; campaign detail roll-up from real links.  
5. Retire or relabel Phase 9 “campaigns” proxy to **“Top promotions”**.

### Settlement impact reporting

Until Settlement Engine consumes `fundingPayload`, finance reports cannot attribute campaign-level platform spend accurately—only per-promotion funding fields (if set at orchestrate).
