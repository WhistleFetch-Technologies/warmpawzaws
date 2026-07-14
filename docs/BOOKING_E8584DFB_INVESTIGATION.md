# Booking e8584dfb — End-to-End Investigation (DEV)

**Booking ID:** `e8584dfb-3fd0-4c9b-abe0-275cd89cecbb`  
**Vendor:** `109ac8bc-9709-45a6-a7f8-c6ed7c63571c` — Vet Center Bindu TEST  
**Environment:** DEV RDS + `warmpawz-dev-api-handler`  
**Investigation date:** 2026-07-07  

---

## Problem

A completed, paid veterinary booking shows a ₹100 platform discount and ₹110 customer payment, but:

- No `promotion_id`, no `wp_promo_meta`, and no `promotion_usages` row for platform promotion `4414ddd5-bb70-408b-8951-971fa094f404` ("Vet promotion", 50% off).
- `vendor_earnings` uses **10% commission on ₹110** (vendor net ₹99) instead of the expected **20% Basic tier on list price ₹200** with platform-funded discount.
- No settlement snapshot in notes, empty `vendor_earnings.metadata`, and no `settlements` row.

---

## Expected

| Area | Expected behavior |
|------|-------------------|
| Promotion | Server resolves "Vet promotion", persists `promotion_id` + `wp_promo_meta`, increments `promotion_usages` / `usage_count` after payment |
| Commission | `resolveVendorCommissionPolicy` → Basic tier **20%** on commission base **₹200** (platform-funded discount) → commission ₹40, vendor net ₹160 |
| Settlement | Funding-aware snapshot in `wp_financial_meta` (or `vendor_earnings.metadata`) with `commissionBase`, `winningOffer`, `fundingSummary` |
| Finance flag | If `FINANCE_FUNDING_AWARE_SETTLEMENT=AUTHORITATIVE`, earnings path uses snapshot + rich metadata |

---

## Actual

| Field | Value |
|-------|-------|
| `status` / `payment_status` | `completed` / `paid` |
| `base_price` / `total_amount` / `discount_amount` | ₹200 / ₹110 / ₹100 |
| `promotion_id` / `coupon_code` | `NULL` / `NULL` |
| Notes | `wp_financial_meta` only — `platformDiscount:100`, no `platformPromotionId`, no `settlementSnapshot` |
| `vendor_earnings` | `total_amount=110`, `commission_rate=10%`, `commission_amount=11`, `amount=99`, `metadata={}` |
| `promotion_usages` / `coupon_usages` | 0 rows |
| `settlements` | 0 rows |
| `vendor_tier_subscriptions` | 0 rows for vendor |

---

## Root Cause (summary)

Three independent gaps compound on this booking:

1. **Promotion linkage gap** — `wp_promo_meta` and `promotion_id` are written only when server-side `resolveBookingPromotions` returns `totalSavings > 0`. The booking has client-origin `wp_financial_meta.platformDiscount=100` but no server promo resolution artifact. `recordBookingPromotionUsageFromBooking` therefore has no promotion IDs to record usage.

2. **Commission policy SQL bug** — `resolveVendorCommissionPolicy` queries `vendor_tier_subscriptions.expires_at`, which does not exist on DEV (column is `end_date`). The query throws; the outer `catch` returns `DEFAULT_COMMISSION_RATE` (**10%**) and never reaches the vendor-tier join that would return Basic **20%**.

3. **Finance S2 not enabled** — `FINANCE_FUNDING_AWARE_SETTLEMENT` is **unset** on Lambda (defaults `LEGACY`). Legacy earnings use checkout total ₹110 as commission base and skip settlement snapshot persistence. Discount-engine settlement mode is AUTHORITATIVE but Finance funding-aware accrual is not.

---

## Evidence

### RDS (DEV)

```
Booking notes (excerpt):
wp_financial_meta:{"vendorId":"109ac8bc-...","servicePrice":200,"vendorDiscount":0,
  "platformDiscount":100,"couponDiscount":0,"finalPaid":110,"cgst":5,"sgst":5,"totalTax":10,...}
  — NO wp_promo_meta, NO platformPromotionId, NO settlementSnapshot

vendor_tiers match: tier_name=Basic, commission_rate=20.00 (vendor.tier="Basic")
vendor_tier_subscriptions: 0 rows
vendor_earnings: commission_rate=10.00, total_amount=110.00, metadata={}

Promotion 4414ddd5: 50% percentage, service_category=veterinary,
  applicable_services=["veterinary"], usage_count=0

Service 5301c1b8 (Injection Administration): catalog services.category = NULL
Vendor role_id present; vendor.category = NULL
```

### Lambda env (`warmpawz-dev-api-handler`)

| Variable | Value |
|----------|-------|
| `DISCOUNT_ENGINE_V2_RESOLVER_MODE` | AUTHORITATIVE |
| `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | AUTHORITATIVE |
| `DISCOUNT_ENGINE_V2_STACK_MODE` | AUTHORITATIVE |
| `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` | AUTHORITATIVE |
| `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` | AUTHORITATIVE |
| `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | AUTHORITATIVE |
| `FINANCE_FUNDING_AWARE_SETTLEMENT` | **(not set → LEGACY)** |

Terraform `infra/envs/dev/main.tf` sets all `DISCOUNT_ENGINE_V2_*` to AUTHORITATIVE but does **not** set `FINANCE_FUNDING_AWARE_SETTLEMENT`.

---

## Files (code paths)

| Concern | Primary files |
|---------|----------------|
| Booking create + promo meta | `backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts` |
| Promotion resolution | `backend/lambda/src/lib/services/booking-promotion-service.ts` |
| Usage recording | `recordBookingPromotionUsageFromBooking` → `razorpay.razorpay.ts` webhook |
| Commission policy | `backend/lambda/src/finance/commission/resolve-vendor-commission-policy.ts` |
| Earnings accrual | `backend/lambda/src/utils/vendor-earnings-on-completion.ts` |
| Finance S2 settlement | `backend/lambda/src/finance/settlement/*` |
| Runtime flags | `discount-engine/policy/*-mode.ts`, `finance/settlement/finance-settlement-mode.ts` |

---

## Environment

- **RDS cluster:** `warmpawz-dev-cluster` (Data API)
- **API:** `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`
- **UAT_MODE:** `true`

---

## Recommended Fix

| # | Fix | Owner |
|---|-----|-------|
| 1 | Fix `resolveVendorCommissionPolicy`: use `vts.end_date` (not `expires_at`); do not let subscription query failure skip vendor-tier fallback | Backend |
| 2 | When client sends `financialMeta.platformDiscount`, require server promo resolution OR reject booking; always persist `platformPromotionId` into `wp_financial_meta` / `wp_promo_meta` | Backend + customer-web |
| 3 | Derive `serviceCategory` from vendor `role_id` when `services.category` is null (vet promotion is category-scoped) | Backend |
| 4 | Set `FINANCE_FUNDING_AWARE_SETTLEMENT=SHADOW` then `AUTHORITATIVE` on dev Lambda after commission fix | Infra |
| 5 | Backfill: re-run `realignPendingVendorEarningsForBooking` + manual `promotion_usages` for affected bookings | Ops |

See child docs: `PROMOTION_USAGE_ROOT_CAUSE.md`, `COMMISSION_POLICY_INVESTIGATION.md`, `SETTLEMENT_ROOT_CAUSE.md`, `RUNTIME_FLAG_ANALYSIS.md`, `FINANCE_RUNTIME_TRACE.md`.

---

## Priority

**P1** — Incorrect vendor payout (commission rate + base) and broken promotion usage analytics.

---

## Risk

- **Financial:** Vendor under-credited by ₹61 vs correct path (₹160 net vs ₹99 actual on list-price semantics).
- **Promo ops:** `usage_count` stuck at 0; campaigns may over-allocate budget.
- **Reconciliation:** Empty settlement metadata blocks funding-aware batch payout.
