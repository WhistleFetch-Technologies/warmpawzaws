# Phase 6 Migration Report — Stack Engine

**Status:** Complete (local — not committed)  
**Policy contract:** `STACK_POLICY.md` v1.1.0  
**Resolver version:** `phase-6.0`  
**Stack version:** `1.0.0`

---

## Summary

Phase 6 replaces the **Legacy Stack Adapter** inside the unified resolver with a configuration-driven **Stack Engine**. The Stack Engine determines coexistence, applies discounts sequentially (vendor → platform → coupon), enforces cumulative limits, preserves funding metadata, and emits full stack audit. Production checkout endpoints remain unchanged — V2 runs via `invokeResolverAlongsideLegacy()` until Phase 8.

---

## Architecture

### Pipeline (Phase 6)

```
Candidate Provider
  ↓
Rule Engine
  ↓
Benefit Engine
  ↓
Priority Engine
  ↓
Stack Engine          ← replaces Legacy Stack Adapter (when enabled)
  ↓
Resolver Result
```

| Component | Responsibility |
|-----------|----------------|
| **Priority Engine** | Rank, score, selection limits — unchanged |
| **Stack Engine** | Coexistence, sequential application, conflict resolution, cumulative caps, audit |
| **Legacy Stack Adapter** | Retained for `OFF` and `SHADOW` compare path |

### Stack Engine modules

| Path | Role |
|------|------|
| `stack/stack-engine.ts` | `DefaultStackEngine` — phase gate, exclusive short-circuit, sequential walk |
| `stack/stack-policy.ts` | `resolveStackPolicy()` — global + domain override merge |
| `stack/stack-configuration.ts` | `loadStackConfiguration()` — domain-effective config view |
| `stack/stack-registry.ts` | Phase split, stack order sort, source helpers |
| `stack/conflict-resolver.ts` | Pairwise coexistence, funding vetoes, duplicate detection |
| `stack/sequential-rebase-calculator.ts` | Recompute benefits on running amount |
| `stack/stack-result-mapper.ts` | Map applied set → `CandidateBenefitOutcome[]` |
| `stack/stack-mode.ts` | `DISCOUNT_ENGINE_V2_STACK_MODE` flag |
| `stack/types.ts` | `StackDecision`, `StackAudit`, rejection types |

---

## Sequential rebase

Each applied discount recalculates the benefit on the **running amount**, not the original base:

| Step | Base | Discount | Running after |
|------|------|----------|---------------|
| Original | 1000 | — | 1000 |
| Vendor 10% | 1000 | 100 | 900 |
| Platform 20% | 900 | 180 | 720 |
| Coupon ₹100 | 720 | 100 | 620 |

Implemented via `recomputeBenefitOnRunningAmount()` → Benefit Engine with `currentAmount = runningAmount`.

---

## Evaluation order (immutable)

1. **AUTO_PROMOTIONS** — vendor/platform auto promotions (stack order sort)
2. **COUPONS** — code-triggered discounts on post-auto running amount

Coupons never run before automatic promotions.

---

## Conflict matrix (configuration-driven)

| Conflict | Reason code | Owner |
|----------|-------------|-------|
| Exclusive promotion | `EXCLUSIVE` | Stack Engine |
| Duplicate candidate id | `DUPLICATE` | ConflictResolver |
| Multiple vendor autos | `MULTIPLE_VENDOR_PROMOTIONS` | Stack policy flag |
| Platform + vendor (domain) | `PLATFORM_VENDOR_COEXISTENCE` | Domain override |
| Multiple coupons | `MULTIPLE_COUPONS` | Stack policy flag |
| Coupon + promotion disabled | `COUPON_WITH_PROMOTION_DISABLED` | Stack policy flag |
| Funding veto (shared + platform coupon) | `FUNDING_VETO_*` | FundingConfiguration |
| Stack rule deny | `STACK_RULE_DENIED` | `stackRules[]` |
| Cumulative limit | `LIMIT` / `MIN_PAYABLE` | LimitConfiguration |

Every rejected candidate includes `reason`, `detail`, optional `ruleId`, `conflictWith`, `funding`, and `phase`.

---

## Stack rules (from configuration)

Read from `StackPolicyConfiguration` via `loadStackPolicyConfiguration()`:

| Flag | Default (global) | ECOMMERCE override |
|------|------------------|-------------------|
| `allowCouponWithPromotion` | true | — |
| `allowMultipleCoupons` | false | — |
| `allowMultipleVendorPromotions` | false | — |
| `allowPlatformWithVendor` | true | **false** |
| `applicationModeDefault` | SEQUENTIAL | — |
| `exclusiveTerminatesAll` | true | — |
| `exclusiveSkipsCouponPhase` | true | — |
| `stackOrder` | VENDOR → PLATFORM → VENDOR_COUPON → PLATFORM_COUPON | — |

No hardcoded business rules in engine code.

---

## Feature flag

**`DISCOUNT_ENGINE_V2_STACK_MODE`**

| Value | Behaviour |
|-------|-----------|
| `AUTHORITATIVE` | Default — Stack Engine output drives `applied[]`, `totalSavings`, `finalAmount` |
| `SHADOW` | Run Stack Engine; return Legacy Stack Adapter result; attach `metadata.stack.audit` |
| `OFF` | Skip Stack Engine; Legacy Stack Adapter only |

Resolver-only flag. Production HTTP endpoints unchanged.

---

## Resolver integration

### Changed files

| File | Change |
|------|--------|
| `resolver/unified-discount-resolver.ts` | Stack Engine wiring; `RESOLVER_VERSION = phase-6.0` |
| `resolver/types.ts` | `StackDiagnostics` in metadata |
| `resolver/production-bridge.ts` | Log stack mode + counts |
| `resolver/__tests__/resolver.integration.test.ts` | Version bump assertion |
| `resolver/__tests__/stack-engine.integration.test.ts` | OFF / SHADOW / AUTHORITATIVE integration |

### Unchanged

| Area | Notes |
|------|-------|
| HTTP endpoints | Legacy checkout engines |
| `invokeResolverAlongsideLegacy()` | Fire-and-forget diagnostics only |
| Rule / Benefit / Priority engines | No modifications |
| Customer / Vendor / Admin UI | No modifications |

### Diagnostics (`metadata.stack`)

| Field | Description |
|-------|-------------|
| `stackMode` | `OFF` / `SHADOW` / `AUTHORITATIVE` |
| `stackVersion` | Engine version or `legacy-adapter` |
| `authoritative` | Whether stack output drove resolver result |
| `appliedCount` / `rejectedCount` | Stack decision counts |
| `totalSavings` / `finalAmount` | Sequential totals when authoritative |
| `audit` | Full `StackAudit` (steps, rejections, fingerprint) |

---

## Funding awareness

Stack Engine preserves `candidate.funding` on each applied step (`PLATFORM`, `VENDOR`, `SHARED`). Funding vetoes from `FundingConfiguration` may reject candidates. **No settlement** — Settlement Engine (Phase 7) consumes funding metadata.

---

## Testing summary

| Suite | Coverage |
|-------|----------|
| `stack/__tests__/stack-engine.test.ts` | Sequential rebase, exclusive, domain override, limits, funding, conflict |
| `resolver/__tests__/stack-engine.integration.test.ts` | OFF / SHADOW / AUTHORITATIVE resolver paths |
| `resolver/__tests__/legacy-stack-adapter.test.ts` | Legacy adapter (OFF/SHADOW baseline) |
| `resolver/__tests__/priority-authoritative.integration.test.ts` | Phase 5B regression |
| All Phase 1–5B suites | **120 tests passing** |

---

## Known limitations

1. **Parallel application mode** — Config flag exists; sequential is default and primary path tested.
2. **Stack conflict records** — `StackAudit.conflicts[]` reserved; pairwise rejections recorded in `rejected[]`.
3. **Coupon phase running amount in Priority** — Priority pipeline still estimates coupon running amount from pre-stack benefit sums; Stack Engine re-applies sequentially authoritatively.
4. **Production cutover** — Deferred to Phase 8; resolver runs diagnostic-only alongside legacy.
5. **Admin UI for stack policy** — Future; config loaded from in-code defaults + loader overrides.

---

## Migration notes

1. Deploy with `DISCOUNT_ENGINE_V2_STACK_MODE=SHADOW` first to compare stack audit vs legacy adapter output in CloudWatch.
2. Validate sequential totals on SERVICE domain (vendor + platform stacks allowed).
3. Validate ECOMMERCE domain (platform rejected when vendor present — domain override).
4. Promote to `AUTHORITATIVE` when shadow audit matches expectations.

---

## Rollback strategy

| Step | Action |
|------|--------|
| Immediate | Set `DISCOUNT_ENGINE_V2_STACK_MODE=OFF` on Lambda env — reverts to Legacy Stack Adapter |
| Partial | Set `SHADOW` — stack runs for audit only; customer-facing resolver output unchanged |
| Full revert | Revert resolver commit; `phase-5b.0` behaviour restored |
| Production | No production endpoint changes in Phase 6 — rollback is env-flag only until Phase 8 |

---

## Success criteria

| Criterion | Status |
|-----------|--------|
| Stack Engine replaces Legacy Stack Adapter in resolver | ✓ |
| Sequential stacking (vendor → platform → coupon) | ✓ |
| Exclusive promotions terminate stack | ✓ |
| Configuration-driven stack rules | ✓ |
| Funding metadata preserved | ✓ |
| Stack audit generated | ✓ |
| Phase 1–5B tests green | ✓ (120/120) |
| No production endpoint behaviour changes | ✓ |
