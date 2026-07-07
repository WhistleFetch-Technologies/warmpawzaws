# P0/P1 Stabilization — Promotion Usage + Finance Settlement + Commission Policy

**Date:** 2026-07-07  
**Booking reference:** `e8584dfb-3fd0-4c9b-abe0-275cd89cecbb`  
**Environment:** DEV (`warmpawz-dev-api-handler`)

---

## Root Cause (summary)

| Issue | Root cause |
|-------|------------|
| Commission 10% vs Basic 20% | `resolveVendorCommissionPolicy` queried `vts.expires_at` (missing on RDS); outer catch returned `DEFAULT_COMMISSION_RATE` (10%) |
| Promotion usage 0 | `serviceCategory` block-scoped bug + NULL catalog category → server resolver failed; client discount persisted without `wp_promo_meta` |
| Settlement snapshot missing | `FINANCE_FUNDING_AWARE_SETTLEMENT` unset → LEGACY path skipped snapshot persistence |
| Commission base ₹110 vs ₹200 | Legacy earnings used checkout total; funding-aware path not active |

---

## Files Changed

| Area | File |
|------|------|
| P0 Commission | `backend/lambda/src/finance/commission/resolve-vendor-commission-policy.ts` |
| P0 Tests | `backend/lambda/src/finance/commission/__tests__/resolve-vendor-commission-policy.test.ts` |
| P1 Category | `backend/lambda/src/lib/services/resolve-booking-service-category.ts` |
| P1 Booking create | `backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts` |
| P1 Promotions API | `backend/lambda/src/endpoints/promotions.ts` |
| P1 Usage fallback | `backend/lambda/src/lib/services/booking-promotion-service.ts` |
| Finance SHADOW | `backend/lambda/src/finance/settlement/build-settlement-snapshot.ts` |
| Realign utility | `backend/lambda/src/utils/vendor-earnings-on-completion.ts` |
| Terraform dev | `infra/envs/dev/main.tf` |

---

## Terraform Changes

`infra/envs/dev/main.tf` — added:

```hcl
FINANCE_FUNDING_AWARE_SETTLEMENT = "SHADOW"
```

Production defaults unchanged (env var absent → `LEGACY`).

---

## AWS CLI Commands

Update dev Lambda immediately (before/after deploy):

```bash
aws lambda update-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1 \
  --environment "Variables={FINANCE_FUNDING_AWARE_SETTLEMENT=SHADOW,...existing vars...}"
```

Verify:

```bash
aws lambda get-function-configuration \
  --function-name warmpawz-dev-api-handler \
  --region ap-south-1 \
  --query "Environment.Variables.FINANCE_FUNDING_AWARE_SETTLEMENT"
```

Expected output: `"SHADOW"`

---

## Environment Changes (DEV)

| Variable | Before | After |
|----------|--------|-------|
| `FINANCE_FUNDING_AWARE_SETTLEMENT` | (unset → LEGACY) | **SHADOW** |
| `DISCOUNT_ENGINE_V2_*` | AUTHORITATIVE | unchanged |

### SHADOW mode behavior

- **Checkout:** `wp_financial_meta` includes `settlementSnapshot`, `commissionBase`, `winningOffer`, `fundingSummary`
- **Completion:** Legacy `vendor_earnings` INSERT (unchanged payout path)
- **CloudWatch:** `[FINANCE-S2-SHADOW]` compare logs (legacy vs funding-aware)

Promote to `AUTHORITATIVE` only after shadow validation on fresh bookings.

---

## Regression Tests

```bash
cd backend/lambda
npm test -- --testPathPattern="resolve-vendor-commission-policy|funding-aware-settlement"
```

Coverage:

- Active subscription → subscription rate
- No subscription + Basic tier → 20%
- Premium tier → 7%
- Missing tier → default tier
- Subscription SQL failure → falls through to vendor tier (20%)
- Funding-aware settlement scenarios A–E (existing)

---

## Validation Checklist

After deploy + AWS CLI env update:

- [ ] Fresh test booking with vet promotion → `promotion_id` + `wp_promo_meta` populated
- [ ] Payment success → `promotion_usages` + `promotions.usage_count` increment
- [ ] `wp_financial_meta.settlementSnapshot` present (SHADOW)
- [ ] CloudWatch `[FINANCE-S2-SHADOW]` log on create/complete
- [ ] Commission rate 20% for Basic vendor (policy resolver)
- [ ] `realignPendingVendorEarningsForBooking('e8584dfb-...')` recomputes from financial meta (repair path)
- [ ] Booking with unresolvable client discount → `400 PROMOTION_RESOLUTION_REQUIRED`

---

## Validation Results

| Check | Result |
|-------|--------|
| Unit tests | **PASS** (13 tests: commission policy + funding-aware settlement) |
| Lambda build | **PASS** |
| Lambda deploy (`warmpawz-dev-api-handler`) | **PASS** (2026-07-07) |
| Loyalty consumer deploy | **PASS** |
| Customer-web deploy | **PASS** (S3 + CloudFront invalidation) |
| AWS env `FINANCE_FUNDING_AWARE_SETTLEMENT` | **SHADOW** (verified via CLI) |
| Fresh booking E2E | *Manual — create vet booking with promotion after deploy* |
| `realignPendingVendorEarningsForBooking(e8584dfb...)` | *Manual — run via repair endpoint/script after SHADOW snapshot validation* |

---

## Rollback Plan

1. Set `FINANCE_FUNDING_AWARE_SETTLEMENT=LEGACY` on dev Lambda (AWS CLI or Terraform revert).
2. Redeploy previous Lambda artifact if code rollback needed.
3. Commission policy fix is backward-compatible — no rollback required unless regression found.
4. Fail-closed promotion create can be relaxed only by reverting booking create changes.

---

## Category Resolution Precedence

Documented in `resolve-booking-service-category.ts`:

1. Explicit request category  
2. `services.category` / `vendor_services.category`  
3. Vendor `roles.customer_service` / role config category  
4. `vendors.category`  
5. Service name/id heuristic (`service-catalog-sync`)

Used by booking create and `POST /promotions/calculate-booking`.

---

## Related Investigation Docs

- `docs/BOOKING_E8584DFB_INVESTIGATION.md`
- `docs/PROMOTION_USAGE_ROOT_CAUSE.md`
- `docs/SETTLEMENT_ROOT_CAUSE.md`
- `docs/COMMISSION_POLICY_INVESTIGATION.md`
- `docs/RUNTIME_FLAG_ANALYSIS.md`
- `docs/FINANCE_RUNTIME_TRACE.md`
- `docs/FINANCE_SETTLEMENT_INTEGRATION_IMPLEMENTATION.md`
