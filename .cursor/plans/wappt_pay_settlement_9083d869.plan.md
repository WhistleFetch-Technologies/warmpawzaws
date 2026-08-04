---
name: WAPPT Pay Settlement
overview: Tie Warmpawz Appointments (flat-fee slots) and Warmpawz Pay (counter bill) into one commerce_mode=warmpawz_pay flow with appointment-fee credit, OTP closure gate, platform withhold settlement, and vendor earnings — while leaving marketplace endpoints and settlement paths untouched.
todos:
  - id: p0-withhold-migration
    content: Add platform_withhold_percent to warmpawz_pay_merchant_pricing + admin pricing API/UI
    status: pending
  - id: p0-verify-accrual
    content: Implement accrue-wpay-settlement.ts and call from customer_warmpawz_pay_verify_post (idempotent settlements insert)
    status: pending
  - id: p0-vendor-earnings
    content: Extend vendor earnings/settlements GET to surface order_type=warmpawz_pay rows with customer name and net amount
    status: pending
  - id: p1-appointment-context
    content: New GET /customer/warmpawz-pay/appointment-context + credit idempotency table
    status: pending
  - id: p1-initiate-credit
    content: Gate appointment fee credit on completed booking in initiate/verify + metadata
    status: pending
  - id: p1-customer-pay-ui
    content: "WarmpawzPayVendorClient: OTP booking card, poll completion, quote line items"
    status: pending
  - id: p1-vendor-pay-api-ui
    content: GET /vendor/warmpawz-pay/payments + VendorEarningsSettlementDashboard pay_bill rows
    status: pending
  - id: p2-cancel-verify
    content: Verify WAPPT 1h cancel/refund tiers match spec; fix only if drift
    status: pending
  - id: p3-backfill-job
    content: "Optional reconciliation: completed warmpawz_pay payments missing settlements"
    status: pending
isProject: false
---

# WAPPT + Warmpawz Pay — unified implementation plan

## Product flow (authoritative)

```mermaid
sequenceDiagram
  participant C as Customer
  participant WP as WarmpawzPay
  participant B as WAPPT_Booking
  participant V as Vendor_OTP
  participant S as Settlement

  C->>B: Book slot (appointment fee only)
  Note over C,V: In-person services; vendor quotes bill
  C->>WP: Enter quoted amount at vendor Pay screen
  WP->>B: Lookup open appointment (same vendor, not completed)
  alt Has open appointment
    WP->>C: Show booking detail + OTP
    V->>B: Complete booking via existing OTP API
    WP->>WP: Re-quote: (quoted - appointmentFee) then apply discount%
  else No appointment
    WP->>WP: Quote: quoted × discount% only
  end
  C->>WP: Razorpay pay
  WP->>S: Verify → accrue settlement (platform withhold on paid amount)
  S->>V: Earnings row (customer name, date, net amount)
```



**Admin-only config (no vendor config UI):**


| Parameter                              | Where today                                            | Gap                           |
| -------------------------------------- | ------------------------------------------------------ | ----------------------------- |
| Pay Bill discount %                    | `warmpawz_pay_merchant_pricing.discount_value`         | Exists                        |
| Appointment fixed fee                  | `warmpawz_appointments_vendor_catalog.appointment_fee` | Exists                        |
| Platform withhold % on **paid** amount | —                                                      | **New column + admin API/UI** |


**Cancellation (appointments):** cancel **before** 1h → wallet refund; **within** 1h or missed (no OTP) → no refund. Partially implemented in `[wappt-booking-cancel.service.ts](backend/lambda/src/endpoints/warmpawz-appointments/shared/wappt-booking-cancel.service.ts)` + policy migrations `1091`/`1092` — verify tiers match this spec, do not touch marketplace cancel APIs.

---

## RCA — what exists vs what’s missing

### Already built (reuse, don’t rewrite)

- **WAPPT booking create** — `commerce_mode` on bookings via `[bookings-enhanced.booking.ts](backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts)`; flat fee from `[vendor_fee_get](backend/lambda/src/endpoints/customer/warmpawz-appointments/services/vendor_fee_get.service.ts)`
- **Pay Bill customer APIs** — `[customer/warmpawz-pay/](backend/lambda/src/endpoints/customer/warmpawz-pay/)` (vendors list, initiate, verify, transactions)
- **Discount math** — `[wpay-discount.ts](backend/lambda/src/endpoints/customer/warmpawz-pay/shared/wpay-discount.ts)` (`computeWpayDiscountQuote`)
- **OTP booking completion** — existing vendor booking complete / OTP verify in `[vendor.gpstracking.ts](backend/lambda/src/endpoints/gpsTracking/endpoints/vendor.gpstracking.ts)` — **reuse as-is**; do not fork for WAPPT
- **Schema hooks for Pay Bill settlement** — migration `[1080](db/migrations/1080_warmpawz_pay_phase1_schema.sql)`: `payments.payment_source=warmpawz_pay`, unique `settlements(payment_id) WHERE order_type='warmpawz_pay'`
- **Admin Pay pricing** — `[warmpawz-pay/admin/pricing/](backend/lambda/src/endpoints/warmpawz-pay/admin/pricing/)`
- **Customer Pay UI shell** — `[WarmpawzPayVendorClient.tsx](apps/customer-web/app/warmpawz-pay/vendors/[vendorId]/WarmpawzPayVendorClient.tsx)`

### Gaps (root cause of “Pay doesn’t show in vendor earnings”)

1. **Verify stops at payment row** — `[customer_warmpawz_pay_verify_post.service.ts](backend/lambda/src/endpoints/customer/warmpawz-pay/services/customer_warmpawz_pay_verify_post.service.ts)` completes `payments` only; **no settlement accrual**
2. **Initiate ignores appointments** — `[customer_warmpawz_pay_initiate_post.service.ts](backend/lambda/src/endpoints/customer/warmpawz-pay/services/customer_warmpawz_pay_initiate_post.service.ts)` always `computeWpayDiscountQuote(amount, %, null)` — no appointment lookup, no fee credit, no `bookingId` in metadata
3. **Platform withhold %** — not in DB or admin pricing
4. **Vendor earnings API** — `[vendor-dashboard-enhanced.ts](backend/lambda/src/endpoints/vendor/endpoints/vendor-dashboard-enhanced.ts)` joins `vendor_earnings` → `bookings` only; Pay Bill has **no booking row** → invisible
5. **Customer Pay UX** — no appointment-context step or OTP booking card between quote and pay

---

## Architecture principle: isolate marketplace, extend Warmpawz

**Do not** add `if (commerce_mode)` branches inside marketplace booking create, marketplace cancel, or marketplace settlement hooks.


| Surface                                  | Strategy                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| Marketplace bookings/checkout/settlement | **Zero changes** when toggle = `marketplace`                                      |
| WAPPT                                    | Existing `customer/warmpawz-appointments/`*, `warmpawz-appointments/admin/*`      |
| Pay Bill                                 | Extend only `customer/warmpawz-pay/*`, new `vendor/warmpawz-pay/*` read APIs      |
| Shared OTP complete                      | Keep single vendor endpoint; **Pay Bill layer** enforces eligibility + fee credit |


Commerce Switch already routes discovery/booking UI; backend isolation is by **route namespace + `commerce_mode` on rows**, not by mutating shared handlers.

---

## Pricing pipeline (single helper — extend, don’t duplicate)

Extend `[computeWpayDiscountQuote](backend/lambda/src/endpoints/customer/warmpawz-pay/shared/wpay-discount.ts)`:

```ts
// billBase = quotedAmount - appointmentFeeCredit (0 if no completed linked booking)
// discountAmount = billBase * discountPercent / 100
// payableAmount = billBase - discountAmount (min ₹0.01)
```

**Appointment fee credit rules (enforce server-side on initiate + verify):**

- Eligible booking: `commerce_mode = warmpawz_pay`, same `customer_id` + `vendor_id`, appointment fee captured, status in `{confirmed, in_progress, …}` **not** `completed`/`cancelled`, slot not in distant past (define: same calendar day or within slot window — pick one constant in repo query)
- Credit applied **only if** `booking.status = completed` (OTP verified) at initiate/verify time
- **Idempotency:** `payments.metadata.appointmentFeeBookingId` + flag `appointmentFeeConsumed`; one credit per booking ever (DB unique partial index on metadata or link table — prefer small migration `warmpawz_pay_appointment_credits(booking_id UNIQUE)`)

**Stored on payment metadata (and settlement breakup):**

- `quotedAmount` — vendor quote (gross bill)
- `appointmentFeeCredit` — fee deducted from quote (0 if walk-in)
- `discountPercent`, `discountAmount`
- `payableAmount` — Razorpay charged amount
- `platformWithholdPercent`, `platformWithholdAmount`
- `vendorNetAmount` — what vendor earns

---

## Settlement accrual (P0 — unblocks vendor earnings)

**New module** (one file, called from verify only):

`backend/lambda/src/endpoints/customer/warmpawz-pay/shared/accrue-wpay-settlement.ts`

On successful verify (inside existing transaction as `dbWpayCompletePayment`):

1. Read completed payment + metadata
2. `platformWithhold = payableAmount × withholdPercent / 100`
3. `vendorNet = payableAmount - platformWithhold`
4. **Idempotent insert** into `settlements`:
  - `order_type = 'warmpawz_pay'`, `payment_id`, `booking_id = NULL` (or linked WAPPT booking id for traceability only — not for commission base)
  - `total_amount = payableAmount`, `commission_amount = platformWithhold`, `vendor_amount = vendorNet`
  - `settlement_breakup` JSON with quoted/discount/credit/withhold labels
5. **Vendor earnings visibility** (lazy mirror of delivery_settlements pattern):
  - **Option A (smaller migration):** extend `GET /vendor/:id/earnings` to `UNION` `settlements WHERE order_type='warmpawz_pay'` joined to `payments` + `customers` for name/date — **no `vendor_earnings` schema change**
  - **Option B (payout-batch parity):** migration nullable `vendor_earnings.booking_id` + `payment_id UUID UNIQUE`; insert row on accrual — use if existing payout job only reads `vendor_earnings`

**Recommend Option A first** (extend earnings API + settlements list); add Option B only if payout batch ignores `settlements` for Warmpawz Pay.

**Do not** call `[insertVendorEarningsFromSettlementSnapshot](backend/lambda/src/finance/settlement/create-vendor-earnings-from-snapshot.ts)` — that is booking/commission-tier logic; Pay Bill uses flat **platform withhold %**, not vendor tier commission.

---

## API changes (Warmpawz namespace only)

### Customer


| Endpoint                                                   | Change                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /customer/warmpawz-pay/appointment-context?vendorId=` | **New** — returns eligible open WAPPT booking summary + OTP display fields (reuse booking detail shape from `[customer_bookings_bookingid_get](backend/lambda/src/endpoints/customer/bookings/services/customer_bookings_bookingid_get.service.ts)`) |
| `POST /customer/warmpawz-pay/quote`                        | **New (optional)** — server-side quote preview with optional `bookingId`; keeps initiate thin                                                                                                                                                        |
| `POST /customer/warmpawz-pay/initiate`                     | Accept optional `bookingId`; resolve credit only if booking completed; persist full quote in metadata                                                                                                                                                |
| `POST /customer/warmpawz-pay/verify`                       | After payment complete → `accrueWpaySettlement`                                                                                                                                                                                                      |


### Vendor


| Endpoint                            | Change                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /vendor/warmpawz-pay/payments` | **New** — list completed Pay Bill payments for vendor (date, customer, quoted, paid, net) |
| `GET /vendor/:vendorId/earnings`    | **Extend** — merge `warmpawz_pay` settlements; `flowType: 'pay_bill'` in response         |


### Admin


| Endpoint                                    | Change                                    |
| ------------------------------------------- | ----------------------------------------- |
| `PUT /admin/warmpawz-pay/pricing/:vendorId` | Add `platformWithholdPercent` (0–100)     |
| WAPPT catalogue                             | No change (appointment fee already there) |


---

## Customer UI (`[WarmpawzPayVendorClient.tsx](apps/customer-web/app/warmpawz-pay/vendors/[vendorId]/WarmpawzPayVendorClient.tsx)`)

1. On vendor load + after amount entry → fetch `appointment-context`
2. If open appointment → render **same booking detail card** as My Bookings (reuse `[BookingDetailModal](apps/customer-web/components/customer/BookingDetailModal.tsx)` or slim inline variant) with OTP visible to customer
3. Poll booking status (or refetch context) until `completed`
4. Re-run quote showing line items: Quoted → Appointment fee credit → Discount → Payable
5. Existing Razorpay checkout unchanged (Bindu’s timing rule preserved)

Walk-in (no appointment): current UX — percentage discount only.

---

## Vendor UI

Extend `[VendorEarningsSettlementDashboard.tsx](apps/vendor-web/components/vendor/VendorEarningsSettlementDashboard.tsx)`:

- New row type: **Warmpawz Pay** — columns: pet parent name, date, quoted amount, paid amount, **your earnings** (after withhold)
- Optional dedicated Pay Bill tab fed by `GET /vendor/warmpawz-pay/payments`

---

## WAPPT cancellation alignment (verify, minimal edits)

In `[wappt-booking-cancel.service.ts](backend/lambda/src/endpoints/warmpawz-appointments/shared/wappt-booking-cancel.service.ts)` + policy tiers:

- Confirm preview API returns **100% wallet refund** when `hoursUntilStart >= 1`
- Confirm **0% refund** when `< 1` hour or no-show
- Customer cancel UI: warn within 1h (“you will lose the money”) — use existing `wappt_booking_cancellation_policy_get`

**No marketplace cancel path changes.**

---

## Migrations (additive only)

1. `10XX_warmpawz_pay_platform_withhold.sql` — `ALTER warmpawz_pay_merchant_pricing ADD COLUMN platform_withhold_percent NUMERIC(5,2) DEFAULT 0 CHECK (0..100)`
2. `10XX_warmpawz_pay_appointment_credit.sql` — `warmpawz_pay_appointment_credits(booking_id UUID PRIMARY KEY, payment_id UUID, amount NUMERIC, consumed_at TIMESTAMPTZ)` — prevents double credit

---

## Execution order (ponytail: money trail first)

```mermaid
flowchart LR
  P0a[Admin withhold %] --> P0b[Verify accrual]
  P0b --> P0c[Vendor earnings API]
  P0c --> P1a[Appointment context API]
  P1a --> P1b[Initiate fee credit gate]
  P1b --> P1c[Customer Pay UI OTP card]
  P2[Cancel policy verify]
  P3[Reconciliation job optional]
```




| Phase  | Deliverable                                                  | Why first                                       |
| ------ | ------------------------------------------------------------ | ----------------------------------------------- |
| **P0** | Withhold config + verify → settlement + vendor earnings list | Proves money path; walk-in Pay works end-to-end |
| **P1** | Appointment context + fee credit + OTP-gated re-quote + UI   | Ties WAPPT to Pay                               |
| **P2** | Cancel policy audit/fix if tiers drift                       | Policy mostly done                              |
| **P3** | Idempotent backfill job for payments missing settlements     | Safety net                                      |


---

## Suggested team split


| Owner     | Scope                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Bindu** | Migration withhold %, admin pricing field, `accrue-wpay-settlement`, vendor earnings/settlements API extension, vendor Pay Bill list API, vendor earnings UI |
| **Abhi**  | `appointment-context` resolver, initiate/verify pricing + credit idempotency, customer Pay UI (OTP card + quote lines), WAPPT cancel policy verification     |


Integration branch: `feature/warmpawz-pay-appointments-unified` → PR to `develop`.

---

## Test plan (smallest runnable checks)

1. **Walk-in Pay Bill:** quote ₹1000, 10% discount, 5% withhold → verify settlement `vendor_amount = 1000×0.9×0.95`
2. **With WAPPT:** book ₹200 fee → complete OTP → Pay ₹800 quote → credit ₹200 → discount on ₹600 → settlement correct
3. **No double credit:** second Pay Bill with same `bookingId` → 409 or credit=0
4. **Marketplace regression:** create marketplace booking + settlement unchanged (smoke on `commerce_mode=marketplace`)
5. **Cancel:** cancel at T-2h → wallet credit; cancel at T-30m → no refund

---

## Deliberate simplifications (`ponytail:` ceilings)

- **Reuse marketplace OTP complete** — ceiling: WAPPT-specific completion rules later need a dedicated vendor route; upgrade path: `POST /vendor/warmpawz-appointments/:id/complete` wrapper
- **Earnings via settlements UNION first** — ceiling: payout batch may need `vendor_earnings.payment_id`; upgrade: migration + insert on accrual
- **Appointment eligibility = same vendor + unpaid-completed slot heuristic** — ceiling: edge cases (multiple open bookings); upgrade: explicit `link_booking_id` on initiate request
