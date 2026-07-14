# Finance Settlement Conflict Report

**Phase:** S2 (pre-implementation)  
**Date:** 2026-07-06  
**Purpose:** Compare confirmed S2 business rules against existing Finance implementation before code changes.

---

## Confirmed Rules vs Current Behavior

| Rule | Confirmed requirement | Current behavior | Conflict? | Resolution |
|------|----------------------|------------------|-----------|------------|
| **R1** Platform promotion → platform bears; vendor settlement unchanged | Commission base = vendor base price | Accrual uses service price; **ignores** platform promo on base (OK). Batch uses `total_amount` (customer paid after promo) — **reduces effective base** | **Yes (batch)** | Batch aggregates `vendor_earnings`; accrual uses funding-aware base |
| **R2** Platform coupon → platform bears | Commission base = vendor base price | Same as R1; coupon in `couponDiscount` not split by owner in meta | **Partial** | Track coupon funding type in settlement snapshot |
| **R3** Vendor promotion → vendor bears; base reduces | Base − vendor promo amount | Hook reduces base only when AUTHORITATIVE + preview present; **preview not persisted** | **Yes** | Persist snapshot at checkout; apply on completion |
| **R4** Vendor coupon → vendor bears | Base − coupon amount | Same as R3; vendor coupons rare in meta | **Yes** | Winning offer + funding in snapshot |
| **R5** Only ONE offer (Policy Center) | Winning offer only | Legacy stack may apply **multiple** discounts sequentially at checkout | **Yes (checkout)** | Snapshot records **winning offer only** for settlement; checkout stack unchanged (no Promotion CRUD change) |
| **R6** Commission % from Finance tier/subscription only | Never from Discount Engine | Accrual uses `getVendorCommissionRate` (no subscription); Razorpay uses `getVendorTierCommission` | **Yes (dual lookup)** | Single `resolveVendorCommissionPolicy()` |

---

## Infrastructure Conflicts

| Area | Current | S2 target | Adapt vs new |
|------|---------|-----------|--------------|
| Commission lookup | 2 functions, 2 defaults (10% / 15%) | One resolver | **Extend** — replace internals, keep function names as thin wrappers |
| Commission base | `resolveLedgerGrossForVendorCommission` + optional hook | Funding-aware formula | **Extend** finance settlement module; reuse gross resolver for vendor base price |
| Settlement preview | Phase 7 in-memory only | Persisted in `wp_financial_meta` | **Extend** `financial-meta-bridge` + new `settlementSnapshot` block |
| `vendor_earnings` | No metadata column | JSONB settlement metadata | **New migration** 1058 |
| Daily batch | Recalculates from `bookings.total_amount` | Aggregate ledger | **Extend** `calculate-daily` behind feature flag |
| Reports | Recompute waterfall from bookings/payments | Read ledger + metadata | **Extend** report resolver to prefer stored values |

---

## Behaviours Preserved (No Conflict)

- Tier definitions in `vendor_tiers` — reuse as-is  
- Payout schedule, EventBridge, Razorpay — unchanged  
- E-commerce commission V2 — out of scope  
- Discount Engine resolver/stack/priority — not rewritten  
- Phase 7 `FundingAllocator` — complementary; Finance integration uses same funding types  

---

## Deviations Documented (Intentional for S2)

1. **Checkout may still stack discounts (legacy)** until resolver is fully authoritative. Settlement snapshot will derive **winning offer** using max-savings rule (Policy Center default) from amounts in financial meta — settlement uses one offer even if checkout applied multiple.

2. **SHARED funding** — formula implemented (vendor share reduces base only); full runtime depends on Policy Center + campaigns (future).

3. **SHADOW mode** — new calculations logged compared to legacy; writes remain legacy until `FINANCE_FUNDING_AWARE_SETTLEMENT=AUTHORITATIVE`.

---

## Files Expected to Change

| File | Change type |
|------|-------------|
| `finance/commission/resolve-vendor-commission-policy.ts` | New |
| `finance/settlement/*` | New integration layer |
| `utils/vendor-commission-rate.ts` | Delegate to resolver |
| `utils/vendor-tier-commission.ts` | Delegate to resolver |
| `utils/vendor-earnings-on-completion.ts` | Funding-aware INSERT |
| `endpoints/settlement&payouts/.../settlements.ts` | Ledger aggregation path |
| `lib/services/booking-promotion-service.ts` | Extended financial meta type |
| `endpoints/booking/.../bookings-enhanced.booking.ts` | Attach settlement snapshot |
| `db/migrations/1058_vendor_earnings_settlement_metadata.sql` | New column |
| `utils/vendor-booking-earnings-report.ts` | Prefer metadata |

Legacy code paths retained behind `FINANCE_FUNDING_AWARE_SETTLEMENT` flag (default `LEGACY`).
