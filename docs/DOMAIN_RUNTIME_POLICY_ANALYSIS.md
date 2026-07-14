# Domain Runtime Policy Analysis

**Status:** Analysis only  
**Covers:** Investigations 7 (Discount Resolver), 8 (Runtime Policy), 12 (Feature Flags)

---

## Runtime policy resolution flow

```
discount_policy_versions (status=active)
        │
        ▼
loadPublishedBundle()  ──►  DiscountPolicyBundle (JSON)
        │
        ▼
loadRuntimePolicy(DiscountDomain, { draft?, publishId? })
        │
        ├── mergePriorityForDomain(bundle.priority, domain)
        ├── mergeStackForDomain(bundle.stack, domain)
        ├── mergeLimitsForDomain(bundle.limits, domain)
        ├── ensureBusinessRules(bundle.businessRules)  ← GLOBAL today
        └── ensureFunding(bundle.funding)              ← GLOBAL
        │
        ▼
RuntimePolicy { priority, stack, funding, limits, businessRules, publishId, fingerprint }
        │
        ▼
UnifiedDiscountResolver.resolve(context)
```

**Entry:** `backend/lambda/src/discount-engine/policy/runtime-policy-loader.ts`

---

## Investigation 7 — Discount Resolver

### Can resolver accept domain as runtime context?

**Yes — already required.**

`DiscountResolutionContext` includes `domain: DiscountDomain`. All resolution paths set:

| Path | Domain |
|------|--------|
| `resolveBookingPromotions` | `SERVICE` |
| `calculateBestCartPromotion` | `ECOMMERCE` |
| `validate-code` | From `orderType` |
| Policy simulator | Should pass operator-selected domain |

### Rewrite vs configuration?

| Need | Approach |
|------|----------|
| Different stack rules per domain | **Configuration** — `stack.domains[ECOMMERCE]` |
| Different limits per domain | **Configuration** — `limits.domains[ECOMMERCE]` |
| Different Best Offer per domain | **Configuration extension** — `businessRules.domains[...]` |
| Different funding per domain | **Configuration extension** (optional) |
| Second resolver codebase | **Not required** |

### Independent discount application per domain

| Capability | Independent without duplicate resolver? |
|------------|----------------------------------------|
| Winning strategy | **After** businessRules per-domain |
| Funding | Mostly shared; optional domain override |
| Limits | **Yes** — already in bundle |
| Validation / rejection messages | **Yes** — same resolver, domain-specific policy |
| Stack / coupon phases | **Yes** — already in bundle |

### Resolver modes (global feature flags)

`DISCOUNT_ENGINE_V2_RESOLVER_MODE` — `OFF` | `SHADOW` | `AUTHORITATIVE`

When `OFF`, legacy paths in `booking-promotion-service` and cart engine bypass unified resolver.

---

## Investigation 8 — Single vs multiple runtime policies

### Today

| Question | Answer |
|----------|--------|
| Single runtime policy bundle? | **Yes** — one active publish |
| Multiple effective policies? | **Partial** — domain merge on priority/stack/limits |
| Services publish v3, E-Commerce stays v2? | **No** — one version number for entire bundle |
| Draft vs published | Draft in `discount_policy_draft`; publish copies to `discount_policy_versions` |
| Rollback | Deactivates current active; promotes prior version |

### Path to independent version lines (if required)

**Option A — Recommended:** One publish, domain slices in bundle  
- `bundle.version` + per-domain override timestamps in metadata  
- Operators publish once; changelog lists domain-affected sections  

**Option B — Advanced:** `discount_policy_versions` gains `domain` column; multiple active rows  
- `loadRuntimePolicy(domain)` selects active row for that domain  
- Higher operational complexity; only if legal/compliance requires independent approval  

**Option C — Services v3 / E-Commerce v2 without schema change**  
- Use domain overrides only; global `businessRules` still shared — **insufficient** for divergent application strategies  

---

## Investigation 12 — Feature flags

### Commercial engine flags (Lambda env)

| Variable | Purpose | Per-domain today? |
|----------|---------|-------------------|
| `DISCOUNT_ENGINE_V2_RESOLVER_MODE` | Unified resolver rollout | **Global** |
| `DISCOUNT_ENGINE_V2_PRIORITY_MODE` | Priority engine | **Global** |
| `DISCOUNT_ENGINE_V2_STACK_MODE` | Stack engine | **Global** |
| `DISCOUNT_ENGINE_V2_SETTLEMENT_MODE` | Settlement engine | **Global** |
| `DISCOUNT_ENGINE_V2_ANALYTICS_MODE` | Analytics emission | **Global** |
| `DISCOUNT_ENGINE_V2_CAMPAIGN_MODE` | Campaign API/orchestration | **Global** |
| `DISCOUNT_ENGINE_V2_PRIORITY_SHADOW` | Legacy shadow (deprecated path) | **Global** |

### Admin UI flags

| Variable | Purpose |
|----------|---------|
| `ENABLE_LEGACY_PROMOTION_UI` | Redirect old routes to Promotion Center |
| `NEXT_PUBLIC_ENABLE_LEGACY_PROMOTION_UI` | Client-side mirror |

### Recommendation: flags global vs per-domain

| Flag type | Recommendation |
|-----------|----------------|
| Engine rollout (`*_MODE`) | **Stay global** — one resolver binary; shadow/authoritative is infra rollout |
| Business behavior (Best Offer, stack rules) | **Policy bundle per domain** — not env flags |
| Campaign enablement | **Global** `CAMPAIGN_MODE`; domain split is data |
| Future kill-switch per domain | Optional SSM map `DISCOUNT_ENGINE_V2_MODES_BY_DOMAIN` — **only if** ops need to disable ecommerce resolver without services |

**Anti-pattern:** Using env vars for business rules that differ between Services and E-Commerce—belongs in Policy Center bundle.

---

## Settlement engine sharing

`settlement-engine.ts` uses `loadRuntimePolicy(domain).funding` for split hints.

**One settlement engine** serves both domains. Domain-specific settlement **reporting** filters by `booking_id` vs `order_id` in usage tables—not separate engines.

---

## Analytics engine sharing

Phase 9 endpoints accept `?domain=SERVICE|PRODUCT|MEAL|PHARMACY|PACKAGE|ECOMMERCE`.

`MarketingAnalyticsHub` locks `surface="ecommerce"` → `PRODUCT` domain.

**One analytics engine** — domain is a query dimension.

---

## Required changes summary

| Area | Change | Effort |
|------|--------|--------|
| `businessRules` schema | Add `domains` map | Medium |
| Policy Center UI | Wire domain view to editors | Medium |
| Runtime API | `?domain=` on `/runtime` | Low |
| Feature flags | No change for business split | — |
| Resolver code | No rewrite | — |
| Independent publish per domain | Optional schema + loader | High |

---

## Answers to key questions

1. **Can runtime policy load per domain?** Yes — `loadRuntimePolicy(domain)` today; business rules not yet domain-scoped.

2. **Can Services and E-Commerce have independent winning strategy without duplicate resolver?** Yes, after `businessRules.domains` extension.

3. **Should runtime flags remain global?** Yes for rollout modes; business config belongs in policy bundle.

4. **Can Services publish v3 while E-Commerce remains v2?** Not with current single-active-publish model; achievable with Option B or by treating version as bundle-level with domain-only override sections (same publish ID, different effective config).
