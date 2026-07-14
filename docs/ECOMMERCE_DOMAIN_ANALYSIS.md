# E-commerce Promotions & Coupons — Domain Separation Analysis

**Status:** Analysis only (no implementation)  
**Date:** 2026-07-08  
**Terminology:** Customer-facing vertical is **Shop / Pet Shop**. Code often uses `ecommerce`, `product`, `shop`, `marketplace`, `retail`. Treat these as one commercial domain unless noted.

---

## Executive summary

Warmpawz has **two commercial domains** (Services and E-commerce / Shop) on **one Commercial / Discount Engine**. Domain separation today is **incomplete**:

| Layer | Services vs Shop separation |
|-------|----------------------------|
| Admin nav entry points | Two routes (`/promotion-center` vs `/ecommerce/promotions`) — **same hub component** |
| Create payload | **No persisted `domain` / `surface`** on platform promos/coupons |
| List APIs | **Unfiltered** — return entire `promotions` / `coupons` tables |
| Admin list UI | **Client heuristics** in `surface-config.ts` that often misclassify Shop offers as Marketing |
| Vendor tables | **Physically split** (`vendor_service_promotions` vs `vendor_promotions`) — correct |
| Runtime resolver | Knows `DiscountDomain.SERVICE` vs `ECOMMERCE` — partially applied at list time |
| Customer shop vs booking galleries | Separate UI, but both load **over-broad** coded-offer lists |

**Observed bugs (match QA):**

1. Creating an E-commerce promo/coupon from **Admin → E-commerce → Promotions** often appears under **Admin → Marketing → Promotion Center**.
2. Customer checkout (booking UPP and shop cart) surfaces coupons from **irrelevant categories / domains**.
3. E-commerce admin targeting still presents **marketplace-wide / service-oriented category catalogs**, not a clean Shop → Sellers → Products (+ Pet Shop product categories) model.

---

## Investigation 1 — Admin navigation & routing

### Intended structure

| Path | Intended content |
|------|------------------|
| Marketing → Promotion Center (`/promotion-center`) | **Services** platform promos/coupons only |
| E-commerce → Promotions & Coupons (`/ecommerce/promotions`) | **Shop** platform promos/coupons only |

### Actual structure

| Entry | Route | Component |
|-------|-------|-----------|
| Marketing | `/promotion-center` | `PromotionCenterHub` → `AdminPromotionHub surface="marketing"` |
| E-commerce | `/ecommerce/promotions` | `AdminPromotionHub surface="ecommerce"` |
| E-commerce seller | `/ecommerce/seller-promotions` | `VendorPromotionsOverview domain="ECOMMERCE"` |
| Marketing vendor | Promotion Center `?tab=vendor` | `VendorPromotionsOverview domain="SERVICE"` |

Nav files:

- `apps/admin-web/lib/marketing-portal-nav.ts` → Promotion Center
- `apps/admin-web/components/admin/ecommerce/ECommerceSubNav.tsx` → Promotions & Coupons

**Both portals reuse one shared hub.** Separation is only the `surface` prop.

### Why E-commerce creates appear under Marketing → Promotions

Chain of failure:

1. Admin opens `/ecommerce/promotions` with `surface="ecommerce"`.
2. Wizard saves via `wizardToAdminPromotionPayload` / `wizardToAdminCouponPayload` (`packages/promotion-management-ui/src/mappers.ts`).
3. Payload includes targeting (`applicable_to`, `target_scopes`, `applicable_products`, …) but **never** `domain`, `discount_domain`, or `surface`.
4. Persistence (`promotion-admin-persistence.ts`) stores products mainly in **metadata**; top-level product markers are unreliable for later heuristics.
5. “Entire marketplace” maps to `applicable_to: 'all'` and empty product lists.
6. Both hubs call the **same** `GET /admin/promotions` and `GET /admin/coupons` (**no domain query**).
7. `filterPromotionRows` / `filterCouponRows` in `surface-config.ts` use heuristics:
   - Ecommerce if top-level products / seller_id / domain enum / shop-ish `service_category` / product-ish type.
   - Else → **Marketing (default)**.
8. Heuristic **does not** treat `applicable_to === 'products'`, nor `metadata.applicableProducts` / `metadata.targetScopes`, as ecommerce.
9. Result: Shop create → classified as marketing → **visible in Marketing**, often **hidden from E-commerce**.

**Domain separation break point:** create path omits durable domain; list path filters client-side and incorrectly.

---

## Investigation 2 — Promotion domain separation

### How domain is stored today

| Entity | Domain storage |
|--------|----------------|
| Platform `promotions` | **No** `discount_domain` column. Proxies: `applicable_to`, `service_category`, `applicable_services`, `metadata.targetScopes` / `applicableProducts` |
| Platform `coupons` | Same targeting columns / metadata (`1062_coupons_service_targeting.sql`) |
| Vendor service promos | Table `vendor_service_promotions` = Services |
| Vendor shop promos | Table `vendor_promotions` = Shop (products / product categories) |
| Commercial campaigns | `metadata.domain` / `metadata.surface` stamped from admin surface |
| Runtime | `DiscountDomain.SERVICE` \| `ECOMMERCE` (engine enums, not DB on platform rows) |

**Is surface persisted?** Only for campaigns today. **Not** for platform promotions/coupons.

### Cross-leakage

| Question | Answer |
|----------|--------|
| Can a Services promo appear in E-commerce admin list? | Rarely (default = marketing). E-commerce list often **misses** true Shop rows. |
| Can an E-commerce promo appear in Services / Marketing list? | **Yes — common** (default classify-as-marketing). |
| Can service offers appear on shop customer list? | **Yes** — `/ecommerce/promotions/active?serviceType=product` still allows `applicable_to=all` and null `applicable_services`. |
| Can shop offers appear on booking gallery? | **Yes** — booking gallery often omits hard product exclusion on list; apply is stricter. |

### Places filtering is missing

| Location | Gap |
|----------|-----|
| `GET /admin/promotions` | No `?domain=` / `applicable_to` |
| `GET /admin/coupons` | Same |
| `GET /marketing/promotions` | Same |
| `surface-config.ts` heuristics | Ignore `applicable_to`, metadata products/scopes |
| `GET /promotions/active` product mode | Too permissive (`all` / null services) |
| Booking `/promotions/active` without product exclusion | Coded product offers can enter gallery |
| Candidate normalizer | Platform promos always `SERVICE`; coupons always `ECOMMERCE` — ignores row scope |
| Coupon ecommerce validate | Weak / missing product-line & `applicable_to` gates vs services path |

---

## Investigation 3 — Customer coupon visibility (overview)

See `docs/ECOMMERCE_COUPON_VISIBILITY_ANALYSIS.md` for full detail.

**Booking:** `UniversalPaymentPage` → `CheckoutCouponPanel` → `CouponSection` loads `/promotions/active?includeCoupons=true&includeCodedPromotions=true&service=…` plus vendor service offers. Ineligible rows stay **visible** (greyed).

**Shop:** `CartPromotionSelect` (not UPP) loads `/ecommerce/promotions/active?serviceType=product&includeCoupons=true` **without** a shop/product-category bucket; FE filters **min order only**.

Frontend `coupon-targeting.ts` is effectively **unused** by checkout galleries.

---

## Investigation 4–7 — Targeting (overview)

See `docs/ECOMMERCE_PROMOTION_TARGETING_ANALYSIS.md`.

Smart UX for ecommerce **relabels** flows (Entire marketplace / Categories / Seller inventory) and loads **products** for seller inventory. But:

- “Categories” still comes from **service catalog** (`/admin/catalog/categories`), **not** `/admin/ecommerce/categories` (Pet Shop / product categories).
- “Entire marketplace” remains available and writes `applicable_to: all` → marketing leak.
- Static non-smart scope chips in the shared wizard still conceptually include services/packages/meals/styles for platform mode; smart mode hides most of that for ecommerce, but the **catalog behind Categories is still wrong**.

---

## Investigations 8–12 (pointers)

| Topic | Doc |
|-------|-----|
| Universal Payment Page / galleries | `ECOMMERCE_COUPON_VISIBILITY_ANALYSIS.md` |
| Runtime policy | `ECOMMERCE_RUNTIME_ANALYSIS.md` |
| Shared components & admin UX | `ECOMMERCE_ADMIN_UX_ANALYSIS.md` |
| Gaps & final recommendations | `ECOMMERCE_GAP_REPORT.md` |

---

## Final answers (this doc)

1. **Why E-commerce under Marketing?** No persisted domain; shared unfiltered APIs; weak client heuristics default to marketing.
2. **Why customer coupons unfiltered?** Galleries fetch broad coded lists; display does not hide ineligible domain/category rows; shop omits service/product-category query; backend product mode is permissive.
3–5. Targeting / categories / Shop root — see targeting + gap reports.
6. **Shared components?** Yes — extend existing hub, wizard, selector, runtime — **do not duplicate**.
7–9. Full gap list and architecture — `ECOMMERCE_GAP_REPORT.md`.
