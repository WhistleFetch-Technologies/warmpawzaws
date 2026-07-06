# Phase 8 — Production Migration Plan

**Date:** 2026-07-06  
**Scope:** Step-by-step strategy to make Discount Engine V2 authoritative in production  
**Prerequisite docs:** `PHASE8_CURRENT_STATE.md`, `LEGACY_COMPONENT_INVENTORY.md`, `RESOLVER_MATRIX.md`, `STACK_POLICY.md`

---

## 1. Goals

1. Single authoritative discount path at **HTTP layer** for all S1–E6 scenarios (or documented exclusions).
2. Feature-flagged cutover with **shadow → authoritative** per domain (service booking, ecommerce, coupons).
3. Unified usage recording from V2 resolver.
4. Settlement preview persisted on all new transactions when settlement authoritative.
5. Zero customer-visible regression on amounts, GST, and vendor payouts.

---

## 2. Prerequisites (must complete before cutover)

| # | Prerequisite | Owner | Verification |
|---|--------------|-------|--------------|
| P1 | Dev/staging Lambda env: all `DISCOUNT_ENGINE_V2_*_MODE` flags documented in SSM/Terraform | Infra | `aws lambda get-function-configuration` |
| P2 | Implement `DISCOUNT_ENGINE_V2_RESOLVER_MODE` or `discount_engine_v2_authoritative` HTTP swap | Backend | Unit + integration tests |
| P3 | RESOLVER_MATRIX rows S1–E6 shadow parity signed off | Backend + QA | CloudWatch compare dashboards |
| P4 | Fix S5: booking `coupon_code` → resolver coupon phase | Backend | Integration test |
| P5 | Fix E6: shop checkout → `coupons` table or deprecate platform shop coupons | Product + Backend | E2E shop checkout |
| P6 | Fix S3/S4: replace inline validate-code math with resolver | Backend | Code path audit |
| P7 | Fix `GET /admin/promotions` route shadowing | Backend | Admin list returns full rows |
| P8 | Admin wizard targeting persistence verified on dev RDS | Backend | POST/PUT round-trip |
| P9 | Migration `1046_commercial_discount_campaigns.sql` applied prod (if campaigns in scope) | DBA | migrate status |
| P10 | Rollback runbook tested on dev | Ops | Flag OFF restores legacy amounts |

---

## 3. Recommended execution order

### Wave 0 — Infrastructure & observability (1–2 weeks)

1. Add Terraform/SSM parameters for all V2 mode flags (default OFF in prod).
2. Add CloudWatch metric filters on `[discount-resolver]` log keys: `priorityAuthoritative`, `stackAuthoritative`, `settlementAuthoritative`, mismatch counters from shadow layers.
3. Create dev dashboard: legacy amount vs resolver amount delta by label.
4. Document baseline legacy behaviour snapshots (golden tests from integration suite).

### Wave 1 — Shadow parity hardening (2–3 weeks)

1. Set dev Lambda: `PRIORITY_MODE=AUTHORITATIVE`, `STACK_MODE=SHADOW`, `SETTLEMENT_MODE=SHADOW`.
2. Run full regression: vendor functional + customer functional + booking/ecommerce E2E.
3. Close matrix gaps: S5, S6, E6, S3 inline paths.
4. Wire inline handlers through `buildDiscountContext` + at minimum shadow compare.
5. Implement usage tracker DB writes in resolver (behind flag, dry-run first).

### Wave 2 — Resolver authoritative (dev only) (2 weeks)

1. Implement `isResolverAuthoritative()` + HTTP adapter:
   - `resolveBookingPromotions` returns resolver when flag ON and resolver success.
   - Fallback to legacy on resolver error (log `RESOLVER_FALLBACK`).
2. Cut over **read-only quote endpoints first:**
   - `POST /promotions/calculate-booking`
   - `POST /customer/pricing/quote`
   - `POST /promotions/calculate-cart`
3. Compare 100% sample in SHADOW log for 1 week on dev.
4. Cut over **validate endpoints:**
   - `POST /promotions/validate-code`
   - `GET/POST /coupons/*`

### Wave 3 — Write path & settlement (2 weeks)

1. Booking create + order create: persist resolver `ResolverResult` into `wp_financial_meta` including settlement preview.
2. Enable `SETTLEMENT_MODE=AUTHORITATIVE` on dev; verify `vendor-earnings-on-completion` uses hook bridge.
3. Reconcile payout reports vs pre-cutover baseline for 50 bookings + 50 orders.
4. Enable `STACK_MODE=AUTHORITATIVE` on dev after stack audit matches legacy stack within ₹1.

### Wave 4 — Production canary (1 week)

1. Prod Lambda: all modes OFF (baseline).
2. Prod: `PRIORITY_MODE=SHADOW`, `STACK_MODE=SHADOW` only — no customer impact.
3. Prod: enable resolver authoritative for **calculate-booking only** at 5% traffic (if API Gateway/Lambda alias supports; else dev-equivalent UAT window).
4. Monitor error rates, support tickets, payment amount disputes.

### Wave 5 — Full production cutover

1. Prod authoritative: quotes → validate → booking/order create.
2. Disable legacy shadow compare (or reduce to sample) after 7 clean days.
3. Enable analytics `AUTHORITATIVE` for admin dashboards.
4. Optional: campaign `SHADOW` then `AUTHORITATIVE` if commercial campaigns required.

### Wave 6 — Legacy decommission (post-stabilization)

See `PHASE8_TECHNICAL_DEBT.md` — orphan UI, dead routes, `platform_promotions` migration.

---

## 4. Endpoint migration order

| Priority | Endpoint | Matrix rows | Rationale |
|----------|----------|-------------|-----------|
| 1 | `POST /promotions/calculate-booking` | S1, S2 | Highest customer visibility; read-only |
| 2 | `POST /customer/pricing/quote` | S1, S2 | Same engine path |
| 3 | `GET /promotions/applicable` | S1, S2 preview | Listing support |
| 4 | `POST /promotions/calculate-cart` | E1, E2 | Shop preview |
| 5 | `POST /promotions/validate-code` | S3–S6, E2, E5 | Code entry |
| 6 | `GET /coupons/validate/:code` | S5, E6 | Legacy alias — deprecate after #5 |
| 7 | `POST /coupons/apply` | S5, E6 | Usage recording |
| 8 | Booking create validation | S1, S2, S5 | Write path |
| 9 | Ecommerce order create | E1–E3 | Write path |
| 10 | `POST /promotions/apply` | S4, E5 | Consolidate duplicate handlers |
| 11 | Admin stats | — | Analytics enrichment already partial |

**Not in scope for initial cutover:** Admin CRUD, vendor CRUD (unchanged persistence), notification campaigns.

---

## 5. Feature flag rollout sequence

```
Stage 0 (prod today):     All OFF / PRIORITY authoritative in resolver only (no HTTP effect)
Stage 1:                  PRIORITY=SHADOW, STACK=SHADOW, SETTLEMENT=OFF — prod logs
Stage 2:                  RESOLVER=SHADOW (new flag) — dual compute, legacy return
Stage 3:                  RESOLVER=AUTHORITATIVE on quote endpoints only (dev → prod)
Stage 4:                  STACK=AUTHORITATIVE
Stage 5:                  SETTLEMENT=AUTHORITATIVE
Stage 6:                  RESOLVER=AUTHORITATIVE all endpoints
Stage 7:                  ANALYTICS=AUTHORITATIVE
Stage 8:                  CAMPAIGN=SHADOW → AUTHORITATIVE (optional)
Stage 9:                  Remove legacy fallback flag (maintenance window)
```

---

## 6. Data migration tasks

| Task | Action | When |
|------|--------|------|
| `platform_promotions` | Migrate rows to `promotions` or `coupons`; remove apply handler query | Before Stage 6 |
| Category/style slug map | Central config service or normalizer | Before admin cutover |
| Historical bookings | No recalculation; keep `wp_financial_meta` fallback | N/A |
| Commercial campaigns | Apply migration 1046 on prod | Before campaign Stage 8 |

---

## 7. Testing strategy

| Layer | Tests |
|-------|-------|
| Unit | Existing `discount-engine/**/__tests__` — keep green |
| Integration | `stack-engine.integration.test.ts`, `priority-authoritative.integration.test.ts`, `settlement-engine.integration.test.ts` |
| Parity | Golden files: legacy vs resolver for 20 booking + 20 cart fixtures |
| E2E | Customer payment flow, shop checkout, vendor promo create + customer redeem |
| Financial | Settlement report diff pre/post for same synthetic orders |
| Load | Quote endpoints under peak — resolver adds DB candidate load |

---

## 8. Success criteria (Phase 8 complete)

- [ ] All quote/validate/checkout paths return resolver amounts when `RESOLVER_MODE=AUTHORITATIVE`.
- [ ] Shadow mismatch rate < 0.1% on dev for 14 days (excluding known exclusions).
- [ ] No increase in payment verification failures or refund disputes.
- [ ] `promotion_usages` / `coupon_usages` written from V2 usage tracker.
- [ ] Settlement preview on new bookings/orders; vendor earnings reconcile within ₹1.
- [ ] Rollback tested: flag OFF restores legacy within 5 minutes without deploy.
- [ ] Admin analytics dashboard shows data with `ANALYTICS_MODE=AUTHORITATIVE`.
- [ ] Documentation updated; `PROMOTION_SYSTEM_STATUS.md` refreshed.

---

## 9. Out of scope (Phase 8B vs later)

| Item | Phase |
|------|-------|
| Unified public `/discounts` API | 11 |
| Registry HTTP wiring | 13 |
| Marketing Hub UI consolidation | UX post-cutover |
| Policy admin publish UI → SSM | 8B optional |
| Mass migration of old booking financial snapshots | Optional |

---

## 10. Team RACI (suggested)

| Area | Responsible | Accountable |
|------|-------------|-------------|
| Resolver HTTP swap | Backend lead | Principal engineer |
| Infra flags | DevOps | Backend lead |
| QA parity | QA | Product |
| Settlement reconciliation | Finance + Backend | Finance |
| Prod cutover go/no-go | Product + Engineering | CTO/EM |
| Rollback execution | On-call | DevOps |

---

*Phase 8A artifact — local only, not committed.*
