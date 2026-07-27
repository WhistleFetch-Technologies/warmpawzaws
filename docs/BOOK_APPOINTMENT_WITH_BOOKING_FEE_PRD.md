# Book Appointment with Booking Fee

## Product Requirement Document (PRD)

**Product:** Warmpawz Pay  
**Feature:** Book Appointment with Booking Fee  
**Version:** 1.0  
**Status:** Draft — Stakeholder Review  
**Date:** 27 July 2026  
**Owner:** Product  
**Audience:** Product Managers · Business Stakeholders · Designers · Engineering Leads

---

# Executive Summary

Warmpawz Pay already helps customers **pay a bill** at a vendor—with Admin-controlled discounts on walk-in payments. This document proposes a complementary capability: **Book Appointment with Booking Fee**.

Instead of paying the full service price upfront to confirm an appointment, customers pay a **small, fixed booking fee** (for example ₹99, set by Admin). The **remaining balance** is paid after the appointment—at the clinic, at home, or through the app, depending on policy.

**Why this matters:** Full upfront payment is a major drop-off point in appointment booking. A low booking fee lowers the barrier to commitment while giving vendors confidence that the customer intends to show up. Admin retains control over fee amounts across categories and vendors—mirroring how Pay Bill discounts are centrally managed today.

**Recommendation:** Pilot the booking-fee model with veterinary clinic visits in a single market, measure booking and no-show improvement against today’s full-upfront flow, then expand by category with Admin-configured fees.

---

# Product Vision

**Every pet parent should be able to secure a quality appointment with a fair, transparent commitment—without paying the full cost before care is delivered.**

We extend Warmpawz Pay from *“pay what you owe at the counter”* to *“reserve your slot with confidence.”* The booking fee is not a hidden charge—it is a clear, upfront commitment that unlocks a confirmed appointment, with the service balance settled after the visit.

**North star:** Increase completed appointments while reducing no-shows—without sacrificing vendor trust or customer clarity.

---

# Business Problem

## Existing problems

### For customers

- **Payment shock at checkout:** Seeing the full consultation or grooming price upfront causes hesitation and abandonment.
- **Unclear value before the visit:** Paying 100% before service feels risky, especially for first-time vendor relationships.
- **Inconsistent offline deposits:** Some vendors ask for cash or UPI advances outside the app—fragmented, untrackable, and dispute-prone.

### For vendors

- **No-shows and late cancellations:** Empty slots mean lost revenue and idle staff.
- **Low-quality bookings:** Customers who book without commitment treat slots casually.
- **Manual follow-up for payment:** Staff chase balances at the counter without a shared record of what was already paid online.

### For the platform

- **Booking and Pay Bill feel disconnected:** Two high-value payment moments exist, but only Pay Bill lives under Warmpawz Pay today.
- **One-size-fits-all upfront payment:** The same full-payment model applies whether the service costs ₹200 or ₹5,000—no flexibility for Admin or category strategy.
- **Missed conversion:** Industry patterns show deposit-based booking improves completion; Warmpawz has not yet offered this for appointments.

## Why this feature is needed

Pay Bill proved that customers and vendors will trust Warmpawz for **location-based payments** when rules are clear and Admin sets commercial terms. Appointment booking is the platform’s highest-intent flow—but it still demands **full payment before confirmation**, which conflicts with how many customers prefer to commit (small deposit now, rest later).

Booking Fee closes that gap using the **same product philosophy as Pay Bill**: Admin configures commercial terms; the customer sees transparent pricing; the vendor receives a reliable signal of intent; the platform owns the payment record.

## Business opportunity

| Opportunity | Potential impact |
|-------------|------------------|
| Higher booking completion | More confirmed appointments from the same traffic |
| Lower no-show rate | Booking fee as skin-in-the-game |
| Stronger Warmpawz Pay brand | Unified payment story across walk-in and scheduled care |
| Admin-led monetisation levers | Category-specific fees without renegotiating with every vendor |
| Reduced support friction | Single source of truth for deposit vs balance |

---

# Goals

## Business Goals

1. **Increase appointment booking completion rate** (summary → confirmed) by reducing upfront payment friction.
2. **Reduce no-show rate** for vendors on the booking-fee model vs full upfront.
3. **Establish Admin-controlled booking fees** as a standard platform capability.
4. **Grow Warmpawz Pay adoption** beyond walk-in bill payment.
5. **Maintain or improve vendor satisfaction** with payment clarity and fewer empty slots.

## User Goals

| User | Goal |
|------|------|
| **Customer** | Book quickly with a small, predictable payment; know exactly what is left to pay after the visit |
| **Vendor** | See confirmed bookings with deposit received; collect or track balance without ambiguity |
| **Admin** | Set and adjust fees by category and vendor; monitor performance and exceptions |
| **Support** | Resolve disputes with clear payment and booking history |

## Success Criteria

Success is achieved when, in pilot markets:

- Booking **completion rate** (reached payment step → confirmed) improves measurably vs baseline.
- **No-show rate** decreases vs baseline for the same vendor cohort.
- **Balance collection rate** (completed appointments with balance settled) meets agreed threshold (TBD in pilot).
- **Support ticket rate** per 1,000 booking-fee appointments does not exceed baseline full-upfront bookings.
- **Vendor opt-in and retention** in pilot meets agreed target (TBD).
- Admin can **change default booking fee** and category overrides **without a product emergency release** (operational success criterion—implementation approach out of scope for this PRD).

---

# Non Goals

The following are **explicitly out of scope** for this feature’s initial releases:

| Non-goal | Rationale |
|----------|-----------|
| Replacing or merging Pay Bill | Independent journey; same brand, different intent |
| Customer-entered booking fee amount | Admin sets fee; customer does not negotiate amount |
| Vendor self-service fee configuration | Admin owns commercial terms in v1 |
| Wallet, loyalty, or membership credits for booking fee | Complexity; future consideration |
| Dynamic surge pricing of booking fee | v1 uses fixed Admin-configured amounts |
| International / multi-currency | India-first |
| Replacing full upfront booking globally on day one | Pilot and phased rollout |
| Insurance or third-party payer flows | Separate product line |
| Subscription or package redesign | Packages may integrate via rules, not rebuild |
| Legal/tax engine design | Compliance input required separately |

---

# Existing Product Analysis

## Warmpawz Pay → Pay Bill (current product)

Pay Bill is Warmpawz’s **walk-in payment** product: the customer pays a bill at a vendor without booking a slot. Admin configures **discounts** on the amount the customer enters.

### Customer journey (Pay Bill)

1. **Discover** — Customer finds Warmpawz Pay entry (e.g. scan/pay entry point) and browses participating vendors.
2. **Select vendor** — Opens vendor pay experience; sees vendor identity, offer/discount messaging.
3. **Enter bill amount** — Customer types what they owe (or selects a quick amount).
4. **Preview savings** — Sees discount applied per Admin rules; sees amount to pay now.
5. **Pay** — Completes payment through standard checkout.
6. **Confirmation** — Sees success state with amount saved/paid.
7. **History** — Views past Pay Bill transactions in payment history.

**Customer expectation:** Fast, transparent payment at visit time—no appointment required.

### Vendor journey (Pay Bill)

1. **Eligibility** — Vendor is published to Pay Bill catalogue by Admin.
2. **Notification** — Receives notice of payment (when notification product is live).
3. **History** — Sees walk-in payments in transaction history.
4. **Settlement** — Receives payout per platform settlement policy.

**Vendor expectation:** Incremental walk-in revenue through Warmpawz; no slot management.

### Admin journey (Pay Bill)

1. **Catalogue** — Adds/removes vendors; publishes or unpublishes visibility.
2. **Commercial terms** — Sets discount percentage (and related rules) per merchant.
3. **Monitor** — Views payment volume, discounts given, merchant participation.
4. **Support** — Handles exceptions via payment records.

**Admin expectation:** Control which vendors appear and what discount customers receive—without vendor-by-vendor engineering.

### Product philosophy to carry forward

| Principle | Pay Bill | Apply to Booking Fee |
|-----------|----------|----------------------|
| Admin sets commercial terms | Discount % | Fixed booking fee |
| Customer sees breakdown before pay | Bill − discount = pay now | Service price − booking fee = pay later |
| Transparent, single payment moment | One payment | Two payments, clearly labeled |
| Vendor trust via platform record | Payment history | Deposit + balance history |
| Opt-in vendor participation | Catalogue publish | Appointment fee enablement |

---

# Proposed Product

## Book Appointment with Booking Fee

### Vision

Customers book appointments by paying a **small, Admin-configured booking fee** to confirm their slot. The **balance** of the service price is paid after the appointment—aligned with when value is delivered.

### Customer experience

- From vendor profile, taps **Book Appointment** (not Pay Bill).
- Selects service, slot, and pet as today.
- On summary, sees **three numbers that matter**: service price, **booking fee (pay now)**, **balance (pay after visit)**.
- Pays only the booking fee to confirm.
- Receives confirmation with clear balance reminder.
- After visit, pays balance in app or at clinic per policy.
- Full history shows both payments tied to one appointment.

### Vendor experience

- Sees **confirmed** bookings only after booking fee is paid.
- Dashboard shows **deposit received** and **balance pending** per appointment.
- Can request balance payment or mark balance received (e.g. cash/UPI at clinic).
- Pay Bill walk-ins remain separate from scheduled appointments.

### Admin experience

- Sets **platform default booking fee** (e.g. ₹99).
- Overrides by **category** (vet, grooming, training) and optionally **service mode** (clinic, home, video).
- Overrides for **individual vendors** when needed.
- Enables vendors for booking-fee appointment model.
- Defines cancellation, refund, and balance policies.
- Monitors KPIs and pilot performance.

---

# User Personas

## Customer — Priya, 32, Bengaluru

**Profile:** Working professional, two dogs. Books vet and grooming via mobile.

**Behaviours:** Compares vendors by reviews and distance. Abandons checkout when full price feels high for a first visit.

**Needs:** Low commitment to try a new clinic; clarity on what she owes later; receipts for both payments.

**Frustrations:** Paying ₹1,500 before knowing the doctor; vendors asking for separate UPI deposits.

---

## Vendor — Dr. Mehta, Clinic Owner

**Profile:** Multi-doctor veterinary clinic, 40+ appointments/day.

**Behaviours:** Uses Warmpawz for discovery and bookings; staff manage front desk collections.

**Needs:** Fewer no-shows; visible deposit in system; easy balance collection day-of.

**Frustrations:** Blocked slots from no-shows; arguing with customers about what was “already paid online.”

---

## Admin — Kavita, Platform Operations

**Profile:** Owns commercial rules, vendor onboarding, and payment policies.

**Behaviours:** Configures Pay Bill discounts; runs pilots; reports to leadership.

**Needs:** One place to set booking fees; roll out by category; rollback without chaos.

**Frustrations:** Every new fee idea requiring custom vendor deals; unclear pilot metrics.

---

## Support — Arjun, Customer Support

**Profile:** Handles payment and booking disputes via CRM.

**Behaviours:** Looks up booking ID, payment status, refund state.

**Needs:** Single timeline: booking fee paid, balance due/paid, cancellation outcome.

**Frustrations:** Customers saying “I paid ₹99 but they charged full price again” with no unified view.

---

# User Stories

## Customer

| ID | Story | Acceptance (product-level) |
|----|-------|----------------------------|
| C-01 | As a customer, I want to book an appointment by paying a small booking fee so that I don’t pay the full price upfront. | Summary shows fee and balance; confirmation requires fee payment only. |
| C-02 | As a customer, I want to see exactly what I pay now vs later before I pay so that I trust the transaction. | Summary and payment screens show both amounts in plain language. |
| C-03 | As a customer, I want confirmation with appointment details and balance reminder so that I know my slot is secure. | Confirmation includes date, time, vendor, fee paid, balance due. |
| C-04 | As a customer, I want to pay my balance after the visit so that I pay when service is delivered. | Balance payment path available per policy (in-app or at clinic). |
| C-05 | As a customer, I want both payments in my history so that I have records for disputes or taxes. | Appointment shows fee and balance as separate line items with dates. |
| C-06 | As a customer, I want clear cancellation rules for my booking fee so that I know if I get a refund. | Policy shown before payment; refund outcome communicated on cancel. |

## Vendor

| ID | Story | Acceptance (product-level) |
|----|-------|----------------------------|
| V-01 | As a vendor, I want to see only confirmed appointments after booking fee is paid so that my calendar reflects real commitments. | Unpaid attempts do not appear as confirmed bookings. |
| V-02 | As a vendor, I want to see deposit and balance separately so that staff know what to collect. | Booking detail shows fee received and balance status. |
| V-03 | As a vendor, I want to mark balance received when customer pays cash/UPI so that records stay accurate. | Offline payment can be recorded with audit trail. |
| V-04 | As a vendor, I want to request balance payment from the customer so that collection is faster. | Customer receives request with amount and pay action. |
| V-05 | As a vendor, I want Pay Bill and appointments to stay separate so that walk-in payments don’t confuse bookings. | Distinct flows and records. |

## Admin

| ID | Story | Acceptance (product-level) |
|----|-------|----------------------------|
| A-01 | As Admin, I want a default booking fee for the platform so that new categories have a baseline. | Default applies when no override exists. |
| A-02 | As Admin, I want category-level fees so that grooming and vet can differ. | Category override takes precedence over default. |
| A-03 | As Admin, I want per-vendor overrides for pilots and partners. | Vendor override wins over category and default. |
| A-04 | As Admin, I want to enable/disable booking-fee model per vendor. | Disabled vendors use existing full-upfront booking. |
| A-05 | As Admin, I want cancellation and refund rules for booking fees. | Policy drives customer-facing messaging and outcomes. |
| A-06 | As Admin, I want reporting on fees, balances, and exceptions. | Dashboard surfaces pilot and production metrics. |

## Support

| ID | Story | Acceptance (product-level) |
|----|-------|----------------------------|
| S-01 | As support, I want one view of booking fee and balance so that I can resolve disputes quickly. | Single appointment timeline with payment states. |
| S-02 | As support, I want to see cancellation and refund status so that I can explain outcomes to customers. | Refund state visible and consistent with policy. |
| S-03 | As support, I want to distinguish Pay Bill vs appointment payments so that I route issues correctly. | Transaction type clearly labeled. |

---

# Customer Journey

End-to-end journey for Book Appointment with Booking Fee:

```
Discovery
    ↓
Vendor Profile
    ↓
Book Appointment
    ↓
Booking (service · slot · pet · details)
    ↓
Summary (fee + balance breakdown)
    ↓
Booking Fee Payment
    ↓
Confirmation
    ↓
Appointment (visit / service delivery)
    ↓
Final Balance Payment
    ↓
History & completion
```

## Stage-by-stage

| Stage | Customer goal | Key moments |
|-------|---------------|-------------|
| **Discovery** | Find the right vendor | Search, categories, reviews, distance |
| **Vendor profile** | Decide to book | Services, hours, **Book Appointment** CTA |
| **Book Appointment** | Start booking | Intent: scheduled care, not walk-in bill |
| **Booking** | Configure appointment | Service, date/time, pet, location mode |
| **Summary** | Understand cost split | Service price · booking fee · balance · policy |
| **Booking fee payment** | Confirm slot | Pay fixed fee only; no amount editing |
| **Confirmation** | Trust slot is held | Reference, calendar, balance reminder |
| **Appointment** | Receive service | Show up; may pay balance at venue |
| **Final balance payment** | Settle remainder | In-app or verified offline payment |
| **History** | Record keeping | Completed appointment with both payments |

---

# Vendor Journey

| Stage | Vendor goal | Key moments |
|-------|-------------|-------------|
| **Onboarding** | Participate in program | Admin enables booking-fee model for vendor |
| **New booking** | Prepare for visit | Notification: confirmed booking + deposit received |
| **Calendar** | Plan day | Confirmed slots show deposit/balance status |
| **Pre-visit** | Reduce surprises | Optional balance reminder to customer |
| **Day of service** | Collect balance if needed | See pending balance; request pay or mark received |
| **Completion** | Close appointment | Mark complete when service delivered and balance resolved |
| **Reporting** | Reconcile earnings | Deposit and balance in earnings/history views |
| **Pay Bill (parallel)** | Walk-in revenue | Separate from appointment deposits |

---

# Admin Journey

| Stage | Admin goal | Key moments |
|-------|------------|-------------|
| **Strategy** | Set commercial model | Decide default fee, pilot scope, categories |
| **Configuration** | Encode rules | Default → category → vendor overrides; policies |
| **Enablement** | Roll out vendors | Publish vendors to booking-fee programme |
| **Launch** | Communicate change | Vendor and customer comms (ops/marketing) |
| **Monitor** | Track health | KPIs, exceptions, support volume |
| **Iterate** | Tune fees and policy | Adjust by data; expand or rollback |
| **Pay Bill (parallel)** | Maintain walk-in product | Discount catalogue independent of booking fees |

---

# UX Flow

Screen-by-screen **experience** description—no visual design specification.

---

## 1. Vendor profile

**Purpose:** Decide whether to book or pay a walk-in bill.

**Primary CTA:** Book Appointment  
**Secondary CTA:** Pay Bill (existing, when available)

**User expectations:** Clear difference—“Book a future slot” vs “Pay my bill now.” No booking fee amount shown here yet.

---

## 2. Service & slot selection

**Purpose:** Build the appointment (service, time, pet, location).

**Primary CTA:** Continue to summary  
**Secondary CTA:** Back

**User expectations:** Same familiarity as today’s booking; no payment yet.

---

## 3. Booking summary

**Purpose:** **Critical decision screen**—customer commits mentally before paying.

**Primary CTA:** Pay [booking fee amount] and confirm  
**Secondary CTA:** Back / edit details

**User expectations:**
- See appointment details (who, what, when, where).
- See **Pay now:** booking fee (prominent).
- See **Pay after visit:** balance (clear but secondary).
- See cancellation/refund policy in plain language.
- No surprise fees at payment step.

---

## 4. Booking fee payment

**Purpose:** Collect booking fee only.

**Primary CTA:** Complete payment  
**Secondary CTA:** Cancel (returns to summary; slot may expire)

**User expectations:**
- Amount is **fixed**—not editable.
- Reminder: “Remaining [balance] due after your visit.”
- Standard trusted checkout experience.
- Failure allows retry without losing clarity on what went wrong.

---

## 5. Confirmation

**Purpose:** Reinforce success and set expectations for balance.

**Primary CTA:** View appointment  
**Secondary CTA:** Add to calendar / return home

**User expectations:**
- “Appointment confirmed” — unambiguous.
- Booking fee paid; balance still due.
- When and how to pay balance (at clinic vs in app).

---

## 6. Appointment detail (pre-visit)

**Purpose:** Ongoing reference until visit.

**Primary CTA:** Contextual (directions, reschedule if allowed)  
**Secondary CTA:** Cancel (policy-driven)

**User expectations:** Status = Confirmed; payment section shows fee paid, balance pending.

---

## 7. Balance payment (post-booking / day-of)

**Purpose:** Settle remaining amount.

**Primary CTA:** Pay balance (in-app) OR informational “Pay at clinic”  
**Secondary CTA:** View receipt / contact support

**User expectations:** Amount matches summary; no duplicate charge for booking fee.

---

## 8. Completion & history

**Purpose:** Closed loop and records.

**Primary CTA:** Rate/review (if product includes)  
**Secondary CTA:** Book again

**User expectations:** Appointment marked completed; both payments visible; suitable for support reference.

---

## Vendor: booking detail

**Purpose:** Operational view for front desk and practitioners.

**Primary CTA:** Mark complete / request balance  
**Secondary CTA:** Contact customer / cancel (policy)

**User expectations:** Deposit ✓; balance status obvious; distinction from Pay Bill transactions.

---

## Admin: booking fee configuration

**Purpose:** Set and maintain fee rules.

**Primary CTA:** Save / publish configuration  
**Secondary CTA:** Preview impact (“Vet clinic booking → ₹99 fee”)

**User expectations:** Hierarchy clear; changes apply prospectively unless policy states otherwise for in-flight bookings.

---

# Product Rules

## Booking fee ownership

| Rule | Description |
|------|-------------|
| BF-01 | Booking fee amount is **owned and set by Admin**, not customer or vendor (v1). |
| BF-02 | Booking fee applies **per appointment** unless product policy defines bundled multi-pet rules. |
| BF-03 | Booking fee **cannot exceed** total service price. |
| BF-04 | If service price is zero, booking proceeds without fee unless Admin mandates symbolic fee for free services. |
| BF-05 | Booking fee is **separate from Pay Bill discounts**—Pay Bill rules do not auto-apply to appointments. |

## Payment rules

| Rule | Description |
|------|-------------|
| PAY-01 | **Phase 1:** Customer pays booking fee to confirm appointment. |
| PAY-02 | **Phase 2:** Customer pays balance after booking, timing per Admin policy (at visit or earlier if allowed). |
| PAY-03 | Customer **cannot edit** booking fee amount at checkout. |
| PAY-04 | Each phase generates a **distinct payment record** linked to the same appointment. |
| PAY-05 | Double payment of the same phase is prevented. |
| PAY-06 | Offline balance (cash/UPI at clinic) may be recorded by vendor with audit trail. |

## Booking rules

| Rule | Description |
|------|-------------|
| BK-01 | Slot is **confirmed only after** booking fee payment succeeds. |
| BK-02 | Unpaid booking attempts release slot after **hold window** (Admin-configurable). |
| BK-03 | Confirmed appointments appear in customer and vendor appointment lists immediately. |
| BK-04 | Vendors on booking-fee model only offer this payment split; others remain full upfront until migrated. |

## Cancellation rules

| Rule | Description |
|------|-------------|
| CAN-01 | Customer cancellation policy is **shown before** booking fee payment. |
| CAN-02 | Cancellation time relative to appointment start determines **fee refund eligibility**. |
| CAN-03 | Vendor-initiated cancellation **defaults to booking fee refund** unless policy excepts. |
| CAN-04 | Cancelled appointments **never charge balance** if service was not delivered. |

## Refund rules

| Rule | Description |
|------|-------------|
| REF-01 | Refunds apply to **booking fee** per cancellation policy; balance refunded only if erroneously charged. |
| REF-02 | Partial refunds (if ever allowed) follow Admin policy with customer notification. |
| REF-03 | Refund timeline communicated to customer at cancellation. |

## Balance payment rules

| Rule | Description |
|------|-------------|
| BAL-01 | Balance = service price (per agreed tax/fee display policy) **minus booking fee paid**. |
| BAL-02 | Balance may be collected in-app, at clinic, or both—per Admin/vendor programme settings. |
| BAL-03 | Service completion may require balance settlement per strict/relaxed Admin policy. |
| BAL-04 | If service price **increases** after booking fee paid, policy defines customer notification and adjusted balance. |

## Eligibility rules

| Rule | Description |
|------|-------------|
| EL-01 | Vendor must be **enabled** for booking-fee appointment model. |
| EL-02 | Vendor must meet platform **trust/eligibility** standards (same spirit as Pay Bill participation). |
| EL-03 | Customer must be **authenticated** to book and pay. |
| EL-04 | Package-covered sessions may **waive or reduce** booking fee per Admin rules. |

---

# Configuration Rules

Admin configures booking fees in a **precedence hierarchy**. When multiple rules apply, the **most specific wins**.

```
Platform Default
        ↓
Category (e.g. Veterinary, Grooming)
        ↓
Category + Service Mode (e.g. Vet · Clinic vs Home)
        ↓
Vendor Override
```

## Platform default

- Single baseline booking fee (example: **₹99**).
- Applies when no lower-level override exists.

## Category

- Different fees by service category reflect different no-show cost and ticket size.
- Example: Grooming ₹49, Veterinary ₹99, Training ₹79.

## Category + service mode

- Optional refinement: home visit may add surcharge or use distinct fee.
- Example: Vet clinic ₹99, Vet home visit ₹129.

## Vendor override

- For strategic partners, premium clinics, or pilot cohorts.
- Example: Partner chain ₹149 booking fee.

## Precedence example

| Default | Category | Vendor override | **Customer pays** |
|---------|----------|-----------------|---------------------|
| ₹99 | Vet ₹99 | — | ₹99 |
| ₹99 | Grooming ₹49 | — | ₹49 |
| ₹99 | Vet ₹99 | Clinic X ₹149 | ₹149 |
| ₹99 | — | Clinic Y disabled | Full upfront (not on booking-fee model) |

## Policy configuration (non-fee)

Admin also configures: hold window, cancellation/refund windows, balance collection mode, package waivers, and pilot enablement lists—separate from fee amount but equally important.

---

# Edge Cases

| Scenario | Product behaviour |
|----------|-----------------|
| **Payment failure (booking fee)** | Appointment not confirmed; customer can retry; slot released after hold expires |
| **Payment success, confirmation not shown** | Appointment still confirmed; visible in My Appointments |
| **No-show** | Booking fee disposition per policy (typically forfeited); balance not charged |
| **Vendor cancellation** | Booking fee refunded; customer notified; slot freed |
| **Customer cancellation (early)** | Full or partial fee refund per policy |
| **Customer cancellation (late)** | Fee forfeited or partial refund per policy |
| **Price change after fee paid** | Balance adjusted; customer notified if increase |
| **Reschedule** | Fee transfers to new slot OR policy requires re-booking—product decision required |
| **Multiple pets** | Single fee vs fee per pet—defined by Admin policy |
| **Active package** | Fee waived or balance reduced per package rules |
| **Promotion on service** | Applies to service price; booking fee handling defined (waived vs unchanged) |
| **Offline balance at clinic** | Vendor marks received; customer sees updated status |
| **Customer pays balance twice** | Second payment blocked; support escalation |
| **Dispute: “charged full price again”** | Support uses unified appointment payment timeline |
| **Tele / video appointment** | Same fee model unless category policy differs; balance timing may be before session |
| **Booking fee equals service price** | Single payment covers all; balance zero |
| **Vendor not on booking-fee programme** | Customer sees existing full-upfront booking only |

---

# Notifications

## Customer

| Event | Intent |
|-------|--------|
| Booking fee payment success | Confirmation + balance reminder |
| 24h appointment reminder | Time/place + balance due if pending |
| Balance payment request | Action to pay remaining amount |
| Balance received | Thank you / receipt |
| Cancellation | Refund status on booking fee |
| Payment failed | Retry guidance |

## Vendor

| Event | Intent |
|-------|--------|
| New confirmed booking | Prepare schedule; deposit received |
| Day-of balance pending | Front desk awareness |
| Customer paid balance in app | No cash collection needed |
| Customer cancellation | Slot available; fee disposition |
| Vendor cancellation reminder | Policy compliance for refunds |

## Admin

| Event | Intent |
|-------|--------|
| Pilot threshold alerts | Conversion or dispute anomalies |
| Refund processing failures | Operational intervention |
| Weekly roll-up | Fees collected, balances outstanding |

## Support

| Event | Intent |
|-------|--------|
| Escalated dispute assigned | Full context in ticket |
| Refund SLA breach | Priority queue |

*Channels (push, SMS, email, in-app) to be defined with marketing and compliance—not prescribed in this PRD.*

---

# Booking Lifecycle

Conceptual states from product perspective:

```
Intent started
      ↓
Slot selected (provisional)
      ↓
Awaiting booking fee ──timeout──→ Slot released
      ↓
Confirmed (fee paid)
      ↓
      ├── Rescheduled → Confirmed (policy-dependent)
      ├── Cancelled → Closed (refund rules apply)
      ↓
In progress / checked in
      ↓
Completed (service delivered)
      ↓
Closed (balance settled or written off per policy)
```

**Customer-visible labels:** Awaiting payment · Confirmed · Completed · Cancelled  

**Vendor-visible additions:** Deposit received · Balance pending · Balance received

---

# Payment Lifecycle

Two-phase payment model:

## Phase 1 — Booking fee

```
Not started → Pending → Paid ✓
                ↓
              Failed → Retry
                ↓
              Cancelled (appointment not confirmed)
```

**Trigger:** Customer confirms on summary screen.  
**Outcome:** Appointment moves to Confirmed.

## Phase 2 — Balance

```
Not due → Due → Pending → Paid ✓
              ↓
            Failed → Retry
              ↓
            Recorded offline (vendor verified)
              ↓
            Waived (package/policy) → Closed
```

**Trigger:** Typically after booking; at or before/after visit per policy.  
**Outcome:** Appointment financial closure.

## Relationship

- Both phases link to **one appointment**.
- Pay Bill transactions **never** substitute for booking fee or balance.
- Refunds operate **per phase** according to policy.

---

# Reporting

Admin should monitor:

| Area | Questions reporting answers |
|------|----------------------------|
| **Volume** | How many booking-fee appointments vs full upfront? |
| **Conversion** | Where do customers drop off—summary vs payment? |
| **Fees collected** | Total booking fees by category, vendor, city |
| **Balances** | Outstanding balance · collection rate · ageing |
| **Cancellations** | Rate · fee refunds vs forfeitures |
| **No-shows** | Rate vs control group |
| **Vendor participation** | Enabled · active · churned |
| **Support** | Tickets per 1k appointments · top dispute types |
| **Pay Bill interaction** | Same customer using both products—incremental or cannibalisation |

---

# KPIs

| KPI | Definition | Why it matters |
|-----|------------|----------------|
| **Booking conversion rate** | Confirmed / reached summary | Core funnel health |
| **Payment conversion rate** | Fee paid / reached payment step | Checkout effectiveness |
| **No-show rate** | No-shows / confirmed appointments | Vendor value proposition |
| **Vendor adoption rate** | Enabled vendors actively receiving booking-fee bookings | Rollout success |
| **Booking completion rate** | Completed / confirmed | End-to-end success |
| **Balance collection rate** | Balance paid / completed appointments | Revenue realisation |
| **Booking fee revenue** | Sum of fees collected | Platform and vendor economics |
| **Support ticket rate** | Tickets / 1k booking-fee appointments | Operational cost |
| **Customer repeat booking rate** | Repeat within 90 days | Satisfaction proxy |
| **Refund rate** | Refunded fees / cancelled appointments | Policy tuning |

**Pilot baseline:** Compare each KPI to full-upfront booking cohort in same category and geography.

---

# Rollout Strategy

## Pilot

- **Scope:** One category (recommend veterinary clinic), one geography, limited vendor set (10–20).
- **Duration:** 4–8 weeks minimum for statistical learning.
- **Fee:** Admin default ₹99 (adjust if stakeholder sign-off differs).
- **Balance collection:** Vendor mark-paid + optional in-app balance link.
- **Success gate:** Conversion ↑ and no-show ↓ without support spike.

## Expansion

- Add categories with category-specific fees (grooming, training).
- Expand geography and vendor count.
- Refine policies from pilot learnings.

## General availability

- Booking-fee model default for **new eligible vendors** in supported categories.
- Migration plan for existing vendors (opt-in, not forced day one).
- Marketing campaign: “Book for ₹99” with clear balance messaging.

## Rollback

- Admin disables booking-fee model globally or per vendor.
- Vendors revert to full upfront booking.
- In-flight confirmed appointments honour existing fee/balance rules—no customer stranded mid-journey.

---

# Risks

## Business risks

| Risk | Mitigation |
|------|------------|
| Booking fee too low to affect no-shows | Pilot tuning; category differentiation |
| Booking fee too high—hurts conversion | A/B vs baseline; Admin adjustability |
| Cannibalisation of full upfront revenue timing | Model balance collection and cash flow with finance |
| Unclear ROI | Strict pilot KPIs and control cohort |

## Customer risks

| Risk | Mitigation |
|------|------------|
| Confusion: fee vs full price | Summary UX; glossary; support scripts |
| Feeling “charged twice” | Clear labels; receipts; policy transparency |
| Refund dissatisfaction | Explicit policy before pay |

## Vendor risks

| Risk | Mitigation |
|------|------------|
| Resistance to partial upfront | Opt-in pilot; vendor comms on no-show reduction |
| Balance collection burden | In-app pay + mark-paid; reminders |
| Reconciliation with Pay Bill | Separate records and training |

## Operational risks

| Risk | Mitigation |
|------|------------|
| Support volume spike | Playbooks; unified appointment payment view |
| Refund processing delays | SLA and escalation |
| Policy misconfiguration | Preview mode; staged publish; audit log |

---

# Open Product Questions

Requires explicit Product sign-off before build:

1. **Default booking fee:** Is ₹99 the platform default for all categories at launch?
2. **Naming:** Customer-facing term—“Booking fee”, “Reservation deposit”, or “Slot fee”?
3. **Vendor opt-out:** Can vendors stay on full upfront indefinitely?
4. **Balance timing:** Must balance be paid before service starts, or only after?
5. **Tele-consultation:** Same fee structure as clinic visits?
6. **Reschedule:** Does booking fee transfer or is a new fee required?
7. **Multi-pet appointments:** One fee or multiple?
8. **Packages:** Waive booking fee entirely or only reduce balance?
9. **Promotions:** Can campaigns reduce or waive booking fee?
10. **Strict completion:** Can vendor mark service complete if balance unpaid?
11. **Refund SLA:** Target time for booking fee refund after cancellation?
12. **Pay Bill cross-sell:** After appointment, prompt Pay Bill for add-ons (medicines)?
13. **Finance/settlement:** How are booking fee and balance recognised in vendor payouts? (Business decision—finance stakeholder)
14. **In-flight migration:** What happens to confirmed full-upfront bookings when vendor switches model?

---

# Glossary

| Term | Definition |
|------|------------|
| **Warmpawz Pay** | Platform payment brand covering Pay Bill and appointment payments |
| **Pay Bill** | Walk-in payment: customer pays a bill amount at vendor; Admin sets discount |
| **Book Appointment with Booking Fee** | Scheduled appointment confirmed by paying Admin-set fee; balance paid later |
| **Booking fee** | Fixed upfront amount (e.g. ₹99) to confirm appointment |
| **Balance** | Remaining service amount after booking fee |
| **Service price** | Listed price for booked service before split into fee + balance |
| **Full upfront booking** | Existing model: customer pays entire amount at booking |
| **Two-phase payment** | Booking fee (phase 1) + balance (phase 2) |
| **Confirmation** | Appointment state after successful booking fee payment |
| **No-show** | Customer did not attend confirmed appointment |

---

# Final Recommendation

**Proceed with Book Appointment with Booking Fee** as a strategic extension of Warmpawz Pay—using the same Admin-led commercial philosophy as Pay Bill, applied to scheduled care instead of walk-in bills.

**Recommended approach:**

1. **Keep Pay Bill and Book Appointment distinct** — separate CTAs, separate mental models, shared trust in Warmpawz Pay.
2. **Lead with clarity on the summary screen** — booking fee vs balance is the make-or-break UX moment.
3. **Pilot narrowly** — veterinary clinic, single market, Admin default ₹99, measure conversion and no-shows against control.
4. **Invest in vendor and support enablement** — deposit/balance visibility and dispute playbooks are as important as customer checkout.
5. **Resolve open product questions** — especially naming, reschedule, packages, and balance timing — before design freeze.

This PRD is intended for stakeholder review. Upon sign-off, Design may produce flows and visuals; Engineering Leads may estimate and plan delivery—without changing the product rules defined here without Product approval.

---

**Document approval**

| Role | Status |
|------|--------|
| Product Management | Pending |
| Business / GM | Pending |
| Design | Pending |
| Engineering Lead | Pending (estimate only post sign-off) |
| Finance / Compliance | Pending |
| Operations / Support | Pending |

---

*End of document*
