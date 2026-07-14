# Smart Target Selection — Implementation

**Date:** 2026-07-06  
**Status:** Implemented (local — not committed)  
**Design basis:** `TARGET_SELECTION_UX_RECOMMENDATION.md`, `TARGET_SELECTION_REUSE_PLAN.md`, `TARGET_SELECTION_IMPLEMENTATION_ROADMAP.md` (Phase 0–1)

---

## 1. Architecture

### Principle

**One Discount Engine · One Promotion Wizard · One PromotionTargetSelector**

Two operator experiences on shared framework:

| Surface | Route | Operator mental model |
|---------|-------|------------------------|
| **Marketing (Services)** | `/promotions` | Service marketplace — vendors, categories, service inventory |
| **E-Commerce** | `/ecommerce/promotions` | Retail marketplace — sellers, categories, product SKUs |
| **Vendor portal** | vendor dashboard | Own published inventory only (static selector) |

Backend, engine, settlement, analytics, and campaign audience logic are **unchanged**.

### Smart Context mode

`PromotionTargetSelector` detects `smartTargetSurface`:

- `'marketing' | 'ecommerce'` → Smart Context UX (progressive disclosure)
- omitted / `'vendor'` → legacy static scope chips (backward compatible)

Lazy inventory loads via `SmartTargetCatalogAdapter` (admin-web) using **existing APIs only**.

---

## 2. Files Changed

### Shared package (`packages/promotion-management-ui`)

| File | Change |
|------|--------|
| `src/types.ts` | `SmartTargetSurface`, `SmartTargetFlowId`, `VendorInventoryType`, `SmartTargetCatalogAdapter`, `PaginatedTargetState`; `PromotionManagementScope.smartTargetSurface` |
| `src/smart-target.ts` | **New** — flow labels, inventory filters, infer/build helpers, summary formatting |
| `src/hooks/useDebouncedValue.ts` | **New** — 300ms debounced search |
| `src/components/TargetContextBar.tsx` | **New** — context breadcrumb, selection summary, skeleton, empty/retry states |
| `src/components/PromotionTargetSelector.tsx` | Extended — `SmartPromotionTargetSelector` + static mode preserved |
| `src/components/PromotionWizard.tsx` | Passes `smartTargetSurface` + `smartTargetAdapter` |
| `src/components/PromotionDashboard.tsx` | Passes `smartTargetAdapter` to wizard |
| `src/components/PromotionSummary.tsx` | Human-readable smart target summary |
| `src/validation.ts` | Category + vendor-without-inventory validation |
| `src/index.ts` | Exports smart-target utilities + TargetContextBar |

### Admin web (`apps/admin-web`)

| File | Change |
|------|--------|
| `lib/smart-target-catalog-adapter.ts` | **New** — lazy vendor/seller inventory via existing vendor APIs |
| `lib/promotion-catalog-loader.ts` | **New** `loadSmartTargetBaseCatalogWithErrors()` — categories, vendors, styles only |
| `lib/promotion-domain/surface-config.ts` | `smartTargetSurface` on scopes; slim `catalogForSurface()` |
| `components/admin/marketing/AdminPromotionHub.tsx` | Base catalog + adapter wiring |
| `components/admin/marketing/campaigns/CampaignOrchestrationPanel.tsx` | Same smart target reuse for campaign wizard |

### Vendor web (`apps/vendor-web`)

| File | Change |
|------|--------|
| `components/vendor/promotions/ServicePromotionsHub.tsx` | Unified `isEligiblePublishedInventory` filter on services/packages/meals |

### Documentation

| File | Change |
|------|--------|
| `docs/TARGET_SELECTION_IMPLEMENTATION.md` | This document |

---

## 3. UX Decisions

| Decision | Rationale |
|----------|-----------|
| Model D Smart Context for admin | Progressive disclosure; no massive preloaded catalog |
| Three top-level flows per surface | Matches operator intent (broad vs category vs surgical) |
| Single vendor/seller per inventory promo | Prevents cross-vendor confusion; enforced by radio picker |
| Categories → Done (no forced services) | Category-wide promos are valid; optional style narrowing is collapsed |
| Optional service styles (marketing only) | Advanced narrowing — not shown by default |
| Vendor portal unchanged (static mode) | Inventory already scoped; client search sufficient |
| Business labels only in UI | No platform vs vendor ID concepts exposed to operators |
| Campaign audience stays separate | `CampaignAudienceEditor` unchanged; inventory via `PromotionWizard` |

---

## 4. Marketing Flow (`/promotions`)

```
Target type
├── Entire platform → confirmation only → Done
├── Categories → dynamic category search/select → Done
│   └── (optional) Narrow by service style
└── Vendor inventory
    ├── Search vendor → select one (radio)
    ├── Inventory type: Services | Packages | Meal plans
    └── Lazy load published inventory → search → multi-select → Done
```

**Inventory filter:** published, enabled, approved only — excludes draft, archived, disabled, deleted, pending.

**APIs used (lazy):**

- `GET /admin/vendors?limit=200` — partner search (cached in catalog)
- `GET /vendor/{id}/services/enabled`
- `GET /vendor/{id}/packages`
- `GET /vendor/{id}/nutritionist/meal-plans`

**Hub mount APIs (light):**

- `GET /admin/catalog/categories`
- `GET /admin/banners/destination-options`
- `GET /admin/catalog/service-styles`
- `GET /admin/vendors?limit=200`

---

## 5. E-Commerce Flow (`/ecommerce/promotions`)

```
Target type
├── Entire marketplace → confirmation only → Done
├── Categories → dynamic category search/select → Done
└── Seller inventory
    ├── Search seller → select one (radio)
    └── Lazy load products → search → multi-select → Done
```

**APIs used (lazy):**

- `GET /vendor/{sellerId}/products`

**Extension points (not implemented — no APIs):**

- Collections scope hook in adapter interface
- Brands scope hook
- Variant/SKU expand row

---

## 6. Vendor Flow

Unchanged static `PromotionTargetSelector`:

- Scopes: services, packages, meal plans, styles (capability-gated)
- Client-side search + pagination
- **Tightened filter:** `isEligiblePublishedInventory` on all inventory types

No vendor/seller picker — context is implicit.

---

## 7. Shared Component Extensions

### `PromotionTargetSelector` new props

```typescript
smartTargetSurface?: 'marketing' | 'ecommerce' | 'vendor';
smartTargetAdapter?: SmartTargetCatalogAdapter;
```

When omitted → **static mode** (existing behaviour).

### `SmartTargetCatalogAdapter`

```typescript
{
  searchPartners?(query): Promise<TargetOption[]>;
  loadVendorInventory?(vendorId, type, search): Promise<TargetOption[]>;
  loadSellerProducts?(sellerId, search): Promise<TargetOption[]>;
}
```

### `PromotionManagementScope.smartTargetSurface`

Set in `surface-config.ts` for admin marketing/ecommerce scopes.

---

## 8. Reuse Summary

| Reused | Extended | Not duplicated |
|--------|----------|----------------|
| `PromotionTargetSelector` | Smart mode branch | AdminTargetSelector |
| `PromotionWizard` | adapter prop | CampaignTargetSelector |
| `PromotionDashboard` | adapter prop | SellerTargetSelector |
| `targeting.ts` / `mappers.ts` | unchanged persistence | New payload shape |
| `CampaignOrchestrationPanel` | same wizard + adapter | Duplicate campaign picker |
| `loadPromotionTargetCatalogWithErrors` | kept for legacy callers | — |

---

## 9. Known Limitations

| Limitation | Mitigation path |
|------------|-----------------|
| Vendor list capped at 200 | Phase 2 server pagination (`TARGET_SELECTION_IMPLEMENTATION_ROADMAP.md`) |
| Partner search is client filter on 200 rows until pagination API | Phase 2 |
| E-commerce admin categories use platform category API (not product taxonomy) | Future: derive from product catalog slice |
| Collections/brands/variants not in UI | Adapter extension points reserved |
| Legacy promos with flat service scope may open in vendor-inventory flow on edit | Acceptable; re-save aligns metadata |
| Admin coupon wizard still minimal target fields in mapper | Phase 0 follow-up (persistence) |
| No engine/resolver changes in this phase | IDs still mapped by existing backend |

---

## 10. Validation Checklist

### Marketing (`/promotions`)

- [ ] **Entire platform** — select flow, no picker, publish succeeds
- [ ] **Category promotion** — pick category(ies), no inventory required, publish succeeds
- [ ] **Optional styles** — expand advanced styles, select, summary shows count
- [ ] **Vendor service promo** — pick vendor → Services → select items → publish
- [ ] **Vendor package promo** — pick vendor → Packages → select items → publish
- [ ] **Vendor meal promo** — pick vendor → Meal plans → select items → publish
- [ ] **No cross-vendor** — only one vendor radio selected at a time
- [ ] **Draft inventory hidden** — disabled/archived items not in lazy lists
- [ ] **Validation** — vendor selected without inventory blocks publish

### E-Commerce (`/ecommerce/promotions`)

- [ ] **Entire marketplace** — no picker
- [ ] **Category promotion** — categories only
- [ ] **Seller product promo** — seller → products → publish

### Vendor portal

- [ ] **Own services/packages/meals** — static selector works
- [ ] **Unpublished items excluded** from picker

### Campaign Builder

- [ ] **Orchestration panel wizard** uses same smart selector
- [ ] **Campaign audience** still separate from inventory

### Regression

- [ ] Vendor/seller hubs unchanged UX (static mode)
- [ ] Legacy marketing modal/routes still present

---

## 11. Rollback

| Level | Action |
|-------|--------|
| **UI only** | Remove `smartTargetSurface` from `MARKETING_PROMOTION_SCOPE` / `ECOMMERCE_PROMOTION_SCOPE` in `surface-config.ts` — reverts to static selector |
| **Catalog load** | Switch `AdminPromotionHub` back to `loadPromotionTargetCatalogWithErrors` |
| **Full** | Revert package + admin-web + vendor-web files listed in §2 |

No database migration. No engine flags. Rollback is frontend-only.

---

## 12. Build Verification

```
apps/admin-web: npm run build — ✓ Compiled successfully (2026-07-06)
```

---

*End of implementation record.*
