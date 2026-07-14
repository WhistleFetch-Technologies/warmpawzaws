# Phase 8 — Technical Debt Register

**Date:** 2026-07-06  
**Scope:** Remaining debt before, during, and after Discount Engine V2 production cutover  
**Prioritization:** P0 (cutover blocker) → P3 (nice cleanup)

---

## Summary by priority

| Priority | Count | Theme |
|----------|-------|-------|
| **P0** | 8 | Cutover blockers, financial correctness |
| **P1** | 12 | Shadow parity, API correctness, security |
| **P2** | 15 | Duplication, orphan UI, bridge removal post-cutover |
| **P3** | 10 | Dead code, docs, naming |

---

## P0 — Cutover blockers

| ID | Item | Location | Cleanup after migration |
|----|------|----------|-------------------------|
| TD-P0-01 | HTTP resolver authoritative flag not implemented | Phase 8B new | Flag becomes primary control |
| TD-P0-02 | RESOLVER_MATRIX S5 booking coupon gap | booking-promotion-service | Close row |
| TD-P0-03 | RESOLVER_MATRIX E6 shop coupon gap | ecommerce checkout | Wire or exclude |
| TD-P0-04 | Inline validate-code math (S3/S4) | vendor-promotions.ts, promotions.ts | Route through resolver |
| TD-P0-05 | V2 flags not in Terraform/SSM | infra/ | IaC parameters |
| TD-P0-06 | Usage tracker metadata-only (no DB) | usage-preparation.ts | Implement UsageTracker writes |
| TD-P0-07 | `discount_engine_v2_authoritative` design-only | STACK_POLICY.md | Implement or rename to RESOLVER_MODE |
| TD-P0-08 | Stack/settlement prod defaults untested together | Lambda env | Staged rollout |

---

## P1 — High (pre/post cutover)

| ID | Item | Location | Notes |
|----|------|----------|-------|
| TD-P1-01 | Dual admin promotion APIs | /marketing vs /admin | Consolidate POST handler |
| TD-P1-02 | GET /admin/promotions route shadowing | handler/index.ts order | Fix registration |
| TD-P1-03 | Duplicate POST /promotions/apply | promotions.ts | Merge handlers |
| TD-P1-04 | platform_promotions table + query | promotions.ts, migration 306 | Data migration |
| TD-P1-05 | Rule engine always shadow | rules/shadow-adapters | Make authoritative post-parity |
| TD-P1-06 | Benefit compare ±₹1 fallback | benefits/compare.ts | Remove after cutover |
| TD-P1-07 | /marketing/promotions no admin auth | promotions.ts | Security |
| TD-P1-08 | Category/style slug inconsistency | UI + backend scattered | Central config |
| TD-P1-09 | Admin service ID vs vendor service ID spaces | catalog loaders | Document in engine |
| TD-P1-10 | discountCalculationService.couponCode unused | discount-calculation-service | Wire or remove param |
| TD-P1-11 | PROMOTION_SYSTEM_STATUS.md stale (phases 6–10) | docs/ | Refresh in 8B |
| TD-P1-12 | Per-endpoint rollback flags missing | Phase 8B design | Granular control |

---

## P2 — Medium (post-cutover cleanup)

| ID | Item | Location |
|----|------|----------|
| TD-P2-01 | production-bridge fire-and-forget | production-bridge.ts → direct resolve |
| TD-P2-02 | legacy-stack-adapter coexistence-only | legacy-stack-adapter.ts |
| TD-P2-03 | CompositeDiscountCalculator | adapters/composite-discount-calculator.ts |
| TD-P2-04 | Legacy service/ecommerce calculator adapters | adapters/legacy-*.ts |
| TD-P2-05 | shadow-adapters + rules/shadow.ts | rules/adapters/ |
| TD-P2-06 | priority-shadow.ts deprecated | resolver/priority-shadow.ts |
| TD-P2-07 | getDiscountEngineRegistry unused | di/discount-engine-container.ts |
| TD-P2-08 | AdvancedPromotionsEngine orphan | admin-web |
| TD-P2-09 | PromotionsManagement ecommerce orphan | admin-web |
| TD-P2-10 | Vendor wrapper components | ServicePromotionsManagement.tsx |
| TD-P2-11 | GET /coupons/validate legacy alias | promotions.ts — deprecate |
| TD-P2-12 | GET /ecommerce/promotions/active alias | promotions.ts |
| TD-P2-13 | Unregistered endpoint mirror files | endpoints/*.ts duplicates |
| TD-P2-14 | Two PromotionCard component names | customer vs management-ui |
| TD-P2-15 | Marketing Hub vs /promotions dual sidebar | admin nav consolidation |

---

## P3 — Low (opportunistic)

| ID | Item | Location |
|----|------|----------|
| TD-P3-01 | apps/customer-web/lib/promotions-engine.ts dead | customer-web |
| TD-P3-02 | ComingSoonSection placeholders | promotion-management-ui |
| TD-P3-03 | Vendor segments audience “coming soon” | PromotionWizard |
| TD-P3-04 | Policy simulator not built | admin future |
| TD-P3-05 | /reports sidebar with no page | admin-web |
| TD-P3-06 | Notification campaign analytics UI missing | admin |
| TD-P3-07 | BookingConfirmationSavings not on all routers | customer-web |
| TD-P3-08 | Service discovery not on MarketplaceCard | customer-web |
| TD-P3-09 | Phase 11 /discounts API deferred | backend |
| TD-P3-10 | Phase 13 registry HTTP wiring deferred | backend |

---

## Engine dependency debt

```
Current (pre-cutover):
  Legacy engines ──shadow──► V2 resolver (logs only)
  Legacy engines ──amount──► Customer HTTP response
  Settlement hooks ◄── optional preview (SETTLEMENT OFF)

Target (post-cutover):
  HTTP ──► UnifiedDiscountResolver ──► response
  Legacy engines ──fallback──► (flag OFF only)
  Settlement hooks ◄── authoritative preview
  Analytics ◄── resolver audit trail
  Campaign ◄── promotion-bridge (materialize only)
```

**Remaining legacy dependencies in V2 (intentional bridges):**

| V2 module | Still depends on legacy |
|-----------|-------------------------|
| Benefit adapters | legacyAmount compare |
| Candidate providers | Same DB tables + query patterns as legacy loaders |
| Legacy stack adapter | Used when STACK_MODE ≠ AUTHORITATIVE |
| settlement-hook-bridge | Reads meta shape produced by booking-promotion-service |
| promotion-bridge | Uses promotion-admin-persistence |

---

## Documentation debt

| Document | Issue | Action |
|----------|-------|--------|
| PROMOTION_SYSTEM_STATUS.md | Says Phase 6–10 not started | Update after 8B |
| RESOLVER_MATRIX.md | Checklist all open | Mark rows as cutover completes |
| STACK_POLICY.md | Flags named differently than env vars | Alignment table in 8B |
| Phase 6–10 reports | "Complete local, not committed" | Verify committed state on branch |

---

## Database cleanup candidates (post-migration)

| Table / column | When safe |
|----------------|-----------|
| `platform_promotions` | After data migration + 90d no queries |
| Duplicate indexes on promotion codes | After usage audit |
| Orphan commercial_campaign links | After campaign stable |

---

## Cleanup sprint recommendation (post-cutover +30d)

**Week 1:** P0 verification, remove dead client engine, fix route shadowing  
**Week 2:** Remove shadow adapters behind `LEGACY_SHADOW_ENABLED=false`  
**Week 3:** Admin UI consolidation (/marketing promo tab → /promotions)  
**Week 4:** platform_promotions migration, delete orphan components, registry decision  

---

## Debt intentionally retained

| Item | Reason |
|------|--------|
| promotion-admin-persistence.ts | Normalization layer for API compat |
| settlement-hook-bridge.ts | Permanent earnings integration |
| context-mappers.ts | HTTP ↔ DiscountContext boundary |
| Shared promotion DB tables | Single source of truth — not duplicated for V2 |

---

*Phase 8A artifact — local only, not committed.*
