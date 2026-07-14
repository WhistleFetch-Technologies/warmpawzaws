# Finance Reuse Plan

**Phase:** S1 (Analysis Only)  
**Date:** 2026-07-06  
**Purpose:** Decide what Finance module components to reuse, extend, shadow, or avoid when integrating Discount Engine settlement.

Companion: `docs/SETTLEMENT_REUSE_MAP.md` (Phase 7 discovery — still largely valid).

---

## Reuse Principles

1. **Do not rewrite** payout infrastructure (`settlements.ts`, Razorpay, `payouts` table).  
2. **Extend** accrual hooks and ledger metadata — do not fork commission math in Discount Engine.  
3. **Finance owns** tier commission % and payout rules; **Discount Engine owns** funding attribution.  
4. **Settlement preview** is input to Finance accrual, not a replacement for `vendor_earnings`.

---

## Reuse Matrix

### Finance — Keep & Reuse As-Is

| Component | Path | Reuse |
|-----------|------|-------|
| `vendor_tiers` table + admin CRUD | `TierManagement.tsx`, `/admin/payments/tiers` | **Yes** |
| Payout hold period | `vendor_tiers.payout_period_days` | **Yes** |
| Settlement schedule + EventBridge | `SettlementScheduleSettings`, `settlement-schedule-eventbridge.ts` | **Yes** |
| Min payout / auto payout rules | `platform_settings` payout_rules | **Yes** |
| Razorpay payout flow | `razorpay-settlements.ts`, `payouts` table | **Yes** |
| Fee calculator at checkout | `feeCalculator.ts` | **Yes** |
| GST configuration | GST admin + booking financial meta | **Yes** |
| Cancellation penalties | `cancellation_policies` | **Yes** |
| Accrual reports | `vendor-daily-accrual`, `vendor-booking-earnings` | **Yes** (extend columns later) |
| E-commerce commission V2 | `resolve-ecommerce-commission-rate.ts` | **Yes** |
| Tier upgrade deductions | `tier_upgrade_deductions`, settlement-processor | **Yes** |

### Finance — Extend (Not Replace)

| Component | Path | Extension needed |
|-----------|------|------------------|
| `ensureVendorEarningsForCompletedBooking` | `vendor-earnings-on-completion.ts` | Persist funding metadata; always use subscription-aware rate |
| `resolveLedgerGrossForVendorCommission` | same | Already has hook — needs preview at checkout |
| `settlement-hook-bridge` | `discount-engine/settlement/` | Wire `buildSettlementMetadataForLedger` into INSERT |
| `vendor_earnings` table | migration (future) | JSONB `metadata` for funding breakup / policy fingerprint |
| `delivery_settlements` | same | Funding metadata on meal/pharmacy rows |
| `vendor-booking-earnings-report` | `vendor-booking-earnings-report.ts` | Optional columns: platform vs vendor discount funding |
| `POST /settlements/calculate-daily` | `settlements.ts` | Aggregate from ledger rows instead of recalculating bookings |
| `getVendorCommissionRate` | `vendor-commission-rate.ts` | Delegate to `getVendorTierCommission` or deprecate |

### Discount Engine — Reuse As-Is

| Component | Path | Reuse |
|-----------|------|-------|
| Unified resolver pipeline | `unified-discount-resolver.ts` | **Yes** |
| FundingAllocator | `settlement/funding-allocator.ts` | **Yes** |
| SettlementCalculator | `settlement/settlement-calculator.ts` | **Yes** |
| DefaultSettlementEngine | `settlement/settlement-engine.ts` | **Yes** |
| FundingConfiguration | Policy Center / `funding-config-loader.ts` | **Yes** |
| Candidate funding defaults | `candidate-normalizer.ts` | **Yes** |
| Campaign funding | `campaign-funding.ts`, `1046` migration | **Yes** |
| Settlement mode flag | `settlement-mode.ts` | **Yes** |
| Policy Center business rules | admin-web discount-policy | **Yes** |

### Discount Engine — Extend

| Component | Extension |
|-----------|-----------|
| `financial-meta-bridge.ts` | Call at booking create / checkout success |
| `production-bridge.ts` | Return preview to client when authoritative |
| Settlement analytics | Persist previews for historical reporting (Phase 9 gap) |

### Do Not Reuse / Avoid

| Component | Reason |
|-----------|--------|
| `settlement_rules` dynamic matcher (nonexistent) | Rules stored but never evaluated — don't build on until implemented or remove |
| `vendor_settlements` legacy table | Unclear usage — avoid |
| `/admin/tiers` legacy page vs `/admin/payments/tiers` | Consolidate operationally; two APIs exist |
| Batch booking commission recalculation | Duplicate of accrual — **replace behavior**, not reuse |
| Hardcoded 15% / 10% fallbacks scattered in code | Consolidate to `commission.ts` + tier default row |
| `SETTLEMENT_CURRENT_STATE.md` § Discount stub | Stale — use `PHASE7_MIGRATION_REPORT.md` |

### Shadow (Compare Before Cutover)

| Pair | Purpose |
|------|---------|
| Legacy gross vs preview-adjusted gross | SHADOW settlement mode logs |
| `vendor_earnings` vs batch recalculation | Detect batch/accrual drift |
| Resolver customerPayable vs checkout finalPaid | Checkout parity |

---

## What Stays in Finance vs Moves to Discount Engine

| Concern | Keep in Finance | Keep in Discount Engine |
|---------|-----------------|-------------------------|
| Commission % | ✓ | |
| Tier / subscription | ✓ | |
| Payout schedule & execution | ✓ | |
| Platform fees & GST | ✓ | |
| Reports & CSV exports | ✓ | |
| Promotion/coupon resolution | | ✓ |
| Stack / priority / winning offer | | ✓ |
| Funding attribution | | ✓ |
| Settlement preview math | | ✓ (pure, no DB) |
| **Writing vendor_earnings** | ✓ (consume preview) | |

**Nothing moves wholesale.** Discount Engine gains **persistence wiring**; Finance gains **metadata consumption**.

---

## Admin UI Reuse

| UI | Reuse for settlement integration |
|----|----------------------------------|
| Finance → Tier System | Unchanged |
| Finance → Schedule Settings | Unchanged |
| Finance → Settlement Rules | **Hold** — fix backend matcher before relying on UI |
| Finance → Vendor Booking Earnings | Extend to show funding columns |
| Policy Center → Funding | Source for shared split defaults |
| Marketing → Settlement Analytics | Display-only; needs persisted previews |
| Policy Center → Simulator | Local preview; align with Phase 7 when API ships |

---

## API Reuse

| API | Action |
|-----|--------|
| `POST /settlements/calculate-daily` | Keep — change internal aggregation source |
| `GET /admin/finance/vendor-booking-earnings` | Keep — extend response |
| `POST /admin/discount-policy/simulate` | Future — invoke resolver + settlement |
| `GET /admin/analytics/discount-engine/mode` | Keep — operational flag visibility |
| `GET /admin/commercial-campaigns/:id/settlement-attribution` | Keep — campaign funding read |

---

## Priority Order for Reuse Work (Reference — Not Implementation)

| Priority | Item |
|----------|------|
| **P0** | Persist settlement preview at checkout |
| **P0** | Store funding metadata on `vendor_earnings` |
| **P0** | Align batch with accrual ledger |
| **P1** | Unify commission rate lookup |
| **P1** | Wire `buildSettlementMetadataForLedger` |
| **P2** | Implement or remove dynamic settlement rules |
| **P2** | Persist settlement audit for analytics |

---

## Related Documents

- `docs/SETTLEMENT_MIGRATION_PLAN.md` — phased steps  
- `docs/FINANCE_GAP_ANALYSIS.md` — why changes are needed  
- `docs/SETTLEMENT_REUSE_MAP.md` — detailed file-level matrix  
