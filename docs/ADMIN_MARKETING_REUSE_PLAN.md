# Admin Marketing & Promotions — Reuse Plan

**Phase:** UI/UX Sprint A — Discovery  
**Date:** 2026-07-03  
**Status:** Analysis only — no implementation  
**Companion:** `docs/ADMIN_MARKETING_CURRENT_STATE.md`, `docs/ADMIN_MARKETING_GAP_ANALYSIS.md`

---

## Executive Summary

Sprint A should **extend** the `@warmpawz/promotion-management-ui` package and `AdminPromotionHub` as the long-term promotion/coupon operator surface. Legacy Marketing Hub components should be **bridged or retired** only after API and catalog parity. This document maps every reusable asset to **Reuse / Extend / Replace / Duplicate** with migration notes.

**Principle:** Never rebuild what exists in `packages/promotion-management-ui/`.

---

## Component Reuse Matrix

### Package: `@warmpawz/promotion-management-ui`

| Component | Current usage | Can reuse | Needs extension | Replacement required | Owner screen | Migration strategy |
|-----------|---------------|-----------|-----------------|---------------------|--------------|-------------------|
| `PromotionDashboard` | `/promotions` | **Yes** | Add analytics slot, bulk actions | No | AdminPromotionHub | Keep; extend props for stats |
| `PromotionWizard` | `/promotions` create/edit | **Yes** | Wire catalog props; coupon bulk step optional | No | AdminPromotionHub | Keep; pass loaded catalogs |
| `PromotionTargetSelector` | Wizard step 3 | **Yes** | None — consumer must load data | No | AdminPromotionHub | Load catalogs in hub |
| `PromotionTypeSelector` | Wizard step 1 | **Yes** | — | No | Wizard | As-is |
| `PromotionTriggerSelector` | Wizard step 4 | **Yes** | Customer segments (future) | No | Wizard | Extend when segment API exists |
| `PromotionCard` | Dashboard grid | **Yes** | — | No | Dashboard | As-is |
| `CouponCard` | Dashboard coupons tab | **Yes** | — | No | Dashboard | As-is |
| `PromotionDetailsPanel` | Dashboard drawer | **Yes** | Settlement/funding preview (future) | No | Dashboard | Extend post-Phase 7 UI |
| `PromotionSummary` | Wizard review | **Yes** | — | No | Wizard | As-is |
| `PromotionPreview` | Wizard review | **Yes** | Live simulator hook (future) | No | Wizard | Extend in Sprint B+ |
| `PromotionStatusBadge` | Cards, drawer | **Yes** | — | No | Shared | As-is |
| `PromotionTimeline` | Drawer | **Yes** | Audit events (future) | No | Drawer | Extend when audit API exists |
| `ComingSoonSection` | Wizard policy step | **Yes** | Convert chips to deep links when screens ship | No | Wizard | Placeholder → nav links |
| `validation.ts` | Wizard | **Yes** | Funding rule validation (future) | No | Wizard | Extend with policy fields |
| `normalize.ts` | AdminPromotionHub | **Yes** | Map `/marketing/promotions` shape if dual API | No | Hub | Add adapter functions |
| `lifecycle.ts` | Dashboard tabs | **Yes** | — | No | Dashboard | As-is |
| `types.ts` | Package-wide | **Yes** | Policy/scoped funding types (future) | No | Package | Extend types only |

---

### Admin Web: `apps/admin-web/components/admin/marketing/`

| Component | Current usage | Can reuse | Needs extension | Replacement required | Owner screen | Migration strategy |
|-----------|---------------|-----------|-----------------|---------------------|--------------|-------------------|
| `AdminPromotionHub.tsx` | `/promotions` | **Yes** | **Catalog loading**, API adapter, error states | No | `/promotions` | Sprint A primary work |
| `CouponManagement.tsx` | `/marketing` coupons tab | **Partial** | Delete/toggle; fix bulk-generate | **Eventually replace** with Dashboard coupons tab | `/marketing` → `/promotions` | Redirect or embed Dashboard tab |
| `VendorPromotionsOverview.tsx` | `/marketing` vendor tab | **Yes** | Filter, detail drawer | No | `/marketing` | Keep until vendor hub exists |
| `BannerImageField.tsx` | Banners | **Yes** | — | No | `/marketing`, `/banners` | Shared — do not duplicate |
| `ShopBannerDestinationFields.tsx` | Banners | **Yes** | — | No | Banners | Shared — do not duplicate |
| `AdvancedPromotionsEngine.tsx` | **Orphan** | **Partial** (patterns) | — | **Yes — retire** | None | Archive after E2E check |
| `BannerAdmin.tsx` | **Orphan stub** | No | — | **Yes — delete** | None | Remove stub |

---

### Admin Web: `apps/admin-web/app/marketing/page.tsx`

| Surface | Current usage | Can reuse | Needs extension | Replacement required | Migration strategy |
|---------|---------------|-----------|-----------------|---------------------|-------------------|
| Promotions tab (table + modal) | Live production | **Partial** (data fetch patterns) | — | **Yes — retire modal** | Deprecation banner → link `/promotions` |
| Vendor Promotions tab | Live | Yes | — | No | Keep on `/marketing` |
| Dashboard UI tab | Live | Yes | — | No | Keep — unrelated to promos |
| Spotlight tab | Live | Yes | — | No | Keep |
| Coupons tab | Live | Partial | — | Replace with hub tab | Soft redirect |
| Banners tab | Live | Yes | — | No | Keep or consolidate `/banners` |
| Articles tab | Live | Yes | — | No | Keep |
| What's New tab | Live | Yes | — | No | Keep |

---

### Admin Web: `apps/admin-web/app/banners/page.tsx`

| Component / hook | Can reuse | Notes |
|------------------|-----------|-------|
| Page + CRUD hooks | **Yes** | Reference pattern for catalog loading |
| `useApiData`, `useCrud`, `useFormModal` | **Yes** | Extract pattern for AdminPromotionHub |
| Destination options API usage | **Yes** | **Reuse for promotion target catalog** |

---

### Orphan: `apps/admin-web/components/admin/ecommerce/promotions/`

| Component | Status | Action |
|-----------|--------|--------|
| `PromotionsManagement.tsx` | Not mounted on `/ecommerce` | **Duplicate** of hub — do not extend; merge or delete |

---

## API Reuse Matrix

| API | Legacy consumer | New hub consumer | Reuse strategy |
|-----|-----------------|------------------|----------------|
| `GET/POST/PUT/DELETE /marketing/promotions` | Marketing tab | — | **Extend or adapter** — richer targeting |
| `GET/POST/PUT/DELETE /admin/promotions` | AdminPromotionHub | Primary target | **Extend** payload for full targeting |
| `GET/POST/PUT/DELETE /admin/coupons/*` | Both hubs | Both hubs | **Reuse** — unify lifecycle on hub |
| `POST /admin/coupons/bulk-generate` | CouponManagement | — | **Implement** backend |
| `GET /admin/banners/destination-options` | Banners | — | **Reuse pattern** for promo catalogs |
| `GET /admin/catalog/categories` | Catalog admin | — | **Wire** to AdminPromotionHub |
| `GET /admin/vendors` | AdminPromotionHub | Loaded | **Reuse** — already wired |
| `GET /admin/vendor-promotions` | Vendor tab | — | **Keep** separate |
| `GET /admin/promotions/analytics` | Orphan | — | **Wire** to Dashboard in Sprint B |

---

## Target Selector — Catalog Wiring Plan (Sprint A)

| Scope | Current source | Recommended source | Status |
|-------|----------------|-------------------|--------|
| `entire_platform` | N/A | No catalog needed | Ready |
| `categories` | Empty array | `GET /admin/catalog/categories` OR banner destination-options | **Wire** |
| `styles` | Hardcoded 3 | `GET /admin/banners/destination-options` (styles) OR policy-options | **Wire** |
| `services` | Empty array | Catalog services API (same as banner/service pickers) | **Wire** |
| `packages` | Empty array | Admin packages list endpoint | **Wire** |
| `meal_plans` | Empty array | Admin meal plans endpoint | **Wire** |
| `products` | Empty array | Shop products admin API | **Wire** |
| `vendors` | `GET /admin/vendors` | Already loaded | **Ready** |

**Reference implementation:** Banner modals in `marketing/page.tsx` and `/banners` — copy data-fetch pattern, not UI.

---

## Screen Ownership (Post-Sprint A Target)

| Screen | Long-term owner | Interim |
|--------|-----------------|---------|
| Platform promotions CRUD | `/promotions` | Legacy tab shows redirect banner |
| Platform coupons CRUD | `/promotions` (coupons tab) | `/marketing` coupons tab redirects |
| Vendor promotions view | `/marketing` vendor tab | Unchanged |
| Banners | `/marketing` and/or `/banners` | Consolidate later |
| Spotlight | `/marketing` | Unchanged |
| Articles / What's New | `/marketing` | Unchanged |
| Dashboard UI config | `/marketing` | Unchanged |
| Stack / priority / funding policy | **New screens** (future) | `ComingSoonSection` |
| Promotion analytics | `/promotions` dashboard extension | Future sprint |
| Simulator / audit | **New screens** | Not started |

---

## Duplicate Logic to Eliminate

| Duplicate | Location A | Location B | Resolution |
|-----------|------------|------------|------------|
| Promotion create form | `marketing/page.tsx` modal | `PromotionWizard` | Retire modal |
| Promotion list | `marketing/page.tsx` table | `PromotionDashboard` | Retire table |
| Coupon create | `CouponManagement` modal | `PromotionWizard` | Unify on wizard |
| Category lists | Hardcoded modal select | Hardcoded AdvancedPromotionsEngine | Single API-driven catalog |
| Status display | Inline badges | `PromotionStatusBadge` | Use package |
| API normalization | Inline mapping | `normalize.ts` | Use package only |
| Banner CRUD | `marketing/page.tsx` inline | `/banners` page + hooks | Prefer `/banners` hooks pattern |

---

## Migration Phases (Recommended — Not Implementation)

### Phase 1 — Sprint A (extend, don't replace)
- Wire catalogs in `AdminPromotionHub`
- Resolve API persistence for targeting
- Add sidebar entry for `/promotions`
- Fix coupon bulk-generate
- Add deprecation notice on legacy Promotions tab

### Phase 2 — Parity verification
- E2E: create promo on new hub → visible on legacy list (or vice versa)
- E2E: targeting tokens match runtime eligibility
- Operator training / doc update

### Phase 3 — Soft retirement
- Legacy Promotions tab → read-only or redirect
- Legacy Coupons tab → redirect to hub coupons tab
- Remove inline modal code from `marketing/page.tsx`

### Phase 4 — Marketing Hub slim-down
- Extract remaining tabs to route-level pages (optional refactor)
- Delete orphan components
- Unify banner surfaces

### Phase 5 — Policy admin UI
- Replace `ComingSoonSection` chips with real screens
- Stack / priority / funding / settlement preview
- Simulator and audit

---

## Decision Log (Analysis Only)

| Question | Finding | Recommendation |
|----------|---------|----------------|
| Which hub becomes long-term? | New `/promotions` + package | **Extend new hub** |
| What to reuse from legacy? | API richness, banner catalog pattern, vendor tab | **Bridge APIs**, reuse fetch patterns |
| What to retire? | Inline modal, orphan engines, duplicate ecommerce promos | **After parity** |
| Replace Marketing Hub entirely? | No — 7 non-promo tabs still needed | **Partial retirement** of promo/coupon tabs only |

---

## Files Reference (Quick Index)

```
apps/admin-web/
  app/marketing/page.tsx          # Legacy hub (3500 lines)
  app/promotions/page.tsx         # New hub entry
  app/banners/page.tsx            # Banner CRUD reference
  components/admin/marketing/
    AdminPromotionHub.tsx         # Sprint A primary extension point
    CouponManagement.tsx
    VendorPromotionsOverview.tsx
    AdvancedPromotionsEngine.tsx  # Retire candidate
packages/promotion-management-ui/
  src/components/                 # Reuse all
  src/validation.ts
  src/normalize.ts
packages/shared-types/
  src/admin-portal-nav.ts         # Add /promotions link here
backend/lambda/src/endpoints/
  marketing/promotions             # Legacy API
  admin/promotions, admin/coupons  # New hub API
```

---

## Sign-off Checklist (Pre-Implementation)

Before Sprint A coding starts, confirm:

- [ ] API strategy chosen: extend `/admin/promotions` vs adapter to `/marketing/promotions`
- [ ] Catalog endpoints identified for each target scope
- [ ] Sidebar link copy and permission gate agreed
- [ ] Legacy tab deprecation messaging approved
- [ ] Bulk-generate backend owner assigned
- [ ] E2E test plan covers dual-hub parity window
