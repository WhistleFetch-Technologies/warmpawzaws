# Phase 5B Migration Report — Priority Engine Authoritative

**Status:** Complete (local — architecture review)  
**Policy contract:** `STACK_POLICY.md` v1.1.0  
**Resolver version:** `phase-5b.0`  
**Priority version:** `1.0.0`

---

## Summary

Phase 5B promotes the Priority Engine from **shadow-only** to **authoritative ranking** inside the unified resolver pipeline. Legacy stack coexistence rules still govern which priority-selected candidates may apply together. Production checkout endpoints remain on legacy engines (`invokeResolverAlongsideLegacy` unchanged).

---

## Architecture changes

### Before (5A)

```
Benefit Engine → Priority (shadow) → build result from ALL eligible
```

### After (5B)

```
Benefit Engine → Priority Pipeline → Legacy Stack Adapter → build result from stacked selection
                                      ↑
                         selectedCandidates[] (authoritative mode)
```

| Mode | Priority runs | `appliedCandidates` source |
|------|---------------|----------------------------|
| `OFF` | No | All eligible |
| `SHADOW` | Yes (diagnostics) | All eligible |
| `AUTHORITATIVE` (default) | Yes | Priority + legacy stack |

---

## New / changed components

| Path | Role |
|------|------|
| `policy/priority-mode.ts` | `DISCOUNT_ENGINE_V2_PRIORITY_MODE` — `OFF` / `SHADOW` / `AUTHORITATIVE` |
| `resolver/priority-pipeline.ts` | Unified priority run with fallback (replaces shadow-only logic) |
| `resolver/legacy-stack-adapter.ts` | Applies legacy coexistence rules to `selectedCandidates[]` |
| `resolver/unified-discount-resolver.ts` | Authoritative flow + expanded `metadata.priority` |
| `resolver/production-bridge.ts` | Logs priority mode and selection counts |
| `resolver/priority-shadow.ts` | Thin wrapper for 5A test compatibility |

---

## Feature flag

**`DISCOUNT_ENGINE_V2_PRIORITY_MODE`**

| Value | Behaviour |
|-------|-----------|
| `AUTHORITATIVE` | Default — priority selection feeds legacy stack adapter |
| `SHADOW` | Priority diagnostics only; all eligible remain applied |
| `OFF` | Skip priority; Phase 4 resolver behaviour |

Legacy `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW=false` maps to `OFF` when MODE is unset.

---

## Priority flow (authoritative)

1. Load runtime policy + validate  
2. If validation fails → fallback to all eligible (never block checkout)  
3. Run auto phase priority  
4. Skip coupon phase if exclusive selected + `exclusiveSkipsCouponPhase`  
5. Run coupon phase with `runningAmount` when applicable  
6. Merge `selectedCandidates` from both phases  
7. Legacy stack adapter applies coexistence (exclusive terminal, coupon+promo, platform+vendor)  
8. Map stacked selection → `appliedCandidates`, `applied[]`, `totalSavings`

---

## Fallback flow

| Condition | Action |
|-----------|--------|
| Priority engine throws | Log warning → all eligible |
| Policy validation errors | Log → all eligible |
| `OFF` mode | Skip priority |

Never throws to caller. Never blocks checkout.

---

## Diagnostics (`metadata.priority`)

| Field | Description |
|-------|-------------|
| `priorityMode` | `OFF` / `SHADOW` / `AUTHORITATIVE` |
| `priorityVersion` | Engine config version |
| `policyFingerprint` | SHA-256 of merged runtime policy |
| `strategy` | Active ranking strategy |
| `selectedCount` | Final applied count (authoritative) |
| `rejectedCount` | Limit rejections from priority |
| `executionTimeMs` | Priority pipeline time |
| `validationWarnings` / `validationErrors` | Policy validation counts |
| `authoritative` | Whether selection affected output |
| `fallbackReason` | Set when authoritative path skipped |
| `autoPhase` / `couponPhase` | Full `PriorityResult` objects |

---

## Testing summary

| Suite | Coverage |
|-------|----------|
| `policy/__tests__/priority-mode.test.ts` | Flag modes + legacy mapping |
| `resolver/__tests__/legacy-stack-adapter.test.ts` | Coexistence rules |
| `resolver/__tests__/priority-authoritative.integration.test.ts` | Authoritative, shadow, off, fallback, exclusive skip |
| `resolver/__tests__/priority-shadow.integration.test.ts` | 5A compatibility (unchanged) |
| `resolver/__tests__/resolver.integration.test.ts` | Matrix rows + phase-5b version |
| `priority/__tests__/priority-engine.test.ts` | Unit tests (unchanged) |

Run: `cd backend/lambda && npm test -- --testPathPattern=discount-engine`

---

## Known limitations

- **Stack Engine not implemented** — legacy stack adapter applies global coexistence flags only; no sequential re-base or full matrix  
- **Production cutover deferred** — legacy engines still return customer-visible amounts; resolver is diagnostic-only at endpoints  
- **Coupon benefits not recomputed** on `runningAmount` before priority (Phase 6)  
- **SERVICE two-leg sequential savings** may differ from `calculateBookingPromotionsStack` until Stack Engine  
- Config still uses in-code defaults (no Admin UI / SSM)

---

## Deferred work

| Phase | Scope |
|-------|-------|
| **6** | Stack Engine — coexistence matrix, sequential applicator, final `applied[]` |
| **7** | Settlement Engine |
| **8** | Resolver replaces legacy at production endpoints |
| **9+** | Campaign overrides, analytics, audit persistence |

---

## Verification checklist

- [ ] `npm test -- --testPathPattern=discount-engine` passes  
- [ ] `DISCOUNT_ENGINE_V2_PRIORITY_MODE=SHADOW` keeps all eligible applied  
- [ ] `DISCOUNT_ENGINE_V2_PRIORITY_MODE=OFF` skips priority  
- [ ] `DISCOUNT_ENGINE_V2_PRIORITY_MODE=AUTHORITATIVE` limits ECOMMERCE to 1 auto promo  
- [ ] Policy validation failure falls back without throwing  
- [ ] Legacy production endpoints unchanged  
- [ ] No API / DB migrations  

---

*Phase 5B complete — ready for architecture review before Phase 6 (Stack Engine).*
