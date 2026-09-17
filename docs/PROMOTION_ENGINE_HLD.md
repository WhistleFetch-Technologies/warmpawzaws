# Warmpawz Promotion, Discount & Cashback Engine — HLD (Source of Truth)

**Audience:** Bindu, Abhi, Praveen (and Cursor agents on `feature/promo-engine-v1`)  
**Status:** Product / engineering source of truth for behaviour, APIs, schema intent, and rule model  
**Companion:** [PROMOTION_ENGINE_MASTER_PLAN.md](./PROMOTION_ENGINE_MASTER_PLAN.md) — phased execution, migration numbers, UI seating, ownership  
**Figma prototype:** [Warmpawz Promotion Engine — UI/UX Wireframes](https://www.figma.com/proto/bdLIYhcbseibOrjzFIBDVH/Warmpawz-Promotion-Engine-%E2%80%94-UI-UX-Wireframes?node-id=2-370&p=f&t=ObcZOMlHR9Re9TyR-1&scaling=min-zoom&content-scaling=fixed&page-id=0%3A1)

> Implementation note: map table names in §33 to `promo_engine_*` as defined in the master plan (avoids clash with legacy `promotions`). Extend existing `discount-engine` rather than a greenfield service. Admin UI reuses Promotion Center styling; Figma is flow reference only.

---

## 1. Objective

Build a configurable Promotion Engine that determines:

- Who is eligible?
- For what service/product?
- On which visit/order?
- Under what behavioural conditions?
- What discount should be applied?
- What cashback should be earned?
- Where can that cashback be used?
- When does it expire?
- Can multiple promotions be combined?
- Who funds the benefit?
- How many times can the user use it?

The existing **Warmpawz Wallet** remains the financial ledger/store for cashback.

The existing **Loyalty & Rewards Engine** remains independent.

---

## 2. High-Level Architecture

```
                         WARMPAWZ ADMIN
                              │
                              ▼
                  ┌─────────────────────────┐
                  │ Promotion Admin Service │
                  │ Create / Edit / Pause   │
                  │ Rules / Benefits        │
                  │ Campaigns / Limits      │
                  └────────────┬────────────┘
                               │
                               ▼
                  ┌─────────────────────────┐
                  │   PROMOTION ENGINE      │
                  │ 1. Eligibility Engine   │
                  │ 2. Rule Engine          │
                  │ 3. Benefit Calculator   │
                  │ 4. Stack/Conflict       │
                  │ 5. Usage/Limit Engine   │
                  └────────────┬────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
 ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐
 │ User Behaviour  │  │ Booking/Order    │  │ Service Catalog  │
 │ Visits/Recency  │  │ Amount/Items     │  │ Category/Vendor  │
 │ Frequency/Spend │  │ Vendor/Visit #   │  │ Location/Package │
 └────────┬────────┘  └────────┬─────────┘  └────────┬─────────┘
          └────────────────────┼─────────────────────┘
                               ▼
                  ┌─────────────────────────┐
                  │     BENEFIT RESULT      │
                  │ Discount ₹X / Cashback ₹Y│
                  │ Applicable / Expiry     │
                  └────────────┬────────────┘
                               │
                  ┌────────────┴────────────┐
                  ▼                         ▼
        ┌──────────────────┐       ┌──────────────────┐
        │ Booking / Order  │       │ Wallet Service   │
        │ Apply Discount   │       │ Credit / Debit   │
        └──────────────────┘       └──────────────────┘
```

---

## 3. Core Principle

```
INPUT → Context → Find applicable promotions → Evaluate conditions
  → Calculate benefits → Resolve conflicts → Return promotion result
  → Transaction confirmed → Commit benefit → Wallet cashback transaction
```

**Never credit cashback during the initial eligibility check.**

---

## 4. Promotion Lifecycle

```
DRAFT → SCHEDULED → ACTIVE ⇄ PAUSED → EXPIRED → ARCHIVED
```

Example: Campaign "September Grooming Offer", 01-Sep-2026 → 30-Sep-2026, status ACTIVE.

---

## 5. Promotion Object

A promotion is the business campaign.

```json
{
  "promotion_id": "PROMO-GRM-001",
  "name": "Grooming Win Back",
  "status": "ACTIVE",
  "priority": 80,
  "start_at": "2026-09-01T00:00:00",
  "end_at": "2026-12-31T23:59:59",
  "stacking_policy": "SERVICE_LEVEL",
  "funding": {
    "type": "SHARED",
    "warmpawz_percent": 70,
    "vendor_percent": 30
  }
}
```

---

## 6. Rule Structure

```
PROMOTION
  ├── RULE 1
  ├── RULE 2
  └── RULE 3
```

Each rule: **IF** conditions **THEN** benefits.

---

## 7. Generic Condition Model

Do not hard-code business rules. Use `field` / `operator` / `value`.

```json
{ "field": "user.days_since_last_service", "operator": ">=", "value": 30 }
```

```json
{ "field": "transaction.service_category", "operator": "IN", "value": ["GROOMING"] }
```

```json
{ "field": "user.service_visit_count", "operator": ">=", "value": 3 }
```

---

## 8. Condition Groups

Support AND and OR.

```json
{
  "operator": "AND",
  "conditions": [
    { "field": "transaction.service_category", "operator": "=", "value": "GROOMING" },
    { "field": "user.days_since_last_grooming", "operator": ">=", "value": 30 },
    { "field": "user.grooming_visit_count", "operator": ">=", "value": 1 }
  ]
}
```

---

## 9. Condition Field Catalog (v1)

| Group | Fields |
|-------|--------|
| **User** | `user_id`, `user_segment`, `new_user`, `account_age`, `city`, `state` |
| **Behaviour** | `total_orders`, `completed_orders`, `cancelled_orders`, `total_spend`, `average_order_value`, `service_visit_count`, `last_service_date`, `days_since_last_service` (+ service-specific: `grooming_visit_count`, `days_since_last_grooming`, …) |
| **Transaction** | `order_value`, `service`, `service_category`, `service_type`, `vendor`, `vendor_category`, `city`, `state`, `quantity`, `package` |
| **Visit** | `visit_number`, `first_visit`, `second_visit`, `nth_visit` |
| **Wallet** | `wallet_balance`, `cashback_balance` |

---

## 10. Example — First Visit

First grooming visit → ₹200 cashback.

At booking time, completed count is still 0 (current visit not completed).

```json
{
  "conditions": [
    { "field": "transaction.service_category", "operator": "=", "value": "GROOMING" },
    { "field": "user.grooming_visit_count", "operator": "=", "value": 0 }
  ],
  "benefits": [
    { "type": "CASHBACK", "value_type": "FIXED", "value": 200 }
  ]
}
```

---

## 11. Example — Second Visit

Service = GROOMING AND completed grooming visits = 1 → 15% discount.

---

## 12. Example — Every Subsequent Visit

Service = GROOMING AND completed grooming visits >= 2 → ₹100 cashback.

Together:

| Visit | Benefit |
|-------|---------|
| 1 | ₹200 cashback |
| 2 | 15% discount |
| 3+ | ₹100 cashback |

No separate application logic per visit — configuration only.

---

## 13. Example — 30-Day Winback

IF service = GROOMING AND grooming_visit_count >= 1 AND days_since_last_grooming >= 30  
THEN 20% discount MAX ₹300 + ₹150 cashback.

Example: ₹1,200 − ₹240 = ₹960 payable; ₹150 cashback earned.

---

## 14. Example — Cross Sell

IF grooming_visit_count >= 2 AND vet_visit_count = 0 AND current_service = VET  
THEN ₹200 cashback.

Supports loops: Grooming → Vet → Training → Boarding → Ecommerce.

---

## 15. Example — Upsell

IF service = GROOMING AND package = PREMIUM AND order_value >= 899  
THEN ₹200 cashback.

---

## 16. Benefit Model

Single generic BENEFIT type system (do not split discount and cashback into separate engines):

`DISCOUNT` | `CASHBACK` | `FREE_SERVICE` | `FREE_ADDON` | `VOUCHER` | `UPGRADE`

**v1 implement:** `DISCOUNT`, `CASHBACK` only.

---

## 17. Discount Types

- `PERCENTAGE`, `FIXED_AMOUNT`
- Caps: `MAX_DISCOUNT`, `MIN_ORDER_VALUE`

Example: 20% off, max ₹300, min order ₹999.

---

## 18. Cashback Types

- `FIXED`, `PERCENTAGE` (optional max)

---

## 19. Cashback Usage Rules (earn vs redeem scope)

Earn scope (where earned) and redeem scope (where usable) are independent.

Example: Earn on Grooming ₹200; redeem on Vet, Training, Boarding, Ecommerce (not Grooming).

This is the cross-sell loop.

---

## 20. Cashback Expiry

Each cashback **ledger row** carries its own expiry (do not rely only on promotion-level expiry).

Wallet ledger fields:

- `wallet_transaction_id`, `user_id`, `promotion_id`
- `amount`, `remaining_amount`
- `earned_at`, `expires_at`, `status`

---

## 21. Wallet Integration

Existing wallet: Money / Cashback / other balances.

Engine calls cashback credit (shape):

```http
POST /wallet/cashback/credit
```

```json
{
  "user_id": "U123",
  "amount": 200,
  "source": "PROMOTION",
  "promotion_id": "PROMO123",
  "reference_id": "BOOKING456",
  "expires_at": "2026-10-16T23:59:59"
}
```

Map onto existing Warmpawz wallet credit APIs + ledger columns from master plan migration `1113`.

---

## 22. Cashback Redemption

```
Booking → Promotion Engine / Wallet → Available cashback (scope-filtered) → Redeem
```

Example: Booking ₹1,000; available ₹400; max usable ₹300; user uses ₹300; cash ₹700.

---

## 23. Multiple Promotions in Same Visit (line/service level)

Evaluate **per service line**, not only order total.

Example cart: Grooming ₹1,000 (−10%), Vet ₹800 (+₹200 CB), Training ₹500 (+15% CB)  
→ Payable ₹2,200; Cashback ₹275.

---

## 24. Promotion Stacking

Values: `NONE` | `ORDER_LEVEL` | `SERVICE_LEVEL` | `CATEGORY_LEVEL` | `DISCOUNT_WITH_CASHBACK` | `FULL_STACKING`

Example: two discounts → pick one (priority); cashback can still apply under `DISCOUNT_WITH_CASHBACK`.

---

## 25. Priority & Conflict Resolution

Each promotion has `priority` (e.g. VIP 100, Winback 80, Cross-sell 60, Generic 20).

```
Find eligible → Group by service → Stacking rules → Priority → Final benefits
```

---

## 26. Evaluation API

Most important runtime API.

```http
POST /api/v1/promotions/evaluate
```

Request:

```json
{
  "user_id": "U1001",
  "transaction": {
    "type": "BOOKING",
    "service_category": "GROOMING",
    "service_type": "HOME_GROOMING",
    "vendor_id": "V100",
    "city": "Bengaluru",
    "amount": 1200
  }
}
```

Response:

```json
{
  "eligible": true,
  "benefits": [
    { "promotion_id": "PROMO001", "benefit_type": "DISCOUNT", "amount": 240 },
    { "promotion_id": "PROMO002", "benefit_type": "CASHBACK", "amount": 150 }
  ],
  "summary": {
    "gross_amount": 1200,
    "discount": 240,
    "payable": 960,
    "cashback": 150
  }
}
```

Warmpawz path: `/promo-engine/evaluate` (see master plan) — same contract semantics.

---

## 27. Commit API

After successful payment/booking:

```http
POST /api/v1/promotions/commit
```

```json
{
  "evaluation_id": "EVAL-123456",
  "transaction_id": "BOOKING-123",
  "payment_id": "PAY-123"
}
```

Commit: record usage → consume quota → credit cashback → audit.

---

## 28. Reverse API

```http
POST /api/v1/promotions/reverse
```

On refund: reverse credited cashback. If already spent, wallet accounting policy applies (negative/reversal txn).

---

## 29. Behaviour Service

**Not** part of the promotion rule database. Separate Customer Behaviour Profile:

```json
{
  "user_id": "U123",
  "overall": {
    "completed_orders": 14,
    "total_spend": 12500,
    "average_order_value": 893
  },
  "services": {
    "grooming": {
      "completed_count": 5,
      "last_completed_at": "2026-08-01",
      "total_spend": 4500
    },
    "vet": {
      "completed_count": 1,
      "last_completed_at": "2026-07-12",
      "total_spend": 800
    },
    "training": { "completed_count": 0 }
  }
}
```

Avoid scanning millions of bookings on every evaluate.

---

## 30. Behaviour Events

Publish / consume:

- `BOOKING_CREATED`, `BOOKING_CONFIRMED`, `SERVICE_COMPLETED`, `BOOKING_CANCELLED`
- `ORDER_CREATED`, `ORDER_COMPLETED`, `ORDER_CANCELLED`
- `PAYMENT_COMPLETED`, `PAYMENT_REFUNDED`

```
Booking Service → Event Bus → Behaviour Service → User Behaviour Profile
```

---

## 31. Promotion Evaluation Flow

```
Booking → Evaluate → Get Behaviour → Get Applicable Promotions
  → Evaluate Conditions → Eligible? → Calculate Benefits → Resolve Conflicts → Final Result
```

---

## 32. Candidate Filtering (scale)

Do not evaluate every promotion. Index filter first:

`ACTIVE`, `start_at <= now`, `end_at >= now`, `service_category`, `city`, `vendor`, `promotion_type`

```
10,000 → DB filter → 100 candidates → rules → 8 eligible → conflict → 3 benefits
```

---

## 33. Database — Core Tables (logical)

### promotions (`promo_engine_promotions` in implementation)

| Field | Purpose |
|-------|---------|
| id | Promotion ID |
| name | Campaign name |
| status | Draft/Active/… |
| priority | Conflict resolution |
| start_at / end_at | Window |
| stacking_policy | Stacking |
| funding_type | Warmpawz/Vendor/Shared |
| budget / budget_consumed | Campaign budget |

### promotion_rules (`promo_engine_rules`)

| Field | Purpose |
|-------|---------|
| id / promotion_id | Identity |
| condition_json | Rule conditions |
| benefit_json | Rule benefit(s) |
| priority | Rule priority |
| rule_type | `GENERIC` \| `CUSTOMER_JOURNEY` |

### promotion_usage (`promo_engine_usage`)

| Field | Purpose |
|-------|---------|
| promotion_id / user_id / transaction_id | Keys |
| discount_amount / cashback_amount | Applied |
| idempotency_key | Dedup commits |
| created_at | Timestamp |

### promotion_limits (`promo_engine_limits`)

| Field | Purpose |
|-------|---------|
| per_user / per_transaction / daily_limit / campaign_limit / budget_limit | Caps |

---

## 34. Cashback Ledger

Use existing Wallet; make promotion reference explicit.

`wallet_transactions` types (logical):

`CASHBACK_CREDIT` | `CASHBACK_DEBIT` | `CASHBACK_EXPIRED` | `CASHBACK_REVERSED`

Fields: `amount`, `remaining_amount`, `source=PROMOTION`, `promotion_id`, `transaction_id`, `earned_at`, `expires_at`, `status` (+ `redeem_scope` JSON in implementation).

---

## 35–36. End-to-End Cross-Sell Loop

Rahul: 5 grooming visits, last 45 days ago, 0 vet, spend ₹8,000 → books Grooming ₹1,500  
→ Winback: 20% max ₹300 → payable ₹1,200 + cashback (redeem Vet/Training/Ecommerce, 30 days).

Next Vet ₹800 → redeem ₹200 CB → cash ₹600 → may earn new CB → Training → Ecommerce.

---

## 37. Admin Rule Builder (UX contract)

Approximate form (implement with **existing** admin Promotion Center chrome):

- Promotion name  
- WHEN: service + conditions (visits, days since, spend, …)  
- GIVE: discount %/₹ + max; cashback ₹/%  
- Cashback validity days + redeem checkboxes  
- Limits: per user, campaign budget  
- Stacking: discount / cashback  
- Save draft / Activate  

See Figma for layout; see master plan for tab seating.

---

## 38. Rule JSON / DSL

```json
{
  "promotion_id": "PROMO001",
  "eligibility": {
    "operator": "AND",
    "conditions": [
      { "field": "transaction.service_category", "operator": "=", "value": "GROOMING" },
      { "field": "user.grooming_visit_count", "operator": ">=", "value": 1 },
      { "field": "user.days_since_last_grooming", "operator": ">=", "value": 30 }
    ]
  },
  "benefits": [
    {
      "type": "DISCOUNT",
      "value_type": "PERCENTAGE",
      "value": 20,
      "max_amount": 300
    },
    {
      "type": "CASHBACK",
      "value_type": "FIXED",
      "value": 150,
      "expiry_days": 30,
      "redeem_scope": {
        "services": ["VET", "TRAINING", "BOARDING", "ECOMMERCE"]
      }
    }
  ]
}
```

---

## 39. Recommended API Set

**CRUD**

- `POST/GET /promotions`
- `GET/PUT /promotions/{id}`
- `PATCH /promotions/{id}/status`
- `DELETE /promotions/{id}` (prefer soft → ARCHIVED)

**Rules**

- `POST /promotions/{id}/rules`
- `PUT /promotions/{id}/rules/{rule_id}`
- `DELETE /promotions/{id}/rules/{rule_id}`

**Runtime**

- `POST /promotions/evaluate`
- `POST /promotions/commit`
- `POST /promotions/reverse`

**Usage**

- `GET /promotions/{id}/usage`
- `GET /promotions/{id}/budget`
- `GET /users/{id}/promotions`

Prefix in Warmpawz admin: `/admin/promo-engine/…` (master plan).

---

## 40. Engineering Components

```
promotion-service
├── promotion-crud
├── rule-manager
├── eligibility-engine
├── benefit-engine
├── stacking-engine
├── usage-limit-engine
├── budget-engine
├── evaluation-service
├── promotion-commit-service
└── promotion-audit-service
```

Separately: `wallet-service`, `behaviour-service`, `booking-service`, `order-service`, `catalog-service`.

Warmpawz: implement as modules under / extending `backend/lambda/src/discount-engine/`.

---

## 41. Non-Functional Requirements

### Idempotency

Commit twice must not double-credit. Key: `promotion_id + transaction_id + benefit_id`.

### Audit

Store: evaluated, eligible, rejected, committed, cashback credited / reversed / expired.

### Explainability

```text
eligible = false
reason: DAYS_SINCE_LAST_GROOMING < 30
actual = 18
required = 30
```

---

## 42. Caching (later)

Redis for active promotions / rules / eligibility maps. DB is source of truth. **Do not** cache user cashback balance — Wallet is SoT. Deferred until after correctness (master plan non-goal v1).

---

## 43. Event Architecture

```
Booking / Order / Payment → Event Bus
  → Behaviour Service
  → Promotion Service
  → Analytics
```

Example payload:

```json
{
  "event": "SERVICE_COMPLETED",
  "user_id": "U123",
  "service_category": "GROOMING",
  "service_id": "S123",
  "vendor_id": "V123",
  "transaction_id": "B123",
  "amount": 1200,
  "timestamp": "2026-09-16T15:00:00Z"
}
```

---

## 44. What Engineering Must NOT Do

Do **not** hard-code:

```
if grooming:
  if first_visit: cashback
  elif second_visit: discount
  elif 30_days: …
```

Instead: any transaction → Promotion Engine → generic rule evaluation. All business promotion logic belongs in the engine.

---

## 45. Final Architecture / Mental Model

**Transaction** = what the customer is buying.  
**Behaviour** = who the customer is.  
**Promotion Rules** = whether they qualify.  
**Benefit Engine** = what they get.  
**Stacking Engine** = what can coexist.  
**Wallet** = stores the cashback.

Lifecycle: Create booking/order → Evaluate → Discount + pending CB → Payment → Commit → Wallet credit → Expire or redeem → Next transaction re-evaluates.

This is generic promotion infrastructure (not a coupon-only system): state campaigns, vendor-funded, winback, cross-sell, upsell, ecommerce, etc. without changing core transaction architecture.

---

## Appendix A — Visit Sequence / Customer Journey (first-class)

Visit-sequence rules are a **first-class rule type** in the UI (not only generic conditions).

| Rule | Condition (completed counts at evaluate) | Example benefit |
|------|------------------------------------------|-----------------|
| Visit 1 | Grooming visits = 0 | ₹200 cashback |
| Visit 2 | Grooming visits = 1 | 15% discount |
| Visit 3 | Grooming visits = 2 | ₹100 cashback |
| Visit 4–5 | BETWEEN 3–4 | ₹150 cashback |
| Visit 6+ | >= 5 | ₹100 cashback |
| Every visit | >= 0 | 5% cashback |
| Every 3rd visit | visits % 3 = 0 (document convention) | ₹250 cashback |

### Rule builder: Customer Journey section

- Rule type: Customer Journey  
- Service: Grooming / Vet / …  
- Visit number: Exactly / >= / Between / Every Nth  
- Quick templates: First, Second, Third, Nth, First 3, Every, Every Nth, Visits >= N, Visits between N–M  
- May combine with other conditions (e.g. 3rd Grooming AND vet_visit_count = 0)

### Service-specific visit axes

Distinguish: overall | grooming | vet | training | boarding | walking | ecommerce orders.

### Journey Model view (admin)

```
Visit 1          Visit 2          Visit 3+
Grooming CB      Grooming 15%     Grooming CB
Cross-sell       Upsell           Loyalty
        └── 30 days inactive → WINBACK 20% + CB
```

---

## Appendix B — Document control

| Doc | Role |
|-----|------|
| This file (`PROMOTION_ENGINE_HLD.md`) | Product/engineering SoT for behaviour & contracts |
| `PROMOTION_ENGINE_MASTER_PLAN.md` | How we build it on Warmpawz (phases, migrations 1111–1114, UI seats, owners) |
| Figma | Visual flow for admin wizard / simulator |

When HLD and master plan conflict on Warmpawz-specific paths (table names, `/admin/promo-engine`, extend discount-engine), **master plan wins for repo implementation**; update this HLD appendix if product intent changes.
