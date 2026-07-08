# Commercial Domain Migration Plan

**Status:** Analysis only — phased plan, no implementation  
**Principles:** Zero duplicated engines, zero duplicated UI, independent business configuration, no breaking changes

---

## Target state

```
SHARED                          PER DOMAIN (Services | E-Commerce)
─────────────────────────────────────────────────────────────────
Discount Engine V2              Promotions & coupons (row/table scope)
Settlement Engine               Policy bundle slices (businessRules + overrides)
Analytics Engine                Campaigns (domain column + API filter)
Campaign orchestrator           Analytics views (domain lock)
promotion-management-ui         Admin navigation surfaces
Policy Center UI (one)          Runtime effective policy (merged per domain)
```

---

## Phase 0 — Baseline (current)

**Already done:**

- `surface-config.ts` client filtering for Marketing vs E-Commerce admin UI
- `DiscountDomain` in resolver
- `priority/stack/limits.domains` in policy bundle
- Split vendor tables (`vendor_service_promotions` / `vendor_promotions`)
- Phase 9 analytics `?domain=`
- Campaign metadata.domain on create (UI)

**Known gaps:**

- Policy Center domain view not wired to editors
- Global `businessRules`
- Campaign list not server-filtered
- Platform coupons on shop checkout (E6)
- Campaign drawer missing `surface` prop

**Exit criteria:** Team agrees on target; no schema changes.

---

## Phase 1 — Policy Center domain scoping (no DB migration)

**Goal:** Operators edit the correct domain slice; simulator matches production domain.

| Task | Owner | Risk |
|------|-------|------|
| Pass `viewDomain` → config sections | admin-web | Low |
| Edit `bundle.*.domains[domain]` when view ≠ services default | admin-web | Low |
| Simulator: domain selector → `loadRuntimePolicy(domain)` | admin-web + API | Low |
| `GET /admin/discount-policy/runtime?domain=` | backend | Low |
| Document “global vs domain” in Policy Center header | admin-web | None |

**Backward compatible:** Existing bundle JSON without domain keys continues to use global only.

**Deploy:** admin-web + lambda (API only).

---

## Phase 2 — Per-domain business rules (additive JSON)

**Goal:** Services `BEST_OFFER_ONLY` independent of E-Commerce `PROMOTION_PLUS_COUPON`.

| Task | Owner |
|------|-------|
| Extend `BusinessRulesConfiguration` with optional `domains` map | backend + admin-web types |
| `mergeBusinessRulesForDomain()` in runtime-policy-loader | backend |
| Policy Center business rules section scoped by domain view | admin-web |
| Fingerprint includes domain-specific business rules | backend |
| Unit tests: SERVICE vs ECOMMERCE different applicationStrategy | backend |

**No migration file** — JSONB bundle is schemaless; publish validates shape.

**Backward compatible:** Missing `domains` → use global `businessRules` as today.

---

## Phase 3 — Campaign domain hardening

**Goal:** Independent campaign inventories per domain.

| Task | Owner |
|------|-------|
| Migration `1063_*`: `ALTER TABLE commercial_discount_campaigns ADD COLUMN IF NOT EXISTS domain TEXT` | db |
| Backfill: `UPDATE ... SET domain = metadata->>'domain'` | migration script |
| Index `idx_commercial_campaigns_domain` | migration |
| API: `?domain=SERVICE|ECOMMERCE` on list | backend |
| Server-set `domain` on create from authenticated surface | backend |
| Fix `CampaignDetailsDrawer` surface prop | admin-web |
| Align ecommerce campaign type registry with backend | admin-web |

**Backward compatible:** Nullable column; client filter remains until API deployed.

**Prod gate:** Apply migration before `CAMPAIGN_MODE=AUTHORITATIVE` on prod (if not already).

---

## Phase 4 — Promotion/coupon domain clarity (optional)

**Goal:** Reduce misclassification from heuristics.

| Task | When |
|------|------|
| Persist `discount_domain` on `promotions` / `coupons` (optional column) | Only if heuristic mis-fires in prod |
| Admin list `?domain=` filter | When row volume grows |
| Shop checkout: platform `coupons` table path (E6) | Product decision |

**Prefer:** Strong targeting validation (already shipped) over new columns.

---

## Phase 5 — Analytics & finance separation

**Goal:** Domain-clean reporting without duplicate analytics engine.

| Task | Owner |
|------|-------|
| Campaign analytics: query campaign links not top-promo proxy | backend |
| Finance export: `?domain=` on settlement reports | backend |
| E-Commerce hub: link to Promotion Analytics vs Marketplace Analytics | admin-web |
| Dashboard tiles scoped by surface | admin-web |

**No analytics schema change** if `discount_analytics_events` already stores domain (verify in Phase 9 tables).

---

## Phase 6 — Navigation & RBAC polish

| Task |
|------|
| E-Commerce subnav → Policy Center (`/promotion-center?tab=policy&domain=ecommerce`) |
| Optional `/ecommerce/promotion-center` hub mirroring Marketing |
| Centralize `promo-portal-nav.ts` |
| Permission: `admin.ecommerce` read-only policy view |

---

## Phase 7 — Advanced (only if business requires)

| Capability | Trigger |
|------------|---------|
| Independent publish per domain | Legal/ops needs separate approval workflows |
| Per-domain funding in policy bundle | Marketplace commission model diverges |
| Per-domain feature flag kill-switch | Incident isolation |

---

## Rollout & safety

### Feature flag sequence (dev → prod)

1. Phase 1–2 on dev; verify fingerprints per domain in Policy Center runtime tab
2. Phase 3 migration on dev RDS; test campaign list filters
3. `DISCOUNT_ENGINE_V2_*_MODE` remain **global** — no per-domain flag changes
4. Smoke tests:
   - Booking with coupon under SERVICE Best Offer
   - Cart with vendor promo under ECOMMERCE stack rules
   - Campaign orchestrate from each surface

### Breaking change avoidance

| Change | Mitigation |
|--------|------------|
| New bundle JSON keys | Fallback to global |
| Campaign domain column | Nullable + backfill |
| API filters | Optional query params |
| UI domain editor | Default view = services (current behavior) |

### Rollback

- Policy: rollback publish in Policy Center history
- Campaigns: domain column ignored if API not deployed
- UI: surface prop optional; defaults to marketing

---

## Effort estimate (rough)

| Phase | Engineering | QA |
|-------|-------------|-----|
| 1 Policy UI wiring | 3–5 days | 1 day |
| 2 Business rules per domain | 5–8 days | 2 days |
| 3 Campaign domain | 3–5 days | 1 day |
| 4 Promo domain (optional) | 2–5 days | 1 day |
| 5 Analytics | 3–5 days | 1 day |
| 6 Nav/RBAC | 2–3 days | 0.5 day |

**Total (Phases 1–3 minimum viable domain split):** ~3–4 weeks.

---

## Success metrics

- Services and E-Commerce can run different application strategies simultaneously
- Campaign lists return zero cross-surface rows without client filter
- Policy Center domain view edits persisted domain slice in bundle
- No second resolver deployment
- Existing promotions/coupons continue to resolve without re-migration
