# E-commerce Commercial Completion (Phase E1)

**Status:** Implemented locally (not committed / not pushed)  
**Date:** 2026-07-08  
**Scope:** Complete E-commerce commercial domain on the existing Commercial Engine — no rewrites, no duplicate engines.

Based on:

- `ECOMMERCE_DOMAIN_ANALYSIS.md`
- `ECOMMERCE_PROMOTION_TARGETING_ANALYSIS.md`
- `ECOMMERCE_COUPON_VISIBILITY_ANALYSIS.md`
- `ECOMMERCE_ADMIN_UX_ANALYSIS.md`
- `ECOMMERCE_RUNTIME_ANALYSIS.md`
- `ECOMMERCE_GAP_REPORT.md`

---

## Architecture

```
Marketing (SERVICE)              E-commerce / Shop (ECOMMERCE)
─────────────────────            ─────────────────────────────
Promotion Center                 Promotions & Coupons
  Platform Promos/Coupons          → same AdminPromotionHub
  Vendor Promotions                Seller Promotions
  Policy Center                    Policies → PolicyCenter
  Campaigns                        Campaigns
  Analytics                        Analytics

                    Shared
        Discount Engine V2
        Policy / Campaign / Analytics / Settlement
        promotion-management-ui (wizard, selector, dashboard)
```

Separation key: persisted **`discount_domain`** = `SERVICE` | `ECOMMERCE`.

---

## Domain Separation

| Concern | Mechanism |
|---------|-----------|
| Persist | `promotions.discount_domain`, `coupons.discount_domain` (migration `1063_…`) |
| Create | Wizard mappers stamp from admin `surface`; ecommerce forces `applicable_to=products` |
| Admin list | `GET /admin/promotions?discount_domain=` / `GET /admin/coupons?discount_domain=` |
| Customer list | `GET /promotions/active?discount_domain=` (+ shop `serviceType=product`) |
| Legacy | NULL column → SQL heuristics + `inferLegacyDiscountDomain` |
| Client | Safety-net filters only; no longer primary |

---

## Navigation (unchanged Marketing; E-commerce Policies retargeted)

**Marketing:** Marketing Hub · Promotion Center · Notification  

**Promotion Center tabs:** Platform · Vendor · Policy · Campaigns · Analytics  

**E-commerce:** Promotions & Coupons · Seller Promotions · Campaigns · Analytics · **Policies** → `/ecommerce/policy` (Discount Policy Center, not marketplace return/shipping settings)

---

## Policy Center

- Same `PolicyCenter` component.
- Marketing: `surface="marketing"` → SERVICES view (locked when surface set).
- E-commerce: `/ecommerce/policy` → `surface="ecommerce"` → ECOMMERCE view locked.
- Runtime loader continues to merge per-domain priority/stack/limits; shared engine.

---

## Campaigns

- Same `CommercialCampaignHub` with `surface`.
- Create stamps `metadata.domain` / `metadata.surface` / `discount_domain`.
- List filtered by surface (metadata + campaign type).

---

## Promotion Center

- Marketing hub: `discount_domain=SERVICE` only.
- E-commerce Promotions & Coupons: same components, `discount_domain=ECOMMERCE`.
- No duplicate wizard / dashboard.

---

## Targeting

| Marketing | E-commerce |
|-----------|------------|
| Entire platform | **All Products** |
| Categories (+ catalogue services, styles) | **Product Categories** (`/admin/ecommerce/categories`) |
| Vendor inventory (services / packages / meals) | **Seller inventory → Products** |

Removed from E-commerce UI: Services, Packages, Meal Plans, Styles, Entire Platform.

---

## Coupon Filtering (Customer)

| Surface | API |
|---------|-----|
| Booking gallery | `/promotions/active?...&discount_domain=SERVICE&service=` |
| Shop cart | `/ecommerce/promotions/active?serviceType=product&includeCoupons=true&discount_domain=ECOMMERCE` |

Booking gallery **omits** ineligible codes (no greyed wall). Backend domain filter is primary.

---

## Runtime

- One Discount Engine; callers pass `DiscountDomain.SERVICE` or `ECOMMERCE`.
- Booking apply excludes ECOMMERCE / products rows (`platformPromotionAppliesToBooking`).
- Policy / campaigns / analytics stay domain-parameterized.

---

## Testing checklist

- [ ] Create ecommerce promo from E-commerce → appears only under E-commerce Promotions & Coupons  
- [ ] Create service promo from Promotion Center → appears only under Marketing  
- [ ] Ecommerce targeting shows All Products / Product Categories / Seller inventory only  
- [ ] Product categories load from ecommerce category API  
- [ ] `/ecommerce/policy` opens Policy Center locked to ecommerce  
- [ ] Booking coupon gallery = SERVICE only  
- [ ] Shop cart coupons = ECOMMERCE only  
- [ ] Legacy rows without `discount_domain` still list via fallback  
- [ ] Apply migration `1070_promotions_coupons_discount_domain.sql` on env before relying on column  

---

## Rollback

1. Revert UI to previous surface heuristics (or redeploy prior build).  
2. APIs remain backward compatible: missing `discount_domain` query returns broader lists; column missing falls back to metadata.  
3. Migration is additive (`ADD COLUMN IF NOT EXISTS`) — safe to leave in place.

---

## Future Roadmap

| Phase | Item |
|-------|------|
| E2 | Backfill `discount_domain` for all legacy rows |
| E3 | Product collections as targets |
| E4 | Per-domain businessRules in Policy Center publish |
| E5 | Campaign list API `?discount_domain=` |
| E6 | Stricter cart-line product eligibility on gallery |

---

## Key files

| Area | Path |
|------|------|
| Migration | `db/migrations/1070_promotions_coupons_discount_domain.sql` |
| Domain util | `backend/lambda/src/utils/commercial-discount-domain.ts` |
| Persist | `promotion-admin-persistence.ts`, `coupon-targeting.ts` |
| APIs | `backend/lambda/src/endpoints/promotions.ts` |
| Admin hub | `AdminPromotionHub.tsx`, `surface-config.ts` |
| Targeting | `packages/promotion-management-ui` smart-target + selector |
| Policy | `app/ecommerce/policy/page.tsx`, `PolicyCenter.tsx` |
| Customer | `CouponSection.tsx`, `CartPromotionSelect.tsx` |
