# UX Sprint 1 — Pricing Truth & Promotion Experience

**Scope:** Customer Web UI only. No backend, API, database, resolver, or engine changes.

## Objective

One consistent pricing story from service discovery through booking history: same original price, discounts, savings, and final paid amount wherever the customer looks.

## Components Created

| Component | Path | Purpose |
|-----------|------|---------|
| `PriceDisplay` | `components/customer/pricing/PriceDisplay.tsx` | Original + current price, savings, discount % chip |
| `SavingsBadge` | `components/customer/pricing/SavingsBadge.tsx` | Save amount, auto-applied, coupon, platform/vendor offer |
| `PromotionOfferBadge` | `components/customer/pricing/PromotionOfferBadge.tsx` | % OFF, flat OFF, BOGO, bundle (distinct from `shared/PromotionBadge.tsx`) |
| `PriceBreakdown` | `components/customer/pricing/PriceBreakdown.tsx` | Reusable line-item breakdown |
| `PromotionCard` | `components/customer/pricing/PromotionCard.tsx` | Unified offer card for listing → history |
| `ServiceListingPrice` | `components/customer/pricing/ServiceListingPrice.tsx` | Listing price via `/promotions/calculate-booking` + vendor % fallback |
| `BookingPricingSummary` | `components/customer/pricing/BookingPricingSummary.tsx` | Savings banner + breakdown for paid bookings |
| `BookingConfirmationSavings` | `components/customer/pricing/BookingConfirmationSavings.tsx` | Post-payment summary from booking API |

### Lib helpers

| Module | Path | Purpose |
|--------|------|---------|
| Types | `lib/pricing/types.ts` | Shared pricing model |
| Format | `lib/pricing/format.ts` | INR formatting, discount % |
| Booking financial | `lib/pricing/booking-financial.ts` | Parse `base_price`, `discount_amount`, `notes` (`wp_promo_meta`) |
| Checkout lines | `lib/pricing/checkout-price-breakdown.ts` | Map checkout state → `PriceBreakdownLine[]` |

Barrel export: `components/customer/pricing/index.ts`

## Screens Updated

| Phase | Screen | Change |
|-------|--------|--------|
| 2 | Service listing (`UniversalServicesByStyle`, `VetServicesByStyle`) | `ServicePricingDisplay` with `usePromoQuote` → live promo quote or honest “Offer available” |
| 3 | Service booking review | `ServiceBookingPromoSummary` uses `PromotionCard` + `PriceDisplay` |
| 4 | Checkout (`UniversalPaymentPage`) | Fragmented price UI replaced with `PriceBreakdown` |
| 5 | Booking success (`GroomingBookingRouter`) | `BookingConfirmationSavings` after confirmation |
| 6 | Booking details (`BookingDetailModal`) | `BookingPricingSummary` — financial truth |
| 7 | Booking history (`MyBookings`) | Paid amount, strikethrough original, savings/promo badges |
| — | `ServicePricingDisplay` | Delegates to unified components; backward-compatible props |

## Reuse Pattern

```
Discovery (ServiceListingPrice / PriceDisplay)
    ↓
Detail / review (ServiceBookingPromoSummary / PromotionCard)
    ↓
Checkout (PriceBreakdown via buildCheckoutPriceLines)
    ↓
Confirmation (BookingConfirmationSavings)
    ↓
Details & history (extractBookingFinancial → BookingPricingSummary / PriceDisplay)
```

Existing APIs used (unchanged):

- `POST /promotions/calculate-booking` — listing & review quotes
- `POST /customer/pricing/quote` — available via `fetchServiceBookingQuote` for future detail pages
- `GET /bookings/:id` — confirmation & detail breakdown

## Future Extension Points

- Wire `fetchServiceBookingQuote` on service detail pages not yet using `ServiceBookingPromoSummary`
- Share `buildCheckoutPriceLines` with ecommerce `CheckoutPriceBreakdown` for shop parity
- Add `PromotionCard` to order/meal flows when meal UI ships
- Pass payment snapshot from `UniversalPaymentPage` success callback to avoid extra GET on confirmation
- Enrich `extractBookingFinancial` if backend later exposes explicit tax/fee line items on bookings

## Known Limitations

- **Listing quote** uses promotion stack on service subtotal only; GST/platform fees still shown at checkout (footnote on listing).
- **Booking history** relies on stored `base_price`, `discount_amount`, `coupon_code`, and `wp_promo_meta` in notes; older bookings without these fields show paid amount only.
- **Confirmation** fetches booking after payment; brief loading state; package/free sessions skip savings block.
- **Non-grooming routers** (vet, walker, etc.) not yet given `BookingConfirmationSavings` — same component can be dropped in with `bookingId` + `fallbackBasePrice`.
- **`PromotionOfferBadge`** is the sprint pricing chip; **`shared/PromotionBadge.tsx`** remains for catalog/product promo types.

## No Backend Changes

- No API contract changes
- No database migrations
- No Discount / Rule / Benefit / Unified Resolver modifications
- No Stack Engine or Settlement work

## Validation Checklist

- [ ] Service listing: strikethrough + promo OR “Offer available” / base price — never fake discounts
- [ ] Service detail / pre-payment review: promo cards + estimated savings
- [ ] Checkout: vendor + platform + coupon + tax + fees + final + savings line
- [ ] Booking success: savings summary when booking has discount
- [ ] Booking details: full breakdown matches paid amount
- [ ] History: paid amount + savings badges vs list-only price

Run build: `cd apps/customer-web && npm run build`
