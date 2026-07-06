# Commission Policy Analysis

**Phase:** S1 (Analysis Only)  
**Date:** 2026-07-06  
**Purpose:** Document how commission is calculated today, on what price base, and how discounts/GST/tiers interact.

---

## Commission Tracks (Three Separate Systems)

Warmpawz does **not** have one universal commission policy. Three parallel tracks exist:

| Track | Domain | Rate source | Base amount |
|-------|--------|-------------|-------------|
| **A. Service tier** | Bookings, packages | `vendor_tiers.commission_rate` | Vendor-visible service price (not customer checkout total) |
| **B. Delivery tier** | Meals, pharmacy | Same tier join | Vendor meal/pharmacy subtotal only |
| **C. E-commerce V2** | Shop orders | Category/ownership config | Line subtotals per product |

This document focuses on **A and B** (Finance tier) with notes on Discount Engine interaction. Track C is Finance-owned but tier-independent.

---

## Service Booking Commission (Track A)

### When calculated

At **booking completion** via `ensureVendorEarningsForCompletedBooking()` in `vendor-earnings-on-completion.ts`.

Inserts row into `vendor_earnings`:

```
amount          = vendor net (gross - commission)
commission_amount = gross × rate / 100
total_amount    = commissionable gross
commission_rate = tier rate at completion time
status          = pending
```

### Commission rate lookup

**Function:** `getVendorCommissionRate(vendorId)`  
**Source:** `vendors.tier` JOIN `vendor_tiers.commission_rate`  
**Fallback:** 15% if tier missing

**Alternative (not used at completion):** `getVendorTierCommission()` — includes active subscription priority, default 10%.

### Commissionable gross (critical)

**Function:** `resolveLedgerGrossForVendorCommission(booking, bookingId)`

Priority:

1. **Vendor-visible service price** from service snapshot (`resolveVendorVisibleBookingAmount`) when ≤ checkout gross  
2. Else `total_amount` / `base_price` / `amount` on booking  
3. May sync from completed `payments` row if booking gross is zero  

**Intent:** Commission on **list/service price**, not on customer checkout total that includes GST, platform fee, convenience fee, delivery fee.

**NOT used as base:** Customer `finalPaid` from checkout unless it equals service price path.

### Discount Engine adjustment (when AUTHORITATIVE)

```typescript
totalAmount = applySettlementPreviewToCommissionableGross(totalAmount, settlementPreview);
```

Reduces gross by:

- `vendorDiscountShare` + `sharedDiscountShare.vendor` from Phase 7 preview

Platform-funded discounts do **not** reduce vendor commission base in the hook.

**Gap:** Preview rarely present at completion — checkout does not persist `settlement_preview` in `wp_financial_meta`.

### GST / tax

GST is stored in `wp_financial_meta` (cgst, sgst, igst, totalTax) at booking create.  
**GST does not participate** in tier commission base for service bookings (commission is on pre-tax vendor service price path).

Platform fees and convenience fees are **customer-paid** and excluded from vendor commission base.

---

## Daily Batch Commission (Duplicate Path)

**Endpoint:** `POST /settlements/calculate-daily` in `settlements.ts`

For each eligible booking:

```javascript
commissionRate = booking.commission_percentage || rules.defaultCommission  // default 10
bookingAmount = booking.total_amount  // often customer finalPaid
commissionAmount = bookingAmount × commissionRate / 100
```

| Aspect | Accrual path | Batch path |
|--------|--------------|------------|
| Rate source | `getVendorCommissionRate` → tier join | `vendors.commission_percentage` denormalized |
| Base | Service/list price logic | `bookings.total_amount` (customer paid) |
| Subscription override | No (simple tier join) | No |
| Discount adjustment | Hook (if preview exists) | **None** |
| Output | `vendor_earnings` row | Aggregated `settlements` row |

**This is a major inconsistency.** Batch can produce different commission than `vendor_earnings` when discounts, fees, or tier sync lag apply.

---

## Meal / Pharmacy Commission (Track B)

**File:** `meal-order-settlement.ts`

**Base:** `resolveVendorMealListingAmount(order)` — vendor subtotal from order, excludes customer delivery/platform/convenience/GST.

**Rate:** Tier join on vendor (same as services), fallback 15%.

**Formula:**

```
commissionAmount = vendorMealAmount × rate / 100
netPayout = vendorMealAmount - commissionAmount
```

**Discount hook:** Same `applySettlementPreviewToCommissionableGross` when preview in order metadata.

**Storage:** `delivery_settlements` — pre-calculated commission; batch **sums** these rows (does not recalculate).

---

## E-Commerce Commission (Track C — Reference)

**File:** `resolve-ecommerce-commission-rate.ts`

**Explicitly no tier.**

Priority: vendor model branch (category vs ownership) → vendor default → category default → platform default → error.

Persisted at order time in `order_item_commission`.

---

## Answers to Commission Analysis Questions

| Question | Answer |
|----------|--------|
| How is commission calculated? | `gross × commission_rate / 100` (track-specific gross) |
| Original price? | **Accrual:** vendor-visible service price / meal subtotal |
| Customer paid? | **Batch only** uses `bookings.total_amount` (often finalPaid) |
| Net price? | Not used as commission base |
| Price after vendor discount? | **Target:** yes via settlement preview hook; **today:** rarely applied |
| Price after all discounts? | No — platform-funded discounts don't reduce vendor commission base in hook |
| Does GST participate? | **No** in service/meal commission base |
| Does tax participate? | Same as GST — excluded from tier commission base |
| Does tier override commission? | Tier **is** the commission rate (not an override on top) |
| Does subscription override commission? | **Should** via `getVendorTierCommission`; **may not** at completion accrual |
| How are tiers loaded? | SQL join on `vendors.tier` or subscription CTE |
| How are subscriptions loaded? | `vendor_tier_subscriptions` where active and not expired |
| Where are defaults stored? | `vendor_tiers.is_default`; constants in `commission.ts`; hardcoded fallbacks in multiple files |

---

## Discount Types & Commission Impact (Today)

| Discount type | Customer checkout | Commission base (accrual) | Funding owner |
|---------------|-------------------|---------------------------|---------------|
| Vendor promotion | Reduced finalPaid | List price unless preview hook applies | Vendor (target) |
| Platform promotion | Reduced finalPaid | List price unchanged | Platform |
| Vendor coupon | Reduced finalPaid | List price unless preview hook | Vendor |
| Platform coupon | Reduced finalPaid | List price unchanged | Platform |
| Shared / campaign | Reduced finalPaid | Partial vendor share reduction when authoritative | Split per FundingConfiguration |

Legacy accrual **ignores most discounts** on commission base because preview is not persisted and hook is inactive in SHADOW mode.

---

## wp_financial_meta Structure (Booking)

Stored in `booking.notes` as `wp_financial_meta:{json}` at create (`bookings-enhanced.booking.ts`):

- `servicePrice`, `vendorDiscount`, `platformDiscount`, `couponDiscount`  
- `subtotalAfterDiscounts`, GST fields, platform/convenience/delivery fees  
- `finalPaid`, `walletAmount`  

**Missing today:** `settlement_preview`, `appliedFunding`, `discountSettlementPreview`.

`total_amount` on booking is set to `finalPaid` (customer paid).

---

## Constants & Configuration Locations

| Setting | Location |
|---------|----------|
| Default commission (fallback) | `lib/constants/commission.ts` — 10% |
| Tier rates | `vendor_tiers.commission_rate` |
| Batch default commission | `platform_settings` `admin:settings:payout_rules.defaultCommission` — 10 |
| E-com platform default | `ecommerce_commission_settings` |
| Min/max commission bounds | `commission.ts` — 5%–30% |
| Fee amounts | `admin_settings` via `feeCalculator.ts` |

---

## Recommendations (Analysis Only — No Implementation)

1. **Single commission base policy** — document and enforce: tier commission on vendor-visible gross minus vendor-funded discount shares.  
2. **Batch should aggregate `vendor_earnings`**, not recalculate from `bookings.total_amount`.  
3. **Unify rate lookup** — always use `getVendorTierCommission` (subscription-aware) at accrual.  
4. **Persist settlement preview** at checkout before AUTHORITATIVE cutover.  
5. **Keep tier % in Finance** — Discount Engine only adjusts base, never replaces tier rate.

---

## Related Documents

- `docs/TIER_SYSTEM_ANALYSIS.md`  
- `docs/SETTLEMENT_ARCHITECTURE_ANALYSIS.md`  
- `docs/FINANCE_GAP_ANALYSIS.md`  
