# Rollback Plan — Discount Engine V2 Production Cutover

**Date:** 2026-07-06  
**Objective:** Restore legacy authoritative discount behaviour within minutes without data loss  
**Related:** `PRODUCTION_CUTOVER_CHECKLIST.md`, `PHASE8_MIGRATION_PLAN.md`

---

## 1. Rollback triggers

Execute rollback when **any** of:

| Trigger | Severity |
|---------|----------|
| Customer charged wrong amount (verified) | **Immediate** |
| Payment verification failure rate +100% vs 24h baseline | **Immediate** |
| Resolver authoritative path error rate > 5% on quote endpoints | **Immediate** |
| Vendor payout discrepancy > ₹500 on sampled bookings | **Within 4h** |
| Widespread coupon rejection regression | **Within 4h** |
| Product/EM go/no-go veto during canary | **Immediate** |

---

## 2. Rollback mechanism (primary)

Discount Engine V2 cutover is **env-flag driven**. No redeploy required for immediate rollback if flags are in Lambda environment.

### Flag reset — production safe state

Set on `warmpawz-prod-api-handler` (and dev equivalent):

```
DISCOUNT_ENGINE_V2_RESOLVER_MODE=OFF          # (to be implemented — Phase 8B)
DISCOUNT_ENGINE_V2_STACK_MODE=OFF
DISCOUNT_ENGINE_V2_SETTLEMENT_MODE=OFF
DISCOUNT_ENGINE_V2_PRIORITY_MODE=OFF            # optional; reduces resolver internal authority
DISCOUNT_ENGINE_V2_ANALYTICS_MODE=OFF           # if analytics caused issues only
DISCOUNT_ENGINE_V2_CAMPAIGN_MODE=OFF            # if campaigns enabled
```

**Today (pre-HTTP swap):** Production already uses legacy for HTTP. Rollback during Wave 4+ means setting **RESOLVER authoritative OFF** — legacy path in `booking-promotion-service` / engines resumes automatically.

### Execution steps

1. **Identify** — confirm symptom matches discount engine (compare legacy shadow logs if still enabled).
2. **Announce** — #incidents channel; support on standby.
3. **Flip flags** — AWS Console Lambda → Configuration → Environment variables **OR** Terraform/SSM apply (preferred for audit trail).
4. **Wait** — Lambda cold starts pick up env within 1–2 minutes; no cache layer for flags.
5. **Verify** — run smoke tests from cutover checklist (calculate-booking, payment flow).
6. **Preserve logs** — export CloudWatch `/aws/lambda/warmpawz-prod-api-handler` last 2 hours.
7. **Post-incident** — ticket with flag timeline, sample booking IDs, resolver diagnostic JSON.

**Target recovery time:** **< 5 minutes** from decision to verified legacy behaviour.

---

## 3. Rollback mechanism (secondary — deploy revert)

Use if bad **code** deployed (not just flags):

1. Redeploy previous Lambda artifact from last known good CI build / S3 version.
2. Keep flags OFF during redeploy.
3. Run full smoke suite.

**Target recovery time:** **15–30 minutes** (build + deploy script).

```bash
# Dev reference — prod only with explicit approval
LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh
```

---

## 4. Data compatibility

| Concern | Rollback impact | Action |
|---------|-----------------|--------|
| Bookings created during authoritative window | May have `wp_financial_meta` from V2 | **Do not delete** — legacy re-read uses stored paid amount from payment row |
| `promotion_usages` / `coupon_usages` | May have V2 tracker writes | Keep rows — audit trail; no automatic rollback of usage counts |
| Settlement accrual with V2 preview | Earnings may used hook bridge | Re-run accrual fix script if finance identifies batch — **manual** |
| Commercial campaigns materialized promos | Promos remain in DB | Disable campaign engine; promos still valid legacy entities |
| Admin-created promos | Unaffected | N/A |

**Principle:** Rollback restores **calculation path**, not historical rows. Finance reviews bookings in cutover window if settlement authoritative was ON.

---

## 5. Critical files (do not break during hotfix)

| File | Role |
|------|------|
| `booking-promotion-service.ts` | Legacy booking stack — must remain callable |
| `service-promotion-engine.ts` | Legacy service math |
| `vendor-promotion-engine.ts` | Legacy cart math |
| `promotions.ts` | HTTP handlers — legacy return path |
| `production-bridge.ts` | Must remain safe when resolver fails |
| `settlement-hook-bridge.ts` | Must no-op when SETTLEMENT_MODE=OFF |

---

## 6. Critical services

| Service | Rollback dependency |
|---------|---------------------|
| `warmpawz-prod-api-handler` | Flag host |
| RDS `promotions`, `coupons`, `vendor_*` | Read by legacy engines |
| Razorpay verify webhook | Uses legacy financial meta builders |
| EventBridge settlement cron | Independent — pause if payout dispute |

---

## 7. Verification after rollback

### Automated

- [ ] `POST /promotions/calculate-booking` — compare to pre-cutover fixture JSON
- [ ] Health: `GET /promotions/active` returns 200

### Manual (5 min)

- [ ] Complete one UAT booking end-to-end
- [ ] Apply one known vendor coupon on shop cart
- [ ] Admin stats page loads

### CloudWatch

- [ ] No new `[discount-resolver] pipeline failed` spikes
- [ ] Legacy engine log lines present (`[VendorServices]`, booking promotion logs)

---

## 8. Partial rollback (domain-specific)

If only one domain fails:

| Domain | Action |
|--------|--------|
| Service booking only | RESOLVER authoritative OFF for booking handlers only (requires per-endpoint flag — Phase 8B design) |
| E-commerce only | Revert calculate-cart + order create |
| Analytics only | `ANALYTICS_MODE=OFF` — no customer impact |
| Campaign only | `CAMPAIGN_MODE=OFF` — APIs 503; existing promos unaffected |
| Settlement only | `SETTLEMENT_MODE=OFF` — earnings use legacy gross |

**Note:** Per-endpoint flags are **not implemented today** — full RESOLVER OFF is the safe default.

---

## 9. Communication template

```
Subject: [ROLLBACK] Discount Engine V2 authoritative mode disabled

We disabled Discount Engine V2 authoritative mode on production at <time UTC>.
Customer checkout now uses the previous promotion calculation engine.

Impact: <describe symptom>
Action required: Support — use standard discount troubleshooting; escalate booking IDs to #eng-promo

Next steps: Post-incident review scheduled <date>
```

---

## 10. Post-rollback requirements

1. Root cause analysis within 48h.
2. Fix forward plan before re-attempting cutover.
3. Add failing scenario to golden parity tests.
4. Update `PHASE8_RISK_REGISTER.md` with realized risk.

---

*Phase 8A artifact — local only, not committed.*
