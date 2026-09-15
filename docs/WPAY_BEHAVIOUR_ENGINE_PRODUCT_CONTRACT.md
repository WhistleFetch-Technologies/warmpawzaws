# Warmpawz Pay Behaviour Engine — Product Contract (Locked)

**Scope:** Pay Bill + Appointments. Not marketplace.  
**Financial authority:** existing WPay commercial path (`computeWpayCommercialQuote` + settlement).  
**Behaviour authority:** inference, rules, and Reward Budget. Never money formulas.

---

## Core principle

Customers must not repeatedly receive the same static discount.

Every successful WPay transaction updates customer behaviour, which earns a **Reward Budget** consumed on future visits.

The configured percentage is a **Maximum Benefit Ceiling**, not a guaranteed discount.

---

## Tier economics (locked)

The **tier determines vendor payable**. The customer reward stack is funded only from **commission headroom**. Behaviour can construct *how* the customer benefit is built. It cannot change the tier’s vendor economics.

```text
                    ORIGINAL BILL Q
                         │
                         ▼
                 ┌─────────────────┐
                 │  WPay Tier      │
                 │ Commission = C  │
                 └────────┬────────┘
                          │
                          ▼
                FIXED VENDOR PAYABLE
                    Q × (1 − C)
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
       CUSTOMER BENEFIT         PLATFORM ECONOMICS
       must fit inside          remain protected
       commission headroom
```

### Two ceilings

| Ceiling | What it is | Role |
|---------|------------|------|
| **Tier Commission C** | Economic ceiling | Gross commission headroom. Fixes vendor payable. |
| **Maximum Benefit Ceiling D** | Customer-benefit ceiling | How much of that headroom the customer may receive. |

```text
                 TIER COMMISSION
                       │
                       ▼
              ECONOMIC HEADROOM
                       │
                       ▼
              ┌─────────────────┐
              │ Maximum Benefit │
              │     Ceiling     │
              └────────┬────────┘
                       │
                       ▼
          Points + Promotion + Dynamic
                       │
                       ▼
             Actual Customer Benefit
```

### Guardrails

```text
Maximum Benefit Ceiling D  <  Tier Commission C     (publish + quote)
Total Customer Benefit ₹   ≤  Gross Tier Commission
Platform Revenue           =  Gross Commission − Customer-funded platform benefit
Vendor Payable             =  Q × (1 − C)            (standard tier model)
```

`D < C` is the existing `assertDiscountBelowCommission` rule. A vendor with C = 25% and D = 20% may publish. C = 25% and D = 30% must fail at publication. The 20% ceiling cannot independently override the tier.

This is the standard `tier_commission` path in `computeWpayCommercialQuote`. Burn mode (vendor paid full Q) is an existing exception and is not the default for this reward stack.

### Worked economics

Vendor on a **25%** commission tier. Bill Q = ₹10,000.

| Line | Amount |
|------|--------|
| Gross Commission | ₹2,500 |
| Vendor Payable (fixed by tier) | ₹7,500 |
| Points + Promotion + Dynamic | ₹2,000 |
| Platform Revenue | ₹500 |

Vendor ₹7,500 / Customer benefit ₹2,000 / Platform ₹500. Consistent with existing `wpayRevenueAmount = grossCommission − fundedBenefit`.

---

## Architectural split (locked)

The Behaviour Engine **never calculates money**. It produces a Reward Budget. WPay remains the financial authority.

| Layer | Owns | Must not own |
|-------|------|----------------|
| **Behaviour Engine** | Behaviour state, rule evaluation, Reward Budget, Points Award, Promotion Award | Dynamic discount ₹/%, fees, GST, vendor payable, platform revenue, settlement |
| **WPay** | Dynamic Discount (last-mile filler), commission/tier, vendor payable, platform revenue, GST, fees, final payable, settlement, benefit construction on the payment | Behaviour scoring, lifecycle rules, next-visit award decisions |

Lifecycle:

1. WPay completes payment (existing implementation).
2. Behaviour Engine updates customer state from that successful transaction.
3. Behaviour rules decide what Reward Budget the customer earns for the next visit.
4. On the next visit, Points then Promotions consume that budget first.
5. WPay fills only the remaining gap with a Dynamic Discount.
6. `computeWpayCommercialQuote` performs commission, vendor payable, GST, fees, and settlement exactly as today.

---

## Priority of benefits

```
Points
  ↓
Promotion
  ↓
Dynamic Discount
  ↓
Maximum Benefit Reached
```

Dynamic Discount is always the last-mile filler. It may be zero.

---

## Locked terminology

| Term | Meaning |
|------|---------|
| **Maximum Benefit Ceiling %** | Admin-configured cap. Never stored or applied as “the discount”. |
| **Reward Budget / Maximum Benefit Budget ₹** | Ceiling applied to the real bill Q. Computed by WPay at quote time, not by Behaviour. |
| **Points Benefit ₹** | Earned value consumed first. |
| **Promotion Benefit ₹** | Campaign value consumed second. |
| **Dynamic Discount ₹ / %** | WPay last-mile filler for remaining gap. |
| **Total Customer Benefit ₹** | Points + Promotion + Dynamic, then capped at `min(Maximum Benefit Budget, Gross Commission)`. |
| **Effective Benefit %** | Reconciled result (Total ÷ Q). Not the configured input. |
| **Gross Commission** | `Q × C`. Economic headroom. |
| **Vendor Payable** | `Q × (1 − C)`. Fixed by tier. Behaviour cannot change it. |
| **Platform Revenue** | Gross Commission − Total Customer Benefit. |

Forbidden implementation: `configured 20% = always give 20% off`.

---

## What the Behaviour Engine tracks

Business inference only. No clickstream or page-view history.

| Behaviour | Example |
|-----------|---------|
| Customer lifecycle | First-time, Returning, Regular, Dormant |
| Total WPay transactions | 6 |
| Last WPay transaction | 15 days ago |
| Vendor relationship | Regular at Vendor A |
| Vendor visit count | 4 |
| Category relationship | Grooming Regular |
| Spend tier | High Value |
| Recency | 15 days |
| Active reward state | Return Reward Ready |

---

## Admin controls everything

### Customer lifecycle

| Setting | Example |
|---------|---------|
| First Visit | 1 transaction |
| Returning | 2–4 |
| Regular | 5+ |
| Dormant | 45 days |

### Vendor behaviour

| Setting | Example |
|---------|---------|
| Repeat Vendor | 2 visits |
| Regular Vendor | 5 visits |
| Lapsed Vendor | 60 days |

### Spend behaviour

| Setting | Example |
|---------|---------|
| Medium | ₹5,000 |
| High | ₹10,000 |

### Reward configuration

| Setting | Example |
|---------|---------|
| First Visit Points | 100 |
| Second Visit Points | 150 |
| Fifth Visit Points | 500 |
| Return Window | 30 days |
| Promotion Validity | 30 days |
| Points Expiry | 60 days |

### Benefit configuration

| Setting | Example |
|---------|---------|
| Maximum Benefit Ceiling | 20% |
| Points→₹ | 1 Point = ₹1 |
| Max Redeem | 1,000 Points |
| Allow Points + Promotion | Yes |

---

## Reward Budget model

Behaviour Engine says: **customer has a 20% reward budget**.  
It does **not** say: give 20% discount.

That budget is funded in order: Points → Promotion → Dynamic Discount.

### Worked example

Bill = ₹10,000  
Maximum Benefit Ceiling = 20%  
Maximum Budget = ₹2,000

| Already owned | Value |
|---------------|-------|
| Points | ₹1,000 |
| Promotion | ₹500 |
| Existing benefit | ₹1,500 |
| Remaining gap | ₹500 |
| Dynamic Discount | ₹500 = 5% of bill |

| Final construction | Value |
|--------------------|-------|
| Points | ₹1,000 |
| Promotion | ₹500 |
| Dynamic Discount | ₹500 |
| Total Benefit | ₹2,000 (20%) |

The customer can still receive the full ceiling value, but only the gap appears as an actual WPay discount because the rest was earned.

---

## Outputs vs calculations

### Behaviour Engine outputs

- Behaviour State
- Reward Budget (ceiling entitlement for next visit — not rupee math on a live bill)
- Points Award
- Promotion Award

### WPay calculates

- Dynamic Discount
- Vendor Payable
- Platform Revenue
- Platform GST (inclusive)
- Platform Fee + GST
- Convenience Fee + GST
- Final Customer Payable
- Settlement

`computeWpayCommercialQuote` continues to own all money calculations. Behaviour never duplicates financial formulas. Vendor payable stays inside that commercial calculation.

Implementation guards:

1. Do **not** pass Maximum Benefit Ceiling % into today’s flat `discountPercent` field. That recreates “always D% off.”
2. Resolve Points + Promotion first. WPay computes Dynamic Discount for the remaining gap, then hands the **funded Total Customer Benefit ₹** into commercial as the discount-funded portion.
3. Commercial still enforces `D < C` at publish and `Total Customer Benefit ≤ Gross Commission` at quote.

---

## Reconciliation contract

Every completed payment records **how** the benefit was constructed. Never store “customer received 20% discount.”

| Field | Example |
|-------|---------|
| Original Bill | ₹10,000 |
| Tier Commission C | 25% |
| Gross Commission | ₹2,500 |
| Maximum Benefit Ceiling D | 20% |
| Maximum Benefit Budget | ₹2,000 |
| Points Used | ₹1,000 |
| Promotion Used | ₹500 |
| Dynamic Discount | ₹500 |
| Effective Benefit | 20% |
| Vendor Payable | ₹7,500 (tier-fixed) |
| Platform Revenue | ₹500 |
| Platform Fee + GST | Existing WPay |
| Convenience Fee + GST | Existing WPay |

Store: “Customer received a 20% total benefit composed of Points + Promotion + Dynamic Discount.”

That audit trail is the source of truth for finance, support, reward analytics, and the next behaviour update.
