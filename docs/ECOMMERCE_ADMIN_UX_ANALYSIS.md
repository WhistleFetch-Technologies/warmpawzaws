# E-commerce Admin UX Analysis

**Status:** Analysis only (no implementation)  
**Date:** 2026-07-08  

---

## Current Admin experience

### Marketing (Services)

- Entry: Marketing → Promotion Center  
- Hub: `AdminPromotionHub surface="marketing"`  
- Scope copy: veterinary, grooming, training, boarding, meal plans, packages & service vendors  
- Targeting: Entire platform / Categories (+ catalogue services + styles) / Vendor inventory (services, packages, meal plans)

### E-commerce (Shop / Pet Shop)

- Entry: E-commerce → Promotions & Coupons  
- Same hub: `AdminPromotionHub surface="ecommerce"`  
- Scope copy: Marketplace sellers, products, categories & cart coupons  
- Targeting labels: Entire marketplace / Categories / Seller inventory  

### What is shared (Investigation 10)

| Component | Shared? | Should stay shared? | Need domain-awareness |
|-----------|---------|---------------------|------------------------|
| `AdminPromotionHub` | Yes | Yes | Persist & filter by surface/domain |
| `PromotionDashboard` / Coupon dashboard | Yes | Yes | Domain column + server filter; drop dead UI domain dropdown that never sets `domain` |
| `PromotionWizard` | Yes | Yes | Surface-driven scopes/validation messages |
| `PromotionTargetSelector` | Yes | Yes | Ecommerce catalog = Pet Shop categories + sellers + products; no services stack |
| Mappers / validation | Yes | Yes | Stamp domain; map Entire Shop → products domain not bare `all` |
| Simulator | Shared when present | Yes | Domain input = checkout type |
| Policy Center / Campaigns | Shared engines | Yes | Campaigns already stamp metadata; Policy stack/limits per domain |

**Do not duplicate** Marketing vs Ecommerce wizards. Parameterize by `surface` / `DiscountDomain`.

---

## Investigation 11 — UX review

### Should a Services admin see Products / Shop categories / Collections?

**No** (except intentional cross-domain campaigns if product ever requires them — out of scope today).  
Marketing selector already focuses on services/packages/meals/styles; keep products out of marketing smart flows.

### Should an E-commerce admin see Services / Packages / Meal Plans / Styles?

**No.**  
Those are Services-only. Current smart UI mostly hides inventory toggles, but:

- **Entire marketplace** still appears  
- **Categories** shows **service catalogue** categories (wrong mental model and wrong data)  
- Misclassified list rows make Services offer clutter Marketing and confuse ownership of Shop offers  

### Cleanest UX

**Marketing → Promotion Center**

- Only SERVICE platform + vendor service promos  
- Targets: categories (service) → catalogue services → vendors → services/packages/meals → styles  

**E-commerce → Promotions**

- Only ECOMMERCE platform + seller promos  
- Targets (in order of business language):
  1. Entire Shop (optional, carefully permissioned)  
  2. Pet Shop / product categories  
  3. Sellers  
  4. Their products  
  5. Collections if/when supported  

Sidebar labels: prefer **Shop / Pet Shop** where customer-facing naming matters; keep “E-commerce” as portal name if product already owns that nav.

---

## Why QA sees “why Services scopes in Ecommerce?”

Admin expectation matches the recommended Shop tree (category → vendor → products). Implementation still wires Categories to **service** catalogue APIs and allows marketplace-wide `all`, so the page **feels** like a Services wizard recolored with retail words.

---

## UX issues list (concise)

1. Ecommerce creates show under Marketing lists.  
2. Ecommerce list often empty/incomplete for marketplace-wide offers.  
3. “Categories” in Ecommerce is not Pet Shop product categories.  
4. “Entire marketplace” creates unscoped `all` that Services owns by heuristic.  
5. Dashboard domain filter UI is ineffective (`domain` unset on normalize).  
6. Two entry points imply two databases; reality is one table + fragile heuristics.  
7. Seller promotions live on a separate page while platform Shop promos share marketing UX language.  
8. Copy says “retail categories” while data is service hubs.
