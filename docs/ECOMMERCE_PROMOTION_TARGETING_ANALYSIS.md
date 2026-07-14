# E-commerce Promotion Targeting Analysis

**Status:** Analysis only (no implementation)  
**Date:** 2026-07-08  
**Domain name:** Shop / Pet Shop (code: ecommerce / product / shop / marketplace)

---

## Current implementation

### Surfaces

| Surface | Scope config | Smart target |
|---------|--------------|--------------|
| Marketing | `domains: service, package, meal, booking` | `smartTargetSurface: 'marketing'` |
| E-commerce | `domains: product` | `smartTargetSurface: 'ecommerce'` |

Source: `apps/admin-web/lib/promotion-domain/surface-config.ts`

### Shared target selector

`packages/promotion-management-ui` — `PromotionTargetSelector` + `smart-target.ts`.

Smart flows (both admin surfaces):

| Flow id | Marketing label | Ecommerce label |
|---------|-----------------|-----------------|
| `entire_platform` | Entire platform | Entire marketplace |
| `categories` | Categories (+ catalogue services + optional styles) | Categories |
| `vendor_inventory` | Vendor services / packages / meal plans | Seller inventory → **products** |

Ecommerce correctly switches inventory scope to `products` and shows seller search. Marketing shows Services / Packages / Meal plans toggles.

### Payload mapping (`mappers.ts`)

```ts
entire_platform → applicable_to: 'all'
products        → applicable_to: 'products'
services/packages/meal_plans → 'services' | 'bookings'
```

`applicable_products` is sent from selected product IDs. Persistence prefers metadata for products (`promotion-admin-persistence.ts`). **No domain stamp.**

---

## Investigation 4 — Why admin sees “Entire Platform / Services / Packages / …”

### Partial truth (smart mode)

With `smartTargetSurface: 'ecommerce'`, the primary chips are **not** labeled Services / Packages / Meal Plans / Styles. Primary UI is:

1. Entire marketplace  
2. Categories  
3. Seller inventory  

Services / Packages / Meal Plans toggles appear only on the **marketing** vendor-inventory path.

### Why it still feels “service-like”

1. **Entire marketplace** still exists — equivalent to platform-wide apply; maps to `applicable_to: 'all'`, which Marketing list heuristics treat as Services-domain.
2. **Categories picker data** is loaded by `loadSmartTargetBaseCatalogWithErrors` from:
   - `/admin/catalog/categories` (service catalogue)
   - `/admin/banners/destination-options`
   - **Not** `/admin/ecommerce/categories` (Pet Shop product categories used by `CategoryManagement.tsx`)
3. Step hints still say “retail categories,” but the IDs/labels are **service hub categories**, so admins see verticals that look like Services (vet, grooming, etc.) mixed with shop-ish names.
4. `catalogForSurface(ecommerce)` drops `styles` from the catalog object but **keeps `categories`** from the same service-oriented load.
5. If smart targeting is off / legacy chip path runs, static `enabledScopes` still includes platform-wide services/packages/meal_plans/products/styles.

### Answer

Administrator **should not** see Services / Packages / Meal Plans / Styles as first-class Shop targets.  
They **currently** still see **Entire marketplace** plus a **miswired Categories catalog** that behaves like the Services world. Seller → products is the only clearly correct Ecommerce path.

---

## Investigation 5 — Correct E-commerce target model

### Recommended scopes (Shop only)

| Scope | Purpose | Persist as |
|-------|---------|------------|
| Entire Shop (optional / restricted) | Rare platform sales | `applicable_to: 'products'` + explicit `discount_domain: ECOMMERCE` / `metadata.surface: ecommerce` — **not** bare `all` shared with services |
| Shop / Pet Shop product categories | Category-wide cart off | `applicable_categories` / selected product-category IDs from `/admin/ecommerce/categories` |
| Products | SKUs | `applicable_products` / selected product IDs |
| Sellers / Vendors | Seller-scoped | `vendor_ids` + products or categories under that seller |
| Product collections (if product exists) | Merchandising sets | Only if collections API exists — not first-class today |

### Should these exist in E-commerce?

| Scope | Recommendation |
|-------|----------------|
| Entire Platform (services+shop) | **No** — domain leak |
| Entire Shop / Entire marketplace | **Optional**, only as Shop-scoped, with durable ecommerce domain |
| Services | **No** |
| Packages | **No** |
| Meal Plans | **No** |
| Styles (`at_home` / `tele` / …) | **No** |
| Service catalogue categories | **No** (use Pet Shop product categories) |

---

## Investigation 6 — Product categories (Pet Shop)

### How they are stored / managed

- Admin UI: `CategoryManagement.tsx` → `GET/PUT /admin/ecommerce/categories`
- Used elsewhere: commission settings, product approval (`category` / `category_name`)
- Vendor seller promos already support `applicable_categories` on `vendor_promotions`

### Does Promotion Target Selector support them?

**No — not for admin platform ecommerce.**

Smart catalog loader only merges **service** `/admin/catalog/categories` (+ banner destinations). Ecommerce hub never injects product category tree into `PromotionTargetCatalog.categories`.

### Required extension (analysis only)

1. Surface-aware catalog load: when `surface === 'ecommerce'`, load `/admin/ecommerce/categories` into `catalog.categories` (and stop using service catalogue for that surface).
2. Persist selected IDs as product-category targets (metadata + optionally `applicable_categories` column parity with vendor table).
3. Match at cart time against cart line product category IDs (vendor engine already understands product categories on lines).
4. Treat “Shop / Pet Shop” as the **customer hub / root vertical**, not as a Service catalogue style.

**Product Categories should become first-class Shop promotion targets.**

---

## Investigation 7 — Target selector behaviour

| Capability | Current |
|------------|---------|
| Hide Services / Packages / Meal Plans when Domain = Ecommerce | **Mostly yes** in smart vendor-inventory UI |
| Hide Styles | **Yes** for ecommerce catalog (styles omitted) |
| Hide Entire platform | **No** — shown as Entire marketplace |
| Show Products | **Yes** via seller inventory adapter |
| Show Product Categories (Pet Shop) | **No** — wrong category API |
| Show Sellers | **Yes** (search sellers) |
| Show Collections | **No** |
| Driven by Domain / Surface / Target Scope | **Partially** — surface drives labels and inventory type; category source is **not** domain-correct |

Shared component can become domain-aware without duplication: pass surface-specific catalog + disable flows (e.g. remove `entire_platform` for ecommerce, or scope it).

---

## Shop / Pet Shop as root category

**Recommendation:** Yes — treat **Shop / Pet Shop** as the **root E-commerce commercial vertical** for:

- Customer navigation / hub naming  
- Runtime `serviceType=product|shop`  
- Admin ecommerce surface root  

Do **not** force platform promos to pick the Service catalogue “shop” category slug as their only domain marker. Prefer explicit `discount_domain = ECOMMERCE` + product targeting.

Mapping already exists: catalog names like `ecommerce`, `pet-shop`, `store` → customer `shop` in `catalog-category-customer-service-map.ts`.

---

## Summary

Targeting for Ecommerce is **half-migrated**: seller products work; domain persistence and product-category selection do not. Entire-marketplace-as-`all` plus service categories in the Categories flow explain why Ecommerce admin UX still feels like Services.
