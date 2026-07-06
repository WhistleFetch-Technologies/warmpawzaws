# UI/UX Refinement Sprint — Promotions Platform

Admin and vendor promotion experience improvements. **UI / navigation only** — no Discount Engine, settlement, analytics engine, campaign engine, or backend business logic changes.

---

## Architecture

```
Admin sidebar (UnifiedAdminSidebar)
  └── Marketing (collapsible)
        ├── Marketing Hub → /marketing?tab=…
        ├── Promotions → /promotions, /marketing/vendor-promotions, …
        └── Notifications → /notification-engine, /notifications

@warmpawz/promotion-management-ui
  └── PromotionDashboard (shared admin + vendor)
        ├── Lifecycle tabs: Active | Scheduled | Draft | Expired
        ├── Type filter: All | Promotions | Coupons
        ├── PromotionCard / CouponCard (same grid)
        └── PromotionDetailsPanel (drawer on card click)
```

Vendor hubs (`ServicePromotionsHub`, `SellerPromotionsHub`) render the same `PromotionDashboard` — no separate vendor details panel.

---

## Files changed

| Area | Files |
|------|--------|
| Marketing IA | `apps/admin-web/lib/marketing-portal-nav.ts` (new) |
| Sidebar | `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx` |
| Nav label | `packages/shared-types/src/admin-portal-nav.ts` |
| Dashboard filters | `packages/promotion-management-ui/src/components/PromotionDashboard.tsx` |
| Package exports | `packages/promotion-management-ui/src/index.ts` |
| Admin hub | `apps/admin-web/components/admin/marketing/AdminPromotionHub.tsx` |
| Routes | `apps/admin-web/app/promotions/page.tsx`, `apps/admin-web/app/ecommerce/promotions/page.tsx` |
| E-commerce sub-nav | `apps/admin-web/components/admin/ecommerce/ECommerceSubNav.tsx` |
| Notifications anchors | `apps/admin-web/app/notification-engine/page.tsx` |

---

## Navigation changes (Issue 1)

**Before:** Flat list under “Marketing & Promotions” (Content, Promotions, Vendor Promotions, Policy Center, Analytics, Campaigns, Notification Engine).

**After:**

| Group | Items | Routes |
|-------|--------|--------|
| **Marketing Hub** | Dashboard UI, Spotlight, Banners, Articles, What's New | `/marketing?tab=…` |
| **Promotions** | Platform Promotions, Vendor Promotions, Coupons, Policy Center, Analytics, Campaigns | Existing paths (see `marketing-portal-nav.ts`) |
| **Notifications** | Push Notifications, Notification Campaigns, Templates, History | `/notification-engine?view=…`, `/notifications` |

- Parent sidebar label: **Marketing**
- Legacy mode (`NEXT_PUBLIC_ENABLE_LEGACY_PROMOTION_UI=true`) keeps the previous flat list.
- RBAC and route guards unchanged (`ADMIN_PORTAL_NAV_ITEMS` path prefixes preserved).

---

## Filter changes (Issue 2)

**Lifecycle tabs (only):** Active, Scheduled, Draft, Expired  
- Removed **Coupons** lifecycle tab  
- Removed **Recently created** tab (out of sprint scope)

**Type filter (canonical):** All | Promotions | Coupons  
- Replaces “All kinds” dropdown labels  
- **Active + All** shows active promotions **and** active coupons in one grid (unique keys, no duplicate cards)  
- **Promotions** / **Coupons** restrict the grid to one kind while lifecycle tab still applies  

Deep links:
- `/promotions?type=coupons` → Type = Coupons  
- `/ecommerce/promotions?type=coupons` (legacy `?tab=coupons` still supported)

---

## Vendor details (Issue 3)

- Vendor already uses shared `PromotionDashboard`.
- **Promotion** card click → `PromotionDetailsPanel` (promotion fields).
- **Coupon** card click → same panel (coupon mode).
- **Edit** in drawer closes panel then opens `PromotionWizard`.
- No `VendorPromotionDetailsPanel` — single shared panel only.

---

## Reuse summary

| Component | Reused |
|-----------|--------|
| `PromotionDashboard` | Admin + vendor |
| `PromotionCard` / `CouponCard` | Admin + vendor |
| `PromotionDetailsPanel` | Admin + vendor |
| `PromotionWizard` | Admin + vendor |
| Filters / search / sort | In-package only |

---

## Validation checklist

### Marketing navigation
- [ ] Sidebar shows Marketing → Hub / Promotions / Notifications groups
- [ ] Marketing Hub links open correct `/marketing?tab=…` sections
- [ ] Promotions sub-links open platform, vendor, coupons, policy, analytics, campaigns
- [ ] Notifications sub-links open push builder, campaigns table, templates, history

### Promotion dashboard
- [ ] Lifecycle tabs: Active, Scheduled, Draft, Expired
- [ ] Type filter: All, Promotions, Coupons
- [ ] Active + All lists both promotion and coupon cards
- [ ] No separate Coupons tab
- [ ] Details drawer on card click (admin + vendor)
- [ ] Edit from drawer opens wizard

### Vendor
- [ ] Service + seller hubs unchanged API wiring
- [ ] Click promotion → details drawer
- [ ] Click coupon → details drawer

---

## Known limitations

- Notification sub-links use in-page scroll anchors on `/notification-engine`; History uses existing `/notifications` monitor (not duplicated).
- Coupon lifecycle on **Draft** tab includes paused coupons (same as promotions).
- `?type=coupons` sets initial type filter only on first mount (client `useEffect`).
- Funding / analytics sections in `PromotionDetailsPanel` remain **Coming soon** placeholders (unchanged).

---

## Rollback

1. Set `NEXT_PUBLIC_ENABLE_LEGACY_PROMOTION_UI=true` to restore flat marketing sidebar.
2. Revert `PromotionDashboard.tsx` to restore Coupons lifecycle tab and “All kinds” label.
3. Remove `marketing-portal-nav.ts` usage in sidebar (restore flat `visibleMarketingNav` block only).

No database or API rollback required.
