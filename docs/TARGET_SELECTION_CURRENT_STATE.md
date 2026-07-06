# Target Selection — Current State Inventory

**Date:** 2026-07-06  
**Scope:** Analysis only — documents existing behaviour across Admin, Vendor, Seller, Customer, Campaign Builder, and Discount Engine integration.  
**Companion docs:** `TARGET_SELECTION_GAP_ANALYSIS.md`, `TARGET_SELECTION_UX_RECOMMENDATION.md`, `TARGET_SELECTION_ARCHITECTURE.md`

---

## 1. Executive Summary

Warmpawz uses a **shared promotion UI package** (`@warmpawz/promotion-management-ui`) with a single `PromotionTargetSelector` component. Each actor loads a **different catalog** from different APIs and persists **different ID spaces**. Admin operates on platform catalog IDs (`service_catalog.service_id`); vendors operate on inventory IDs (`vendor_services.id`, package/meal row IDs, `products.id`).

Target selection is **scope-chip based** (entire platform, vendors, categories, services, packages, meal plans, products, styles) with **client-side search and pagination** (8 items per page). There is **no server-side filtering** for target pickers today.

---

## 2. Shared UI Components

| Component | Path | Role |
|-----------|------|------|
| `PromotionTargetSelector` | `packages/promotion-management-ui/src/components/PromotionTargetSelector.tsx` | Scope chips + checkbox list + search |
| `PromotionWizard` | `packages/promotion-management-ui/src/components/PromotionWizard.tsx` | Multi-step create/edit; step 3 = targets |
| `PromotionDashboard` | `packages/promotion-management-ui/src/components/PromotionDashboard.tsx` | List + wizard host for all hubs |
| `targeting.ts` | `packages/promotion-management-ui/src/targeting.ts` | Parse/persist tokens, round-trip |
| `mappers.ts` | `packages/promotion-management-ui/src/mappers.ts` | Actor-specific API payloads |

### 2.1 PromotionTargetSelector behaviour

- **Scope chips:** User toggles one or more of `enabledScopes`. Selecting `entire_platform` clears all granular targets.
- **Active scope tabs:** When multiple scopes selected, user switches tab per scope to pick items.
- **Search:** Client-side filter on `label`, `subtitle`, `id` (case-insensitive).
- **Pagination:** Fixed `pageSize = 8`; prev/next buttons only.
- **Select all / Clear:** Operates on **filtered** options (current search result set).
- **Empty state:** Dashed border message — "No matching items in this catalog."
- **No virtualization**, no lazy load, no server query params.

### 2.2 Wizard enabled scopes by actor

From `PromotionWizard.enabledScopes()`:

| `scope.mode` | Enabled scopes |
|--------------|----------------|
| `platform` (admin) | `entire_platform`, `vendors`, `categories`, `services`, `packages`, `meal_plans`, `products`, `styles` — trimmed per surface |
| `vendor_services` | `services`, `packages`, `meal_plans`, `styles` |
| `vendor_seller` | `products`, `categories`, `packages`, `meal_plans` |

Admin surfaces further restrict via `surface-config.ts`:

- **Marketing:** `entire_platform`, `vendors`, `categories`, `services`, `packages`, `meal_plans`, `styles`
- **E-Commerce:** `entire_platform`, `vendors`, `categories`, `products`

---

## 3. Admin Experience

### 3.1 Entry points

| Route | Component | Surface |
|-------|-----------|---------|
| `/promotions` | `AdminPromotionHub` | marketing |
| `/ecommerce/promotions` | `AdminPromotionHub` | ecommerce |
| Campaign orchestration | `CampaignOrchestrationPanel` | marketing or ecommerce |

Legacy modal still exists: `AdvancedPromotionsEngine` (hardcoded 5 categories; coarse targeting).

### 3.2 Catalog loading

**Loader:** `apps/admin-web/lib/promotion-catalog-loader.ts` → `loadPromotionTargetCatalogWithErrors()`

Parallel API calls on hub mount:

| Catalog slice | API | ID field used | Known limit |
|---------------|-----|---------------|-------------|
| Categories | `GET /admin/catalog/categories` + `/admin/banners/destination-options` | `category_id` / slug | Unbounded merge + dedupe |
| Services | `GET /admin/catalog/services` | `service_id` (fallback `id`) | **LIMIT 100** in SQL |
| Packages | `GET /admin/catalog/regional-packages` | `id` | Endpoint-dependent |
| Products | `GET /admin/catalog/products` | `id` | Endpoint-dependent |
| Vendors | `GET /admin/vendors?limit=200` | `id` | **200 max** |
| Styles | `GET /admin/catalog/service-styles` | `value` / `id` | Fallback: 3 hardcoded |
| Meal plans | `GET /meal-plans/search` | `id` | Search endpoint |

After load, `catalogForSurface()` slices catalog:

- **Marketing:** categories, services, packages, mealPlans, styles, vendors
- **E-Commerce:** categories, products, vendors

### 3.3 Admin UX flow

1. Open Promotion Hub → full catalog fetched once.
2. Create promotion/coupon → `PromotionWizard` opens.
3. Step: Target selection → `PromotionTargetSelector` with surface-specific scopes.
4. Admin can combine scopes (e.g. category + specific services + style).
5. Save → `wizardToAdminPromotionPayload()` or `wizardToAdminCouponPayload()`.

### 3.4 Admin persistence

**Promotions** (`wizardToAdminPromotionPayload`):

- `applicable_services[]` — mixed token array (category slugs, `style:*`, UUIDs for services/packages/meals/products)
- `applicable_service_ids[]`, `applicable_category_ids[]`, `applicable_products[]`, `vendor_ids[]`
- `target_scopes[]`, `selected_targets{}` — round-trip metadata
- `service_category`, `service_style` — primary column shortcuts
- `applicable_to` — coarse enum: `all`, `services`, `products`, `bookings`

**Coupons:** Minimal payload today — **no target fields** in `wizardToAdminCouponPayload()`.

### 3.5 Admin limitations (observed)

- Service list capped at 100 platform catalog rows.
- Vendor list capped at 200.
- Flat lists — no vendor→service hierarchy in picker.
- Coupon wizard cannot target specific services/products.
- Legacy modal and wizard coexist; persistence paths differ.
- `/admin/promotions` handler may not persist all wizard fields (see `ADMIN_PROMOTION_GAP_ANALYSIS.md` ADMIN-03).

---

## 4. Vendor (Service) Experience

### 4.1 Entry point

`apps/vendor-web/components/vendor/promotions/ServicePromotionsHub.tsx`

### 4.2 Catalog loading

| Slice | API | ID used |
|-------|-----|---------|
| Services | `GET /vendor/{id}/services/enabled` | `vendor_services.id` |
| Packages | `GET /vendor/{id}/packages` + package-flagged services | row `id` |
| Meal plans | `GET /vendor/{id}/nutritionist/meal-plans` (capability-gated) | row `id` |
| Styles | Hardcoded 3 options | slug tokens |

### 4.3 Inventory filters (client-side)

| Entity | Filter applied |
|--------|----------------|
| Services (non-package) | From `/services/enabled` — **no extra status filter** |
| Packages | `isActiveLike()` + `isApprovedOrUnversioned()` |
| Meal plans | `isActiveLike()` + `isApprovedOrUnversioned()` |

`isActiveLike`: excludes `false`, `0`, `inactive`, `disabled`, `deleted`.  
`isApprovedOrUnversioned`: accepts `approved`, `active`, `published`, `live`; empty status passes.

### 4.4 Enabled scopes

Built by `buildEnabledTargetScopes()`:

- Always: `services`, `styles`
- `packages` if capability or catalog has packages
- `meal_plans` if capability or catalog has meal plans
- **No** `entire_platform`, `vendors`, `categories` (vendor cannot target platform-wide)

### 4.5 Vendor persistence

`wizardToVendorServicePayload()`:

- `applicable_services[]` — union of selected services, packages, meal plan IDs
- `applicable_service_styles[]` — style slugs or `['all']`
- Stored in `vendor_service_promotions` table

**ID space:** vendor inventory IDs, **not** `service_catalog.service_id`.

---

## 5. Seller (E-Commerce) Experience

### 5.1 Entry point

`apps/vendor-web/components/vendor/promotions/SellerPromotionsHub.tsx`

### 5.2 Catalog loading

| Slice | API | ID used |
|-------|-----|---------|
| Products | `GET /vendor/{id}/products` | `products.id` |
| Categories | Derived from `product.category` strings | category name as id |

No collections, brands, or variant-level targeting in UI today.

### 5.3 Seller scopes

Via `PromotionDashboard` scope `vendor_seller`:

- `products`, `categories` (from wizard default; hub does not override `enabledTargetScopes`)

### 5.4 Seller persistence

`wizardToVendorSellerPayload()`:

- `applicable_products[]`
- `applicable_categories[]`
- Stored in vendor product promotions path

---

## 6. Customer (Read-Only Visibility)

Customers do **not** configure targets. They **see** promotion outcomes:

- Service booking flows: applicable promotions resolved at checkout via booking/cart APIs
- Product cart: vendor ecommerce promotion engine
- Platform coupons: code entry + validation

Target matching happens server-side in:

- `booking-promotion-service.ts`
- `vendor-promotion-engine.ts`
- Discount Engine V2 candidate providers (`candidate-normalizer.ts`, domain providers)

Customer-facing UI shows **applied discount labels**, not target picker. Promotion eligibility is opaque unless surfaced as badges ("20% off grooming").

---

## 7. Campaign Builder

### 7.1 Components

| Component | Target selection reuse |
|-----------|------------------------|
| `CampaignBuilderDialog` | 8-step wizard; audience step only |
| `CampaignAudienceEditor` | **Does NOT** use `PromotionTargetSelector` — dropdown for audience kind only |
| `CampaignOrchestrationPanel` | Reuses `PromotionWizard` + full admin catalog for queued promos/coupons |

### 7.2 Campaign audience vs promotion targets

`CampaignAudienceEditor` supports:

- `all`, `new_customers`, `returning`, `vip`, `segment`, `vendor_customers`

Comment says "Reuses promotion targeting kinds" but implementation is **audience segmentation only**, not service/product inventory targeting.

Commercial campaigns attach promotions created elsewhere; inventory targeting is delegated to linked promotion rows.

---

## 8. Data Flow Diagram (Current)

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACTOR-SPECIFIC LOADERS                       │
├──────────────┬──────────────────────┬───────────────────────────┤
│ Admin        │ Service Vendor       │ Seller                    │
│ promotion-   │ /services/enabled    │ /products                 │
│ catalog-     │ /packages            │ (categories derived)      │
│ loader.ts    │ /meal-plans          │                           │
└──────┬───────┴──────────┬───────────┴─────────────┬─────────────┘
       │                  │                         │
       ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              PromotionTargetCatalog (in-memory)                  │
│  { categories, services, packages, mealPlans, products,         │
│    vendors, styles }                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              PromotionTargetSelector (shared UI)                   │
│  scope chips → search → client page (8) → selectedTargets{}      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              targeting.ts + mappers.ts                           │
│  buildApplicableServicesFromForm / parseApplicableServices...    │
└────────────────────────────┬────────────────────────────────────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
 platform_promotions   vendor_service_promotions  vendor product promos
 (mixed tokens)         (vendor_services.id)       (products.id)
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│         Discount Engine V2 / Legacy Engines                      │
│  candidate-normalizer → rule context → eligibility match         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. ID Mapping (Current)

| Entity | Admin saves | Vendor service saves | Seller saves |
|--------|-------------|----------------------|--------------|
| Service | `service_catalog.service_id` | `vendor_services.id` | N/A |
| Package | platform package `id` | vendor package / package-service `id` | N/A |
| Meal plan | meal plan row `id` | vendor meal plan `id` | N/A |
| Product | platform product `id` | N/A | seller `products.id` |
| Category | slug / category_id | N/A (implicit via service) | product.category string |
| Vendor | vendor UUID | N/A | N/A |
| Style | `style:at_home` token | `at_home` in styles array | N/A |

**Round-trip parsing:** `parseApplicableServicesToTargets()` uses loaded catalog ID sets to classify UUIDs into services vs packages vs meals vs products. Unknown UUIDs default to **services** bucket.

---

## 10. Backend Catalog APIs (Key Endpoints)

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /admin/catalog/services` | Platform service catalog | LIMIT 100; prefers `service_catalog` table |
| `GET /admin/catalog/categories` | Service categories | Dynamic from DB |
| `GET /admin/catalog/regional-packages` | Platform packages | |
| `GET /admin/catalog/products` | Platform products | |
| `GET /admin/vendors?limit=200` | Vendor list for targeting | Hard cap 200 |
| `GET /meal-plans/search` | Cross-vendor meal plans | |
| `GET /vendor/{id}/services/enabled` | Vendor published services | Enabled only |
| `GET /vendor/{id}/packages` | Vendor packages | |
| `GET /vendor/{id}/nutritionist/meal-plans` | Vendor meal plans | Capability-gated |
| `GET /vendor/{id}/products` | Seller inventory | All products returned |

---

## 11. Domain Coverage Matrix

| Domain | Admin targets | Vendor targets | Seller targets | Engine support |
|--------|---------------|----------------|----------------|----------------|
| Service marketplace | ✅ categories, services, styles, vendors | ✅ services, styles | N/A | ✅ |
| Packages | ✅ platform packages | ✅ vendor packages | N/A | ✅ |
| Meals | ✅ meal plan search | ✅ meal plans (capability) | N/A | ✅ |
| E-Commerce products | ✅ products (ecom surface) | N/A | ✅ products, categories | ✅ |
| Pharmacy | ⚠️ category slug only | ⚠️ if vendor role | N/A | Partial |
| Insurance | ⚠️ legacy modal only | N/A | N/A | Partial |
| Events | ❌ no catalog slice | ❌ | ❌ | ❌ |
| Pet marketplace | ❌ | ❌ | ❌ | ❌ |

---

## 12. Technical Debt Inventory

| ID | Item | Location |
|----|------|----------|
| TD-TS-01 | Admin service catalog LIMIT 100 | `admin-advanced.ts` |
| TD-TS-02 | Vendor list LIMIT 200 | `promotion-catalog-loader.ts` |
| TD-TS-03 | Dual ID spaces (platform vs vendor) | persistence + engine |
| TD-TS-04 | Mixed token array in `applicable_services` | `targeting.ts` |
| TD-TS-05 | Admin coupons lack target fields | `mappers.ts` |
| TD-TS-06 | Campaign audience ≠ inventory targeting | `CampaignAudienceEditor.tsx` |
| TD-TS-07 | Legacy `AdvancedPromotionsEngine` parallel path | admin marketing |
| TD-TS-08 | Client-only search/pagination at scale | `PromotionTargetSelector.tsx` |
| TD-TS-09 | UUID fallback → services bucket | `targeting.ts:150` |
| TD-TS-10 | Seller: no collections/brands/variants | `SellerPromotionsHub.tsx` |

---

## 13. File Reference Index

| Area | Primary files |
|------|---------------|
| Shared selector | `packages/promotion-management-ui/src/components/PromotionTargetSelector.tsx` |
| Target logic | `packages/promotion-management-ui/src/targeting.ts` |
| Payload mappers | `packages/promotion-management-ui/src/mappers.ts` |
| Admin catalog | `apps/admin-web/lib/promotion-catalog-loader.ts` |
| Admin surface split | `apps/admin-web/lib/promotion-domain/surface-config.ts` |
| Admin hub | `apps/admin-web/components/admin/marketing/AdminPromotionHub.tsx` |
| Vendor service hub | `apps/vendor-web/components/vendor/promotions/ServicePromotionsHub.tsx` |
| Seller hub | `apps/vendor-web/components/vendor/promotions/SellerPromotionsHub.tsx` |
| Campaign panel | `apps/admin-web/components/admin/marketing/campaigns/CampaignOrchestrationPanel.tsx` |
| Engine normalizer | `backend/lambda/src/discount-engine/candidates/candidate-normalizer.ts` |
| Prior gap analysis | `docs/ADMIN_PROMOTION_GAP_ANALYSIS.md` |

---

*End of current state inventory.*
