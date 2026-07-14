# Policy Center Domain Analysis

**Status:** Analysis only  
**Related:** [DOMAIN_RUNTIME_POLICY_ANALYSIS.md](./DOMAIN_RUNTIME_POLICY_ANALYSIS.md)

---

## What Policy Center is

Policy Center configures **how** eligible offers compete at checkout—not **which** offers exist. It drives:

- Application strategy (`BEST_OFFER_ONLY`, `PROMOTION_PLUS_COUPON`, etc.)
- Winning strategy (`HIGHEST_CUSTOMER_SAVINGS`, etc.)
- Stack rules (vendor + platform, coupon phases)
- Priority and limits
- Funding split defaults
- Combination matrix

**UI:** `apps/admin-web/components/admin/marketing/policyCenter/PolicyCenter.tsx`  
**API:** `backend/lambda/src/endpoints/discount-policy.endpoints.ts`  
**Runtime:** `backend/lambda/src/discount-engine/policy/runtime-policy-loader.ts`

---

## How policy is stored

### Database (migration `1061_discount_policy_center_v2.sql`)

| Table | Role |
|-------|------|
| `discount_policy_draft` | Singleton row (`id='singleton'`) — work-in-progress JSONB bundle |
| `discount_policy_versions` | Published versions; one `status='active'` at a time |
| `discount_policy_audit` | Publish, rollback, simulate events |

### Bundle shape (`DiscountPolicyBundle`)

```typescript
{
  priority: PriorityConfiguration,    // global + domains[SERVICE|ECOMMERCE|...]
  stack: StackPolicyConfiguration,    // global + domains[...]
  funding: FundingConfiguration,      // shared (no domain map in types)
  limits: LimitConfiguration,         // global + domains[...] + campaigns[...]
  businessRules: BusinessRulesConfiguration  // GLOBAL — no domains key today
}
```

### Versioning

- **Yes** — each publish gets `publish_id`, `fingerprint`, `published_at`, `published_by`.
- **Single active publish** — `ORDER BY published_at DESC LIMIT 1 WHERE status='active'`.
- **Fingerprint** — SHA-256 over merged runtime policy (`runtime-policy-fingerprint.ts`); differs per `DiscountDomain` when domain overrides differ.

### Cache

In-process TTL cache (30s) in `policy-persistence.ts`; invalidated on publish.

---

## Is policy global?

| Config area | Global? | Per-domain override? |
|-------------|---------|----------------------|
| `businessRules.applicationStrategy` | **Yes** | **No** (gap) |
| `businessRules.winningStrategy` | **Yes** | **No** (gap) |
| `businessRules.combinationMatrix` | **Yes** | **No** |
| `priority.global` + `priority.domains[domain]` | Base global | **Yes** — merged in `mergePriorityForDomain` |
| `stack.global` + `stack.domains[domain]` | Base global | **Yes** — merged in `mergeStackForDomain` |
| `limits.global` + `limits.domains[domain]` | Base global | **Yes** — merged in `mergeLimitsForDomain` |
| `funding` | **Yes** | **No** in type definition |

**Runtime proof:** `runtime-policy-fingerprint.test.ts` asserts `SERVICE` and `ECOMMERCE` fingerprints **differ** when domain overrides exist in default bundle.

---

## Policy Center UI domain selector

`PolicyCenterDomainView` offers: `services` | `ecommerce` | `meals` | `pharmacy`.

**Critical finding:** `viewDomain` state is **not passed** to `PriorityConfigSection`, `StackConfigSection`, `LimitsConfigSection`, or `businessRules` editors. The selector is **cosmetic context** today—it does not scope which JSON paths are edited.

**Implication:** Operators may believe they are editing E-Commerce policy while mutating the global bundle.

---

## Runtime domain support

```typescript
loadRuntimePolicy(DiscountDomain.SERVICE | ECOMMERCE, options?)
```

Called from:

- `unified-discount-resolver.ts` — on every resolve
- `booking-promotion-service.ts` — booking quotes
- `policy-simulator.ts` — admin simulator
- `discount-policy.endpoints.ts` — diagnostics (currently loads `DiscountDomain.SERVICE` only for `/runtime` GET)

Resolver **already accepts domain** as runtime context. No resolver rewrite required—**configuration extension** only.

---

## Can multiple runtime policies exist?

| Interpretation | Answer |
|----------------|--------|
| Multiple published bundles per domain | **No** — one active `discount_policy_versions` row |
| Different effective policy per domain | **Partially** — via `domains` overrides in priority/stack/limits |
| Services v3 while E-Commerce v2 | **Not independently** — single publish bumps all domains; overrides version together |
| Per-domain publish IDs | **No** — one `publishId` on runtime policy |

---

## Would Services and E-Commerce conflict today?

**Yes, in these scenarios:**

1. **Global Best Offer Only** — If Services needs `BEST_OFFER_ONLY` but E-Commerce needs `PROMOTION_PLUS_COUPON`, they **cannot** diverge today (`businessRules` is global).

2. **Shared funding** — Platform/vendor split applies to both domains.

3. **UI domain switcher** — Misleading; edits affect all domains.

4. **Simulator default** — May not pass `DiscountDomain.ECOMMERCE` when operator tests marketplace cart.

**No conflict** where domain overrides already differ (e.g. SERVICE `maxAutoPromotions: 2` vs ECOMMERCE `maxAutoPromotions: 1` in default config)—engine merges correctly.

---

## Dependencies (every consumer)

| Consumer | Uses policy via |
|----------|-----------------|
| Unified discount resolver | `loadRuntimePolicy(context.domain)` |
| Booking promotion service | `loadRuntimePolicy(SERVICE)` |
| Cart promotion engine | `loadRuntimePolicy(ECOMMERCE)` |
| Policy simulator (admin) | Draft bundle + resolver |
| Commercial campaign orchestration | `policy_fingerprint` on campaign row |
| Settlement engine | `loadRuntimePolicy(domain).funding` |
| Customer checkout | Indirect via calculate-booking / calculate-cart |
| Feature flags | Global env vars gate engine modes (not in bundle) |

---

## Recommendation: global vs domain-specific Policy Center

### Do not keep Policy Center fully global

Business rules that define **winning offer behavior** must become **domain-scoped** in the bundle:

```typescript
businessRules: {
  global: { ... },  // optional defaults
  domains: {
    SERVICE: { applicationStrategy, winningStrategy, combinationMatrix },
    ECOMMERCE: { ... }
  }
}
```

### Do keep one Policy Center UI

- Extend sections to edit `bundle.priority.domains[ECOMMERCE]` when domain view = E-Commerce.
- Wire `PolicyCenterDomainView` → section props.
- Simulator must pass selected domain to `simulatePolicyWithResolver`.

### Do keep one publish workflow (initially)

- Single publish atomically updates all domain slices.
- Future: optional per-domain publish with merged effective policy (higher complexity).

### Funding

- Evaluate per-domain funding overrides only if marketplace commission model diverges from services; otherwise shared funding is acceptable.

---

## Required changes (analysis level)

| Priority | Change | Breaking? |
|----------|--------|-----------|
| P0 | Pass `viewDomain` into config sections; edit `domains[domain]` paths | No |
| P0 | Extend `businessRules` with per-domain map | No (additive JSON) |
| P1 | `/admin/discount-policy/runtime?domain=ECOMMERCE` | No |
| P1 | Simulator domain parameter | No |
| P2 | Per-domain publish history labels | No |
| P3 | Separate active publish per domain | Only if business requires independent version lines |
