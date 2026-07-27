# Cover Page

| Field | Value |
|-------|-------|
| **Product Name** | Warmpawz Pay |
| **Feature Name** | Book Appointment with Booking Fee |
| **Document Title** | Product Requirement Document (PRD) |
| **Version** | 1.0 |
| **Status** | Draft — Pending Stakeholder Approval |
| **Date** | 27 July 2026 |
| **Document Owner** | Product Management |
| **Last Updated** | 27 July 2026 |

### Stakeholders

| Function | Role in this initiative |
|----------|-------------------------|
| Product Management | Document owner; scope and prioritisation |
| Business / GM | Commercial strategy and rollout approval |
| Design | Experience design and research |
| Engineering | Delivery estimate post sign-off (out of scope for this PRD) |
| QA | Test strategy derived from acceptance criteria |
| Finance | Fee economics, settlement policy, revenue recognition |
| Operations | Vendor onboarding and programme management |
| Customer Support | Dispute handling and playbook ownership |
| Compliance / Legal | Refund, disclosure, and consumer protection review |

---

# Executive Summary

## What is being built

**Book Appointment with Booking Fee** is a new appointment booking experience within Warmpawz Pay. Customers reserve a confirmed appointment by paying only a **small, Admin-configured Booking Fee** (for example ₹99). The **remaining service balance** is paid after the appointment—at the clinic, at home, or through the app, according to platform policy.

This is a **separate customer journey** from the existing **Pay Bill** flow, which serves walk-in bill payment with Admin-configured discounts. Both products share Warmpawz Pay’s trust, transparency, and Admin-controlled commercial model—but serve different moments: **scheduled care** versus **pay at visit**.

## Why it matters

Today, customers who want to book an appointment must typically pay the **full service price upfront** to confirm a slot. That creates friction, abandonment at checkout, and distrust—especially for first-time visits or higher-ticket services. Vendors suffer **no-shows** and idle capacity. The platform misses conversion that deposit-based booking models have proven in marketplace and healthcare-adjacent industries.

Booking Fee lowers the **psychological and financial barrier** to commitment while giving vendors a **credible signal** that the customer intends to attend. Admin retains **central control** over fee amounts—just as Pay Bill centralises discount policy.

## Expected business outcome

| Outcome | Description |
|---------|-------------|
| **Higher booking conversion** | More customers complete booking after viewing summary |
| **Lower no-show rate** | Booking Fee as meaningful commitment |
| **Stronger Warmpawz Pay brand** | Coherent payment story across walk-in and scheduled care |
| **Admin-led commercial flexibility** | Category and vendor-specific fees without bespoke deals |
| **Improved operational clarity** | Single record of deposit vs balance for support and vendors |

**Recommendation:** Pilot with veterinary clinic appointments in a defined market; compare KPIs to full-upfront booking; expand by category upon success.

---

# Product Vision

## Long-term vision

Warmpawz becomes the **trusted payment layer for all pet-care appointments**—where reserving time is as simple as paying a fair, transparent booking commitment, and settling the rest when care is delivered.

Customers never wonder *“Why am I paying everything before I’ve been seen?”* Vendors never wonder *“Will this slot actually fill?”* Admin never loses **control of commercial rules** to fragmented offline deposits.

## North Star

**Every appointment on Warmpawz should begin with confidence— a small, clear commitment today, and fair settlement after care is complete.**

---

# Product Principles

These principles guide every product decision for this feature.

| # | Principle | Meaning |
|---|-----------|---------|
| P1 | **Reduce booking friction** | Minimise upfront payment without removing commitment |
| P2 | **Transparent pricing** | Customer always sees pay-now vs pay-later before paying |
| P3 | **Customer trust** | No hidden fees; policies visible before payment |
| P4 | **Vendor confidence** | Confirmed means deposit received; balance status always clear |
| P5 | **Admin-controlled commerce** | Fees, policies, and enablement owned by platform—not ad hoc |
| P6 | **Consistent payment experience** | Warmpawz Pay feel across Pay Bill and appointments |
| P7 | **Separate journeys, shared brand** | Book Appointment ≠ Pay Bill; both under Warmpawz Pay |
| P8 | **Fail gracefully** | Payment failure, cancellation, and disputes have clear outcomes |
| P9 | **Measure before scale** | Pilot, learn, tune—do not globalise on assumption |
| P10 | **Support-ready by design** | Every state explainable to a customer on a phone call |

---

# Business Problem

## Current problems

### Customer problems

- **Full upfront payment feels unfair** before service is received, especially for new vendors or expensive consultations.
- **Abandonment at payment step** when the full amount appears on the summary screen.
- **Offline deposit chaos**—vendors request separate UPI or cash advances with no platform record.
- **Confusion after partial payment**—customers unsure what was paid online vs what is owed at the desk.
- **Weak recourse in disputes** without a unified payment timeline tied to the appointment.

### Vendor problems

- **No-shows and late cancellations** waste staff time and revenue.
- **Uncommitted bookings**—customers treat free or fully-refundable slots casually.
- **Manual balance collection** at front desk without system visibility of online deposit.
- **Two worlds:** walk-in Pay Bill payments vs appointments not connected in vendor mental model.

### Business problems

- **Conversion leakage** in the highest-intent funnel (appointment booking).
- **Pay Bill success not extended** to the larger appointment volume opportunity.
- **One payment model for all categories**—no lever for Admin to tune fee by vet vs grooming vs training.
- **Support cost** from payment confusion and duplicate-charge perception.
- **Competitive gap**—platforms that offer deposit booking may win hesitant customers.

## Market opportunity

Pet-care marketplaces combining **discovery, booking, and payments** can capture more GMV by aligning payment timing with customer psychology. Deposit or booking-fee models are established in healthcare booking, hospitality, and premium services. Warmpawz already proved **Pay Bill adoption** when rules are clear and Admin sets terms—**Booking Fee extends that playbook to scheduled care**.

## Why now

1. **Pay Bill establishes payment trust** under Warmpawz Pay.
2. **Appointment booking is mature** on the platform—improving conversion has high ROI.
3. **Vendor feedback** on no-shows creates partnership incentive for pilots.
4. **Admin tooling mindset** exists for commercial configuration (discounts today; fees next).

---

# Goals

## Business goals

1. Increase **appointment booking completion rate** (summary → confirmed).
2. Reduce **no-show rate** for vendors on Booking Fee programme vs control.
3. Launch **Admin-configurable Booking Fee** as a platform capability.
4. Grow **Warmpawz Pay** relevance beyond walk-in payments.
5. Maintain or improve **vendor retention and satisfaction** in pilot cohort.
6. Establish **measurable ROI** before general availability.

## Customer goals

- Book appointments with **minimal upfront payment**.
- Understand **exactly** what is paid now and what is due later.
- Receive **clear confirmation** and reminders.
- Pay balance **conveniently** after service.
- Access **complete payment history** for one appointment.

## Vendor goals

- See **only committed bookings** (deposit received) on the calendar.
- Know **balance due** before and during the visit.
- **Collect or record** balance without argument.
- Keep **Pay Bill** for walk-ins separate and simple.

## Admin goals

- Set **default and override** Booking Fees by category and vendor.
- **Enable/disable** programme participation per vendor.
- Define **cancellation, refund, and balance** policies.
- **Monitor KPIs** and operational exceptions.
- **Roll out and rollback** without business disruption.

## Success criteria

Pilot is successful when **all** of the following are met (targets set at pilot kickoff):

| Criterion | Measure |
|-----------|---------|
| Conversion uplift | Booking completion rate ↑ vs baseline (statistically meaningful) |
| No-show improvement | No-show rate ↓ vs baseline |
| Balance collection | ≥ agreed % of completed appointments with balance settled |
| Support stability | Ticket rate per 1,000 appointments ≤ baseline |
| Vendor participation | ≥ agreed % of pilot vendors active after 30 days |
| Admin operability | Fee and policy changes executed without emergency escalation |

---

# Success Metrics

| Metric | Definition | Primary owner |
|--------|------------|---------------|
| **Booking conversion rate** | Confirmed appointments ÷ customers reaching summary | Product |
| **Payment conversion rate** | Booking Fee paid ÷ customers reaching payment step | Product |
| **No-show rate** | No-shows ÷ confirmed appointments | Business / Ops |
| **Appointment completion rate** | Completed ÷ confirmed | Product |
| **Vendor adoption rate** | Active Booking Fee vendors ÷ enabled vendors | Operations |
| **Balance collection rate** | Balance paid ÷ completed appointments | Finance / Product |
| **Booking Fee revenue** | Sum of Booking Fees collected | Finance |
| **Customer satisfaction (CSAT)** | Post-appointment survey | Product |
| **Support ticket rate** | Payment/booking tickets ÷ 1,000 appointments | Support |
| **Refund rate** | Booking Fee refunds ÷ cancelled appointments | Finance |
| **Repeat booking rate** | Customers rebooking within 90 days | Growth |

---

# Assumptions

| ID | Assumption | Risk if false |
|----|------------|---------------|
| A1 | Customers will book more often if upfront payment is reduced to a Booking Fee | Feature may not move conversion |
| A2 | A meaningful Booking Fee (e.g. ₹99) reduces no-shows vs zero deposit | Fee may be too low or too high |
| A3 | Vendors will adopt if opt-in and benefits are communicated | Low vendor uptake |
| A4 | Balance can be collected reliably post-visit (in-app + offline mark) | Revenue leakage |
| A5 | Admin can operationalise fee configuration without daily engineering support | Ops bottleneck |
| A6 | Pay Bill and Booking Fee can coexist without customer confusion | Brand/journey conflict |
| A7 | Legal/compliance accepts two-phase payment with disclosed policies | Launch delay |
| A8 | Support can be trained on deposit vs balance semantics | Ticket spike |
| A9 | Package and promotion rules can be defined without blocking v1 pilot | Scope creep |
| A10 | Pilot cohort is representative enough to generalise | Wrong rollout decisions |

---

# Non Goals

The following are **explicitly out of scope** for initial releases unless separately approved:

| Item | Reason |
|------|--------|
| Replacing Pay Bill | Complementary product, not merge |
| Customer-negotiated or vendor-set Booking Fee amounts | Admin owns commerce in v1 |
| Dynamic/surge Booking Fees | Fixed Admin configuration only in v1 |
| Wallet, loyalty points, or membership for Booking Fee | Future consideration |
| Global mandatory migration from full upfront | Phased opt-in only |
| Insurance or third-party payer flows | Different product |
| International / multi-currency | India-first |
| Replacing entire appointment scheduling product | Payment model change only |
| Engineering design, architecture, or delivery planning | Separate artefacts post PRD approval |
| Legal contract redesign for vendors | Compliance review separate |
| Full redesign of vendor profile or discovery | Minimal entry-point clarity only |

---

# Existing Product Analysis

## Warmpawz Pay → Pay Bill (current product)

Pay Bill enables customers to **pay a bill at a participating vendor** without booking an appointment. The customer **enters the bill amount**; Admin configures **discount** on that amount.

### Customer journey (Pay Bill)

1. **Discover** Warmpawz Pay entry and browse participating vendors.
2. **Select vendor** and view offer/discount context.
3. **Enter bill amount** (what they owe at the counter).
4. **Preview discount** and amount to pay.
5. **Pay** via standard checkout.
6. **Confirm** success and savings.
7. **History** — view past Pay Bill transactions.

**Customer expectation:** Quick payment at time of visit; **no slot** required.

### Vendor journey (Pay Bill)

1. **Listed** when Admin publishes vendor to Pay Bill programme.
2. **Notified** of payment (when notification programme active).
3. **Views** walk-in payment history.
4. **Settled** per platform payout policy.

**Vendor expectation:** Incremental revenue; no appointment management.

### Admin journey (Pay Bill)

1. **Curates catalogue** — which vendors appear.
2. **Sets discount %** per merchant (commercial terms).
3. **Monitors** volume, discounts, participation.
4. **Supports** exceptions via payment records.

**Admin expectation:** Central control of walk-in commercial terms.

### Business rules (Pay Bill)

- Customer provides **bill amount**; Admin provides **discount**.
- **Single payment** at time of use.
- **No appointment** linked to transaction.
- Vendor **eligibility** governed by programme rules (trust, verification, publish state).

### Product philosophy

| Theme | Pay Bill expression |
|-------|---------------------|
| Admin-controlled commerce | Discount % |
| Transparency before pay | Bill − discount = pay now |
| Warmpawz as payment layer | Walk-in trust |
| Opt-in vendors | Catalogue publish |

### Strengths

- Clear **single-purpose** journey.
- **Admin leverage** without per-vendor engineering.
- Builds **payment habit** on Warmpawz.
- **Separate** from appointment complexity.

### Pain points

- **Not connected** to appointment booking emotionally or in customer mind.
- **Discount-only** lever—no deposit model for scheduled care.
- Does not address **no-shows** or **booking abandonment**.

### Opportunities

- Extend **same Admin commerce philosophy** to Booking Fee.
- Unified **Warmpawz Pay** brand with two clear journeys.
- Cross-use **payment trust** for appointment conversion.

---

# Proposed Product

## Book Appointment with Booking Fee

### Vision

Customers **reserve** appointments with a **small, fixed Booking Fee** set by Admin. They pay the **balance after** the appointment. The experience feels like a **natural extension of Warmpawz Pay**—same transparency, same trust—while remaining a **distinct journey** from Pay Bill.

### Customer experience

- From vendor profile: **Book Appointment** (not Pay Bill).
- Select service, slot, pet, and details as today.
- On **summary**: see service price, **Booking Fee (pay now)**, **balance (pay after visit)**.
- Pay **Booking Fee only** to confirm.
- Receive confirmation with balance reminder.
- Attend appointment; pay balance in app or at venue per policy.
- View **full history** with both payments on one appointment.

### Vendor experience

- **Confirmed** bookings appear only after Booking Fee succeeds.
- Each appointment shows **deposit received** and **balance status**.
- Can **request balance payment** or **mark received** (cash/UPI).
- **Pay Bill** remains available for walk-ins—separate from appointments.

### Admin experience

- Configure **platform default** Booking Fee (e.g. ₹99).
- Override by **category**, **service type** (clinic, home, tele), and **vendor**.
- **Enable/disable** vendors for programme.
- Set **cancellation, refund, reschedule, package, and promotion** rules.
- **Dashboards** for pilot and production KPIs.

### Support experience

- **Single timeline** per appointment: Booking Fee, balance, refunds, cancellations.
- Clear **labelling** of Pay Bill vs appointment payments.
- **Playbooks** for common disputes (“charged twice,” refund delay, balance mismatch).

---

# User Personas

## Customer — Priya, 34, Pet Parent, Urban Professional

| Dimension | Detail |
|-----------|--------|
| **Goals** | Reliable vet and groomer; fair pricing; minimal hassle |
| **Pain points** | Full upfront payment; unclear offline deposits; fear of no-refund |
| **Motivations** | Pet health; convenience; trust in platform |
| **Behaviour** | Mobile-first; compares reviews; abandons if checkout feels expensive |

---

## Vendor — Dr. Mehta, Clinic Owner, 12 Staff

| Dimension | Detail |
|-----------|--------|
| **Goals** | Full calendar; fewer no-shows; clean front-desk collections |
| **Pain points** | Empty slots; customers disputing what was paid online |
| **Motivations** | Revenue stability; professional reputation |
| **Behaviour** | Uses platform for discovery; staff handle day-of payments |

---

## Admin — Kavita, Head of Platform Operations

| Dimension | Detail |
|-----------|--------|
| **Goals** | Scalable commercial rules; successful pilots; executive reporting |
| **Pain points** | One-off vendor deals; unclear metrics |
| **Motivations** | Platform growth; operational efficiency |
| **Behaviour** | Configures Pay Bill today; owns rollout communications |

---

## Support — Arjun, Senior Support Associate

| Dimension | Detail |
|-----------|--------|
| **Goals** | Fast resolution; accurate information; low escalations |
| **Pain points** | Fragmented payment info; angry “double charge” callers |
| **Motivations** | CSAT; clear policies |
| **Behaviour** | CRM lookup by booking reference; explains refund timelines |

---

# User Stories

## Customer

| ID | User story | Priority |
|----|------------|----------|
| US-C01 | As a customer, I want to pay only a Booking Fee to confirm my appointment so that I am not charged the full service price upfront. | P0 |
| US-C02 | As a customer, I want to see Booking Fee and balance clearly on the summary so that I trust what I am paying. | P0 |
| US-C03 | As a customer, I want confirmation with appointment details and balance due so that I know my slot is secure. | P0 |
| US-C04 | As a customer, I want to pay my balance after my visit so that I pay when care is delivered. | P0 |
| US-C05 | As a customer, I want both payments recorded under my appointment so that I have proof for disputes. | P0 |
| US-C06 | As a customer, I want cancellation and refund rules shown before I pay so that I can decide confidently. | P0 |
| US-C07 | As a customer, I want to retry Booking Fee payment if it fails so that I do not lose my slot unnecessarily. | P1 |
| US-C08 | As a customer, I want reminders before my appointment including balance due so that I am prepared. | P1 |
| US-C09 | As a customer, I want to distinguish Book Appointment from Pay Bill on the vendor profile so that I choose the right action. | P0 |

## Vendor

| ID | User story | Priority |
|----|------------|----------|
| US-V01 | As a vendor, I want confirmed appointments only after Booking Fee is paid so that my calendar reflects real commitments. | P0 |
| US-V02 | As a vendor, I want to see deposit and balance separately so that staff know what to collect. | P0 |
| US-V03 | As a vendor, I want to mark balance received when customer pays offline so that records stay accurate. | P0 |
| US-V04 | As a vendor, I want to request balance payment from the customer so that collection is faster. | P1 |
| US-V05 | As a vendor, I want Pay Bill and appointments kept separate so that walk-ins do not confuse bookings. | P0 |
| US-V06 | As a vendor, I want notification when a new confirmed booking arrives so that I can prepare. | P1 |

## Admin

| ID | User story | Priority |
|----|------------|----------|
| US-A01 | As Admin, I want a platform default Booking Fee so that there is a consistent baseline. | P0 |
| US-A02 | As Admin, I want category and service-type overrides so that fees match market reality. | P0 |
| US-A03 | As Admin, I want per-vendor overrides for pilots and partners. | P1 |
| US-A04 | As Admin, I want to enable or disable Booking Fee programme per vendor. | P0 |
| US-A05 | As Admin, I want to configure cancellation and refund policies for Booking Fees. | P0 |
| US-A06 | As Admin, I want dashboards for fees, balances, and exceptions. | P1 |
| US-A07 | As Admin, I want to roll back programme participation without harming in-flight appointments. | P0 |

## Support

| ID | User story | Priority |
|----|------------|----------|
| US-S01 | As support, I want one view of Booking Fee and balance for an appointment so that I resolve disputes quickly. | P0 |
| US-S02 | As support, I want to see refund status and policy applied so that I explain outcomes accurately. | P0 |
| US-S03 | As support, I want Pay Bill and appointment payments clearly labelled so that I route issues correctly. | P0 |

---

# Functional Requirements

## Booking & discovery

| ID | Description | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-1 | Customer can start Book Appointment from vendor profile when vendor is on Booking Fee programme | P0 | Book Appointment CTA visible; Pay Bill remains separate CTA |
| FR-2 | Customer completes service, slot, pet, and detail selection before payment | P0 | Summary not reachable until required fields complete |
| FR-3 | Slot is provisional until Booking Fee succeeds | P0 | Unpaid attempts not shown as confirmed to vendor |
| FR-4 | Slot releases after configurable hold if Booking Fee not paid | P0 | Customer can retry or rebook after release |

## Summary & payment

| ID | Description | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-5 | Summary displays service price, Booking Fee, and balance | P0 | All three visible before payment; Booking Fee emphasised as pay-now |
| FR-6 | Cancellation/refund policy visible on summary | P0 | Policy text approved by Legal shown pre-payment |
| FR-7 | Customer pays Booking Fee only at checkout; amount not editable | P0 | Checkout amount equals Admin-resolved Booking Fee |
| FR-8 | Booking Fee cannot exceed service price | P0 | If fee ≥ price, customer pays service price once; balance zero |
| FR-9 | Appointment confirmed immediately upon successful Booking Fee payment | P0 | Customer and vendor see confirmed state |

## Balance

| ID | Description | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-10 | Balance equals service price minus Booking Fee per display policy | P0 | Matches summary; taxes/fees per product policy |
| FR-11 | Customer can pay balance in-app when enabled | P1 | Successful balance payment updates appointment |
| FR-12 | Vendor can mark balance received for offline payment | P0 | Audit trail; customer sees updated status |
| FR-13 | Vendor can request balance payment from customer | P1 | Customer receives actionable notification |

## Cancellation & refund

| ID | Description | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-14 | Customer cancellation applies Admin refund policy to Booking Fee | P0 | Outcome communicated to customer |
| FR-15 | Vendor cancellation triggers Booking Fee refund per default policy | P0 | Customer notified |
| FR-16 | Balance not charged if appointment cancelled before service | P0 | No balance due on cancelled appointments |

## History & support

| ID | Description | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-17 | Appointment history shows Booking Fee and balance as separate entries | P0 | Dates, amounts, status visible |
| FR-18 | Support view shows unified appointment payment timeline | P0 | Pay Bill transactions not mixed into appointment timeline |

## Admin configuration

| ID | Description | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-19 | Admin sets platform default Booking Fee | P0 | Applies when no override |
| FR-20 | Admin sets category and service-type overrides | P0 | Precedence documented and enforced |
| FR-21 | Admin sets vendor override | P1 | Wins over category and default |
| FR-22 | Admin enables/disables vendor for programme | P0 | Disabled vendors use full upfront booking only |

## Packages & promotions

| ID | Description | Priority | Acceptance criteria |
|----|-------------|----------|---------------------|
| FR-23 | Package sessions apply waiver/reduction rules per Admin policy | P1 | Documented behaviour in pilot |
| FR-24 | Promotions apply per Admin policy without breaking fee/balance display | P2 | Pilot may defer |

---

# Customer Journey

```
Discovery
    ↓
Vendor Profile
    ↓
Book Appointment
    ↓
Booking (service · slot · pet · details)
    ↓
Summary (fee + balance + policy)
    ↓
Booking Fee Payment
    ↓
Confirmation
    ↓
Appointment (service delivery)
    ↓
Balance Payment
    ↓
History
```

| Stage | Customer mindset | Success signal |
|-------|------------------|----------------|
| Discovery | “Find the right care” | Reaches vendor profile |
| Vendor profile | “I want to book, not just pay a bill” | Taps Book Appointment |
| Booking | “Lock in details” | Valid slot and pet selected |
| Summary | “I understand pay now vs later” | Proceeds to pay |
| Booking Fee payment | “Small commit to confirm” | Payment succeeds |
| Confirmation | “I’m booked” | Saves reference / calendar |
| Appointment | “Show up prepared” | Attends on time |
| Balance payment | “Settle what I owe” | Balance marked paid |
| History | “I have records” | Both payments visible |

---

# Vendor Journey

| Stage | Vendor goal | Key moments |
|-------|-------------|-------------|
| Programme onboarding | Participate with clarity | Admin enables; vendor briefed on deposit vs balance |
| New booking alert | Prepare | Notification: confirmed + deposit received |
| Calendar management | Plan day | Confirmed slots; balance pending visible |
| Pre-visit | Reduce friction | Optional customer balance reminder |
| Day of service | Collect if needed | Balance due; request pay or mark received |
| Completion | Close loop | Mark complete; balance resolved |
| Reporting | Reconcile | Deposit and balance in earnings view |
| Pay Bill (parallel) | Walk-in revenue | Unchanged separate flow |

---

# Admin Journey

| Stage | Admin goal | Activities |
|-------|------------|------------|
| Strategy | Define commercial model | Default fee, pilot scope, success metrics |
| Configuration | Encode rules | Fees, policies, enablement |
| Pilot launch | Controlled rollout | Vendor list, comms, monitoring |
| Operate | Tune and support | Adjust fees; handle exceptions |
| Report | Prove ROI | Dashboards, executive readout |
| Scale or rollback | Decision | Expand categories or revert programme |

---

# Support Journey

| Stage | Support goal | Activities |
|-------|--------------|------------|
| Intake | Identify issue type | Pay Bill vs appointment; booking reference |
| Diagnose | Understand payment state | Booking Fee paid? Balance due/paid? Cancelled? |
| Resolve | Apply policy | Explain refund; escalate duplicate charge |
| Document | Improve product | Tag root cause for product ops |
| Escalate | Edge cases | Finance for refund failure; ops for vendor dispute |

---

# UX Experience

Experience descriptions only—no visual design specification.

---

## Vendor profile

| Element | Description |
|---------|-------------|
| **Purpose** | Choose between booking and walk-in payment |
| **User goal** | Start correct journey |
| **Primary CTA** | Book Appointment |
| **Secondary CTA** | Pay Bill (when available) |
| **Expected behaviour** | Clear labels; no fee amount shown yet |
| **Error states** | Vendor not bookable—explain why |
| **Empty states** | N/A |

---

## Booking steps (service, slot, pet, details)

| Element | Description |
|---------|-------------|
| **Purpose** | Define appointment |
| **User goal** | Complete booking details |
| **Primary CTA** | Continue |
| **Secondary CTA** | Back |
| **Expected behaviour** | Familiar to existing booking; no payment |
| **Error states** | Slot unavailable—choose another |
| **Empty states** | No slots—suggest other dates |

---

## Summary

| Element | Description |
|---------|-------------|
| **Purpose** | **Critical trust moment**—payment split |
| **User goal** | Decide to confirm |
| **Primary CTA** | Pay [Booking Fee] and confirm |
| **Secondary CTA** | Edit details / back |
| **Expected behaviour** | Service price, Booking Fee (prominent), balance (clear), policy strip |
| **Error states** | Fee unavailable—block pay; friendly message |
| **Empty states** | N/A |

---

## Booking Fee payment

| Element | Description |
|---------|-------------|
| **Purpose** | Collect deposit only |
| **User goal** | Complete payment |
| **Primary CTA** | Pay now |
| **Secondary CTA** | Cancel (may forfeit slot) |
| **Expected behaviour** | Fixed amount; reminder of balance due later |
| **Error states** | Payment failed—retry; do not confirm appointment |
| **Empty states** | N/A |

---

## Confirmation

| Element | Description |
|---------|-------------|
| **Purpose** | Reinforce success |
| **User goal** | Trust slot is held |
| **Primary CTA** | View appointment |
| **Secondary CTA** | Add to calendar |
| **Expected behaviour** | Confirmed; fee paid; balance due; reference ID |
| **Error states** | Rare: paid but error page—appointment still confirmed in list |
| **Empty states** | N/A |

---

## Appointment detail (pre- and post-visit)

| Element | Description |
|---------|-------------|
| **Purpose** | Ongoing reference |
| **User goal** | Manage appointment and payments |
| **Primary CTA** | Pay balance (when due) or get directions |
| **Secondary CTA** | Cancel / reschedule (if allowed) |
| **Expected behaviour** | Payment section: fee ✓, balance pending/paid |
| **Error states** | Balance pay failed—retry |
| **Empty states** | N/A |

---

## History

| Element | Description |
|---------|-------------|
| **Purpose** | Records |
| **User goal** | Review past care and payments |
| **Primary CTA** | Open appointment detail |
| **Secondary CTA** | Book again |
| **Expected behaviour** | Both payment phases visible |
| **Error states** | Load failure—retry |
| **Empty states** | No appointments yet—CTA to discover |

---

## Vendor appointment detail

| Element | Description |
|---------|-------------|
| **Purpose** | Operations |
| **User goal** | Deliver service and collect balance |
| **Primary CTA** | Request balance / mark received / complete |
| **Secondary CTA** | Contact customer |
| **Expected behaviour** | Deposit and balance obvious |
| **Error states** | Cannot mark complete if policy requires balance—explain |
| **Empty states** | N/A |

---

## Admin configuration

| Element | Description |
|---------|-------------|
| **Purpose** | Manage fees and policies |
| **User goal** | Set rules and enable vendors |
| **Primary CTA** | Save / publish |
| **Secondary CTA** | Preview impact |
| **Expected behaviour** | Hierarchy clear; validation on fee bounds |
| **Error states** | Conflicting rules—highlight conflict |
| **Empty states** | No overrides—show default only |

---

# Product Rules

## Booking rules

| Rule | Statement |
|------|-----------|
| BK-01 | Appointment is **Confirmed** only after Booking Fee payment succeeds |
| BK-02 | Provisional slot held during payment attempt; released on timeout or abandon |
| BK-03 | Vendor calendar shows confirmed appointments only |
| BK-04 | Book Appointment and Pay Bill are **independent** transactions |

## Payment rules

| Rule | Statement |
|------|-----------|
| PAY-01 | **Phase 1:** Booking Fee collected at confirmation |
| PAY-02 | **Phase 2:** Balance collected per policy after booking |
| PAY-03 | Customer **cannot edit** Booking Fee amount |
| PAY-04 | Duplicate payment of same phase is **prevented** |
| PAY-05 | Each phase produces distinct receipt/record linked to same appointment |

## Booking Fee rules

| Rule | Statement |
|------|-----------|
| BF-01 | Booking Fee amount set by **Admin** hierarchy |
| BF-02 | Booking Fee **≤ service price** |
| BF-03 | If service price is ₹0, fee waived unless Admin mandates symbolic fee |
| BF-04 | Booking Fee **independent** of Pay Bill discount rules |
| BF-05 | One Booking Fee per appointment unless policy defines multi-pet exception |

## Balance rules

| Rule | Statement |
|------|-----------|
| BAL-01 | Balance = service price (per tax/fee display policy) − Booking Fee paid |
| BAL-02 | Balance may be paid in-app, offline, or both—per programme settings |
| BAL-03 | Service completion may require balance settlement per strict/relaxed policy |
| BAL-04 | Price increase after fee paid triggers customer notification and adjusted balance |

## Refund rules

| Rule | Statement |
|------|-----------|
| REF-01 | Booking Fee refunds governed by cancellation policy |
| BAL-02 | Balance refunded only if erroneously charged or service not delivered |
| REF-03 | Refund timeline communicated at cancellation |

## Cancellation rules

| Rule | Statement |
|------|-----------|
| CAN-01 | Policy shown **before** Booking Fee payment |
| CAN-02 | Customer late cancel may forfeit Booking Fee |
| CAN-03 | Vendor cancel defaults to Booking Fee refund |
| CAN-04 | Cancelled appointments never accrue new balance |

## Eligibility rules

| Rule | Statement |
|------|-----------|
| EL-01 | Vendor must be enabled for Booking Fee programme |
| EL-02 | Vendor must meet platform trust/eligibility standards |
| EL-03 | Customer must be authenticated to book and pay |
| EL-04 | Vendors not enabled continue **full upfront** booking |

## Reschedule rules

| Rule | Statement |
|------|-----------|
| RS-01 | Reschedule policy TBD—fee transfers or new fee required (see Open Questions) |
| RS-02 | Rescheduled appointment retains payment history linkage |

## Package rules

| Rule | Statement |
|------|-----------|
| PKG-01 | Active package may waive Booking Fee or balance per Admin policy |
| PKG-02 | Package booking path must not double-charge fee |

## Promotion rules

| Rule | Statement |
|------|-----------|
| PROMO-01 | Promotions apply to service price per campaign rules |
| PROMO-02 | Effect on Booking Fee defined by Admin (waive, unchanged, or reduce balance only)—pilot may defer |

---

# Configuration Rules

## Hierarchy (most specific wins)

```
Platform Default Booking Fee
        ↓
Category (e.g. Veterinary, Grooming, Training)
        ↓
Service Type (Clinic · Home Visit · Teleconsultation)
        ↓
Vendor Override
```

## Examples

| Default | Category | Service type | Vendor | **Customer pays now** |
|---------|----------|--------------|--------|-------------------------|
| ₹99 | — | — | — | ₹99 |
| ₹99 | Grooming ₹49 | — | — | ₹49 |
| ₹99 | Vet ₹99 | Home +₹30 | — | ₹129 |
| ₹99 | Vet ₹99 | Clinic | Partner ₹149 | ₹149 |
| ₹99 | — | — | Disabled vendor | Full upfront (not on programme) |

## Policy configuration (non-monetary)

Admin also configures: hold duration, cancellation windows, refund rules, balance collection modes, package waivers, and pilot vendor lists—independent of fee amount but equally binding.

---

# Edge Cases

| Scenario | Expected product behaviour |
|----------|----------------------------|
| **Payment failure (Booking Fee)** | Not confirmed; retry; slot released after hold |
| **Duplicate payment** | Second attempt blocked; support if customer charged twice |
| **Price change** | Balance recalculated; notify if increase |
| **Vendor cancellation** | Fee refunded; slot freed; customer notified |
| **Customer cancellation (early)** | Refund per policy |
| **Customer cancellation (late)** | Fee forfeited or partial refund per policy |
| **No-show** | Fee disposition per policy; balance not charged |
| **Multiple pets** | Single or multiple fees—per Admin policy |
| **Package booking** | Waiver/reduction per package rules |
| **Promotion** | Applied per campaign; fee handling per policy |
| **Offline balance payment** | Vendor marks received; customer status updates |
| **Dispute** | Support uses unified timeline |
| **Expired slot (hold timeout)** | Customer must reselect slot |
| **Tele consultation** | Fee per category policy; balance timing may differ |
| **Home visit** | Fee may include service-type surcharge |
| **Payment success, confirmation UI failure** | Appointment still confirmed in list |
| **Balance paid twice** | Block second payment; support refund if occurred |

---

# Notifications

## Customer

| Trigger | Purpose | Expected message (intent) |
|---------|---------|---------------------------|
| Booking Fee success | Confirm slot | “Appointment confirmed. Paid ₹[fee]. Balance ₹[balance] due after visit.” |
| 24h reminder | Reduce no-show | “Appointment tomorrow at [time]. Balance ₹[X] due at visit.” |
| Balance request | Drive collection | “Pay remaining ₹[X] for your appointment.” |
| Balance received | Close loop | “Payment complete. Thank you.” |
| Cancellation | Set expectations | “Cancelled. Refund of ₹[fee]: [status].” |
| Payment failed | Recovery | “Payment didn’t go through. Tap to retry.” |

## Vendor

| Trigger | Purpose | Expected message (intent) |
|---------|---------|---------------------------|
| New confirmed booking | Prepare | “New appointment [date/time]. Booking Fee received.” |
| Balance pending (day-of) | Front desk | “[Customer] — balance ₹[X] pending.” |
| Balance paid in app | Reduce desk work | “Balance received for appointment [ref].” |
| Customer cancellation | Free slot | “Appointment cancelled. [Fee disposition].” |

## Admin

| Trigger | Purpose | Expected message (intent) |
|---------|---------|---------------------------|
| Pilot anomaly | Intervene | “Booking Fee pilot: [metric] outside threshold.” |
| Refund failure | Ops | “Manual refund required: [ref].” |

## Support

| Trigger | Purpose | Expected message (intent) |
|---------|---------|---------------------------|
| Escalation assigned | Context | Internal ticket with full payment timeline |

*Channels (push, SMS, email, in-app) subject to compliance and marketing standards.*

---

# Booking Lifecycle

```
Started
  ↓
Slot selected (provisional)
  ↓
Awaiting Booking Fee ──timeout──→ Slot released · Closed (unpaid)
  ↓
Confirmed
  ↓
  ├── Rescheduled → Confirmed (policy-dependent)
  ├── Cancelled → Closed (refund rules)
  ↓
In progress
  ↓
Completed (service delivered)
  ↓
Closed (balance settled or written off per policy)
```

**Customer-visible states:** Awaiting payment · Confirmed · Completed · Cancelled  

**Vendor-visible additions:** Deposit received · Balance pending · Balance received

---

# Payment Lifecycle

```
Booking Fee                    Balance                    Completion
    │                              │                            │
    ▼                              ▼                            ▼
Not due → Pending → Paid      Not due → Due → Pending → Paid   Financial closure
              ↓                        ↓
           Failed                   Failed
              ↓                        ↓
           Retry                    Retry / Offline mark
              ↓
         Cancelled (unconfirmed)
```

- **Booking Fee** unlocks **Confirmed** appointment state.
- **Balance** unlocks **financial closure** for the appointment.
- **Pay Bill** transactions never substitute for either phase.

---

# Reporting Requirements

Admin dashboards should answer:

| Domain | Questions |
|--------|-----------|
| **Bookings** | Volume; conversion funnel; cancellations; no-shows |
| **Revenue** | Booking Fee collected; balance collected; GMV timing |
| **Fees** | By category, vendor, city; average fee |
| **Balances** | Outstanding; ageing; collection rate |
| **Refunds** | Volume; reasons; SLA compliance |
| **Disputes** | Rate; categories; resolution time |
| **Vendor performance** | Adoption; completion; no-show by vendor |
| **Customer behaviour** | Repeat rate; drop-off step; Pay Bill cross-usage |

---

# Dependencies

Business dependencies (not technical design):

| Dependency | Why it matters |
|------------|----------------|
| **Appointment booking product** | Slot, pet, service selection must exist |
| **Payments & checkout** | Trusted payment experience for fee and balance |
| **Notifications** | Confirmations, reminders, balance requests |
| **Vendor management** | Enablement, eligibility, comms |
| **Admin configuration** | Fees, policies, enablement UI and process |
| **Customer support** | Playbooks, CRM fields, training |
| **Finance / settlement policy** | How fee and balance flow to vendor payouts |
| **Legal / compliance** | Disclosure, refund, consumer rights |
| **Operations** | Pilot vendor selection and onboarding |
| **QA** | Acceptance criteria validation |

---

# Rollout Strategy

## Pilot

- **Who:** 10–20 veterinary clinics, one geography
- **Fee:** Admin default ₹99 (subject to sign-off)
- **Duration:** 8 weeks minimum
- **Balance:** In-app link + vendor mark-paid
- **Gate:** KPIs vs full-upfront control cohort

## Expansion

- Add grooming, training with category fees
- Expand cities and vendor count
- Refine policies from learnings

## General availability

- Opt-in default for new eligible vendors
- Marketing: “Book for ₹99” with transparent balance messaging
- Executive review before mandatory category migration

## Rollback strategy

- Admin disables programme globally or per vendor
- Vendors revert to full upfront for **new** bookings
- In-flight confirmed appointments honour existing fee/balance rules

---

# Risks

## Business risks

| Risk | Mitigation |
|------|------------|
| Fee too low—no no-show impact | Pilot tuning |
| Fee too high—conversion drops | A/B vs control |
| ROI unclear | Strict pilot metrics |
| Cannibalisation of upfront GMV timing | Finance modelling |

## Customer risks

| Risk | Mitigation |
|------|------------|
| “Charged twice” perception | Clear summary UX; receipts |
| Refund dissatisfaction | Policy pre-disclosure |
| Journey confusion with Pay Bill | Distinct CTAs and naming |

## Vendor risks

| Risk | Mitigation |
|------|------------|
| Resistance to partial upfront | Opt-in; no-show data |
| Balance collection burden | Reminders; in-app pay |
| Staff training gap | Vendor playbook |

## Operational risks

| Risk | Mitigation |
|------|------------|
| Support spike | Training; unified timeline |
| Refund delays | SLA; escalation |
| Misconfigured fees | Preview; staged publish |

## Compliance risks

| Risk | Mitigation |
|------|------------|
| Inadequate disclosure | Legal review of summary and policy copy |
| Refund regulatory issues | Compliance sign-off on cancellation rules |

---

# Open Product Questions

Requires stakeholder approval before design freeze:

1. Default Booking Fee: **₹99** platform-wide at launch?
2. Customer-facing name: **Booking Fee**, **Reservation deposit**, or **Slot fee**?
3. Can vendors **opt out** permanently from programme?
4. **Balance timing:** before service, at service, or after only?
5. **Teleconsultation** fee same as clinic?
6. **Home visit** surcharge—additive or separate fee table?
7. **Reschedule:** fee transfers or new payment required?
8. **Multi-pet:** one fee or fee per pet?
9. **Packages:** waive fee, balance, or both?
10. **Promotions:** affect fee, balance, or neither in v1?
11. **Strict completion:** can vendor complete if balance unpaid?
12. **Refund SLA** for Booking Fee?
13. **Pay Bill cross-sell** after appointment for add-ons?
14. **Finance:** payout timing for fee vs balance?
15. **Migration:** in-flight full-upfront bookings when vendor switches programme?

---

# Glossary

| Term | Definition |
|------|------------|
| **Warmpawz Pay** | Platform payment brand for Pay Bill and appointment payments |
| **Pay Bill** | Walk-in payment; customer enters bill; Admin sets discount |
| **Book Appointment with Booking Fee** | Scheduled appointment confirmed by Admin-set fee; balance paid later |
| **Booking Fee** | Fixed upfront amount to confirm appointment (e.g. ₹99) |
| **Balance** | Remaining service amount after Booking Fee |
| **Service price** | Listed price for booked service |
| **Full upfront booking** | Customer pays entire amount at booking (status quo) |
| **Two-phase payment** | Booking Fee then balance |
| **Confirmed** | Appointment state after successful Booking Fee |
| **Programme** | Admin-enabled Booking Fee experience for a vendor |
| **Provisional slot** | Slot held pending Booking Fee; not confirmed |
| **No-show** | Customer absent from confirmed appointment |

---

# Final Recommendation

## Why this feature should exist

Warmpawz Pay proved that **Admin-controlled, transparent payments** work for walk-in bills. Appointment booking is the platform’s highest-intent flow but still demands **full upfront payment**, causing abandonment and no-shows. **Booking Fee** applies the same product philosophy to scheduled care—reducing friction while preserving vendor confidence and platform control.

## Expected impact

- **Conversion:** More completed bookings from existing traffic
- **Reliability:** Fewer no-shows for participating vendors
- **Brand:** Warmpawz Pay becomes synonymous with pet-care payments—walk-in and scheduled
- **Operations:** Less offline deposit chaos; clearer support resolution

## Recommended rollout

1. **Sign off** open product questions (especially naming, balance timing, reschedule, finance).
2. **Pilot** veterinary clinics, one market, ₹99 default, 8 weeks.
3. **Measure** conversion, no-show, balance collection, support rate vs control.
4. **Expand** by category with Admin fee table.
5. **Scale** with opt-in general availability—never force global switch without data.

## Success criteria (recap)

Pilot succeeds when conversion and no-show metrics improve, balance collection meets threshold, support remains stable, and vendors stay active—enabling confident expansion.

---

# Approval Matrix

| Function | Representative | Approval | Date |
|----------|----------------|----------|------|
| **Product** | | ☐ Approved ☐ Changes requested | |
| **Design** | | ☐ Approved ☐ Changes requested | |
| **Engineering** | | ☐ Acknowledged for estimate ☐ Changes requested | |
| **Business / GM** | | ☐ Approved ☐ Changes requested | |
| **Finance** | | ☐ Approved ☐ Changes requested | |
| **Operations** | | ☐ Approved ☐ Changes requested | |
| **Support** | | ☐ Approved ☐ Changes requested | |
| **Compliance / Legal** | | ☐ Approved ☐ Changes requested | |

**Notes:** Engineering approval indicates readiness to estimate and plan delivery **after** product sign-off. Engineering must not change product rules without Product approval.

---

*This document is the Product source of truth for Book Appointment with Booking Fee. Version control and change log maintained by Product Management.*

*End of PRD*
