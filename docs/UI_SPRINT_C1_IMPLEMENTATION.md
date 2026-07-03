# UI Sprint C.1 — Customer Coupon Integration

**Branch context:** `feature-meal-ui-promotion` (local, uncommitted)  
**Scope:** Customer UI only — no discount/stack/settlement engine changes.

---

## Objective

Wire the existing coupon UX into service bookings, package-via-booking flows, and meal payments using one shared path:

```
Automatic promotions → Coupon validation → Final pricing → Pay
```

Products continue to use `CartPromotionSelect` at cart/checkout (unchanged logic; shared validation utilities added).

---

## Architecture

```
Booking summary / UniversalPaymentPage
        │
        ▼
CheckoutCouponPanel
   ├── checkCouponAvailability()  ← probes backend
   └── CouponSection              ← apply / remove / list offers
        │
        ▼
validateCouponCode()
   ├── POST /promotions/validate-code
   └── GET  /coupons/validate/:code (fallback)
        │
        ▼
PriceBreakdown / buildCheckoutPriceLines / FinancialInvoiceSummary
        │
        ▼
Payment payload (couponCode + promotion IDs)
```

**Stack order (UI):** Auto vendor + platform promotions are applied first (`bookingPromoStack` / `calculate-booking`). Coupon validates against **subtotal after those savings**. UI never reimplements stack rules.

---

## Components Reused

| Component | Role |
|-----------|------|
| `CouponSection` | Collapsible apply UI, available vendor offers |
| `MiniCouponInput` | Unchanged (inline helper) |
| `CartPromotionSelect` | Product cart/checkout (unchanged) |
| `PriceBreakdown` / `buildCheckoutPriceLines` | Shared invoice lines |
| `FinancialInvoiceSummary` | Post-purchase / tracking display (Sprint C) |
| `ServiceBookingPromoSummary` | Auto-promotion quote on booking summary |

---

## Components Added / Extended

| File | Change |
|------|--------|
| `lib/pricing/coupon-validation.ts` | **New** — `validateCouponCode`, `AppliedCheckoutCoupon` |
| `lib/pricing/coupon-capability.ts` | **New** — `checkCouponAvailability` (backend probe) |
| `components/customer/pricing/CheckoutCouponPanel.tsx` | **New** — capability gate + `CouponSection` |
| `components/customer/shared/CouponSection.tsx` | Uses shared validation; supports `meal` order type |
| `components/customer/payment/UniversalPaymentPage.tsx` | Coupon enabled for booking + meals; shared panel |
| `components/customer/booking/ServiceBookingPromoSummary.tsx` | `onQuote` callback for summary coupon base |
| `components/customer/shared/UniversalBookingRouter.tsx` | Summary coupon + pass-through to payment |
| `components/customer/vet/VetBookingRouter.tsx` | Same as universal router |

---

## Coupon Capability Probe

Before showing coupon input, `checkCouponAvailability`:

1. **Product orders** — always available (existing ecommerce flow).
2. **Service / meal** — parallel fetch:
   - `GET /vendors/:id/active-promotions?type=service`
   - `GET /promotions/active?serviceType=service`
3. If any active row has a non-empty `code` → show coupon UI.
4. Otherwise → message: *"Coupons are not available for this booking"*.
5. **`paymentSupportsCoupon={false}`** — hides UI when the downstream API cannot accept `couponCode` (e.g. standalone package purchase).

**Not probed:** Legacy `coupons` table entries without a matching row in active promotion lists (see limitations).

---

## Customer Journeys

### Service booking (vet, universal router)

1. Summary: `ServiceBookingPromoSummary` (auto promos) → `CheckoutCouponPanel`
2. Payment: `UniversalPaymentPage` with `initialAppliedCoupon`
3. Re-validation when promo stack or amount changes

### Package via booking router

Package switch on summary uses the same booking payment path (`type=booking`); coupon applies like a service booking.

### Meals (subscription / one-time)

`UniversalPaymentPage` shows `CheckoutCouponPanel` with `kind=meal`. Coupon discount reduces meal payable total after food subtotal promos.

### Products

Unchanged — `CartPromotionSelect` + checkout. Can adopt `validateCouponCode` in a follow-up for DRY only.

---

## Files Modified (summary)

- `apps/customer-web/lib/pricing/coupon-validation.ts` (new)
- `apps/customer-web/lib/pricing/coupon-capability.ts` (new)
- `apps/customer-web/components/customer/pricing/CheckoutCouponPanel.tsx` (new)
- `apps/customer-web/components/customer/shared/CouponSection.tsx`
- `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx`
- `apps/customer-web/components/customer/booking/ServiceBookingPromoSummary.tsx`
- `apps/customer-web/components/customer/shared/UniversalBookingRouter.tsx`
- `apps/customer-web/components/customer/vet/VetBookingRouter.tsx`

---

## Known Limitations

| Limitation | Notes |
|------------|-------|
| `PackageBookingPage` standalone purchase | `/packages/purchase-from-vendor-service` has no `couponCode` field — coupon UI intentionally hidden via capability / payment path |
| Platform `coupons` table only | Codes not listed in `/promotions/active` may not enable the panel even though validate works |
| Booking charge stack (S5) | `coupon_code` stored on booking; full stack settlement may lag engine matrix — UI sends `couponCode` on payment |
| Other booking routers | Grooming, training, walker, etc. get coupon on **payment page** via `UniversalPaymentPage`; summary step not yet wired everywhere |
| Grooming pre-payment review | Uses `PrePaymentBookingReview` without summary coupon — payment page still supports coupons |

---

## Validation Checklist

- [ ] Service booking — apply / remove / replace coupon on summary + payment
- [ ] Service booking — auto promo + coupon; price breakdown shows both
- [ ] Vet router — same as universal
- [ ] Meal subscription pay — coupon panel visible when codes exist
- [ ] Meal one-time pay — same
- [ ] Product cart — unchanged
- [ ] Invalid / expired code — toast error
- [ ] No codes for vendor — “Coupons are not available…” message
- [ ] Coupon removal updates total
- [ ] Confirmation / booking details show coupon badge (Sprint C surfaces)
- [ ] Responsive layout on payment page

---

## Rollback Strategy

1. Revert customer-web changes on this branch (no backend/migration impact).
2. `UniversalPaymentPage` coupon guard can be restored by hiding `CheckoutCouponPanel` and resetting `couponDiscount` booking guard (single file).
3. Routers: remove `CheckoutCouponPanel` blocks and `initialAppliedCoupon` prop — booking flow returns to auto-promo-only.

No database or Lambda rollback required.
