# Runtime Flag Analysis — Booking e8584dfb (DEV)

---

## Problem

Discount Engine V2 flags are AUTHORITATIVE on dev, yet booking behavior matches **legacy** finance and broken commission paths. Need clarity on which flags govern which runtime behaviors.

---

## Expected

When all `DISCOUNT_ENGINE_V2_*` modes are AUTHORITATIVE:

- Unified resolver drives booking promotion resolution.
- Settlement preview from discount engine informs commission base.
- Finance S2 funding-aware accrual aligns vendor earnings with platform/vendor discount funding.

---

## Actual

| Behavior | Observed | Flag that should govern it |
|----------|----------|----------------------------|
| Promo resolution at create | Discount persisted without `wp_promo_meta` | `DISCOUNT_ENGINE_V2_RESOLVER_MODE` |
| Commission rate 10% | Wrong vs Basic 20% | Finance policy (not discount flag) |
| No settlement snapshot | `wp_financial_meta` flat | `FINANCE_FUNDING_AWARE_SETTLEMENT` |
| Legacy vendor_earnings INSERT | Empty metadata | `FINANCE_FUNDING_AWARE_SETTLEMENT` |
| Promotion usage not recorded | Separate post-payment hook | N/A (data linkage issue) |

---

## Root Cause

### Two independent flag families

**A. Discount Engine V2** (`DISCOUNT_ENGINE_V2_*`)

| Env var | Dev Lambda | Default if unset | Governs |
|---------|------------|------------------|---------|
| `DISCOUNT_ENGINE_V2_RESOLVER_MODE` | AUTHORITATIVE | OFF | `resolveWithProductionMode` — booking promo resolution |
| `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | AUTHORITATIVE | OFF (legacy shadow) | Priority pipeline — best offer selection |
| `DISCOUNT_ENGINE_V2_STACK_MODE` | AUTHORITATIVE | OFF | Stack rules for multiple discounts |
| `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` | AUTHORITATIVE | SHADOW | Discount-engine settlement preview in resolver result |
| `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` | AUTHORITATIVE | OFF | Analytics engine |
| `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | AUTHORITATIVE | OFF | Commercial campaigns |

**B. Finance S2** (separate)

| Env var | Dev Lambda | Default if unset | Governs |
|---------|------------|------------------|---------|
| `FINANCE_FUNDING_AWARE_SETTLEMENT` | **(unset)** | **LEGACY** | `vendor_earnings` INSERT, snapshot persistence, batch settlement |

Terraform `infra/envs/dev/main.tf` sets family **A** only:

```hcl
DISCOUNT_ENGINE_V2_RESOLVER_MODE    = "AUTHORITATIVE"
DISCOUNT_ENGINE_V2_PRIORITY_MODE    = "AUTHORITATIVE"
DISCOUNT_ENGINE_V2_STACK_MODE       = "AUTHORITATIVE"
DISCOUNT_ENGINE_V2_SETTLEMENT_MODE  = "AUTHORITATIVE"
DISCOUNT_ENGINE_V2_ANALYTICS_MODE   = "AUTHORITATIVE"
DISCOUNT_ENGINE_V2_CAMPAIGN_MODE    = "AUTHORITATIVE"
# FINANCE_FUNDING_AWARE_SETTLEMENT — not present
```

### Flag interaction on this booking

```
Booking create
  └─ DISCOUNT_ENGINE_V2_RESOLVER_MODE=AUTHORITATIVE
       └─ resolveBookingPromotions → V2 pipeline (may still fail category match / throw)
  └─ enrichFinancialMetaWithSettlement
       └─ FINANCE_FUNDING_AWARE_SETTLEMENT=LEGACY → skip snapshot

Booking complete
  └─ ensureVendorEarningsForCompletedBooking
       └─ isFinanceFundingAwareSettlementEnabled() → false
       └─ legacy path: getVendorCommissionRate() → resolveVendorCommissionPolicy (SQL bug → 10%)
       └─ resolveLedgerGrossForVendorCommission → ₹110
```

`DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=AUTHORITATIVE` affects resolver `result.settlement` preview appended via `appendSettlementPreviewToFinancialMeta` **only when** `resolvedBookingPromotions?.settlement` exists — which requires successful promo resolution. It does **not** enable Finance S2 accrual.

---

## Evidence

AWS CLI output (`aws lambda get-function-configuration --function-name warmpawz-dev-api-handler`):

```json
{
  "DISCOUNT_ENGINE_V2_RESOLVER_MODE": "AUTHORITATIVE",
  "DISCOUNT_ENGINE_V2_PRIORITY_MODE": "AUTHORITATIVE",
  "DISCOUNT_ENGINE_V2_STACK_MODE": "AUTHORITATIVE",
  "DISCOUNT_ENGINE_V2_SETTLEMENT_MODE": "AUTHORITATIVE",
  "DISCOUNT_ENGINE_V2_ANALYTICS_MODE": "AUTHORITATIVE",
  "DISCOUNT_ENGINE_V2_CAMPAIGN_MODE": "AUTHORITATIVE"
}
```

`FINANCE_FUNDING_AWARE_SETTLEMENT` — **absent** from Variables map.

---

## Files

| Flag | Module |
|------|--------|
| Resolver | `discount-engine/policy/resolver-mode.ts` |
| Priority | `discount-engine/policy/priority-mode.ts` |
| Stack | `discount-engine/stack/stack-mode.ts` |
| DE Settlement | `discount-engine/settlement/settlement-mode.ts` |
| Analytics | `discount-engine/analytics/analytics-mode.ts` |
| Campaign | `discount-engine/campaign/campaign-mode.ts` |
| Finance S2 | `finance/settlement/finance-settlement-mode.ts` |
| Production bridge | `discount-engine/resolver/production-bridge.ts` |
| Infra | `infra/envs/dev/main.tf` |
| Flag introspection API | `endpoints/discount-analytics.endpoints.ts` |

---

## Environment

- Region: `ap-south-1`
- Function: `warmpawz-dev-api-handler`
- `UAT_MODE=true`

---

## Recommended Fix

1. Add `FINANCE_FUNDING_AWARE_SETTLEMENT` to Terraform dev (start `SHADOW`, then `AUTHORITATIVE`).
2. Document flag matrix in team bible: discount settlement ≠ finance accrual.
3. Extend `/discount-analytics/flags` (or similar) to expose `FINANCE_FUNDING_AWARE_SETTLEMENT`.
4. CI check: if any `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` ≠ OFF, warn if finance flag is LEGACY.

---

## Priority

**P2** (configuration) — but blocks correct settlement until set.

---

## Risk

Team assumes AUTHORITATIVE discount flags imply end-to-end funding-aware finance; production payout logic remains legacy.
