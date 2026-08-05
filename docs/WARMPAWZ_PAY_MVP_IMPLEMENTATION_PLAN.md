# Warmpawz Pay MVP — No-OTP Appointment Credit (implementation plan)

Based on [WARMPAWZ_PAY_MVP_ARCHITECTURE.md](WARMPAWZ_PAY_MVP_ARCHITECTURE.md).

**Branch:** `feature/warmpawz-pay-appointments-unified`  
**Policy change (2026-08-05):** Remove OTP gate for appointment fee credit. Same-day **active** WAPPT booking → credit on Pay Bill. On successful verify → booking `completed`. Vendor revenue via **wpay settlement** (admin withhold %), not marketplace OTP earnings.

---

## Sequential workflow (mandatory)

```
Bindu: pull branch → S13 RDS verify → S14 backend → build → push
Abhi:  pull Bindu's push → S15 UI + docs → build → push
Both:  S16 smoke → Bindu deploy lambda (S17) → Abhi deploy customer-web (S18)
```

| Rule | Owner |
|------|-------|
| All migrations + `ENVIRONMENT=dev node scripts/run-migration-rds-node.js …` | **Bindu only** |
| Abhi must **not** run RDS migrations | — |
| Next owner always **`git pull origin feature/warmpawz-pay-appointments-unified`** before starting their phase | — |

**Migrations:** No new file expected for this revision (`1093` withhold, `1094` appointment credits already on dev). Bindu verifies in S13.

---

## Phase changelog (S13–S18)

| Step | Owner | Next pulls | Deliverable | Status |
|------|-------|------------|-------------|--------|
| **S13** | **Bindu** | Abhi | Dev RDS check: `1093`, `1094` applied. New migration **only** if schema gap. | pending |
| **S14** | **Bindu** | Abhi | Backend: active+today eligibility, verify completes booking, `payments.booking_id`, `idempotency_key`, settlement `booking_id`, tests. Build + **push**. | done |
| **S15** | **Abhi** | Bindu | Pull S14. Context API cleanup, remove OTP UI, update ADR/plan docs. Build customer-web + **push**. | done |
| **S16** | **Both** | — | Dev smoke: walk-in, same-day credit, next-day no credit, forged bookingId | pending |
| **S17** | **Bindu** | Abhi | `./scripts/deploy-lambda-direct.sh` (dev) | pending |
| **S18** | **Abhi** | — | `./scripts/deploy-customer-web.sh` (dev) | pending |

---

## S14 — Bindu (backend)

### Eligibility

- `booking_date = ymdInIst()` (today IST)
- Active booking: `status NOT IN ('cancelled', 'completed', 'refunded')`
- Advance paid; credit not consumed
- **Remove** `status = 'completed'` / OTP requirement

**Files:** `wpay-appointment-context.repo.ts`, `wpay-appointment-credit.ts`, `customer_warmpawz_pay_appointment_context_get.service.ts`

### Verify — complete booking

After credit consume: `dbCompleteWapptBookingAfterPayBill` → `status = 'completed'`. No `ensureVendorEarningsForCompletedBooking`.

**Files:** `wpay-appointment-context.repo.ts`, `customer_warmpawz_pay_verify_post.service.ts`

### Payment plumbing (original gaps)

| Task | File |
|------|------|
| `booking_id` + `idempotency_key` on payment insert | `wpay-razorpay-order.ts`, initiate service |
| `booking_id` on `WpayPaymentRow` | `wpay-payment.repo.ts` |
| Settlement `booking_id` | `accrue-wpay-settlement.ts` |

### Verify

```bash
cd backend/lambda && npm run build
npm test -- --testPathPattern=warmpawz-pay
git push origin feature/warmpawz-pay-appointments-unified
```

---

## S15 — Abhi (customer-web + docs)

**Start:** `git pull origin feature/warmpawz-pay-appointments-unified`

### UI

**File:** `apps/customer-web/app/warmpawz-pay/vendors/[vendorId]/WarmpawzPayVendorClient.tsx`

- Remove OTP card, polling, pay gate
- Banner: "Appointment found — ₹{fee} appointment fee will be deducted from your bill."

### Docs

- Update `WARMPAWZ_PAY_MVP_ARCHITECTURE.md` §4.B, §6.1, §8

### Verify

```bash
cd apps/customer-web && npm run build
git push origin feature/warmpawz-pay-appointments-unified
```

---

## Eligibility (server-side)

```
commerce_mode = 'warmpawz_appointments'
AND customer_id + vendor_id match
AND booking_date = today (IST)
AND status active (not cancelled/completed/refunded)
AND advance captured
AND NOT EXISTS warmpawz_pay_appointment_credits
```

---

## Smoke checklist (S16)

| Journey | Expected |
|---------|----------|
| Walk-in | No today booking → full pay, `booking_id` null |
| Same-day appointment | Active booking today → fee deducted → pay → booking completed, credit + settlement |
| Pay next day | No credit |
| Forged `bookingId` | 409 on initiate/verify |

---

## Definition of done

- No OTP for Pay Bill appointment credit
- Bindu backend pushed before Abhi UI
- Dev smoke passed; lambda + customer-web on dev
