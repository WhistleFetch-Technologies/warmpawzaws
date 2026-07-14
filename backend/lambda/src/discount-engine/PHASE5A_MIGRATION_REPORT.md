# Discount Engine V2 — Phase 5A Migration Report

**Phase:** 5A — Priority Engine (Shadow Mode)  
**Status:** Complete — observational only; legacy authoritative  
**Date:** 2026-06-30  
**Contract:** `STACK_POLICY.md` v1.1.0

---

## Objective

Introduce the **Priority Engine** into the unified resolver pipeline in **shadow mode** only. Rank eligible candidates per phase without changing customer-visible discount behaviour, APIs, or database schema.

---

## Architecture

### Pipeline (Phase 5A)

```
DiscountContext
    ↓
Candidate Providers
    ↓
Candidate Normalizer
    ↓
Rule Engine
    ↓
Benefit Engine
    ↓
Priority Engine (shadow)     ← NEW
    ↓
Legacy applied[] (unchanged) ← still all eligible
    ↓
ResolverResult + diagnostics
```

Stack Engine and Settlement Engine are **not** implemented (Phase 6 / 7).

### Priority flow

```
Eligible benefits (per phase)
    ↓
Strategy registry → score
    ↓
Deterministic sort + tie-breakers
    ↓
Selection limits (truncate)
    ↓
orderedCandidateList + selectedCandidates + rejectedByLimit
    ↓
exclusiveCandidates[] (flags only)
    ↓
PriorityAudit
```

**Boundary:** Priority ranks and truncates. It does **not** decide coexistence.

---

## New components

| Path | Role |
|------|------|
| `priority/priority-engine.ts` | Pure `PriorityEngine.prioritize()` |
| `priority/strategy-registry.ts` | Pluggable strategies |
| `priority/strategies/*` | MAX_CUSTOMER_SAVINGS, VENDOR_SPOTLIGHT_FIRST, FIXED_PRIORITY_WEIGHT, LOWEST_PLATFORM_COST, ADMIN_MANUAL_ORDER |
| `priority/priority-audit.ts` | `PriorityDecision`, `PriorityAudit` |
| `priority/priority-utils.ts` | Tie-breakers, phase filter, limits |
| `policy/runtime-policy-loader.ts` | Merge global + domain config |
| `policy/runtime-policy-fingerprint.ts` | SHA-256 `policyFingerprint` |
| `policy/policy-validation-engine.ts` | Pre-publish validation runner |
| `policy/validation-rules/*` | Schema, duplicate, limits, stack, funding validators |
| `config/*-config-loader.ts` | Default Priority / Stack / Funding / Limits configs |
| `resolver/priority-shadow.ts` | Shadow orchestration + diagnostics logging |

---

## Runtime policy flow

```
PriorityConfiguration  (vN)
StackPolicyConfiguration (vN)
FundingConfiguration   (vN)
LimitConfiguration     (vN)
        ↓
Domain merge (SERVICE / ECOMMERCE / …)
        ↓
RuntimePolicy
        ↓
policyFingerprint (SHA-256)
```

Fingerprint is attached to `PriorityResult`, `PriorityAudit`, and `ResolverResult.metadata.priorityShadow`.

---

## Validation flow

```
RuntimePolicy
    ↓
ValidatorRegistry (plug-in validators)
    ↓
ValidationResult { errors, warnings, suggestions, isPublishable }
```

Shadow mode logs validation counts; does **not** block resolver execution in 5A.

---

## Strategy registry

| Strategy | Default domain | Scoring |
|----------|----------------|---------|
| `MAX_CUSTOMER_SAVINGS` | ECOMMERCE global | `discountAmount` |
| `VENDOR_SPOTLIGHT_FIRST` | SERVICE | Spotlight boost + savings |
| `FIXED_PRIORITY_WEIGHT` | — | `priority` weight + savings |
| `LOWEST_PLATFORM_COST` | — | Savings − platform cost estimate |
| `ADMIN_MANUAL_ORDER` | — | Manual id list order |

Register new strategy = new class + `registry.register()` — no engine modification.

---

## Selection limits

| Limit | Enforced in 5A by |
|-------|-------------------|
| `maxSelected` (priority phase config) | Priority Engine |
| `maxAutoPromotions` / `maxCoupons` | Priority Engine |
| `maxTotalDiscounts`, amount caps | **Deferred** — Stack Engine (Phase 6) |

Rejected candidates → `rejectedByLimit[]` with `PROMOTION_LIMIT` or `COUPON_LIMIT`.

---

## Priority audit

Each run emits `PriorityAudit` with `PriorityDecision[]`:

- `candidateId`, `score`, `rank`, `selectedForStack`, `rejectedReason`
- `strategy`, `policyFingerprint`, `executionTimeMs`

**Not persisted** in 5A — returned in resolver metadata only.

---

## Feature flag

| Variable | Default | Effect |
|----------|---------|--------|
| `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW` | enabled (unset) | Run priority shadow |
| `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW=false` | off | Skip priority (Phase 4 behaviour in metadata) |

Legacy production paths unchanged. `invokeResolverAlongsideLegacy` logs priority diagnostics when resolver runs.

---

## Resolver changes

| File | Change |
|------|--------|
| `unified-discount-resolver.ts` | `resolverVersion: phase-5a.0`; calls `runPriorityShadow()`; attaches `metadata.priorityShadow` |
| `production-bridge.ts` | Logs priority shadow via `logPriorityShadowDiagnostics` |
| `applied` / `appliedCandidates` | **Unchanged** — all eligible candidates |

---

## Testing summary

| Suite | Coverage |
|-------|----------|
| `policy/__tests__/runtime-policy-fingerprint.test.ts` | Fingerprint stability, domain merge |
| `policy/__tests__/policy-validation-engine.test.ts` | Errors, warnings, duplicate rules |
| `priority/__tests__/priority-engine.test.ts` | Strategies, limits, exclusive flags, tie-breakers |
| `resolver/__tests__/priority-shadow.integration.test.ts` | Shadow diagnostics, two phases |
| Existing Phase 1–4 tests | Must pass unchanged |

Run: `cd backend/lambda && npm test`

---

## Known limitations (5A)

- Priority output is **not authoritative** — legacy math still wins at checkout  
- No Stack Engine — `selectedCandidates` ≠ final `applied[]`  
- No audit persistence (CloudWatch logs only)  
- Config loaders use **in-code defaults** — no Admin UI / SSM yet  
- Campaign overrides not loaded (extension point in merge layer)  
- `ADMIN_MANUAL_ORDER` strategy registered but requires `manualOrder` in config

---

## Deferred work

| Phase | Scope |
|-------|-------|
| **5B** | Authoritative Priority — `appliedCandidates` from `selectedCandidates`; feature-flag cutover |
| **6** | Stack Engine — coexistence, sequential stack, final `applied[]` |
| **7** | Settlement Engine |
| **8** | Config publish UI, SSM storage, rollback by `publishId` |
| **9** | Analytics on `policyFingerprint` + reason codes |
| **10** | Campaign Engine config overrides |

---

## Verification checklist

- [ ] `npm test` in `backend/lambda` passes  
- [ ] `npm run build:ts` passes  
- [ ] Resolver shadow logs show `policyFingerprint` and rank counts  
- [ ] `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW=false` skips priority metadata  
- [ ] Booking / cart legacy responses unchanged (amounts identical)  
- [ ] No API or DB migrations  

---

## Anti-patterns avoided

- No hardcoded priority or stack rules in engine code  
- Priority Engine has no I/O, logging, or DB access  
- No `applied[]` produced by Priority Engine  
- Contracts in `contracts/priority-engine.ts` left unchanged (new module parallel)  

---

*Phase 5A complete — ready for architecture review before Phase 5B.*
