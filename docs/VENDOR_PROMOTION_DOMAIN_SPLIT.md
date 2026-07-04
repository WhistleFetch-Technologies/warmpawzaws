# Vendor Promotion Domain Split

## Architecture

Vendor-created promotions now use one shared dashboard component:

`apps/admin-web/components/admin/marketing/VendorPromotionsOverview.tsx`

The component accepts a domain config:

- `domain="SERVICE"` for service vendor promotions
- `domain="ECOMMERCE"` for marketplace seller promotions

The UI layout, cards, filters, table, status badges, actions, and loading/empty states remain the existing dashboard design.

## Navigation

Marketing now includes:

- `Vendor Promotions` → `/marketing/vendor-promotions`

E-Commerce now includes:

- `Seller Promotions` → `/ecommerce/seller-promotions`

The existing E-Commerce `Promotions & Coupons`, `Campaigns`, and `Analytics` links remain unchanged.

## Routes

| Route | Domain | Purpose |
| --- | --- | --- |
| `/marketing/vendor-promotions` | `SERVICE` | Service vendor-created promotions/coupons |
| `/ecommerce/seller-promotions` | `ECOMMERCE` | Marketplace seller-created product promotions/coupons |

## Domain Mapping

No backend API was duplicated.

Both routes call:

`GET /admin/vendor-promotions`

The existing category filter is used as the domain split:

- Marketing: `category=service`
- E-Commerce: `category=product`

Toggle actions continue to call:

`PUT /admin/vendor-promotions/:promoId/toggle`

with the promotion row's existing `promo_category`.

## Shared Components

Reused without redesign:

- `VendorPromotionsOverview`
- Existing KPI cards
- Existing search/filter bar
- Existing table layout
- Existing status and action controls
- Existing loading and empty states

## Files Modified

- `apps/admin-web/components/admin/marketing/VendorPromotionsOverview.tsx`
- `apps/admin-web/app/marketing/vendor-promotions/page.tsx`
- `apps/admin-web/app/ecommerce/seller-promotions/page.tsx`
- `apps/admin-web/components/admin/ecommerce/ECommerceSubNav.tsx`
- `apps/admin-web/components/admin/layout/UnifiedAdminSidebar.tsx`
- `packages/shared-types/src/admin-portal-nav.ts`

## Migration Notes

Legacy Marketing Hub still has its internal Vendor Promotions tab, but the stable route is now:

`/marketing/vendor-promotions`

E-Commerce seller-created promotions are available at:

`/ecommerce/seller-promotions`

No database migration and no backend deploy-specific change is required for this split.

## Validation Checklist

- [ ] `/marketing/vendor-promotions` loads only service promotions (`category=service`)
- [ ] `/ecommerce/seller-promotions` loads only product/seller promotions (`category=product`)
- [ ] KPI labels match Marketing wording
- [ ] KPI labels match E-Commerce wording
- [ ] Empty states match the domain
- [ ] Toggle action still works for service promotions
- [ ] Toggle action still works for product promotions
- [ ] Existing dashboard spacing/table/cards remain unchanged

## Rollback Strategy

1. Remove the two route wrappers.
2. Remove the Marketing sidebar nav entry.
3. Remove the E-Commerce subnav entry.
4. Revert `VendorPromotionsOverview` props and hardcoded labels.

No backend rollback is required.
