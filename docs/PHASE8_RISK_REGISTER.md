# Phase 8 — Risk Register

**Date:** 2026-07-06  
**Review cadence:** Weekly during migration; daily during cutover window

---

## Risk scoring

| Probability | Definition |
|-------------|------------|
| **High (H)** | >30% without mitigation |
| **Medium (M)** | 10–30% |
| **Low (L)** | <10% |

| Impact | Definition |
|--------|------------|
| **Critical (C)** | Wrong customer charge, payout loss, regulatory/GST issue |
| **High (H)** | Major feature broken, widespread support load |
| **Medium (M)** | Subset of flows, workaround exists |
| **Low (L)** | Internal/admin only |

---

## Register

| ID | Risk | Probability | Impact | Mitigation | Owner | Rollback |
|----|------|-------------|--------|------------|-------|----------|
| R01 | **HTTP authoritative flag not implemented** — cutover blocked or ad-hoc | H | H | Phase 8B implement `RESOLVER_MODE`; code review gate | Backend | N/A — pre-cutover |
| R02 | **Legacy vs V2 amount mismatch** on production bookings | M | C | Shadow parity 14d; golden tests; ₹1 tolerance alerts | Backend + QA | RESOLVER OFF |
| R03 | **S5 — booking coupon ignored** in stack even after partial fix | M | H | Explicit matrix row closure; integration tests | Backend | RESOLVER OFF |
| R04 | **E6 — shop platform coupon not wired** | M | M | Product decision: implement or exclude from cutover scope | Product | Per-domain OFF |
| R05 | **S3 validate-code inline math** diverges from full engine | M | H | Route validate-code through resolver | Backend | RESOLVER OFF |
| R06 | **Stack order wrong** (platform before vendor) | L | C | Stack integration tests; STACK SHADOW first | Backend | STACK OFF |
| R07 | **Settlement preview wrong** → vendor under/over paid | M | C | SETTLEMENT SHADOW; finance sample reconciliation | Finance + Backend | SETTLEMENT OFF |
| R08 | **Feature flags only in Lambda console** — drift prod/dev | M | H | Terraform/SSM source of truth | DevOps | Config revert |
| R09 | **`GET /admin/promotions` shadowed** — admin operates on wrong data | H | M | Fix handler registration order before cutover | Backend | Deploy fix |
| R10 | **Duplicate POST /promotions/apply** — unpredictable behaviour | M | M | Consolidate handlers; document active handler | Backend | Deploy fix |
| R11 | **`platform_promotions` legacy table** stale codes still redeemable | L | M | Data migration + remove query | Backend | Keep legacy query |
| R12 | **Category/style slug mismatch** — promos don't apply | M | M | Central normalizer; admin catalog alignment | Backend + Admin UX | Legacy targeting |
| R13 | **Admin wizard vs marketing modal** different targeting fidelity | M | M | Sprint A persistence verify; single canonical API | Admin UX | Use /marketing path |
| R14 | **Resolver DB load** — candidate queries slow checkout | M | H | Load test; index review; caching layer Phase 8B+ | Backend | RESOLVER OFF |
| R15 | **Usage double-count** if both legacy and V2 write usages | M | M | Single writer flag; idempotent usage keys | Backend | Disable V2 usage |
| R16 | **Pre-wp_financial_meta bookings** incomplete breakdown | H | L | Document fallback; no recalc | Support | N/A |
| R17 | **Razorpay amount mismatch** on create vs verify | L | C | Existing financialMeta fixes; re-verify post-cutover | Backend | RESOLVER OFF |
| R18 | **Analytics AUTHORITATIVE exposes wrong aggregates** | M | L | Analytics SHADOW first; compare to legacy stats | Backend | ANALYTICS OFF |
| R19 | **Campaign engine materializes duplicate promos** | L | M | Idempotent campaign links; CAMPAIGN SHADOW | Backend | CAMPAIGN OFF |
| R20 | **Migration 1046 not on prod** — campaign features fail | M | M | Apply migration per user rule before prod campaign | DBA | CAMPAIGN OFF |
| R21 | **Rollback flag delay** — Lambda warm instances | L | H | Document cold/warm; increase concurrency refresh | DevOps | Wait 2 min + verify |
| R22 | **No per-endpoint rollback** — must disable all resolver | M | M | Design granular flags in 8B | Backend | Full RESOLVER OFF |
| R23 | **GST breakdown wrong** after discount change | L | C | PriceBreakdown E2E; snapshot validation | Backend + QA | RESOLVER OFF |
| R24 | **Vendor promo ID space ≠ admin catalog ID** — cross-vendor promos break | M | M | Document; engine resolves at booking time by vendor_service id | Backend | N/A |
| R25 | **CloudWatch log volume cost** during SHADOW | M | L | Sample rate; log retention policy | DevOps | Reduce shadow |
| R26 | **Team assumes PROMOTION_SYSTEM_STATUS.md current** — phases 6–10 done in code but doc stale | H | M | This Phase 8A doc set; refresh status doc in 8B | EM | N/A |
| R27 | **Auth gap on /marketing/promotions** — unauthenticated admin writes | M | H | Add admin guard before cutover | Security | Block route |
| R28 | **Insurance/regression test gap** on combo/loyalty/bundle types | M | H | Fixture per promotion_type enum | QA | RESOLVER OFF |

---

## Top 5 risks (prioritized)

1. **R02** — Amount mismatch at cutover (C impact)
2. **R07** — Settlement / payout incorrect (C impact)
3. **R01** — Missing HTTP authoritative implementation (blocks safe cutover)
4. **R03 + R05** — Coupon and validate-code paths incomplete
5. **R09** — Admin route shadowing operational confusion

---

## Risk acceptance (documented exclusions)

| Exclusion | Accepted by | Notes |
|-----------|-------------|-------|
| E4 — platform auto promo on shop cart | Product | May remain out of scope per RESOLVER_MATRIX |
| Old bookings without financial snapshot | Product | Fallback display only |
| Phase 11 unified `/discounts` API | Engineering | Deferred post-cutover |

---

## Monitoring-linked risks

| Risk | Metric |
|------|--------|
| R02 | Shadow mismatch counter |
| R14 | p99 latency on calculate-booking |
| R17 | Razorpay verify 4xx/5xx rate |
| R07 | vendor_earnings delta report |

---

*Phase 8A artifact — local only, not committed.*
