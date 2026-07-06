# Legacy Promotion UI Hide — Implementation

**Date:** 2026-07-06  
**Status:** Implemented (local — not committed)  
**Rule:** Hide only. Never delete routes, components, or APIs.

---

## 1. Objective

Make the **new Promotion Platform** the only visible operator experience for QA while preserving all legacy code for rollback.

---

## 2. Feature Flag

| Flag | Default | Effect |
|------|---------|--------|
| `NEXT_PUBLIC_ENABLE_LEGACY_PROMOTION_UI` | `false` (unset) | Legacy promo tabs, CRUD, and orphan screens hidden |
| `true` | Developer rollback | Restores legacy marketing tabs and legacy CRUD surfaces |

**Runtime override (optional):** `window.__WARMPAWZ_RUNTIME_CONFIG__.enableLegacyPromotionUi = true`

**Helper:** `apps/admin-web/lib/legacy-promotion-ui.ts`

---

## 3. Legacy Screens Hidden (normal QA)

| Legacy surface | Location | Hidden how |
|----------------|----------|------------|
| Marketing hub **Promotions** tab (inline CRUD + modal) | `/marketing?tab=promotions` | Tab hidden; direct URL → deprecated screen |
| Marketing hub **Coupons** tab | `/marketing?tab=coupons` | Tab hidden; direct URL → deprecated screen |
| Marketing hub **Vendor Promotions** tab (duplicate) | `/marketing?tab=vendor-promotions` | Tab hidden; use `/marketing/vendor-promotions` |
| Migration banners (“Open Promotion Hub”) | `/marketing` | Removed |
| AdminPromotionHub “Legacy Marketing Hub” link | `/promotions`, `/ecommerce/promotions` | Removed |
| AdminApp stub promotions table | Root admin app | Deprecated screen unless flag on |
| E-commerce coupons redirect-only UX | `/ecommerce/coupons` | Deprecated screen with hub link |
| Orphan `PromotionsManagement` grid | Not in nav | `/ecommerce/promotions-legacy` — deprecated unless flag |
| Orphan `AdvancedPromotionsEngine` | Not in nav | `/marketing/legacy-promotions` — deprecated unless flag |

---

## 4. Primary UI (visible to QA)

### Marketing sidebar

- **Promotions** → `/promotions` (Promotion Hub)
- **Vendor Promotions** → `/marketing/vendor-promotions`
- **Campaigns** → `/marketing/campaigns`
- **Analytics** → `/marketing/analytics`
- **Policy Center** → `/policy-center`
- **Marketing Content** → `/marketing` (banners, spotlight, articles, dashboard UI only)

### E-Commerce sub-nav

- **Promotions** → `/ecommerce/promotions`
- **Seller Promotions** → `/ecommerce/seller-promotions`
- **Coupons** → `/ecommerce/promotions?tab=coupons`
- **Campaigns** → `/ecommerce/campaigns`
- **Analytics** → `/ecommerce/analytics`

### Vendor portal

- Unchanged — `ServicePromotionsHub` / `SellerPromotionsHub` via existing wrappers (already new platform)

---

## 5. Routes Preserved

| Route | Behaviour when flag **off** | Behaviour when flag **on** |
|-------|----------------------------|----------------------------|
| `/marketing` | Opens **Banners** tab by default | Same + legacy tabs visible |
| `/marketing?tab=promotions` | Deprecated screen + link to `/promotions` | Legacy inline CRUD |
| `/marketing?tab=coupons` | Deprecated screen | Legacy `CouponManagement` |
| `/marketing?tab=vendor-promotions` | Deprecated → `/marketing/vendor-promotions` | Legacy duplicate tab |
| `/marketing/legacy-promotions` | Deprecated screen | `AdvancedPromotionsEngine` |
| `/ecommerce/coupons` | Deprecated screen | Redirect to promotions coupons tab |
| `/ecommerce/promotions-legacy` | Deprecated screen | `PromotionsManagement` grid |
| `/promotions`, `/ecommerce/promotions`, campaigns, analytics | **New platform** (unchanged) | Same |

**No routes deleted.**

---

## 6. Components Preserved (not deleted)

| Component | Path |
|-----------|------|
| `AdvancedPromotionsEngine` | `components/admin/marketing/` |
| `CouponManagement` | `components/admin/marketing/` |
| `PromotionsManagement` (e-commerce) | `components/admin/ecommerce/promotions/` |
| Inline promotion modal + table | `app/marketing/page.tsx` |
| `ServicePromotionsManagement` / `PromotionsManagement` wrappers | vendor-web |
| All Promotion Hub / Wizard / Smart Target components | unchanged |

---

## 7. Files Changed

| File | Change |
|------|--------|
| `lib/legacy-promotion-ui.ts` | **New** — flag + nav filter + tab constants |
| `components/admin/marketing/LegacyPromotionDeprecatedScreen.tsx` | **New** — shared deprecated UX |
| `app/marketing/page.tsx` | Hide legacy tabs; remove migration banners; default tab `banners` |
| `app/marketing/legacy-promotions/page.tsx` | **New** — preserved AdvancedPromotionsEngine route |
| `app/ecommerce/coupons/page.tsx` | Deprecated screen (not silent redirect) |
| `app/ecommerce/promotions-legacy/page.tsx` | **New** — preserved PromotionsManagement route |
| `app/ecommerce/promotions/page.tsx` | Supports `?tab=coupons` |
| `components/admin/marketing/AdminPromotionHub.tsx` | Removed legacy hub link |
| `components/admin/layout/UnifiedAdminSidebar.tsx` | Filter marketing nav via flag |
| `components/admin/ecommerce/ECommerceSubNav.tsx` | Promotions / Coupons split; label cleanup |
| `components/admin/ecommerce/ECommercePromoLayout.tsx` | Suspense for search params |
| `components/AdminApp.tsx` | Legacy promotions stub gated |
| `packages/shared-types/src/admin-portal-nav.ts` | “Marketing Content” label + description |

---

## 8. Navigation Changes

- Sidebar **Marketing Content** (was “Marketing Hub”) — content tools only, no promo CRUD tabs
- **No duplicate** Promotions entry in marketing hub tabs
- E-commerce **Promotions** and **Coupons** are separate nav items pointing at unified hub
- **Campaigns** / **Analytics** labels simplified on e-commerce sub-nav

---

## 9. Rollback

1. Set `NEXT_PUBLIC_ENABLE_LEGACY_PROMOTION_UI=true` in env or runtime config
2. Rebuild admin-web
3. Legacy tabs reappear on `/marketing`
4. `/marketing/legacy-promotions` and `/ecommerce/promotions-legacy` serve full legacy UI
5. Re-add `AdminPromotionHub` legacy link manually if desired (code preserved in git history)

**No database or backend changes required.**

---

## 10. Validation Checklist

### Marketing

- [ ] Sidebar shows Promotions, Vendor Promotions, Campaigns, Analytics, Policy Center, Marketing Content
- [ ] `/marketing` opens Banners (no Promotions/Coupons tabs)
- [ ] No migration orange banners on marketing hub
- [ ] `/promotions` is the only platform promo CRUD entry
- [ ] `/marketing?tab=promotions` shows deprecated screen (flag off)

### E-Commerce

- [ ] Sub-nav: Promotions, Seller Promotions, Coupons, Campaigns, Analytics
- [ ] `/ecommerce/promotions` — new hub
- [ ] `/ecommerce/promotions?tab=coupons` — coupons tab
- [ ] `/ecommerce/coupons` — deprecated screen (flag off)

### Vendor

- [ ] Single promotion experience via vendor dashboard (no change)

### Customer

- [ ] Unaffected

### Developer

- [ ] `npm run build` in admin-web succeeds
- [ ] Legacy components still importable
- [ ] Flag `true` restores legacy tabs and CRUD

---

## 11. Known Limitations

| Item | Notes |
|------|-------|
| Legacy promo modal code remains inside `marketing/page.tsx` | Large file; not extracted — hidden by tab gating only |
| `/ecommerce/promotions-legacy` not linked in nav | Intentional — direct URL for dev rollback |
| Notification Engine remains in marketing sidebar | Not promotion-legacy; kept |
| Commission / Product Approval remain on e-commerce sub-nav | Operational tools, not duplicate promo UI |

---

*End of legacy UI hide implementation record.*
