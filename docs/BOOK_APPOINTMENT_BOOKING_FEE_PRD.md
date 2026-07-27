# Book Appointment with Booking Fee — Product Requirement Document (PRD)

**Document type:** Product Requirement Document  
**Product area:** Warmpawz Pay · Appointments  
**Version:** 1.0  
**Date:** 27 July 2026  
**Status:** Draft — pending product sign-off  
**Audience:** Product, Design, Business, Operations, Engineering (for context only)

---

## 1. Product Vision

**Enable customers to confirm an appointment with a small, predictable upfront booking fee — while paying the full service amount only after the visit — so booking feels low-friction, no-shows drop, and vendors still earn on completed services.**

Warmpawz already helps customers **pay a bill** at a vendor through Pay Bill, with Admin-controlled discounts. This initiative extends the platform’s payment philosophy into **appointments**: customers commit to a slot with a fixed fee (for example ₹99), and settle the remainder after service delivery.

**One-line vision:** *Book now, pay a little — complete the care, pay the rest.*

---

## 2. Business Problem

### 2.1 Problems we are solving

| Problem | Who feels it | Impact |
|---------|--------------|--------|
| **High upfront cost blocks booking** | Customers | Drop-off at payment step; abandoned slots |
| **No-shows and late cancellations** | Vendors | Lost revenue, idle staff, schedule gaps |
| **Walk-in vs booked confusion** | Vendors | Hard to distinguish serious bookings from casual browsing |
| **Inconsistent deposit policies** | Customers & vendors | Some vendors ask for cash advance offline; no platform standard |
| **Pay Bill and Book Appointment feel disconnected** | Product | Two payment moments (bill vs booking) without a unified Warmpawz Pay story |

### 2.2 Why now

Pay Bill establishes trust in **Warmpawz-facilitated payments** at vendor locations. Appointment booking is the platform’s highest-intent service flow. Combining a **low booking fee at confirmation** with **balance after service** reduces payment anxiety while preserving vendor commitment signals.

### 2.3 Success looks like

- Higher **booking completion rate** (summary → confirmed appointment)
- Lower **no-show rate** vs full-upfront or zero-deposit booking
- **Admin-controlled** booking fee across vendor categories without per-vendor negotiation
- Clear **customer and vendor understanding** of what was paid, what is owed, and when

### 2.3 Non-goals (this release)

- Replacing Pay Bill or merging it into appointment checkout
- Wallet, membership, or subscription models for booking fees
- Vendor-set booking fees (Admin configures; vendors do not self-serve fee amounts in v1)
- International or multi-currency booking fees

---

## 3. User Personas

### 3.1 Customer — **Priya, Pet Parent**

- Books vet visits, grooming, and training from her phone
- Hesitates when asked to pay ₹800–₹2,000 upfront before the visit
- Wants certainty: “I’ve secured my slot” without paying the full bill now
- Expects clear receipts and reminders for any amount still due

**Jobs to be done:** Find a trusted vendor → pick slot → pay small fee → show up → pay balance easily

---

### 3.2 Vendor — **Dr. Mehta, Clinic Owner**

- Manages doctors, slots, and daily footfall
- Loses money when customers book and don’t show
- Prefers online commitment over phone bookings with no deposit
- Wants the dashboard to show **deposit received** vs **balance pending** at a glance

**Jobs to be done:** See confirmed bookings → know who paid booking fee → collect or trigger balance → complete service

---

### 3.3 Admin — **Operations / Finance Lead**

- Sets commercial rules platform-wide (fees, discounts, policies)
- Needs to pilot booking fee (e.g. ₹99 for vets, ₹49 for grooming) without engineering each time
- Reports on booking fee collection vs balance collection for settlement and support

**Jobs to be done:** Configure fee rules → enable vendors → monitor adoption → adjust by category

---

### 3.4 Secondary — **Support Agent**

- Handles “I paid ₹99 but they asked for more” disputes
- Needs a single view of booking fee, service total, balance paid/unpaid, and cancellation outcome

---

## 4. Customer Journey

### 4.1 Happy path

| Step | Moment | Customer thinking |
|------|--------|-------------------|
| 1 | Discovers vendor (search, category, profile) | “This clinic looks good.” |
| 2 | Taps **Book Appointment** | “I want a slot, not just pay a bill.” |
| 3 | Selects service, date, time, pet | “Thursday 4pm works.” |
| 4 | Reviews **summary** | “I pay ₹99 now; ₹701 at the clinic. Clear.” |
| 5 | Pays booking fee | “Small commit — I’m in.” |
| 6 | Receives confirmation | “Slot is mine; I know what’s left.” |
| 7 | Attends appointment | — |
| 8 | Pays remaining balance | “Paid at clinic” or “Paid in app” |
| 9 | Views booking in history | “Full record of both payments.” |

### 4.2 Entry points

- Vendor profile → **Book Appointment** (primary)
- Service discovery → vendor → Book Appointment
- Rebook / follow-up flows (policy-dependent)

### 4.3 Exit points

- Abandon before summary
- Abandon at payment (slot may be held briefly — see Product Rules)
- Cancel before appointment
- No-show

---

## 5. Vendor Journey

| Step | Moment | Vendor experience |
|------|--------|-------------------|
| 1 | Booking created with fee paid | Notification: new confirmed appointment + deposit received |
| 2 | Calendar / booking list | Badge: **Deposit paid · Balance due ₹X** |
| 3 | Pre-visit | Optional reminder to customer about balance (platform or vendor-triggered) |
| 4 | Day of service | Sees balance due; can **request payment** or **mark received** (cash/UPI at clinic) |
| 5 | Service complete | Booking marked complete; balance settled or flagged overdue |
| 6 | Earnings view | Deposit and balance shown separately in payment history |

### 5.1 Vendor mental model

- **Booking fee** = customer’s commitment (platform-collected online)
- **Balance** = service price minus booking fee (collected at or after visit)
- Pay Bill remains separate: walk-in bill payment without a booked slot

---

## 6. Admin Journey

| Step | Action | Outcome |
|------|--------|---------|
| 1 | Defines **default booking fee** (e.g. ₹99) | Platform baseline |
| 2 | Sets **overrides by vendor category** (vet, groomer, trainer) | Category-specific fees |
| 3 | Optionally sets **per-vendor override** | Strategic partners or pilots |
| 4 | Enables vendors for **appointment booking fee** model | Only eligible vendors offer this journey |
| 5 | Defines **cancellation / refund rules** for booking fee | Policy published to customer |
| 6 | Monitors dashboard | Bookings, fees collected, balances outstanding, exceptions |

### 6.1 Admin vs Pay Bill configuration

| Setting | Pay Bill (existing) | Book Appointment (new) |
|---------|---------------------|-------------------------|
| What Admin configures | Discount on customer-entered bill | **Fixed booking fee** amount |
| Who enters amount | Customer (bill total) | System (fee); service price from catalogue |
| When payment happens | At visit, no slot | At booking + after service |

---

## 7. UX Flow

### 7.1 Flow diagram (customer)

```
[Vendor Profile]
       │
       ▼
[Book Appointment]
       │
       ├── Service (if not pre-selected)
       ├── Slot & pet
       ├── Address (if home visit)
       │
       ▼
[Summary — NEW emphasis]
   • Service name & time
   • Service price
   • Booking fee (pay now)     ← highlighted
   • Balance (pay after visit) ← secondary
   • Cancellation note
       │
       ▼
[Pay booking fee]
       │
       ├── Success → [Confirmation]
       └── Fail / abandon → [Retry or release slot]
       │
       ▼
[Appointment day]
       │
       ▼
[Pay balance] — in app link OR at clinic
       │
       ▼
[Completed]
```

### 7.2 Information hierarchy on summary screen

1. **What you pay now** — booking fee (largest, action-oriented)
2. **What you pay later** — balance at visit
3. **What you’re booking** — service, time, pet, vendor
4. **Policy** — cancellation, refund of booking fee

### 7.3 Pay Bill vs Book Appointment — customer distinction

| | Pay Bill | Book Appointment |
|---|----------|------------------|
| Primary CTA on profile | Pay Bill (existing) | Book Appointment |
| User enters amount? | Yes (bill total) | No (fee is fixed by Admin) |
| Slot required? | No | Yes |
| Payment timing | Once | Twice (fee + balance) |

Both live under the Warmpawz Pay brand umbrella but serve different intents — **walk-in settlement** vs **scheduled care**.

---

## 8. Wireframe Descriptions

### 8.1 Vendor profile

- Existing **Book Appointment** button remains primary for services
- Optional secondary **Pay Bill** for walk-in (existing)
- No change to discovery layout; booking fee model is invisible until summary

---

### 8.2 Booking summary (key new screen)

**Layout (top to bottom):**

- **Header:** “Confirm appointment”
- **Card — Appointment details:** Vendor name, service, date/time, pet, location style (clinic / home / video)
- **Card — Payment breakdown:**
  - Row: Service price → ₹800
  - Row: **Booking fee (pay now)** → **₹99** (accent color, bold)
  - Divider
  - Row: **Balance (pay after visit)** → ₹701 (muted)
- **Policy strip:** “Booking fee is non-refundable if you cancel within X hours” (wording from Admin policy)
- **Sticky footer:** Primary button **“Pay ₹99 & confirm”**; secondary “Back”

**Empty/error states:** If fee cannot be determined, show friendly error and block payment — do not show ₹0 without explicit free-booking policy.

---

### 8.3 Payment screen (booking fee only)

- Title: “Pay booking fee”
- Amount due: ₹99 (large)
- Line: “Remaining ₹701 due after your visit”
- Standard payment method selection (UPI, card, etc.)
- Trust line: Secured by Warmpawz / Razorpay
- No editable amount field

---

### 8.4 Confirmation screen

- Success illustration
- “Appointment confirmed”
- Date, time, vendor, booking reference
- **Paid now:** ₹99
- **Due at visit:** ₹701
- Actions: Add to calendar, View appointment, Pay balance (disabled until policy allows early pay)

---

### 8.5 Appointment detail (post-booking)

- Status chip: Confirmed / Completed / Cancelled
- **Payment section:**
  - Booking fee — Paid ₹99 on [date]
  - Balance — Due ₹701 / Paid ₹701 on [date]
- CTA when balance due: **Pay now** (if in-app balance enabled) or “Pay at clinic”

---

### 8.6 Vendor booking detail

- Customer, pet, slot, service
- **Payment block:**
  - Booking fee: Received ✓
  - Balance: Pending / Received
- Actions: Request balance payment, Mark balance received (cash/UPI)

---

### 8.7 Admin — booking fee configuration

- **Section: Appointment booking fee**
  - Default fee input (₹)
  - Table: Category (Vet, Grooming, …) | Service mode (Clinic, Home, Video) | Fee | Active
  - Optional vendor-level override table
- **Preview:** “Customer booking vet clinic visit will pay ₹99 now”
- Save / publish with confirmation toast

---

## 9. Product Rules

### 9.1 Booking fee

| Rule | Description |
|------|-------------|
| RF-01 | Booking fee is **fixed by Admin**, not entered by customer |
| RF-02 | Booking fee is **never greater than** total service price |
| RF-03 | If service price ≤ booking fee, customer pays service price only (full amount as “fee”) |
| RF-04 | Free services (₹0) skip payment step unless policy requires symbolic fee |
| RF-05 | Booking fee applies **once per appointment**, not per pet if multi-pet policy bundles |

### 9.2 Slot & confirmation

| Rule | Description |
|------|-------------|
| RF-06 | Slot is **reserved only after** booking fee payment succeeds |
| RF-07 | Unpaid booking attempts release slot after defined hold window |
| RF-08 | Confirmed appointment appears in customer and vendor lists immediately after fee payment |

### 9.3 Balance

| Rule | Description |
|------|-------------|
| RF-09 | Balance = service price (incl. agreed taxes/fees per policy) minus booking fee already paid |
| RF-10 | Balance may be paid in-app or marked received offline by vendor |
| RF-11 | Service completion may require balance settled per Admin policy (strict vs relaxed) |

### 9.4 Cancellation & refund

| Rule | Description |
|------|-------------|
| RF-12 | Cancellation policy defines whether booking fee is refunded, partially refunded, or forfeited |
| RF-13 | If appointment cancelled by vendor, booking fee refunded unless policy states otherwise |
| RF-14 | Balance never charged if appointment cancelled before service |

### 9.5 Coexistence with Pay Bill

| Rule | Description |
|------|-------------|
| RF-15 | Pay Bill and Book Appointment are **independent journeys** on the same vendor profile |
| RF-16 | Pay Bill discount rules do **not** automatically apply to booking fee |
| RF-17 | Customer may use Pay Bill after an appointment to pay an **additional** walk-in bill (e.g. medicines) — separate transaction |

### 9.6 Packages & promotions

| Rule | Description |
|------|-------------|
| RF-18 | Active package sessions may **waive booking fee** per Admin policy |
| RF-19 | Promotions apply to service price; booking fee logic defined separately (fee waived vs fee discounted) |

---

## 10. Configuration Rules (Admin)

### 10.1 Hierarchy (most specific wins)

```
Per-vendor override
    ↓
Per category + service mode (e.g. Vet · Clinic)
    ↓
Platform default booking fee
```

### 10.2 Configurable parameters

| Parameter | Example | Notes |
|-----------|---------|-------|
| Default booking fee | ₹99 | Platform-wide |
| Category fee | Grooming ₹49 | Optional |
| Service mode fee | Home visit +₹20 | Optional surcharge on base fee |
| Vendor override | Partner clinic ₹149 | Pilot or premium |
| Minimum service price for fee | ₹200 | Below this, fee = full price or waived |
| Hold window (unpaid slot) | 10 minutes | Customer-facing timer optional |
| Balance collection mode | In-app + offline | Toggle per category |
| Cancellation refund window | 24 hours full refund | Tied to booking fee policy |

### 10.3 Enablement

- Admin **opts vendors in** to booking-fee appointment model
- Vendors not enabled continue existing **full upfront** booking behaviour until migrated

---

## 11. Edge Cases

| Scenario | Expected behaviour |
|----------|-------------------|
| Customer closes app during payment | Slot held until timeout; retry from appointment draft or “Complete payment” |
| Payment succeeds but confirmation screen fails | Appointment still confirmed; customer sees it in My Bookings |
| Service price changes after booking fee paid | Balance recalculated per policy; customer notified if increase |
| Customer no-shows | Booking fee forfeited per policy; balance not collected |
| Vendor cancels | Booking fee refunded; apology notification |
| Double booking same slot | Second customer blocked at slot selection |
| Booking fee ₹99, service ₹99 | Customer pays ₹99 once; balance ₹0 |
| Partial package coverage | Fee waived or balance reduced per package rules |
| Customer pays balance twice | Second payment blocked; support escalation path |
| Offline balance at clinic, no vendor mark | Customer can upload proof or support reconciles |
| Tele-consultation | Same fee model; balance may be due before video link unlocks (policy) |

---

## 12. Notifications

### 12.1 Customer

| Trigger | Channel | Message intent |
|---------|---------|----------------|
| Booking fee payment success | Push, SMS, in-app | Confirmed slot; fee paid; balance due |
| Reminder 24h before visit | Push | Appointment tomorrow; balance ₹X due at visit |
| Balance payment link sent | Push, SMS | Pay remaining amount |
| Balance received | Push, in-app | Payment complete; thank you |
| Cancellation | Push, email | Refund status of booking fee |
| Payment failed | In-app | Retry booking fee |

### 12.2 Vendor

| Trigger | Channel | Message intent |
|---------|---------|----------------|
| New confirmed booking | Push, in-app | New appointment; deposit received |
| Balance pending day-of | Push | Customer X — balance ₹Y outstanding |
| Customer paid balance in app | Push | Balance settled |
| Cancellation by customer | Push | Slot freed; fee disposition |

### 12.3 Admin / ops

| Trigger | Channel | Message intent |
|---------|---------|----------------|
| Refund failure | Internal alert | Manual intervention |
| Unusual dispute volume | Dashboard | Policy review |

---

## 13. Booking Lifecycle

```
[Draft / slot selected]
        │
        ▼
[Awaiting booking fee] ──timeout──► [Slot released]
        │
        │ payment success
        ▼
[Confirmed]
        │
        ├── reschedule ──► [Confirmed] (fee transfer policy)
        ├── cancel ──► [Cancelled] (refund rules)
        │
        ▼
[In progress / checked in]
        │
        ▼
[Completed]
        │
        └── balance settled ──► [Closed]
```

**Status labels (customer-facing):**

- Awaiting payment
- Confirmed
- Completed
- Cancelled

**Vendor-facing additions:**

- Deposit received
- Balance pending / Balance received

---

## 14. Payment Lifecycle

### 14.1 Two-phase model

| Phase | Amount | When | Who initiates |
|-------|--------|------|---------------|
| **Phase 1 — Booking fee** | Admin-configured (e.g. ₹99) | At booking confirmation | Customer |
| **Phase 2 — Balance** | Service total − booking fee | After booking / at or after visit | Customer or vendor-triggered |

### 14.2 Payment states (per phase)

```
[Not started]
     │
     ▼
[Pending]
     │
     ├── success ──► [Paid]
     ├── fail ──► [Failed] ── retry
     └── cancel ──► [Cancelled]
```

### 14.3 Receipts

- Separate receipt for booking fee and balance
- Appointment detail shows both with timestamps
- Customer support can reference booking ID and both payment IDs

---

## 15. Admin Configuration (summary)

| Area | Admin controls |
|------|----------------|
| **Fees** | Default, category, mode, vendor override |
| **Enablement** | Which vendors use booking-fee model |
| **Policies** | Cancellation, refund, no-show, balance timing |
| **Reporting** | Fees collected, balances outstanding, completion rate |
| **Pilot** | Roll out by city, category, or vendor list |

**Pay Bill (existing):** Admin continues to manage vendor catalogue and **bill discounts** independently.

---

## 16. Risks

| Risk | Likelihood | Impact | Mitigation (product) |
|------|------------|--------|----------------------|
| Customer confusion: fee vs full price | High | Support load, distrust | Clear summary UX; plain language |
| Vendor expects full upfront payment | Medium | Adoption friction | Vendor comms; opt-in rollout |
| Disputes on balance at clinic | Medium | Churn | Receipts, vendor mark-paid, support playbook |
| No-show despite fee | Medium | Vendor dissatisfaction | Tune fee amount; stricter forfeiture policy |
| Low fee doesn’t reduce drop-off | Medium | ROI unclear | Pilot metrics; A/B vs full upfront |
| Two payment products feel fragmented | Low | Brand confusion | Unified Warmpawz Pay naming; distinct CTAs |
| Refund policy backlash | Medium | Reputation | Transparent policy at summary step |

---

## 17. Rollout Strategy

### Phase 0 — Discovery & sign-off

- Finalise default fee (₹99?), categories, cancellation policy
- Legal/compliance review of two-phase payments and refund copy

### Phase 1 — Pilot (4–8 weeks)

- **Scope:** One category (e.g. veterinary clinic visits), one city, 10–20 vendors
- **Model:** Booking fee only; balance via vendor mark-paid + optional in-app link
- **Metrics:** Booking completion rate, no-show rate, support tickets, vendor NPS

### Phase 2 — Expand categories

- Grooming, training, etc. with category-specific fees
- Admin self-serve configuration for category fees

### Phase 3 — Scale

- Default opt-in for new eligible vendors
- Migrate selected existing vendors from full upfront
- Marketing: “Book for ₹99” campaign

### Phase 4 — Optimise

- Tune fees by data
- Optional: dynamic fees by demand (future, out of v1 scope)

### Rollback plan

- Admin disables booking-fee model per vendor or globally
- Affected vendors revert to full upfront booking without customer data loss

---

## 18. Metrics & KPIs

| Metric | Definition | Target (pilot TBD) |
|--------|------------|-------------------|
| Booking completion rate | Confirmed / reached summary | ↑ vs baseline |
| Payment step conversion | Fee paid / reached payment | ↑ |
| No-show rate | No-shows / confirmed | ↓ |
| Balance collection rate | Balance paid / completed appointments | > X% |
| Support contacts per 1k bookings | Fee/balance disputes | < baseline |
| Vendor opt-in rate | Enabled / invited | Pilot learning |

---

## 19. Open Product Questions

1. **Default booking fee:** Is ₹99 universal, or category-specific from day one?
2. **Vendor opt-in:** Can vendors refuse booking-fee model and stay on full upfront?
3. **Balance timing:** Must balance be paid before service starts, or only after?
4. **Tele appointments:** Same ₹99 fee, or different rules for video consults?
5. **Package holders:** Waive booking fee entirely or reduce balance only?
6. **Promotions:** Can booking fee be discounted during campaigns?
7. **Reschedule:** Does booking fee transfer to new slot or require new payment?
8. **Multi-service booking:** One fee or fee per service?
9. **Refund SLA:** How quickly must booking fee refunds appear after cancellation?
10. **Branding:** Customer-facing name — “Booking fee”, “Slot fee”, or “Reservation deposit”?
11. **Pay Bill cross-sell:** After appointment, prompt Pay Bill for add-ons (medicines)?
12. **Full upfront fallback:** When Admin disables fee model, is migration automatic for in-flight bookings?

---

## 20. Document Approval

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Manager | | | Pending |
| Design Lead | | | Pending |
| Business / Ops | | | Pending |
| Legal / Compliance | | | Pending |

---

## Appendix A — Glossary

| Term | Definition |
|------|------------|
| **Booking fee** | Fixed upfront amount (e.g. ₹99) paid to confirm an appointment |
| **Balance** | Remaining service amount due after booking fee |
| **Pay Bill** | Existing Warmpawz Pay flow: customer pays a walk-in bill with Admin discount |
| **Service price** | Listed price for the booked service before booking fee split |
| **Two-phase payment** | Booking fee at confirmation + balance after service |

---

## Appendix B — Comparison: Pay Bill vs Book Appointment

| | Pay Bill | Book Appointment + booking fee |
|---|----------|-------------------------------|
| **Intent** | Pay for services/products received or priced at counter | Reserve time for future service |
| **Slot** | No | Yes |
| **Customer enters amount** | Yes | No |
| **Admin configures** | Discount on bill | Fixed booking fee |
| **Payments** | One | Two (fee + balance) |
| **When used** | At or after visit, walk-in | Before visit, scheduled |

---

*End of PRD — product specification only. Technical design to follow after product sign-off.*
