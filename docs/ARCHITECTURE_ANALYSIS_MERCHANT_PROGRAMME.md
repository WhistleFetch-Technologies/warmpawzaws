# Architecture Analysis: Merchant Programme, Appointment Billing & Warmpawz Pay Platform Evolution

**Document type:** Enterprise Architecture Analysis & Recommendation  
**Version:** 1.0  
**Date:** 27 July 2026  
**Status:** Recommendation only — no implementation authorized  
**Horizon:** 5-year platform evolution  
**Branches analysed:** `develop` (live) · `feature/warmpawzpay` (Pay Bill, pre-merge)  
**Audience:** Principal Engineers, Product Leadership, Finance, Operations

---

## 1. Executive Summary

Warmpawz is at an inflection point. **`develop`** runs a **marketplace booking** model (open discovery, visible prices, full upfront payment). **`feature/warmpawzpay`** introduces **Warmpawz Pay** as a bounded payment context with **Admin-curated merchant visibility** (Pay Bill) — not yet live.

The proposed **Book Appointment** direction asks for:

- Admin-selected vendors (not open discovery)
- Hidden service prices
- **Booking charges** at reservation (Base Appointment Fee + Convenience + Platform)
- **Vendor-generated final bill** after service
- **Base fee redemption** against balance

**This analysis challenges a narrow interpretation of that request.** The cleanest 5-year architecture is **not** “Pay Bill Catalogue + Book Appointment Catalogue.” It is:

```
Vendor
  → Programme Enrollment (Pay Bill | Book Appointment | future products)
    → Programme Configuration (fees, visibility, commercial terms)
      → Domain lifecycles (Scheduling | Billing | Payment | Settlement)
        → Shared Warmpawz Pay Platform (capture hub)
```

**Core recommendations:**

| Decision | Recommendation |
|----------|----------------|
| Catalogue model | **Single Merchant Programme** with programme types — not duplicate catalogues |
| Warmpawz Pay | Evolve to **generic payment platform** with programme-aware payment intents |
| Booking vs billing | **Split concepts** — introduce **Appointment Billing** as independent module |
| Redemption | **Credit base appointment fee only**; platform/convenience at booking are non-redeemable service charges |
| Hidden prices | **Admin-configurable per programme/category**, not globally mandatory on day one |
| Commerce switch | Evolve from 2-model enum to **programme router** with hard exclusions for tele/meal/ecommerce/pharmacy/package |
| Merge strategy | Land Pay Bill + payment platform foundation first; appointment programme second |

**Critical architectural challenge to product:** Hidden prices + vendor-generated final bills introduce **material operational complexity** that payment plumbing alone cannot solve. Without a first-class **Billing** module, the platform will accrue booking-payment monolith debt within 18 months.

---

## 2. Current State

### 2.1 Production (`develop`)

| Dimension | State |
|-----------|-------|
| Discovery | Open — vendors surfaced by category, geo, discovery rules |
| Pricing visibility | Service prices on cards, profiles, booking summary |
| Payment timing | Full amount at booking (marketplace) |
| Payment rail | Legacy booking path: payments create, Razorpay, booking-charge-enforcement, vendor_earnings on completion |
| Commerce mode | `marketplace` default; `bookings.commerce_mode` stamped at create |
| Excluded domains | Tele, nutrition, ecommerce, pharmacy, meal, package, subscription — fixed in commerce-switch contracts |

**Strengths:** Proven slot hold (`pending_payment`), promotion engine integration, vendor calendar, refund orchestration for full bookings.

**Weaknesses:** Payment logic embedded in booking monolith; fee calculator inconsistencies; no Admin-curated appointment discovery; no two-phase payment.

### 2.2 Pre-merge (`feature/warmpawzpay`)

| Dimension | State |
|-----------|-------|
| Product | Pay Bill (SCAN TO PAY) |
| Discovery | Admin-published catalogue only |
| Pricing | Customer-entered bill + Admin discount % |
| Payment | Isolated wpay initiate/verify; `payment_source = warmpawz_pay`; `booking_id = NULL` |
| Admin | Catalogue lifecycle + merchant pricing (discount only) + RBAC + dashboard |
| Settlement | **Designed** (`settlements` order_type warmpawz_pay) — **not implemented post-verify** |
| Booking integration | **None** — architecture explicitly forbade coupling |

**Strengths:** Bounded context discipline, explicit payment_source, programme publish pattern, eligibility model, audit transactions.

**Weaknesses:** Incomplete async effects pipeline; no refunds; discount-only pricing schema; commerce switch booking adapter is stub with marketplace fallback.

### 2.3 Strategic gap

The organisation has **two discovery philosophies** (open vs Admin-curated) and **two payment philosophies** (full upfront vs walk-in bill) with **no unified merchant or commerce abstraction**. Adding Book Appointment as a second catalogue would **cement this fragmentation** for every future product (membership, insurance, wellness, donations).

---

## 3. Existing Architecture

### 3.1 Layered view (as-is)

```
┌─────────────────────────────────────────────────────────────┐
│  Customer / Vendor / Admin Apps                              │
├──────────────┬──────────────────────┬───────────────────────┤
│  Discovery   │  Booking Monolith    │  Warmpawz Pay (wpay)   │
│  (open)      │  + UniversalPayment  │  Pay Bill only         │
├──────────────┴──────────────────────┴───────────────────────┤
│  Shared: Razorpay, payments table, promotions, notifications │
├─────────────────────────────────────────────────────────────┤
│  Settlement split:                                           │
│    Marketplace → vendor_earnings, Route, SQS auto_settle     │
│    Wpay (planned) → settlements batch, no vendor_earnings    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Commerce Switch (today)

- Two registered models: `marketplace`, `warmpawz_pay` (experimental capabilities: slot_fee, final_balance).
- Excluded domains never switch — tele/meal/ecommerce remain marketplace.
- Customer routing falls back to marketplace because appointment Pay navigation unimplemented.
- Booking create already stamps `commerce_mode` — good freeze point for migration.

**Assessment:** Commerce Switch is the **seed of a programme router** but is underpowered as a 2-value enum. It should evolve, not be bypassed with ad-hoc flags.

### 3.3 Warmpawz Pay architecture (approved design)

Key principles already documented and **should be preserved**:

1. **`payment_source` explicit** — no default at insert.
2. **Sync capture, async effects** — verify must not block on settlement/notifications.
3. **Subsystem-owned state** — do not store effect lifecycle in payment metadata.
4. **Dependency rules** — wpay must not import booking monolith handlers wholesale.
5. **Future:** multiple bounded contexts write to payments hub.

**Assessment:** The approved wpay architecture **already anticipates** a payment platform. Pay Bill is **programme #1**, not the platform’s final shape.

### 3.4 Admin catalogue (Pay Bill)

Conceptual structure today:

- **Catalogue row** = vendor visibility (draft/published)
- **Merchant pricing** = commercial terms (discount % only)
- **Eligibility** = advisory warnings + customer SQL predicates (approved, bank verified, published)

**Assessment:** This is **Programme Enrollment + Programme Configuration** in disguise, named for Pay Bill only.

### 3.5 Payment flows (comparison)

| Aspect | Marketplace booking | Pay Bill |
|--------|---------------------|----------|
| Amount authority | Service catalogue + promos + tax/fees | Customer bill + discount |
| Initiate path | /bookings/create → /razorpay/create-order | /warmpawz-pay/initiate |
| Verify side effects | Confirm booking, OTP, loyalty, SQS settle | Payment row only (today) |
| Settlement | vendor_earnings + booking settlements | wpay settlements (planned) |
| Refunds | booking-original-refund | Not built |

### 3.6 Settlement & refund

- **Marketplace:** Mature but booking-coupled; platform/convenience fees partially applied; refunds exclude non-refundable fee components.
- **Wpay:** Schema ready (unique settlement per payment); **PostPaymentProcessor missing** — blocks any wpay-derived programme including appointment fees.

---

## 4. Product Evolution

### 4.1 From three products to one platform

| Era | Products | Discovery | Payment |
|-----|----------|-----------|---------|
| **Past** | Marketplace booking only | Open | Full upfront |
| **Present (branch)** | + Pay Bill | Admin catalogue | Walk-in bill |
| **Requested** | + Book Appointment programme | Admin catalogue | Fee at book + balance after |
| **5-year target** | + Membership, Insurance, Wellness, Retail, Donations | Programme-specific | Intent-based payment platform |

### 4.2 Proposed customer flow (target)

```
Book Appointment
  → Admin-selected vendor catalogue
  → Vendor → Services (hidden prices)
  → Service + Slot
  → Pay Booking Charges (base + convenience + platform)
  → Confirmed
  → Service completed
  → Vendor final bill
  → Base fee redeemed
  → Customer pays balance
```

### 4.3 What must NOT change

Tele, Meal Plans, E-commerce, Pharmacy, existing Package flows — **hard boundary**. These remain on marketplace paths with open or existing discovery rules.

---

## 5. Recommended Long-Term Architecture

### 5.1 Target state (5-year)

```
                    ┌──────────────────────┐
                    │   Merchant (Vendor)   │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     Programme: Pay Bill  Programme: Appt   Programme: Future
              │                │                │
              ▼                ▼                ▼
     Programme Config    Programme Config   Programme Config
     (discount %)       (fee bundle)       (premium, etc.)
              │                │                │
              └────────────────┼────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
   Scheduling            Billing              Warmpawz Pay
   (slots, booking)   (quotes, final bill,    (capture, verify,
                       redemption)             phases, refunds)
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
                         Settlement &
                         Reporting (programme-aware)
```

### 5.2 Architectural invariants (non-negotiable)

1. **Programme enrollment is the only gate for Admin-curated discovery.**
2. **Scheduling (booking) does not compute money** — it requests billing quotes and payment intents.
3. **Billing owns final bill, redemption, taxes on balance, discounts on balance.**
4. **Warmpawz Pay owns capture, idempotency, verify, refund execution** — not commercial rules.
5. **Settlement reads immutable snapshots** — never recomputes commercial logic.
6. **Excluded domains never enter programme router** — tele/meal/ecommerce/pharmacy/package.

### 5.3 Challenge to “second catalogue”

Creating **Book Appointment Catalogue** alongside Pay Bill Catalogue would:

- Duplicate publish/unpublish, eligibility, audit, RBAC, admin UI
- Fork reporting (which catalogue is source of truth for “merchant on platform”?)
- Multiply migration cost for each future product (membership catalogue, insurance catalogue…)

**Verdict:** **Reject Option A** (separate catalogues) for long-term maintainability.

---

## 6. Merchant Programme Analysis

### 6.1 Recommended model: Vendor → Programme → Configuration

| Concept | Responsibility |
|---------|----------------|
| **Merchant (Vendor)** | Identity, trust, bank verification, operational status |
| **Programme** | Product channel: `pay_bill`, `book_appointment`, `membership`, … |
| **Programme Enrollment** | Vendor opt-in, publish state, effective dates, created_by |
| **Programme Configuration** | Commercial terms per programme type |
| **Programme Discovery Projection** | Customer-facing list (published + eligible + programme filters) |

### 6.2 Can one vendor participate in multiple programmes?

**Yes — and should.**

| Programme | Coexistence example |
|-----------|---------------------|
| Pay Bill + Book Appointment | Clinic accepts walk-in bill pay AND scheduled appointments |
| Book Appointment + Membership (future) | Groomer with subscription programme |
| Pay Bill + Retail (future) | Pet store with counter pay |

Enrollment is **many-to-many** (vendor × programme) with **independent publish state** and **independent configuration**.

### 6.3 Programme configuration by type

| Programme | Configuration shape |
|-----------|---------------------|
| Pay Bill | Discount %, max discount cap, effective dates |
| Book Appointment | Base appointment fee, convenience fee, platform fee; price visibility policy |
| Membership (future) | Recurring amount, benefits, renewal |
| Insurance (future) | Premium rules, carrier linkage |

**Do not force one pricing schema for all programmes.** Use **typed configuration** behind a common enrollment admin shell.

### 6.4 Scale assessment

| Approach | 5-year scale (1–5) | Notes |
|----------|-------------------|-------|
| Separate catalogues per product | ⭐⭐ | O(n) admin duplication |
| Single Merchant Programme | ⭐⭐⭐⭐⭐ | O(1) enrollment pattern; O(n) typed config |
| Global vendor flags (`pay_bill_enabled`, etc.) | ⭐ | Already abandoned (migration 1084 dropped pay_bill_enabled) |

**Recommendation:** **Merchant Programme is the correct long-term architecture.**

---

## 7. Booking Architecture

### 7.1 Current booking responsibilities ( overloaded )

Today booking monolith handles:

- Slot validation and holds
- Service selection
- Price aggregation (client-side)
- Promotion application coordination
- Payment amount validation
- Status machine (pending_payment → confirmed)
- OTP, notifications, vendor visibility rules
- Commerce mode stamping

**Problem:** Adding appointment programme without extraction **further overloads** the monolith.

### 7.2 Recommended booking evolution

**Booking (Scheduling) should own only:**

| Owns | Does not own |
|------|--------------|
| Slot, pet, service selection | Final bill amount |
| Booking status (scheduling states) | Redemption math |
| Link to programme enrollment | Settlement |
| Request payment intent from Billing | Discount % for Pay Bill |
| Freeze programme + commerce context at create | Razorpay verify side effects beyond scheduling confirmation trigger |

**New booking types (conceptual):**

| Type | commerce_context | Payment pattern |
|------|------------------|-----------------|
| Marketplace appointment | marketplace | Full upfront (unchanged) |
| Programme appointment | book_appointment | Booking charges at confirm |
| Package session | package (excluded) | Unchanged |
| Tele | tele (excluded) | Unchanged |

### 7.3 Appointment Billing — should it exist?

**Yes.** Introducing **Appointment Billing** as a separate business concept simplifies:

- Hidden price → final bill reveal
- Redemption application
- Balance due calculation
- Tax/discount on balance leg
- Vendor bill approval workflow
- Audit trail for disputes

**Booking creates a BillingAccount (conceptual)** linked 1:1 to appointment booking when on programme. Marketplace bookings may continue without BillingAccount until balance model expands.

---

## 8. Billing Architecture

### 8.1 Why billing must be independent

Without Billing module, final bill logic will leak into:

- Vendor app (ad hoc amounts)
- Payment verify handlers (balance computation)
- Support tools (no single source of truth)
- Reporting (GMV vs deposit vs balance inconsistent)

### 8.2 Billing module responsibilities

| Responsibility | Owner |
|----------------|-------|
| Booking charge quote (fee bundle) | Billing |
| Final bill creation (vendor input + rules) | Billing |
| Tax computation on final bill | Billing |
| Promotions on balance (if allowed) | Billing |
| Redemption application | Billing |
| Balance due calculation | Billing |
| Bill state machine (draft → issued → paid → void) | Billing |
| Payment collection requests | Billing → Warmpawz Pay |

### 8.3 Billing state machine (conceptual)

```
Appointment confirmed (fee paid)
  → Service in progress
  → Final bill draft (vendor)
  → Final bill issued (customer visible)
  → Balance payment pending
  → Balance paid / written off
  → Closed
```

### 8.4 Separation benefits

| Benefit | Impact |
|---------|--------|
| Testability | Billing rules unit-tested without booking integration tests |
| Reuse | Retail counter bill, membership renewal invoices same module later |
| Support | One “Bill” object to reference |
| Compliance | Clear invoice timeline |

**Recommendation:** **Billing is a first-class module**, not a phase-2 afterthought.

---

## 9. Payment Architecture

### 9.1 Warmpawz Pay as payment platform

Evolve from:

```
Pay Bill → wpay payments
```

To:

```
Warmpawz Pay Platform
  ├── Payment Intent (programme, phase, amount authority)
  ├── Capture (Razorpay)
  ├── Verify (HMAC, idempotency)
  ├── Refund (programme-specific policy adapter)
  └── Handoff to Settlement (async)
```

### 9.2 Payment programmes / intents

| Intent type | Programme | Phase | Amount from |
|-------------|-----------|-------|-------------|
| Walk-in bill | pay_bill | single | Billing quote (discount on customer amount) |
| Appointment booking charge | book_appointment | booking_charge | Billing quote (fee bundle) |
| Appointment balance | book_appointment | balance | Billing (post-redemption) |
| Marketplace booking | marketplace | full | Legacy path (transition) |
| Membership renewal (future) | membership | renewal | Billing |

**Shared:** payments hub row, Razorpay client, verify idempotency, admin transaction list filters.

**Independent:** amount resolver per intent type; post-verify orchestration hooks.

### 9.3 Payment phase model

Conceptual **`PaymentPhase`** enum:

- `walk_in` — Pay Bill
- `booking_charge` — appointment fee bundle at book
- `balance` — post-service remainder
- `full` — marketplace legacy

Linked to **`booking_id`** when scheduling-related; NULL for walk-in.

### 9.4 Should marketplace booking migrate to wpay platform?

**Long-term yes, short-term no.**

| Horizon | Approach |
|---------|----------|
| 0–12 months | Marketplace stays on legacy path; programme appointments use wpay platform |
| 12–36 months | Migrate marketplace to payment intents behind feature flag |
| 36+ months | Deprecate monolith verify handler; single platform |

**Rationale:** Big-bang migration of live marketplace payments is high-risk. Programme appointments are greenfield on wpay platform.

### 9.5 Redemption model analysis

**Given example:**

- Booking charge paid: ₹114 (99 + 10 + 5)
- Final service bill: ₹800

**Option R1 — Base fee only redeems (recommended)**

| Component | At booking | Redeems toward service? |
|-----------|------------|-------------------------|
| Base appointment fee ₹99 | Collected | **Yes — credit ₹99** |
| Convenience ₹10 | Collected | **No — platform/service charge for reservation** |
| Platform ₹5 | Collected | **No — platform revenue for reservation transaction** |
| Balance due | — | ₹800 − ₹99 = **₹701** (+ tax/promo on balance per policy) |

**Pros:** Clear customer story (“₹99 advance toward your visit”); platform keeps reservation economics; aligns with PRD fee bundle; finance can recognize components separately.

**Cons:** Customer may perceive ₹114 vs ₹99 mismatch if messaging poor.

---

**Option R2 — Full booking charge redeems**

Balance = ₹800 − ₹114 = ₹686.

**Pros:** Simple arithmetic; customer feels full prepayment credited.

**Cons:** Platform/convenience revenue at booking may need clawback or reclassification; weakens platform fee economics; finance complexity.

---

**Option R3 — Base fee redeems; convenience/platform re-applied on balance**

Balance = ₹800 − ₹99 + convenience₂ + platform₂.

**Pros:** Fee revenue on both legs.

**Cons:** Highest customer friction; likely unacceptable without strong disclosure.

---

**Recommendation:** **Option R1** with explicit receipt line items:

- “Advance toward service: ₹99 (credited to final bill)”
- “Reservation service fee: ₹10”
- “Platform fee: ₹5”

**Promotions:** Apply to **final bill (balance leg)** only in v1 — avoids double-discount on hidden list prices.

---

## 10. Settlement Architecture

### 10.1 Current split (problem)

Two settlement philosophies coexist:

| Rail | Used by | Maturity |
|------|---------|----------|
| vendor_earnings + booking completion | Marketplace | Live |
| settlements order_type warmpawz_pay | Pay Bill | Schema only |

**5-year target:** **Unified settlement orchestrator** reading payment intents + commission snapshots, writing to settlements + vendor_earnings as appropriate.

### 10.2 Programme-aware settlement

| Payment phase | When vendor paid | Basis |
|---------------|------------------|-------|
| booking_charge | After verify (async) | Fee bundle minus commission |
| balance | After balance verify | Net balance minus commission |
| walk_in | After verify (async) | Payable minus discount minus commission |
| marketplace full | Existing paths | Unchanged until migration |

**Immutable commission snapshot** at each payment event — settlement batch never recomputes.

### 10.3 Liability tracking

Billing module tracks **redeemable credit outstanding** (₹99 not yet applied) until final bill issued — important for finance reporting between booking and completion.

---

## 11. Catalogue Architecture

### 11.1 Option comparison

| Criterion | A: Separate catalogues | B: Merchant Programme |
|-----------|------------------------|------------------------|
| Admin UX duplication | High | Low (tab per programme) |
| Eligibility logic | Duplicated | Shared |
| Audit / RBAC | Duplicated | Shared enrollment permissions + typed config permissions |
| Reporting | Fragmented | Unified merchant dimension |
| Future products | New catalogue each time | New programme type |
| Migration from Pay Bill | N/A | Map existing rows to enrollments |
| Cognitive load | Lower per product | Higher initial modeling |
| 5-year TCO | Poor | **Strong** |

### 11.2 Recommendation

**Option B — Single Merchant Programme with programme types.**

Pay Bill catalogue table becomes **first enrollment records**, not a pattern to copy.

### 11.3 Customer discovery projections

Do not merge Pay Bill vendor list and Book Appointment vendor list UI without programme filters — same enrollment backend, **different customer entry points**:

| Entry | Programme filter | UX |
|-------|------------------|-----|
| SCAN TO PAY | pay_bill | Bill amount entry |
| Book Appointment | book_appointment | Service + slot (hidden prices) |
| Open discovery (develop) | none / marketplace | Unchanged for non-enrolled |

---

## 12. Admin Architecture

### 12.1 Ideal admin experience

**Manage Vendor Programmes**, not “catalogues.”

```
Admin → Merchants → [Vendor] → Programmes
  ├── Pay Bill          [Published ✓]  [Configure discount]
  ├── Book Appointment  [Draft]        [Configure fee bundle + price visibility]
  ├── Membership        [Coming soon]
  └── ...
```

Platform defaults:

```
Admin → Warmpawz Pay → Programme Defaults
  ├── Pay Bill (default discount bounds)
  └── Book Appointment (base fee, convenience, platform by category)
```

### 12.2 Category-level configuration

**Required** for Book Appointment:

| Category | Why different defaults |
|----------|------------------------|
| Veterinary | Higher ticket, moderate no-show cost |
| Grooming | Lower ticket, different fee tolerance |
| Boarding | Multi-day final bill complexity |
| Walking / Sitting | High frequency, lower fee |
| Training | Package overlap rules |

### 12.3 RBAC evolution

Extend existing `admin.warmpawz_pay.*` permission family:

| Permission domain | Examples |
|-------------------|----------|
| Enrollment | view, publish, bulk |
| Pay Bill config | pricing.write |
| Appointment config | appointment_fee.write |
| Billing override | billing.adjust (support/finance) |

Legacy **`admin.warmpawz_pay`** full access remains superuser bypass.

### 12.4 Audit

Enrollment publish, fee config changes, final bill adjustments, offline balance marks — all require **entity audit log** (pattern already used in catalogue mutations).

---

## 13. Customer Journey

### 13.1 Programme appointment journey (target)

| Step | System touchpoints |
|------|-------------------|
| Book Appointment entry | Programme discovery projection |
| Vendor list | Enrollment filter; no prices |
| Vendor detail | Services without list price |
| Slot selection | Scheduling module |
| Summary | Billing quote: booking charge breakdown |
| Payment | Warmpawz Pay intent booking_charge |
| Confirmation | Booking confirmed; billing account open |
| Service day | — |
| Final bill issued | Billing module (vendor) |
| Balance payment | Warmpawz Pay intent balance |
| History | Both phases + final bill document |

### 13.2 Unchanged journeys

Tele consultation, meal checkout, e-commerce cart, pharmacy, package session booking — **zero new steps**.

### 13.3 Trust implications (hidden prices)

Customers must see:

- What they pay **now** (exact booking charge)
- That service price is **determined after consultation/service**
- Redemption policy for base fee
- Cancellation impact on ₹99 vs ₹15 fees

---

## 14. Vendor Journey

| Phase | Marketplace (unchanged) | Programme appointment |
|-------|-------------------------|------------------------|
| Discovery | Open | Admin enrolled only |
| Booking notification | Full amount pending/paid | Booking charge received |
| Calendar | Standard | + balance pending badge |
| Service delivery | Standard | May require assessment before final bill |
| **Final bill** | N/A (prepaid) | **Vendor creates/confirm bill in Billing UI** |
| Collection | Prepaid | Balance link + offline mark |
| Pay Bill walk-in | If enrolled separately | Independent |

**Critical:** Vendor workflow change is **heavier than customer payment change** — training and UX investment required.

---

## 15. Reporting Impact

| Metric | Source concept |
|--------|----------------|
| Programme adoption | Enrollment counts by type |
| Booking funnel | Discovery → fee paid → completed → balance paid |
| GMV timing | Deposits vs balance vs marketplace upfront |
| Redemption liability | Unredeemed base fees on open appointments |
| No-show rate | By programme vs marketplace |
| Pay Bill vs Appointment cross-usage | Same merchant, both programmes |
| Settlement reconciliation | Payment intent → settlement row gaps |
| Support disputes | Billing timeline + payment phases |

Reporting grain: **`merchant_id + programme_type + payment_phase + booking_id`**.

---

## 16. Migration Strategy

### 16.1 Principles

1. **No retroactive commerce mode changes** on existing bookings.
2. **Merge wpay branch before appointment programme customer UI.**
3. **Complete PostPaymentProcessor for Pay Bill** — appointment charges inherit it.
4. **Migrate catalogue → enrollment** as rename/refactor, not parallel run.
5. **Feature flags per programme** independent of Pay Bill tab.

### 16.2 Phased migration

| Phase | Action |
|-------|--------|
| M0 | Merge feature/warmpawzpay → develop; flags off in prod |
| M1 | PostPaymentProcessor + settlements live for Pay Bill |
| M2 | Introduce Merchant Programme model; migrate Pay Bill enrollments |
| M3 | Billing module + appointment fee config (admin only) |
| M4 | Customer appointment programme (prices visible pilot) |
| M5 | Hidden prices + vendor final bill |
| M6 | Balance payment + redemption automation |

### 16.3 Coexistence matrix

| Vendor state | Book Appointment behaviour | Pay Bill | Marketplace booking |
|--------------|----------------------------|----------|---------------------|
| Not enrolled | N/A — use open discovery marketplace | If enrolled | Yes |
| Appointment enrolled only | Programme flow | Optional separate enrollment | Disabled for enrolled categories? **Product decision** |
| Both enrolled | Programme + Pay Bill tab | Yes | Policy: hide or allow |

**Recommendation:** Programme enrollment **does not automatically remove** vendor from open discovery until product explicitly migrates category — avoids vendor shock. Gradual **“programme-first discovery”** per category in later phase.

---

## 17. Rollout Strategy

| Stage | Scope | Risk control |
|-------|-------|--------------|
| Pilot | Vet clinic, one city, 10 merchants | Prices visible; manual final bill |
| Expand categories | Grooming, boarding | Category fee defaults |
| Hidden prices | Opt-in merchants | Admin toggle per enrollment |
| Balance in-app | After offline mark proven | |
| GA | Opt-in enrollment | Marketplace fallback always available |

**Rollback:** Unpublish appointment programme enrollment → vendors revert to marketplace booking instantly for new bookings.

---

## 18. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Booking monolith absorbs billing logic | **Critical** | Enforce module boundaries in ADR |
| Incomplete wpay settlement blocks launch | **High** | M1 gate |
| Hidden prices reduce conversion | **High** | Configurable visibility; pilot visible first |
| Vendor final bill fraud/error | **High** | Bill approval, audit, customer dispute flow |
| Dual discovery confusion | **Medium** | Clear entry points |
| Finance misrecognizes fee components | **Medium** | Option R1 receipt semantics |
| RBAC sprawl | **Medium** | Programme-scoped permissions |
| Commerce switch enum exhaustion | **Medium** | Programme router refactor early |
| 5-year product proliferation without programme model | **Critical** | Reject duplicate catalogues now |

---

## 19. Trade-offs

| Choice | Gain | Cost |
|--------|------|------|
| Merchant Programme vs dual catalogue | Long-term scale | Upfront modeling + migration |
| Billing module vs booking-embedded | Clarity, reuse | New module ownership, integration work |
| Option R1 redemption | Clean economics | Customer education |
| Hidden prices mandatory | Vendor pricing flexibility | Conversion risk, trust risk |
| wpay platform for programme only | Isolation from monolith | Two payment paths temporarily |
| Postpone marketplace wpay migration | Stability | Dual maintenance 2–3 years |

**Alternative architecture considered:** Extend marketplace booking with “deposit mode” flag per vendor without programme enrollment.

**Rejected because:** Does not solve Admin-curated discovery, does not scale to membership/insurance, entangles open discovery with commercial experiments, and prevents clean payment platform evolution.

---

## 20. Open Questions

### Architecture

1. Should **Billing** be a separate deployable service or a domain module within lambda monolith initially?
2. When does **Commerce Switch** get replaced by **Programme Router**?
3. Single Razorpay merchant account vs split receipts for booking_charge vs balance?

### Product

4. Programme enrollment vs open discovery — mutual exclusivity per category or overlap during migration?
5. Mandatory hidden prices or Admin toggle default off?
6. Vendor final bill — customer approval step before balance due?
7. Boarding multi-night — one booking charge or recurring balance accrual?

### Finance

8. GST on booking charge bundle components?
9. Recognize ₹99 as liability until service complete?
10. Commission on base fee only or entire bundle?

### Operations

11. Support tooling — build Billing timeline in v1 or phase 2?
12. Offline balance — photo proof required?

---

## 21. Final Recommendations

### 21.1 Strategic (5-year)

1. **Adopt Merchant Programme architecture** — Vendor → Programme Enrollment → Typed Configuration. **Do not create Book Appointment Catalogue.**
2. **Evolve Warmpawz Pay into payment platform** with payment intents and phases — Pay Bill is first consumer, not the platform boundary.
3. **Introduce Appointment Billing module** — final bill, redemption, balance due — separate from Scheduling and Payment capture.
4. **Preserve bounded context rules** from approved wpay architecture — async effects, explicit payment_source, no monolith verify coupling.
5. **Plan for N programmes** (membership, insurance, wellness, retail, donations) using same enrollment + billing + payment intent pattern.

### 21.2 Tactical (next 12 months)

1. Merge wpay branch; **complete settlement pipeline** before appointment fees.
2. Refactor Pay Bill catalogue → **Programme Enrollment (pay_bill)** without customer-visible regression.
3. Build **book_appointment** enrollment + fee configuration in admin.
4. Implement **booking_charge** payment intent linked to booking — pilot with **visible prices**.
5. Ship **vendor final bill + Option R1 redemption + balance payment**.
6. Add **hidden price policy** as enrollment config — default **off** until pilot proves conversion.

### 21.3 Redemption (final)

**Base Appointment Fee redeems 1:1 against final service bill subtotal.** Convenience and Platform fees collected at booking are **non-redeemable reservation charges.** Balance leg subject to tax, promotions, and additional fees per Billing policy.

### 21.4 Hidden pricing (final)

**Admin-configurable per enrollment**, recommended default:

| Level | Default |
|-------|---------|
| Platform | Off (visible) for pilot |
| Category | Vet optional hide after pilot |
| Vendor | Override |

**Mandatory hide** only after operational proof: vendor final bill workflow, support playbooks, conversion metrics.

### 21.5 What not to do

- ❌ Second vendor catalogue for appointments
- ❌ Embed final bill math in payment verify handler
- ❌ Route tele/meal/ecommerce through programme router
- ❌ Force global hidden prices on day one
- ❌ Block Pay Bill merge waiting for full appointment programme

---

## Appendix A — Conceptual entities (no schema)

| Entity | Description |
|--------|-------------|
| **Merchant** | Vendor identity and trust |
| **Programme** | Product channel definition (type, rules version) |
| **ProgrammeEnrollment** | Vendor participation + publish state |
| **ProgrammeConfiguration** | Typed commercial terms (discount OR fee bundle OR future) |
| **ProgrammeDiscoveryProjection** | Customer list cache/filter |
| **AppointmentBooking** | Scheduling aggregate (slot, pet, status) |
| **BillingAccount** | Financial account 1:1 with programme appointment |
| **BookingChargeQuote** | Fee bundle quote at reservation |
| **FinalBill** | Vendor-issued service bill |
| **RedeemableCredit** | Base fee credit applied to final bill |
| **BalanceDue** | Remaining after redemption + adjustments |
| **PaymentIntent** | Platform request to collect specific phase |
| **PaymentCapture** | payments hub row post-capture |
| **SettlementRecord** | Payout accrual per capture |
| **RefundCase** | Programme-aware refund workflow |

---

## Appendix B — Feature flags (recommended)

| Flag | Purpose |
|------|---------|
| WARMPAWZ_PAY_ENABLED | Master wpay platform |
| WARMPAWZ_PAY_ADMIN_ENABLED | Admin programmes |
| PROGRAMME_PAY_BILL_CUSTOMER | SCAN TO PAY tab |
| PROGRAMME_BOOK_APPOINTMENT | New booking entry |
| BOOKING_CHARGE_CHECKOUT | Fee bundle payment |
| BILLING_FINAL_BILL | Vendor bill issuance |
| BALANCE_PAYMENT | Customer balance leg |
| HIDDEN_SERVICE_PRICES | Enrollment-level price hide |
| MERCHANT_PROGRAMME_ADMIN | New admin shell |

---

## Appendix C — Backward compatibility guarantee

| Domain | Guarantee |
|--------|-----------|
| develop marketplace booking | Unchanged for non-enrolled vendors |
| Existing bookings | Frozen commerce_mode and payment rules |
| Existing payments | No mutation |
| Tele / meal / ecommerce / pharmacy / package | Hard excluded — no programme router |
| Pay Bill (post-merge) | Enrollment migration preserves behaviour |
| vendor_earnings marketplace path | Untouched until explicit migration project |

---

*This document provides architecture analysis and recommendations only. Implementation requires ADRs, product sign-off, and phased delivery plans derived from this analysis.*

*End of document*
