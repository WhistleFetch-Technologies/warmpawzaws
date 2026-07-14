# Finance Gap Analysis

**Phase:** S1 (Analysis Only)  
**Date:** 2026-07-06  
**Purpose:** Identify duplicate logic, legacy calculations, incorrect ownership, missing integrations, and technical debt before settlement engine modifications.

---

## Critical Gaps (P0)

### G1 — Accrual vs batch commission mismatch

**Problem:** `vendor-earnings-on-completion.ts` commissions on vendor-visible **service price**; `calculate-daily` commissions on `bookings.total_amount` (customer **finalPaid**) using `vendors.commission_percentage`.

**Impact:** Different vendor nets for same booking; reports disagree; discount-heavy bookings especially wrong in batch.

**Owner fix:** Finance — batch should aggregate `vendor_earnings`, not recalculate.

---

### G2 — Settlement preview not persisted at checkout

**Problem:** Phase 7 computes `DiscountSettlementPreview` in resolver but checkout does not write it to `wp_financial_meta`. `financial-meta-bridge.ts` exists but is unwired.

**Impact:** `AUTHORITATIVE` settlement mode cannot adjust commission base; hooks fall back to legacy gross silently.

**Owner fix:** Discount Engine + Booking endpoints.

---

### G3 — Dual commission rate lookup

**Problem:**

| Function | Subscription aware? | Default |
|----------|---------------------|---------|
| `getVendorCommissionRate` | No | 15% |
| `getVendorTierCommission` | Yes | 10% |

Completion accrual uses the simpler function.

**Impact:** Paid tier subscription may not apply at earnings creation.

**Owner fix:** Finance — single lookup path.

---

### G4 — Multiple default commission constants

**Locations:**

- `DEFAULT_COMMISSION_RATE = 10` (`commission.ts`)
- `getVendorCommissionRate` fallback **15%**
- Batch `defaultCommission: 10`
- Bronze tier seeded at **15%**
- Meal fallback **15%**

**Impact:** Unpredictable rates when tier missing or DB errors.

**Owner fix:** Finance — one constant + default tier row.

---

## High Gaps (P1)

### G5 — Dynamic settlement rules are UI-only

**Problem:** `settlement_rules` CRUD works; **no backend evaluator** in `calculate-daily` or settlement-processor.

**Impact:** Admins may believe tier/region/day rules apply when only `vendor_tiers.payout_period_days` and `payout_rules` matter.

**Owner fix:** Finance — implement matcher or hide/disable UI with clear label.

---

### G6 — `vendors.commission_percentage` denormalization drift

**Problem:** Batch uses denormalized field; accrual uses live tier join. Tier changes without `apply-commissions` desync.

**Impact:** Batch rate ≠ accrual rate until manual sync.

**Owner fix:** Finance — auto-sync on tier change or eliminate denormalized field from batch path.

---

### G7 — Funding metadata not on ledger rows

**Problem:** `buildSettlementMetadataForLedger()` exported but not used in INSERT statements.

**Impact:** No audit trail for platform vs vendor discount cost in finance reports.

**Owner fix:** Finance accrual + optional migration for JSONB column.

---

### G8 — Legacy discount math still authoritative at checkout

**Problem:** `booking-promotion-service.ts` legacy stack returns customer amounts; V2 resolver runs parallel/shadow.

**Impact:** Funding preview may not match what customer actually paid until resolver is authoritative.

**Owner fix:** Discount Engine resolver migration (existing program).

---

### G9 — No `funding` column on promotions/coupons tables

**Problem:** Funding inferred at candidate normalization (platform promo → PLATFORM, vendor promo → VENDOR).

**Impact:** Cannot configure per-record shared splits in CRUD; campaign engine separate.

**Owner fix:** Optional future CRUD extension — not required if Policy Center + campaigns cover cases.

---

## Medium Gaps (P2)

### G10 — Two tier admin APIs

**Problem:** `/admin/payments/tiers` (Finance UI) vs `/admin/tiers` (legacy page).

**Impact:** Operational confusion; possible inconsistent data if both used.

---

### G11 — E-commerce seller settlement hook partial

**Problem:** `resolveSellerCommissionableAmount()` exists; not all order paths wired to discount settlement hook.

**Impact:** Shop orders may ignore funding preview when enabled.

---

### G12 — Settlement analytics without persistence

**Problem:** Phase 9 analytics aggregates previews but historical data is CloudWatch-only.

**Impact:** Admin Settlement Analytics tab limited to live/shadow diagnostics.

---

### G13 — `SETTLEMENT_CURRENT_STATE.md` stale

**Problem:** Doc says Discount settlement engine is "contract stub only" — Phase 7 implemented full engine.

**Impact:** Wrong guidance for new engineers.

**Fix:** Mark doc superseded by `PHASE7_MIGRATION_REPORT.md` (documentation only).

---

### G14 — Policy Center not runtime-wired

**Problem:** Funding/stack/priority config lives in localStorage draft; engines use in-code defaults.

**Impact:** Admin Policy Center changes do not affect production settlement splits.

---

### G15 — Finance dashboard growth metric hardcoded

**Problem:** `finance/page.tsx` uses estimated `monthGrowth` (~18%).

**Impact:** Cosmetic — misleading KPI.

---

## Duplicate Logic Inventory

| Logic | Location A | Location B |
|-------|------------|------------|
| Commission calculation | `vendor-earnings-on-completion` | `settlements.ts` calculate-daily |
| Tier rate lookup | `getVendorCommissionRate` | `getVendorTierCommission` |
| Tier rate lookup | Accrual tier join | Batch `commission_percentage` |
| Discount amounts | Legacy booking-promotion-service | V2 unified resolver |
| Default commission | `commission.ts` | Inline 15% in multiple files |
| Settlement rules config | `settlement_rules` table | `vendor_tiers` + `payout_rules` (actual runtime) |
| Tier admin | `/admin/payments/tiers` | `/admin/tiers` |

---

## Legacy / Dead / Unused

| Item | Status |
|------|--------|
| `settlement_rules` runtime evaluation | **Unused** |
| `financial-meta-bridge.ts` at checkout | **Unwired** |
| `buildSettlementMetadataForLedger` in production INSERT | **Unused** |
| `vendor_settlements` table | Legacy / unclear |
| `FinanceManagement.tsx.backup` | Dead file |
| `contracts/settlement-engine.ts` original stub | Superseded by `DefaultSettlementEngine` |
| `/tiers` legacy page | Legacy parallel to Finance tier tab |

---

## Missing Integrations

| From | To | Status |
|------|-----|--------|
| Discount resolver | `wp_financial_meta.settlement_preview` | Missing |
| Settlement preview | `vendor_earnings.metadata` | Missing |
| Policy Center publish | Runtime `FundingConfiguration` | Missing (Phase 8 API) |
| Campaign funding DB | Candidate normalizer | Partial (Phase 10) |
| Settlement rules UI | Batch eligibility | Missing |
| Phase 7 preview | Admin booking earnings CSV | Missing columns |
| Resolver AUTHORITATIVE | Customer checkout display | In progress |

---

## Incorrect Ownership (Historical)

| Concern | Was treated as | Should be |
|---------|----------------|-----------|
| Promotion stacking | Finance / checkout ad-hoc | Discount Engine |
| Funding split | Not modeled | Discount Engine |
| Commission % | Sometimes inferred from discounts | Finance tier only |
| Final payout | Mixed booking total and service price | Finance ledger from unified base |
| Settlement rules UI | Implied runtime policy | Finance (when implemented) or removed |

---

## Technical Debt Summary

1. **Three commission tracks** (service tier, delivery tier, e-com V2) — document clearly for all engineers.  
2. **Two settlement calculation paths** for services (accrual vs batch) — highest financial risk.  
3. **Feature flag matrix** — resolver, stack, priority, settlement modes independent; easy to misconfigure.  
4. **Financial meta in booking notes** — string parsing fragile; consider dedicated JSONB column long-term.  
5. **No reconciliation job** comparing resolver preview vs actual earnings row.

---

## Risk Matrix

| Gap | Financial risk | Customer impact | Fix complexity |
|-----|----------------|-----------------|----------------|
| G1 batch vs accrual | **High** | Low | Medium |
| G2 preview not stored | **High** | Medium | Medium |
| G3 dual rate lookup | Medium | Low | Low |
| G4 default constants | Medium | Low | Low |
| G5 settlement rules UI | Medium (trust) | None | High |
| G8 legacy checkout | Medium | Medium | High |

---

## Recommended Immediate Focus (Analysis Recommendation — Not Implementation)

1. Fix **G1** (batch reads ledger) — pure Finance, no Discount Engine dependency.  
2. Fix **G2 + G3** before any AUTHORITATIVE settlement prod flag.  
3. Decide **G5** — implement rules engine or deprecate UI.  
4. Update stale docs (**G13**).

---

## Related Documents

- `docs/FINANCE_CURRENT_STATE.md`  
- `docs/COMMISSION_POLICY_ANALYSIS.md`  
- `docs/SETTLEMENT_MIGRATION_PLAN.md`  
- `docs/FINANCE_REUSE_PLAN.md`  
