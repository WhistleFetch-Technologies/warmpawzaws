# UI/UX Sprint A — Implementation Report

**Date:** 2026-07-03  
**Scope:** Admin Promotion Hub (`/promotions`) production readiness  
**Status:** Implemented locally — not committed  
**Principle:** `/promotions` is the future; `/marketing` remains the legacy container for other marketing features.

---

## Executive Summary

Sprint A makes **`/promotions`** the production-ready operator surface for **platform promotions and coupons** by:

1. Wiring **dynamic target catalogs** from existing admin APIs
2. Extending **`/admin/promotions`** as the **canonical API** with full targeting persistence
3. Adding **sidebar navigation** under Marketing
4. Preserving **legacy Marketing Hub** with migration banners (no removal)
5. Implementing **`POST /admin/coupons/bulk-generate`**
6. Improving **loading, empty, and error UX** in the shared UI package

Discount engine, settlement, stack/priority/funding UI, and analytics dashboards were **not** modified (out of scope).

---

## Architecture

```
Admin Sidebar → /promotions
  └── AdminPromotionHub (data layer)
        └── @warmpawz/promotion-management-ui
              ├── PromotionDashboard
              ├── PromotionWizard
              └── PromotionTargetSelector

Catalog: promotion-catalog-loader.ts → existing admin APIs
Persistence: wizardToAdminPromotionPayload → POST/PUT /admin/promotions
             promotion-admin-persistence.ts (backend)
Database: promotions + coupons tables (shared with /marketing/promotions)
```

**Canonical API:** `/admin/promotions`  
**Legacy API (retained):** `/marketing/promotions` — same `promotions` table  
**Compatibility:** Both read/write the same rows; new hub stores rich targeting in `applicable_services` + `metadata.promotionTarget`.

---

## Components Reused (unchanged behavior)

| Component | Package |
|-----------|---------|
| `PromotionDashboard` | `@warmpawz/promotion-management-ui` |
| `PromotionWizard` | same |
| `PromotionTargetSelector` | same |
| `PromotionCard`, `CouponCard` | same |
| `PromotionDetailsPanel` | same |
| `PromotionSummary`, `PromotionPreview` | same |
| `PromotionStatusBadge`, `PromotionTimeline` | same |
| `ComingSoonSection` | same (policy placeholders untouched) |
| `validation.ts`, `lifecycle.ts` | same |

---

## Components / Modules Extended

| Item | Change |
|------|--------|
| `AdminPromotionHub.tsx` | Dynamic catalog load, toasts, error/warning banners |
| `promotion-catalog-loader.ts` | **New** — aggregates existing admin catalog APIs |
| `targeting.ts` | **New** — build/parse applicable_services + metadata |
| `mappers.ts` | Full targeting payload for `/admin/promotions` |
| `normalize.ts` | Round-trip targeting via `parseApplicableServicesToTargets` |
| `PromotionDashboard.tsx` | Improved loading + empty states |
| `PromotionTargetSelector.tsx` | Clearer empty-catalog message |
| `admin-portal-nav.ts` | Sidebar entry: **Promotions** → `/promotions` |
| `UnifiedAdminSidebar.tsx` | Icon + navigation for promotions |
| `marketing/page.tsx` | Migration banners; dynamic category/style dropdowns |
| `CouponManagement.tsx` | Better bulk-generate error handling |
| `promotion-admin-persistence.ts` | **New** — backend targeting persistence |
| `promotions.ts` (backend) | Extended POST/PUT/DELETE; bulk-generate coupons |

---

## Files Modified

### Admin Web
- `apps/admin-web/components/admin/marketing/AdminPromotionHub.tsx`
- `apps/admin-web/lib/promotion-catalog-loader.ts` *(new)*
- `apps/admin-web/app/marketing/page.tsx`
- `apps/admin-web/components/admin/marketing/CouponManagement.tsx`
- `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx`

### Shared Package
- `packages/promotion-management-ui/src/targeting.ts` *(new)*
- `packages/promotion-management-ui/src/mappers.ts`
- `packages/promotion-management-ui/src/normalize.ts`
- `packages/promotion-management-ui/src/index.ts`
- `packages/promotion-management-ui/src/components/PromotionDashboard.tsx`
- `packages/promotion-management-ui/src/components/PromotionTargetSelector.tsx`

### Shared Types
- `packages/shared-types/src/admin-portal-nav.ts`

### Backend
- `backend/lambda/src/utils/promotion-admin-persistence.ts` *(new)*
- `backend/lambda/src/endpoints/promotions.ts`

### Documentation
- `docs/UI_SPRINT_A_IMPLEMENTATION.md` *(this file)*

---

## Catalog Wiring

| Target scope | Source API | Notes |
|--------------|------------|-------|
| Categories | `GET /admin/catalog/categories` + banner destination categories | Deduped by slug/id |
| Services | `GET /admin/catalog/services` | Up to 100 catalog rows |
| Packages | `GET /admin/catalog/regional-packages` | Regional packages |
| Meal plans | `GET /meal-plans/search` | Public search endpoint (read-only list) |
| Products | `GET /admin/catalog/products` | E-commerce catalog |
| Vendors | `GET /admin/vendors?limit=200` | Already used |
| Styles | `GET /admin/catalog/service-styles` | Fallback: at_home, at_center, tele |

Partial catalog failures show a **non-blocking amber warning** in the hub.

---

## API Changes

### `POST /admin/promotions`
Now persists full targeting via `promotion-admin-persistence.ts`:
- `applicable_services` (category slugs, `style:*`, UUIDs for services/packages/meals/products)
- `service_category`, `service_style`
- `metadata.promotionTarget` with `targetScopes` + `selectedTargets`
- `published`, `is_spotlight`, usage limits, dates

### `PUT /admin/promotions/:id`
Merge update preserving existing targeting when partial body sent (e.g. toggle `is_active` only).

### `DELETE /admin/promotions/:id`
Changed from hard delete to **soft delete** (`is_active = false`) — matches `/marketing/promotions` behavior.

### `POST /admin/coupons/bulk-generate` *(new)*
Generates up to 500 unique codes with configurable prefix, length, discount, and validity.

**Legacy `/marketing/promotions` unchanged** — backward compatible.

---

## Migration Strategy

| Phase | Action | Status |
|-------|--------|--------|
| A1 | Production-ready `/promotions` | **Done** |
| A2 | Legacy banners + link to hub | **Done** |
| A3 | UX polish (loading/empty/errors) | **Done** |
| Future | Retire legacy Promotions/Coupons tabs | **Not started** |
| Future | Policy engine admin UI | **Deferred** |

Legacy operators see:
- Orange banner on Marketing Hub **Promotions** and **Coupons** tabs
- **Open Promotion Hub** button → `/promotions`
- Legacy list and modal **still functional**

---

## Known Limitations

1. **Service catalog limit** — `/admin/catalog/services` returns max 100 rows; large catalogs may need pagination in a future sprint.
2. **Meal plans** — loaded via customer search endpoint; admin-only list endpoint would be cleaner (future).
3. **Vendor targeting** — UI supports vendor scope; runtime eligibility for vendor-scoped platform promos depends on existing booking resolver (unchanged).
4. **Dual APIs** — legacy modal still uses `/marketing/promotions`; both write same table but legacy modal has simpler targeting (category + style only).
5. **Hard delete on coupons** — `/admin/coupons` DELETE still hard-deletes (unchanged); promotions use soft delete.
6. **Bulk selection** — not implemented in dashboard (future enhancement).

---

## Future Sprint Items (Explicitly Out of Scope)

- Stack / Priority / Funding / Settlement admin UI
- Campaign builder, analytics dashboard, simulator, audit viewer
- Customer segment targeting
- Vendor co-funding UI
- Full retirement of legacy promotion modal
- E-commerce orphan `PromotionsManagement` merge

---

## Validation Checklist

| Test | Expected |
|------|----------|
| Sidebar → Promotions | Navigates to `/promotions` |
| Create promotion with category targeting | Saves; appears in legacy `/marketing` list |
| Create promotion from legacy modal | Appears in `/promotions` dashboard |
| Edit promotion in wizard | Targets restored correctly |
| Delete / deactivate promotion | Soft delete; hidden from active tab |
| Category/service/package/meal/product/style targets | Persist in `applicable_services` + metadata |
| Create / edit coupon | Works via wizard coupons flow |
| Bulk coupon generate | `POST /admin/coupons/bulk-generate` succeeds |
| Customer checkout | Unchanged — uses existing resolver |
| Vendor portal | Unchanged |

**Build verification (local):**
- `backend/lambda` — `npm run build` ✓
- `apps/admin-web` — `npm run build` ✓

---

## Rollback Strategy

1. **Frontend only:** Revert admin-web + promotion-management-ui changes; legacy Marketing Hub continues to work via `/marketing/promotions`.
2. **Backend:** Revert `promotions.ts` + `promotion-admin-persistence.ts`; old slim `/admin/promotions` POST still worked before but without targeting — hub would lose targeting persistence until re-deployed.
3. **Sidebar:** Remove `promotions` row from `admin-portal-nav.ts`; route `/promotions` remains reachable by URL.
4. **Data:** No schema migration; soft-deleted promos can be reactivated via `is_active = true`.

**Safe rollback order:** Backend first (if targeting causes issues), then frontend. No data loss from soft delete.

---

## Related Documentation

- `docs/ADMIN_MARKETING_CURRENT_STATE.md`
- `docs/ADMIN_MARKETING_GAP_ANALYSIS.md`
- `docs/ADMIN_MARKETING_REUSE_PLAN.md`
- `docs/PROMOTION_SYSTEM_STATUS.md`
