# UX Sprint 3 — Marketplace Consistency

**Scope:** Customer Web UI only. No backend, API, database, resolver, or engine changes.

## Objective

One integrated marketplace feel across **services**, **packages**, **meal plans**, and **shop products** — shared lifecycle: discovery → detail → promotion → checkout → confirmation → history → tracking → cancellation → review.

## Shared module

`apps/customer-web/components/customer/marketplace/` + `lib/marketplace/types.ts`

| Component | Purpose |
|-----------|---------|
| `MarketplaceCard` | Unified discovery card (image, title, vendor, rating, Sprint 1 pricing, promo, availability, CTA slot) |
| `MarketplaceHistoryCard` | Unified history row (status, dates, paid amount, savings badges, actions) |
| `MarketplaceStatus` | Consistent status chip |
| `MarketplaceTimeline` | Vertical / horizontal progress |
| `MarketplaceConfirmation` | Success screen shell (order #, savings, summary, action grid) |
| `MarketplaceActions` | Primary / outline CTA grid |
| `MarketplaceDetailSection` | Titled detail page section |
| `MarketplaceSummary` | Checkout / receipt summary block |
| `MarketplacePolicies` | Cancellation & refund policy copy |
| `MarketplaceRefundStatus` | Refund eligibility / status banner |
| `MarketplaceTracking` | Tracking page shell (header, hero, timeline, body) |
| `MarketplaceReview` | Rate experience prompt |
| `MarketplacePageHeader` | Orange gradient header with back |

Reuses **Sprint 1** `PriceDisplay`, `SavingsBadge`, `PromotionOfferBadge`, `PriceBreakdown`, `BookingPricingSummary`.

## Screens updated

| Domain | Screen | Change |
|--------|--------|--------|
| Product | `ShopProductCard` | `MarketplaceCard` + Sprint 1 pricing |
| Product | `CheckoutPriceBreakdown` | Sprint 1 `PriceBreakdown` via `buildEcommerceCheckoutPriceLines` |
| Service | `BookingConfirmationPage` | `MarketplaceConfirmation` shell |
| Service | `MyBookings` | `MarketplaceStatus` on history cards |
| Product | `EcommerceOrderSuccessScreen` | `MarketplaceConfirmation` + `MarketplaceTimeline` |
| Product | `MyOrders` | `MarketplacePageHeader` + `MarketplaceHistoryCard` |
| Meal | `MealOrderCard` | `MarketplaceHistoryCard` layout |
| Meal | `MealPlanOrderTrackingUI` | `MarketplaceTracking` shell |
| Service | `GroomingBookingRouter` confirmation | `BookingConfirmationSavings` + `MarketplaceReview` |
| Service | `MyBookings` | Sprint 1 pricing on cards (prior sprint) |
| Service | `BookingDetailModal` | Sprint 1 `BookingPricingSummary` (prior sprint) |
| Checkout | `UniversalPaymentPage` | Sprint 1 `PriceBreakdown` (prior sprint) |
| Checkout | Ecommerce cart/review | Sprint 1 `PriceBreakdown` (shared lines) |

## Marketplace consistency matrix

| Lifecycle stage | Service | Package | Meal | Product |
|-----------------|---------|---------|------|---------|
| Discovery | `MarketplaceCard` / listing price | Package selectors (partial) | Meal plans panel | `ShopProductCard` |
| Detail | Vendor profile sections | Package detail | Meal detail | Product detail |
| Promotion | Sprint 1 stack | Same pricing components | Order cards | Shop promo badges |
| Checkout | `UniversalPaymentPage` | Package checkout | Meal checkout | Ecommerce checkout |
| Confirmation | Grooming + booking confirm | Package success | Meal pay success | `MarketplaceConfirmation` |
| History | `MyBookings` | My packages | Meal orders list | `MyOrders` |
| Tracking | `/tracking/[id]` | Package sessions | `MealPlanOrderTrackingUI` | Order tracking |
| Cancellation | Booking cancel modal | Package policy | Meal refund banner | Refund modal |
| Review | `MarketplaceReview` / rate modal | — | Rating footer | — |

## Reuse strategy

```
lib/marketplace/types.ts          ← domain + lifecycle types
lib/marketplace/map-status.ts     ← shared status tone mappers
lib/pricing/ecommerce-checkout-price-breakdown.ts ← shop checkout lines
components/customer/marketplace/  ← shells & cards
components/customer/pricing/        ← Sprint 1 financial truth
```

New domains should compose `MarketplaceCard` + `MarketplaceHistoryCard` + `MarketplaceConfirmation` rather than bespoke layouts.

## Future extension points

- Wrap service/package discovery cards with `MarketplaceCard` (vendor listing rows)
- `ProductDetailPage` sections → `MarketplaceDetailSection`
- Shared `MarketplaceCancellationSheet` for all domains
- Booking/package tracking → `MarketplaceTracking` (same as meals)
- Campaign / stack placeholders — **not exposed** per sprint rules

## Known limitations

- **Service listing cards** still use `ServicePricingDisplay` / `ServiceListingPrice` — structurally similar but not yet wrapped in `MarketplaceCard`
- **Package purchase success** not fully migrated to `MarketplaceConfirmation`
- **Booking tracking** (`OrderTrackingScreen`) not yet on `MarketplaceTracking` shell
- **Detail pages** use `MarketplaceDetailSection` pattern in docs only — incremental adoption recommended
- Domain-specific OTP, payment hold, and tele queue UI remain where required

## No backend changes

- No API or schema changes
- No resolver / discount engine changes

## Validation checklist

- [ ] Shop product grid/deal cards use `MarketplaceCard`
- [ ] Ecommerce checkout uses shared `PriceBreakdown`
- [ ] Booking confirmation uses `MarketplaceConfirmation`
- [ ] My Bookings status chips use `MarketplaceStatus`
- [ ] Ecommerce success uses confirmation + timeline components
- [ ] Meal order history card matches booking/order history layout
- [ ] Meal tracking uses marketplace tracking shell
- [ ] Grooming confirmation shows savings + review prompt
- [ ] My Orders uses unified header and history card
- [ ] Promotion visible through checkout (Sprint 1) on service + shop paths

Build: `cd apps/customer-web && npm run build`
