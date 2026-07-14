# Settlement Migration Plan

**Phase:** S1 (Analysis Only)  
**Date:** 2026-07-06  
**Purpose:** Phased roadmap to integrate Discount Engine funding/settlement with Finance ledger and payouts — **planning only, no implementation**.

---

## Current State Summary

| Layer | Status |
|-------|--------|
| Discount resolution at checkout | Legacy authoritative; V2 shadow/parallel |
| Phase 7 settlement preview | Implemented in resolver; not persisted |
| Accrual hooks | Exist; inactive without preview + AUTHORITATIVE flag |
| `vendor_earnings` | Live; tier commission on service price |
| Daily batch | Live; **different** commission base than accrual |
| Payouts / Razorpay | Live; unchanged by Phase 7 |
| Policy Center funding config | Draft/local; not runtime authoritative |

---

## Migration Goals

1. Single **commission base** policy across accrual and batch.  
2. **Funding attribution** stored per booking/order and visible in reports.  
3. No duplicate promotion math in Finance.  
4. Safe cutover via OFF → SHADOW → AUTHORITATIVE (same pattern as resolver).  
5. Finance module remains payout **system of record**.

---

## Phase S2 — Foundation (Pre-Settlement Logic Changes)

**Objective:** Fix Finance internal consistency before Discount Engine cutover.

| Step | Action | Owner |
|------|--------|-------|
| S2.1 | Document authoritative commission base (service price − vendor-funded discounts) | Finance |
| S2.2 | Unify `getVendorCommissionRate` → subscription-aware lookup | Finance |
| S2.3 | Change `calculate-daily` to sum `vendor_earnings` + `delivery_settlements` instead of recalculating from `bookings.total_amount` | Finance |
| S2.4 | Ensure `POST /admin/tiers/apply-commissions` runs after tier edits (or auto-sync) | Finance |
| S2.5 | Add `vendor_earnings.metadata` JSONB column (idempotent migration) | Finance DB |

**Exit criteria:** Accrual totals match batch totals for sample vendors; no discount engine dependency yet.

---

## Phase S3 — Preview Persistence

**Objective:** Store Discount Engine settlement output at checkout.

| Step | Action | Owner |
|------|--------|-------|
| S3.1 | Wire `appendSettlementPreviewToFinancialMeta()` (or equivalent) in booking create / payment success | Discount Engine + Booking |
| S3.2 | Include `appliedFunding[]`, `vendorReceivable`, `platformCost`, `policyFingerprint` in `wp_financial_meta` | Discount Engine |
| S3.3 | Extend e-commerce order metadata similarly for shop checkout | Discount Engine + Orders |
| S3.4 | SHADOW mode: compare stored preview vs legacy financial meta discounts | Ops |

**Exit criteria:** Sample bookings in dev have parseable `settlement_preview` in notes; hook can extract on completion.

---

## Phase S4 — Accrual Integration (AUTHORITATIVE Hooks)

**Objective:** Finance accrual consumes funding split.

| Step | Action | Owner |
|------|--------|-------|
| S4.1 | Enable `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=SHADOW` in dev; validate logs | Ops |
| S4.2 | Call `buildSettlementMetadataForLedger()` on `vendor_earnings` INSERT | Finance hook |
| S4.3 | Same for `delivery_settlements` INSERT | Finance hook |
| S4.4 | Enable AUTHORITATIVE in dev; verify commission base reduction for vendor promos | QA |
| S4.5 | Vendor booking earnings report: optional funding columns | Finance UI |

**Exit criteria:** Vendor promo bookings show lower commission base and correct funding metadata in dev RDS.

---

## Phase S5 — Resolver Authoritative Cutover

**Objective:** Discount Engine becomes checkout source of truth (coordinated with existing resolver migration).

| Step | Action | Owner |
|------|--------|-------|
| S5.1 | Align `DISCOUNT_ENGINE_V2_RESOLVER_MODE=AUTHORITATIVE` with settlement authoritative | Discount Engine |
| S5.2 | Checkout UI uses resolver amounts (already partially done) | Customer/Vendor web |
| S5.3 | Remove reliance on legacy sequential discount math where safe | Discount Engine |
| S5.4 | Prod SHADOW period with finance reconciliation dashboards | Ops |

**Exit criteria:** Customer paid amount matches resolver; funding metadata present on new bookings in prod.

---

## Phase S6 — Batch & Payout Alignment

**Objective:** End-to-end settlement uses integrated data.

| Step | Action | Owner |
|------|--------|-------|
| S6.1 | Batch aggregates only pending `vendor_earnings` / `delivery_settlements` | Finance |
| S6.2 | Settlement row JSON includes funding summary (optional) | Finance |
| S6.3 | Tier upgrade deductions unchanged — verify against new net amounts | Finance |
| S6.4 | Razorpay payout amount matches sum of ledger nets | QA |

**Exit criteria:** Full booking → completion → batch → payout path verified in staging with discounts.

---

## Phase S7 — Policy Center & Campaign Funding Runtime

**Objective:** Admin-configured funding rules drive production.

| Step | Action | Owner |
|------|--------|-------|
| S7.1 | Ship Policy Center publish API (Phase 8) — funding config to runtime | Discount Engine |
| S7.2 | Campaign `funding_type` / `funding_split` flows through candidate normalizer | Discount Engine |
| S7.3 | Settlement analytics reads persisted previews (Phase 9) | Analytics |

---

## Phase S8 — Settlement Rules (Optional / Separate)

**Objective:** Either implement dynamic settlement rules or deprecate UI.

| Option A | Build runtime matcher in `calculate-daily` for `settlement_rules` |
| Option B | Remove/hide UI until implemented; tier + payout_rules remain sole config |

**Recommendation:** Option B short-term — avoid false confidence in unused rules.

---

## Rollback Strategy

| Flag / lever | Rollback effect |
|--------------|-----------------|
| `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=OFF` | Hooks pass through legacy gross |
| `DISCOUNT_ENGINE_V2_RESOLVER_MODE=SHADOW` | Legacy checkout amounts |
| Batch ledger aggregation (S2.3) | Independent improvement — keep even if DE rolled back |

Metadata columns are additive — rollback does not require data deletion.

---

## Testing Plan (Per Phase)

| Test | Description |
|------|-------------|
| T1 | Vendor promo 25% — commission base excludes vendor share when authoritative |
| T2 | Platform promo only — commission base unchanged |
| T3 | Shared 50/50 — half vendor share reduces base |
| T4 | Tier upgrade deduction still applies after net change |
| T5 | Meal order — delivery_settlements funding metadata |
| T6 | Accrual CSV vs batch settlement totals |
| T7 | E-commerce path unaffected by service tier changes |

---

## Dependencies & Sequencing

```
S2 (Finance consistency)
  → S3 (Preview persistence)
    → S4 (Accrual hooks)
      → S5 (Resolver authoritative)
        → S6 (Batch alignment)
          → S7 (Policy runtime)
```

**Do not enable AUTHORITATIVE settlement before S3** — hooks will silently use legacy gross.

---

## Out of Scope (This Migration)

- Promotion / Coupon CRUD changes  
- Campaign Builder UI changes  
- Razorpay integration rewrite  
- New payout providers  
- GL / double-entry ledger automation  

---

## Related Documents

- `docs/FINANCE_REUSE_PLAN.md`  
- `docs/SETTLEMENT_ARCHITECTURE_ANALYSIS.md`  
- `docs/FINANCE_GAP_ANALYSIS.md`  
- `backend/lambda/src/discount-engine/PHASE7_MIGRATION_REPORT.md`  
