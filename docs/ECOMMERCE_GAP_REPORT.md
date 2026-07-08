# E-commerce Commercial Engine — Gap Report

**Status:** Analysis only (no implementation · no migrations · no commits)  
**Date:** 2026-07-08  
**Companion docs:**

- `ECOMMERCE_DOMAIN_ANALYSIS.md`
- `ECOMMERCE_PROMOTION_TARGETING_ANALYSIS.md`
- `ECOMMERCE_COUPON_VISIBILITY_ANALYSIS.md`
- `ECOMMERCE_ADMIN_UX_ANALYSIS.md`
- `ECOMMERCE_RUNTIME_ANALYSIS.md`

**Terminology:** Customer vertical = **Shop / Pet Shop**. Code aliases: ecommerce, product, shop, marketplace, retail.

---

## Final report — direct answers

### 1. Why are E-commerce Promotions visible under Marketing → Promotions?

Because platform promos/coupons are stored in **shared tables without a durable `domain` / `surface`**, listed by **unfiltered admin APIs**, then split in the browser with heuristics that **default unknown rows to Marketing**.

Typical Ecommerce create (“Entire marketplace”, categories-only, products only in metadata) fails `isEcommercePromotionRow` → counted as Marketing → appears in Promotion Center. Often **disappears** from E-commerce → Promotions.

Key files: `surface-config.ts`, `AdminPromotionHub.tsx`, `mappers.ts`, `promotion-admin-persistence.ts`, `GET /admin/promotions|.coupons`.

### 2. Why are customer coupons not filtered?

Checkout **galleries** fetch broad `/promotions/active` (and ecommerce alias) coded lists; **display keeps** ineligible/off-category codes. Shop never sends a coupon service/product-category bucket (`couponRowMatchesService` then returns everything). Product-mode SQL still admits `applicable_to=all`. Frontend `coupon-targeting.ts` is unused. Apply path is stricter than the list path.

Key files: `CouponSection.tsx`, `CartPromotionSelect.tsx`, `UniversalPaymentPage.tsx`, `promotions.ts` active handler, `coupon-targeting.ts` (backend).

### 3. Should Ecommerce targeting contain Entire Platform / Services / Packages / Meal Plans / Styles?

**No.**

| Replace with | Reason |
|--------------|--------|
| Entire **Shop** (optional, Shop-scoped, never bare shared `all`) | Platform sales without Services leakage |
| Pet Shop / **product categories** | Matches Category Management |
| **Sellers** | Seller-sponsored or Seller-scoped platform offers |
| **Products** | SKU targeting (already partially works via seller inventory) |
| Collections (future) | Only if merchandising supports them |

Services / Packages / Meal Plans / Styles remain **Marketing-only**.

### 4. Should Product Categories become first-class promotion targets?

**Yes.** They already exist under `/admin/ecommerce/categories` and on vendor `applicable_categories`. Admin platform Ecommerce wizard does **not** load them today.

### 5. Should Shop / Pet Shop be the root E-commerce category?

**Yes** as the **commercial vertical / customer hub root**. Do not use Service catalogue category pickers as the Ecommerce domain root. Prefer explicit `DiscountDomain.ECOMMERCE` + product / product-category / seller targets. Keep mapping of aliases (`pet-shop`, `ecommerce`, `store` → `shop`) for customer discovery.

### 6. Can this be achieved by extending shared components?

**Yes.** Keep one `AdminPromotionHub`, wizard, dashboard, target selector, simulator, and Discount Engine. Make them **surface/domain-aware** (catalog source, scopes, persistence stamp, list API filter, customer gallery filter). **Do not** fork Marketing vs Ecommerce component trees.

### 7. Every functional gap

1. No persisted `domain`/`surface` on platform promotions/coupons create.  
2. Admin list APIs lack `?domain=` / `applicable_to` filters.  
3. Client heuristics ignore `applicable_to` and metadata products/scopes.  
4. `entire_platform` → `applicable_to: 'all'` collapses Shop and Services.  
5. Ecommerce Categories use **service** `/admin/catalog/categories`, not Pet Shop categories.  
6. Product IDs often live in metadata; heuristics read top-level only.  
7. Dashboard UI domain filter ineffective (`domain` unset in normalize).  
8. Customer shop gallery omits domain/category prune; min-order only.  
9. Customer booking gallery shows greyed cross-category codes instead of hiding them.  
10. `/promotions/active?serviceType=product` admits null services + `all`.  
11. Platform coupon SERVICE matching unused on shop list.  
12. FE `coupon-targeting` / capability gate unused for galleries.  
13. Candidate normalizer: platform always SERVICE, coupons always ECOMMERCE.  
14. Ecommerce `validate-code` / platform coupon path weak on product lines & service-only rejection.  
15. Legacy `GET /coupons/validate/:code` lacks domain/category gates.  
16. Runtime `businessRules` global — not independently editable per domain.  
17. Campaigns stamp domain; platform promos/coupons do not (inconsistency).  
18. Targeting validation does not require mutually exclusive products vs bookings surfaces.  
19. Product collections unsupported as targets.  
20. Discovery/list helpers vs apply matchers diverge (list leaks, apply rejects).

### 8. Every UI/UX issue

1. Ecommerce create appears under Marketing Promotion Center.  
2. Ecommerce hub “missing” its own creates.  
3. Ecommerce admin sees service-flavoured category lists.  
4. “Entire marketplace” still allowed and poorly scoped.  
5. Services/Packages/Meals/Styles mental leftovers (copy/catalog) on Ecommerce.  
6. Services admins can see leaked Ecommerce/unowned rows in Marketing.  
7. Coupon gallery UX: wall of irrelevant codes (disabled or selectable).  
8. Shop vs booking checkout inconsistent coupon UX (dropdown vs section).  
9. Duplicate conceptual “Promotions” nav without server separation.  
10. Seller Promotions separate page while platform Shop promos share marketing patterns.  
11. Policy Center domain selector appears independent but businessRules are global.  
12. Terminology drift: E-commerce vs Shop vs Pet Shop vs product vs marketplace.

### 9. Recommended final E-commerce commercial architecture

```
                    ┌──────────────────────────────┐
                    │   Discount Engine V2 (shared)│
                    │   Settlement / Analytics     │
                    └─────────────┬────────────────┘
           SERVICE                │              ECOMMERCE (Shop / Pet Shop)
                │                 │                 │
   ┌────────────▼──────────┐      │    ┌────────────▼────────────────┐
   │ Marketing portals     │      │    │ Ecommerce portals           │
   │ Promotion Center      │      │    │ Promotions & Coupons        │
   │ Vendor service promos │      │    │ Seller promotions           │
   └────────────┬──────────┘      │    └────────────┬────────────────┘
                │                 │                 │
   Shared UI: Hub / Wizard / TargetSelector / Simulator
   (parameterized by surface — no forks)
                │                 │                 │
   ┌────────────▼──────────┐      │    ┌────────────▼────────────────┐
   │ promotions/coupons    │◄─────┴───►│ same tables + required      │
   │ discount_domain=      │           │ discount_domain=ECOMMERCE   │
   │ SERVICE               │           │ applicable_to=products      │
   │ + service targeting   │           │ + product categories        │
   └────────────┬──────────┘           │ + sellers + products        │
                │                      └────────────┬────────────────┘
   vendor_service_promotions              vendor_promotions
                │                                   │
   Customer booking UPP                    Customer Shop cart gallery
   list+apply: SERVICE only                list+apply: ECOMMERCE only
```

**Principles**

1. One engine; two **first-class** commercial domains.  
2. Persist domain at create from admin `surface`.  
3. Server-enforce list filters for admin and customer.  
4. Shop targeting tree: Pet Shop categories → Sellers → Products (+ optional Entire Shop).  
5. Coupons visible only if applicable to current cart/booking context.  
6. Extend shared components; do not duplicate.

---

## Suggested implementation phases (not implementing)

| Phase | Focus |
|-------|--------|
| A | Persist `discount_domain` / `surface` on create; filter admin GET by domain; fix heuristics as fallback |
| B | Ecommerce catalog = `/admin/ecommerce/categories`; remove services inventory from ecommerce selector; stop writing bare `all` for Shop |
| C | Harden `/promotions/active` product vs service SQL; hide ineligible coupons in galleries |
| D | Align validate-code / coupon targeting both domains; optional per-domain businessRules |

---

## Mapping QA notes → findings

| QA note | Finding |
|---------|---------|
| Ecommerce category named Shop / Pet Shop | Treat as root vertical naming; wire **product** categories API |
| Create shows under Marketing → Promotions | Gap §1 — no domain + default marketing heuristic |
| UPP / checkout shows all category coupons | Visibility gaps §2 — Shop uses `CartPromotionSelect`; booking UPP gallery still over-broad |
| Ecommerce admin shouldn’t see Services scopes | Targeting gaps §3–7 — hide services stack; replace categories source |

---

*End of analysis. No code, migrations, commits, or pushes were performed for this investigation.*
