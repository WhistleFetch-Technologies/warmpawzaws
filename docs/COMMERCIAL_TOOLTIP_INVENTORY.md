# Commercial Tooltip Inventory (`?` coverage)

**Status:** ANALYSIS ONLY — inventory for future UI work  
**Date:** 2026-07-08  
**Note:** Today, commercial UIs mostly use inline hints, not field-level `?` tooltips. This inventory defines the **target** coverage.

---

## Legend

| Priority | Meaning |
|----------|---------|
| P0 | Confuses operators today; blocks correct configuration |
| P1 | Important for Day-2 ops |
| P2 | Nice-to-have / advanced |

**Ask AI:** whether “Ask AI” link should appear on the tooltip footer.

---

## 1. Policy Center

| Field / concept | Surface | Priority | Ask AI |
|-----------------|---------|----------|--------|
| Winning Strategy / Best Offer | marketing + ecommerce | P0 | Yes |
| Stacking rules | both | P0 | Yes |
| Funding defaults | both | P0 | Yes |
| Runtime vs Draft | both | P0 | Yes |
| Publish / Rollback | both | P0 | Yes (explain only) |
| Domain (SERVICE / ECOMMERCE) | both | P0 | Yes |
| Policy fingerprint | both | P1 | Yes |
| Simulate impact | both | P1 | Yes |
| Vendor override allowance | both | P1 | Yes |

---

## 2. Promotions

| Field | Priority | Ask AI |
|-------|----------|--------|
| Promotion type (flash, seasonal, …) | P0 | Yes |
| Trigger | P0 | Yes |
| Target scope (services / products / categories) | P0 | Yes |
| Schedule / recurrence | P0 | Yes |
| Discount value vs percent | P0 | Yes |
| Usage limits | P1 | Yes |
| Status lifecycle | P1 | Yes |
| `discount_domain` | P0 | Yes |
| Linked campaign | P1 | Yes |
| Vendor vs platform ownership | P1 | Yes |

---

## 3. Coupons

| Field | Priority | Ask AI |
|-------|----------|--------|
| Code uniqueness | P0 | Yes |
| Eligibility / first order | P0 | Yes |
| Stacking with promotions | P0 | Yes |
| Why coupon didn’t apply (reasons) | P0 | Yes |
| Redemption caps | P1 | Yes |
| Domain SERVICE vs ECOMMERCE | P0 | Yes |

---

## 4. Campaigns (CommercialCampaignHub)

| Field | Priority | Ask AI |
|-------|----------|--------|
| Campaign vs Promotion (orchestration vs pricing) | P0 | Yes |
| Campaign type | P1 | Yes |
| Funding type / split | P0 | Yes |
| Budget cap / spent / remaining | P0 | Yes |
| Goal / objective / businessObjective | P1 | Yes |
| Audience kinds | P1 | Yes |
| Schedule types | P1 | Yes |
| Notification mode skip/link/create | P1 | Yes |
| Linked offers | P0 | Yes |
| Campaign Health (Healthy/Warning/Critical) | P0 | Yes |
| Timeline states | P1 | Yes |
| Ownership: Participating vs Owned by You | P0 | Yes |
| Overlap warning on publish | P0 | Yes |
| Duplicate campaign | P2 | Yes |
| Calendar view | P2 | No |
| AI readiness metadata fields | P2 | Yes |
| ROI / redemptions KPIs | P1 | Yes |

---

## 5. Analytics

| Field / KPI | Priority | Ask AI |
|-------------|----------|--------|
| Redemptions | P0 | Yes |
| Discount spend | P0 | Yes |
| Platform vs vendor spend | P0 | Yes (role-aware) |
| ROI | P0 | Yes |
| Orders / conversions | P1 | Yes |
| Revenue attribution caveats | P0 | Yes |
| Domain filters | P1 | Yes |
| Report lag / analytics mode OFF | P0 | Yes |

---

## 6. Settlement & Finance

| Field | Audience | Priority | Ask AI |
|-------|----------|----------|--------|
| Settlement attribution from campaign funding | Admin + own vendor | P0 | Yes |
| Platform fee | Admin; hide/detail for vendor | P0 | Yes |
| Commission rate | Vendor/Seller own | P0 | Yes |
| Payout cycle | Vendor | P1 | Yes |
| Ecommerce fee policies | Admin | P1 | Yes |
| Why vendor received amount X | Own / Admin | P0 | Yes |

---

## 7. Notifications (commercial-related)

| Field | Priority | Ask AI |
|-------|----------|--------|
| Campaign enrollment notification | P1 | Yes |
| Notification mode on commercial campaign | P1 | Yes |
| Customer push vs vendor inbox | P1 | Yes |

---

## 8. Resolver / Runtime (visible diagnostics)

| Concept | Priority | Ask AI |
|---------|----------|--------|
| Why offer lost Best Offer | P0 | Yes |
| Ineligible reason codes | P0 | Yes |
| Policy conflict | P0 | Yes |
| Exhausted budget pauses campaign offers | P0 | Yes |

---

## 9. Pages checklist (ensure `?` coverage)

| Page / hub | Route (approx.) |
|------------|-----------------|
| Promotion Center — Platform | `/promotion-center?tab=platform` |
| Promotion Center — Vendor | `?tab=vendor` |
| Promotion Center — Policy | `?tab=policy` |
| Promotion Center — Analytics | `?tab=analytics` |
| Promotion Center — Campaigns | `?tab=campaigns` |
| Ecommerce Promotions | `/ecommerce/promotions` |
| Ecommerce Policy | `/ecommerce/policy` |
| Ecommerce Campaigns | `/ecommerce/campaigns` |
| Ecommerce Analytics | `/ecommerce/analytics` |
| Finance / Settlements | `/finance`, `/settlements` |
| Notification Engine | `/notification-engine` |
| Vendor Service Promotions + Campaigns | Vendor portal |
| Seller Promotions + Campaigns | Seller Hub |

---

## 10. Implementation note (analysis only)

Centralize tooltip copy in a **Commercial Glossary** JSON consumed by UI `?` and by Copilot Explain pipeline — single source of truth.
