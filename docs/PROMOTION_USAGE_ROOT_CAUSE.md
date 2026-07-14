# Promotion Usage Root Cause — Booking e8584dfb

---

## Problem

Platform promotion **"Vet promotion"** (`4414ddd5-bb70-408b-8951-971fa094f404`, 50% off) was visibly applied (₹100 off ₹200 service), but:

- `bookings.promotion_id` = NULL  
- No `wp_promo_meta` in `bookings.notes`  
- `promotion_usages` = 0 rows  
- `promotions.usage_count` = 0  

---

## Expected

1. Booking create calls `resolveBookingPromotions` (AUTHORITATIVE V2 resolver).
2. On match, persist `promotion_id`, `wp_promo_meta` with `platformPromotionId` + `platformDiscount`.
3. After Razorpay payment, `recordBookingPromotionUsageFromBooking` → `recordPlatformPromotionUsage` → `promotion_usages` + increment `usage_count`.

---

## Actual

- `discount_amount` = 100 on booking row.
- `wp_financial_meta` contains `platformDiscount: 100` (client-supplied financial blob).
- No `wp_promo_meta`, no `platformPromotionId` anywhere in notes.
- `recordBookingPromotionUsageFromBooking` had no IDs to commit.

---

## Root Cause

### 1. `wp_promo_meta` is gated on server resolver success

In `bookings-enhanced.booking.ts`, promotion notes are written **only** when:

```typescript
if (resolvedBookingPromotions && resolvedBookingPromotions.totalSavings > 0) {
  const promoMeta = buildBookingPromotionNotesMeta({ ... });
}
```

`discount_amount` can still be set from **request body** (`body.discountAmount` / `body.couponDiscount`) **without** `resolvedBookingPromotions`:

```typescript
const couponDisc = parseFloat(String(body.couponDiscount ?? body.discountAmount ?? body.discount_amount ?? ''));
if (Number.isFinite(couponDisc) && couponDisc > 0) {
  bookingData.discount_amount = ...;
}
```

If the server resolver fails (caught, `resolvedBookingPromotions = null`) or returns zero savings while the client sends discount via body + `financialMeta`, the booking can persist discount **without** promotion linkage.

### 2. `recordBookingPromotionUsageFromBooking` requires explicit IDs

From `booking-promotion-service.ts`:

| Source | Requirement |
|--------|-------------|
| `wp_promo_meta` | `vendorPromotionId` or `platformPromotionId` with matching discount > 0 |
| Fallback | `bookings.promotion_id` classified as vendor vs platform |
| Coupon | `coupon_code` when no promo IDs |

None of these exist on this booking → function returns early after `discountTotal > 0` check.

### 3. Category-scoped promotion likely not matched server-side

Promotion row (DEV):

- `service_category` = `veterinary`
- `applicable_services` = `["veterinary"]`
- `discount_value` = 50% → ₹100 on ₹200 ✓

Booking service `5301c1b8` (Injection Administration): **`services.category` = NULL**.  
Booking create passes `serviceCategory: service.category` → **undefined/null** to resolver.

`platformPromoMatchesBookingContext` requires category match when `rowCategory` is set (`veterinary`). With empty booking category, server resolver returns **0 savings** while client UI may still show discount from a separate quote path or optimistic client calculation.

### 4. Mismatch guard bypass on resolver failure

`PROMOTION_DISCOUNT_MISMATCH` is thrown only inside the `try` block when `clientClaimedTotal > 0` and server savings differ by > ₹1. On resolver **exception**, catch sets `resolvedBookingPromotions = null` and **skips** mismatch validation — allowing client discount without server confirmation.

---

## Evidence

| Item | Finding |
|------|---------|
| `bookings.notes` | Contains `wp_financial_meta` only; no `wp_promo_meta` |
| `promotion_usages` | `SELECT * ... booking_id = e8584dfb` → [] |
| Promotion `4414ddd5` | `usage_count = 0`, active, published, dates valid |
| Service category | `NULL` on catalog `services` row |
| Promotion targeting | `veterinary` category required |

---

## Files

- `backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts` (lines ~1252–1658)
- `backend/lambda/src/lib/services/booking-promotion-service.ts` — `recordBookingPromotionUsageFromBooking`, `buildBookingPromotionNotesMeta`
- `backend/lambda/src/endpoints/razorpay/endpoints/razorpay.razorpay.ts` — post-payment usage hook
- `backend/lambda/src/utils/platform-promotion-matching.ts` — category matching
- `backend/lambda/src/discount-engine/candidates/providers/platform-promotion.provider.ts`

---

## Environment

- `DISCOUNT_ENGINE_V2_RESOLVER_MODE=AUTHORITATIVE` on dev Lambda
- Promotion created `2026-07-07 13:09:55`; booking `2026-07-07 13:11:12`

---

## Recommended Fix

1. **Always persist promo IDs** when `financialMeta.platformDiscount > 0` — merge client quote IDs or re-resolve at create.
2. **Fail closed**: if `body.discount_amount > 0` and server `totalSavings === 0`, reject (extend mismatch guard to resolver-null path).
3. **Category fallback**: resolve category from vendor `role_id` / service role mapping when `services.category` is null.
4. **Usage backfill script**: for bookings with `platformDiscount` in `wp_financial_meta` but no usage row, infer promotion from amount + vendor category and insert `promotion_usages` (dev-only repair).

---

## Priority

**P1** — Promotion analytics and usage limits are wrong.

---

## Risk

Campaign `max_uses` / `usage_limit` enforcement may be bypassed; finance cannot attribute platform discount cost to promotion `4414ddd5`.
