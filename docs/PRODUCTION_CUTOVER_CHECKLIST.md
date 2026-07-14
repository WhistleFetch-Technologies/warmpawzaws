# Production Cutover Checklist — Discount Engine V2

**Date:** 2026-07-06  
**Related:** `PHASE8_MIGRATION_PLAN.md`, `ROLLBACK_PLAN.md`, `PHASE8_RISK_REGISTER.md`

---

## Pre-cutover (T-14 to T-1 days)

### Code & tests

- [ ] `DISCOUNT_ENGINE_V2_RESOLVER_MODE` (or equivalent HTTP authoritative flag) implemented and reviewed
- [ ] RESOLVER_MATRIX S1–E6 integration tests passing in CI
- [ ] S5 booking coupon wired and tested
- [ ] E6 shop coupon path decided and implemented OR documented exclusion
- [ ] S3 validate-code uses resolver benefit path
- [ ] Duplicate `POST /promotions/apply` consolidated
- [ ] `GET /admin/promotions` shadowing fixed
- [ ] Usage tracker writes tested on dev (dry-run → live)
- [ ] `backend/lambda npm run build` clean
- [ ] `npm run test:navigation` if customer nav touched (N/A if backend-only)

### Data & migrations

- [ ] `1046_commercial_discount_campaigns.sql` applied on **dev** RDS
- [ ] Prod migration plan for 1046 approved (if campaigns in cutover scope)
- [ ] `platform_promotions` row count audited; migration script ready
- [ ] Backup of `promotions`, `coupons`, `vendor_*_promotions` tables scheduled

### Infrastructure

- [ ] SSM/Terraform parameters created for all V2 flags (prod default OFF)
- [ ] Lambda env change procedure documented (no console-only drift)
- [ ] CloudWatch dashboards: resolver diagnostics, shadow mismatch, error rate
- [ ] Alerts: `[discount-resolver] pipeline failed`, payment verify failures, settlement batch errors
- [ ] On-call roster assigned for cutover window

### UAT / parity

- [ ] Dev: 14-day shadow log review — mismatch catalog documented
- [ ] Golden parity: 40 fixtures legacy vs resolver within ₹1
- [ ] Customer regression sprint flows re-run on dev with RESOLVER authoritative
- [ ] Vendor promo create → customer redeem E2E on dev
- [ ] Shop cart + coupon E2E on dev
- [ ] Settlement: 10 bookings earnings report vs baseline

### Admin / ops readiness

- [ ] Runbook printed: `ROLLBACK_PLAN.md`
- [ ] Support macro for “wrong discount amount” tickets
- [ ] Finance sign-off on settlement preview semantics
- [ ] Product sign-off on known exclusions (E4 platform auto on shop, etc.)

### Communication

- [ ] Engineering channel cutover announcement (date, window, rollback owner)
- [ ] Support team briefed on feature flags and symptoms

---

## Cutover day (T-0)

### Sequence (recommended)

| Step | Action | Flag state | Validator |
|------|--------|------------|-----------|
| 1 | Deploy Lambda bundle (no authoritative yet) | All OFF except existing prod | Smoke: health, login |
| 2 | Enable shadow logging prod | PRIORITY=SHADOW, STACK=SHADOW | CloudWatch receiving logs |
| 3 | Enable RESOLVER=SHADOW (dual compute) | + RESOLVER shadow | Mismatch metrics live |
| 4 | Enable RESOLVER=AUTHORITATIVE quotes only | Authoritative calculate-booking, pricing/quote, calculate-cart | Manual quote checks |
| 5 | Monitor 2 hours | — | Error rate, support queue |
| 6 | Enable validate endpoints authoritative | validate-code, coupons | Coupon apply tests |
| 7 | Enable STACK=AUTHORITATIVE | Stack flag | Stack audit logs |
| 8 | Enable write paths | booking/order create validation | End-to-end payment |
| 9 | Enable SETTLEMENT=AUTHORITATIVE | Settlement flag | Earnings sample |
| 10 | Enable ANALYTICS=AUTHORITATIVE | Analytics flag | Admin dashboard |

**Do not skip steps** unless rollback criteria triggered.

### Smoke tests (execute after each wave)

#### Customer — service booking

- [ ] Clinic listing shows promo badge when promo exists
- [ ] `calculate-booking` returns expected discount for known vendor promo
- [ ] Platform auto promo stacks after vendor (amount matches pre-cutover fixture)
- [ ] Payment page total = booking create total
- [ ] Razorpay verify succeeds
- [ ] Booking details shows GST + promo breakdown (`wp_financial_meta`)

#### Customer — coupon

- [ ] Platform coupon validates on booking (S5 path)
- [ ] Invalid code returns clear error
- [ ] Usage count increments after successful booking

#### Customer — shop

- [ ] Cart promo auto-apply works
- [ ] Vendor coupon code at checkout works
- [ ] Platform coupon at shop (if E6 implemented)

#### Vendor

- [ ] Create service promotion → appears in active-promotions
- [ ] Toggle pause → customer quote updates

#### Admin

- [ ] List promotions (full rows, not shadowed handler)
- [ ] Stats endpoint loads
- [ ] Discount analytics overview (if analytics authoritative)

#### Finance

- [ ] One completed booking → vendor earnings row reasonable
- [ ] Settlement daily batch runs without error

---

## Post-cutover (T+1 to T+14)

### Daily (first week)

- [ ] Review CloudWatch resolver failure count
- [ ] Review shadow mismatch samples (if shadow still enabled)
- [ ] Check payment verification failure rate vs 7-day baseline
- [ ] Check refund / support tickets tagged discount
- [ ] Sample 5 bookings + 5 orders financial meta completeness

### Weekly

- [ ] Finance: vendor booking earnings export vs prior week structure
- [ ] Compare promotion_usages insert rate vs booking volume
- [ ] Retire shadow compare sample rate reduction plan

### Sign-off (T+14)

- [ ] Product: no P0/P1 discount defects open
- [ ] Finance: settlement reconciliation passed
- [ ] Engineering: legacy fallback not triggered > threshold
- [ ] Document final flag state in `PRODUCTION_CONFIG.md` or runbook

---

## Rollback checklist (quick reference)

See `ROLLBACK_PLAN.md` for full procedure.

- [ ] Set `DISCOUNT_ENGINE_V2_RESOLVER_MODE=OFF` (or authoritative=false)
- [ ] Set `STACK_MODE=OFF`, `SETTLEMENT_MODE=OFF`
- [ ] Verify legacy amounts restored on calculate-booking within 5 min
- [ ] Notify support — rollback complete
- [ ] Post-incident: preserve CloudWatch logs for analysis

---

## Monitoring checklist (ongoing)

| Signal | Source | Alert threshold |
|--------|--------|-----------------|
| Resolver pipeline failures | `[discount-resolver] pipeline failed` | > 10 / 5 min |
| Priority fallback | `authoritative fallback to legacy eligible set` | Any sustained |
| Payment verify failures | Razorpay webhook errors | +50% vs baseline |
| Booking amount mismatch | Support / manual audit | Any P0 |
| Settlement batch failure | `/settlements/calculate-daily` | Job failure |
| Lambda duration | API Gateway 502/504 | p99 increase |
| DB connection errors | Candidate repository | Spike |

---

*Phase 8A artifact — local only, not committed.*
