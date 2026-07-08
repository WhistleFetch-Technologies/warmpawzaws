# E-commerce Coupon Visibility Analysis

**Status:** Analysis only (no implementation)  
**Date:** 2026-07-08  

---

## Problem statement

Customers see coupons from **every category / domain** at checkout. Expected: only coupons applicable to the **current checkout context** (service booking category/vendor, or Shop cart products/sellers).

---

## Two checkout surfaces

| Surface | UI stack | Coupon gallery |
|---------|----------|----------------|
| Service booking | `UniversalPaymentPage` → `CheckoutCouponPanel` → `CouponSection` | Yes |
| Shop / Pet Shop | `CartPromotionSelect` on cart / payment step | Yes — **not** UPP |

`UniversalPaymentPage` is used for booking / related payment types. E-commerce does **not** mount UPP for cart checkout in this codebase.

---

## Investigation 8 — Universal Payment Page

### How offers load

1. **Auto / best offer (booking):** `POST /promotions/calculate-booking` via booking discount resolver (`use-booking-discount-resolver`, `fetchBookingDiscountQuote`).
2. **Non-booking fallback:** `GET /promotions/applicable?category=…`
3. **Manual coupon gallery:** always via `CheckoutCouponPanel` → `CouponSection`.

### CouponSection load (booking)

```
GET /vendors/:id/active-promotions?type=service
GET /promotions/active?includeCoupons=true&includeCodedPromotions=true&service={category}
```

Then each code is probed with validate / calculate-booking. **Ineligible codes remain in the list** (opacity / “Not applicable”).

### CartPromotionSelect load (shop)

```
GET /ecommerce/promotions/active?serviceType=product&includeCoupons=true
GET /vendors/:id/active-promotions?type=product  (when vendor known)
```

`/ecommerce/promotions/active` is an **alias** of `/promotions/active`.

Frontend then keeps codes with **min order ≥ cart total** only — **no** category / product / domain prune before display.

### Request pattern

| Question | Answer |
|----------|--------|
| Does UPP request all coupons? | Gallery effectively requests **all active coded platform offers** (plus coupons), optionally narrowed by `service=` for the coupons table path only |
| Filtered coupons? | Partially on backend for **platform coupons** when `service` is set; coded `promotions` rows and shop path are weak |
| Where filtering happens | **Apply** (stricter) more than **list** (permissive). FE `coupon-targeting.ts` unused |

---

## Why every coupon is visible

### 1. Gallery is list-first, not eligibility-first

`CouponSection` shows every loaded code; eligibility only greys rows. Shop dropdown only applies min-amount.

### 2. Shop never passes a bucket for coupon matching

`couponRowMatchesService` returns **true for all** when `serviceBucket` is missing. Shop call omits `service` / shop category, so **every platform coupon** merges into the shop gallery.

### 3. Empty targeting = universal

Coupons with empty `applicable_services` / broad `applicable_to` match any bucket (helper design). Combined with create-time weak Shop tagging, many “service” coupons look global.

### 4. Active list SQL for `serviceType=product` is permissive

Product mode allows:

- `applicable_services IS NULL`
- `applicable_to IN ('all', 'products')`
- metadata product scopes / token match  

So **service-domain `all`** promotions still appear on Shop.

### 5. Booking list may include coded product offers

Without a hard products exclusion on the booking active list, product-scoped coded offers can appear; apply may reject them later.

### 6. Frontend targeting helpers unused

`apps/customer-web/lib/pricing/coupon-targeting.ts` is not wired into UPP / CouponSection / CartPromotionSelect. Capability probe (`coupon-capability.ts`) always returns available for products.

### 7. Validate fallback gaps

Legacy `GET /coupons/validate/:code` and weaker coded-promotion paths may skip domain/category gates that platform coupon SERVICE validation has.

---

## Expected customer UX

### Service booking

| Concern | Expected |
|---------|----------|
| Coupon visibility | Only codes with Services domain + matching **service category** (and vendor when required) |
| Promotion visibility | Auto / Best Offer from SERVICE resolver for that vendor/services |
| Payment | UPP + calculate-booking snapshot; do not show shop product coupons |
| Targeting | Category / styles / services / packages / meals as booked |

### Shop / Pet Shop checkout

| Concern | Expected |
|---------|----------|
| Coupon visibility | Only **ECOMMERCE** codes applicable to cart lines (products, Pet Shop categories, sellers) |
| Promotion visibility | Platform product scope + vendor `vendor_promotions` for cart sellers |
| Payment | CartPromotionSelect / cart pricing — not service booking UPP |
| Targeting | Products / product categories / sellers |

---

## Correct filtering architecture (recommendation)

Do **not** rely on greying every global code. Prefer:

1. **Server list APIs** require domain: `domain=SERVICE|ECOMMERCE` or strict `applicable_to`.
2. Booking gallery: exclude `applicable_to=products` (reuse `platformPromotionAppliesToBooking`).
3. Shop gallery: require product scope; pass cart product IDs / category IDs for server-side prune; never return service-only coupons.
4. Frontend: hide ineligible (or never request them); wire `couponOfferMatchesService` / product matchers only as defense-in-depth.
5. Keep apply path strict as source of truth for money; list path must match apply path eligibility rules.

---

## Investigation 12 — Customer UX summary

Customers currently experience **one giant coupon bucket**. The commercial engine can resolve correctly on **apply** for many cases, but **visibility** leaks cross-domain and cross-category offers, especially on Shop and in booking galleries that keep disabled rows.
