# Phase 7 Migration Report — Settlement Engine

**Status:** Complete (local — not committed)  
**Policy contract:** `STACK_POLICY.md` v1.1.0 §7, §11  
**Resolver version:** `phase-7.0`  
**Settlement version:** `1.0.0`

---

## Summary

Phase 7 implements a **pure Settlement Engine** inside Discount Engine V2 that allocates promotion funding (PLATFORM / VENDOR / SHARED) and produces `DiscountSettlementPreview` + `SettlementAudit` after the Stack Engine. It **does not** replace `settlements.ts`, Razorpay payouts, admin/vendor finance dashboards, or production checkout endpoints.

Existing accrual hooks are **extended** to consume settlement preview when `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=AUTHORITATIVE`.

---

## Architecture

### Pipeline (Phase 7)

```
Rule Engine
  ↓
Benefit Engine
  ↓
Priority Engine
  ↓
Stack Engine
  ↓
Settlement Engine          ← NEW (pure, no DB writes)
  ↓
ResolverResult.settlement + metadata.settlement
```

| Component | Responsibility |
|-----------|----------------|
| **Stack Engine** | Coexistence + sequential discounts (unchanged) |
| **FundingAllocator** | Split each applied discount by funding type |
| **SettlementCalculator** | Vendor/platform receivable, fees, net preview |
| **Settlement Engine** | Orchestrate preview + audit |
| **settlement-hook-bridge** | Legacy hooks read preview when AUTHORITATIVE |
| **settlements.ts / payouts** | Unchanged — production payout source of truth |

### Settlement module files

| Path | Role |
|------|------|
| `settlement/settlement-engine.ts` | `DefaultSettlementEngine` |
| `settlement/funding-allocator.ts` | PLATFORM / VENDOR / SHARED splits |
| `settlement/settlement-calculator.ts` | Financial distribution + fees from context |
| `settlement/settlement-policy.ts` | Policy from `FundingConfiguration` |
| `settlement/settlement-configuration.ts` | Domain-effective config loader |
| `settlement/settlement-registry.ts` | Funding inference from applied discounts |
| `settlement/settlement-preview.ts` | `DiscountSettlementPreview` mapper |
| `settlement/settlement-hook-bridge.ts` | Hook integration + `wp_financial_meta` parser |
| `settlement/settlement-mode.ts` | Feature flag |
| `settlement/types.ts` | Audit, preview, decision types |

---

## Funding flow

For each `AppliedDiscount` from Stack Engine:

| Funding | Platform share | Vendor share |
|---------|----------------|--------------|
| PLATFORM | 100% | 0% |
| VENDOR | 0% | 100% |
| SHARED | Config % (default 50/50) | Config % |

Per-discount override: `metadata.sharedSplit { platformPercent, vendorPercent }` (e.g. 70/30).

Configuration source: `FundingConfiguration` via `loadFundingConfiguration()` — **no hardcoded splits**.

```
vendorReceivable = originalAmount - vendorDiscountShare
platformCost     = platformDiscountShare
platformReceivable = platformFees + convenience + delivery + packaging - platformCost
netSettlement    = vendorReceivable - (optional commission hint)
customerPayable  = stack finalAmount
```

Fees read from `context.metadata.fees` — **does not duplicate** `feeCalculator.ts`.

---

## Settlement preview fields

| Field | Description |
|-------|-------------|
| `customerPayable` | Post-discount customer amount |
| `vendorReceivable` | Commissionable vendor gross after vendor/shared-vendor discount |
| `platformCost` | Platform-funded discount liability |
| `vendorCost` | Vendor-funded discount liability |
| `sharedDiscountShare` | Split breakdown for SHARED discounts |
| `platformFees` / `convenienceFees` / `deliveryFees` / `taxes` | From context metadata |
| `netSettlement` | Vendor receivable minus commission hint (when provided) |
| `appliedFunding` | Per-discount allocation audit lines |
| `policyFingerprint` | Runtime policy identity |
| `settlementVersion` | Engine version (`1.0.0`) |
| `audit` | Full `SettlementAudit` |

---

## Integration points

### Resolver (`unified-discount-resolver.ts`)

- Runs settlement after `applied[]` assembly
- Sets `result.settlement` on `DiscountEngineResult`
- Adds `metadata.settlement` diagnostics
- `RESOLVER_VERSION = phase-7.0`

### Production bridge

- Logs `settlementMode`, `vendorReceivable`, `platformCost`
- `invokeResolverAlongsideLegacy()` unchanged — no HTTP behaviour change

### Legacy hook extensions (AUTHORITATIVE only)

| Hook | File | Change |
|------|------|--------|
| Service bookings | `vendor-earnings-on-completion.ts` | Adjust commissionable gross via preview |
| Package sessions | `package-session-sync.ts` | Adjust parent total before session slice |
| Meal orders | `meal-order-settlement.ts` | Adjust vendor meal listing amount |
| Pharmacy | `pharmacy-orders.ts` | Adjust commissionable amount on deliver |
| E-commerce seller | `seller-commission-rate.ts` | `resolveSellerCommissionableAmount()` |

Bridge helpers:

- `applySettlementPreviewToCommissionableGross()`
- `extractSettlementPreviewFromBooking()` — parses `wp_financial_meta:` notes
- `buildSettlementMetadataForLedger()` — optional JSON for future columns

**Not modified:** `settlements.ts`, Razorpay, admin/vendor UI, payment endpoints.

---

## Feature flag

**`DISCOUNT_ENGINE_V2_SETTLEMENT_MODE`**

| Mode | Behaviour |
|------|-----------|
| `SHADOW` (default) | Compute preview + audit; legacy hooks unchanged |
| `OFF` | Skip settlement engine entirely |
| `AUTHORITATIVE` | Hooks adjust commissionable gross from preview |

Independent of stack/priority flags. Production default remains **SHADOW**.

---

## Shadow mode

1. Resolver produces `settlement` + `metadata.settlement.audit`
2. Legacy `vendor_earnings` / `delivery_settlements` math unchanged
3. Compare CloudWatch logs: `vendorReceivable` vs legacy gross
4. Promote to `AUTHORITATIVE` when funding splits match finance expectations

---

## Testing summary

| Suite | Coverage |
|-------|----------|
| `settlement/__tests__/settlement-engine.test.ts` | PLATFORM/VENDOR/SHARED, 50/50, 70/30, fees, hook bridge |
| `resolver/__tests__/settlement-engine.integration.test.ts` | OFF / SHADOW / AUTHORITATIVE resolver paths |
| All Phase 1–6 suites | **134 tests passing** |

---

## Known limitations

1. **Preview at completion** — hooks read preview from booking `wp_financial_meta` / order metadata; if absent in AUTHORITATIVE mode, legacy gross used.
2. **Commission rate hint** — optional via `metadata.commissionRateHint`; does not call `getVendorCommissionRate()` inside engine (avoids duplication).
3. **No DB persistence of preview** — metadata helpers ready; no migration added in Phase 7.
4. **E-commerce seller hook** — utility exported; not wired into every order-create path yet.
5. **Production cutover** — deferred; resolver runs diagnostic-only alongside legacy.

---

## Rollback strategy

| Step | Action |
|------|--------|
| Immediate | `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=OFF` |
| Shadow compare | Keep `SHADOW` — preview only |
| Hook rollback | `SHADOW` or `OFF` — hooks ignore preview |
| Full revert | Revert Phase 7 commit; `phase-6.0` resolver |

---

## Migration notes

1. Deploy with `SHADOW` (default) — no production settlement behaviour change.
2. Store resolver `settlement` in booking `wp_financial_meta` at checkout (future checkout integration) for AUTHORITATIVE hook parity.
3. Compare preview vs `vendor_earnings` rows on dev for promoted bookings.
4. Enable `AUTHORITATIVE` per environment after finance sign-off.

---

## Success criteria

| Criterion | Status |
|-----------|--------|
| Pure Settlement Engine (no DB/payout) | ✓ |
| Preview after Stack Engine | ✓ |
| Funding PLATFORM/VENDOR/SHARED | ✓ |
| Reuse existing settlement infrastructure | ✓ |
| Hook extensions (service/package/meal/pharmacy/seller) | ✓ |
| Dashboards / APIs / payouts unchanged | ✓ |
| SHADOW default operational | ✓ |
| 134/134 discount-engine tests green | ✓ |
| No production HTTP changes | ✓ |
