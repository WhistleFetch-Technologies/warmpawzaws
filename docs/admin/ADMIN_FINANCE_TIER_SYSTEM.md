# Tier System – Admin Guide

## What is the Tier System?

The Tier System defines **vendor subscription tiers** (e.g. Basic, Pro, Enterprise). Each tier has a **commission rate**, **payout period**, **subscription cost** (monthly/yearly, optional 6/12 month discounts), **features**, and **roles** (which vendor types can use this tier). Tiers drive how much commission the platform takes and how often vendors get paid.

---

## How to Create or Edit a Tier

1. Go to **Finance & Logistics** → **Tier System** (or Tier Configuration).
2. Click **Create Tier** or **Edit** on an existing tier.
3. Fill in:
   - **Name** – Internal ID (e.g. `basic`, `pro`).
   - **Display Name** – Label shown to vendors (e.g. "Basic", "Pro").
   - **Description** – Short explanation of the tier.
   - **Commission Rate (%)** – Platform commission on each booking/order (e.g. 15).
   - **Payout Period (days)** – How often payouts run for this tier (e.g. 7 = weekly).
   - **Monthly / Yearly Cost** – Subscription fee in ₹ (if tiers are paid).
   - **6 Month / 12 Month Cost & Discount %** – Optional longer-term pricing.
   - **Allow Split Payment** – Whether vendors can pay subscription in installments (if applicable).
   - **Features** – List of features included (e.g. "Analytics", "Priority support").
   - **Roles** – Which vendor types (roles) can subscribe to this tier.
   - **Default** – Whether this is the default tier for new vendors.
   - **Active** – Only active tiers are available for assignment.
4. Click **Save**.

---

## Where the Tier System Is Used

| Where | How |
|-------|-----|
| **Vendor onboarding** | New vendors are assigned a default tier (or choose one if you offer choice). |
| **Commission calculation** | Each booking/order uses the vendor’s tier **commission rate** to compute platform commission. |
| **Settlement / Payout** | **Payout period** and **Settlement Rules** (if tier-based) use the tier to decide how often to settle and pay. |
| **Vendor subscription** | If tiers are paid, **monthly/yearly cost** and **split payment** drive subscription billing. |
| **Feature gating** | **Features** and **roles** can control which capabilities a vendor gets (e.g. in catalog or reports). |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Commission Rate** | Percentage of booking/order value taken as platform commission. |
| **Payout Period (days)** | How often payouts are generated for vendors in this tier (e.g. 7 = weekly). |
| **Roles** | Which vendor types (e.g. Groomer, Vet) can be on this tier. |
| **Default** | New vendors get this tier if no other selection is made. |
| **Active** | Inactive tiers are not shown or assignable. |
| **Monthly/Yearly Cost** | Subscription price for the tier (if you charge for tiers). |
| **Features** | Used for display or feature gating (e.g. premium analytics). |

---

## Tips

- Use **Default** tier for most vendors; create higher tiers with lower commission or more features for premium partners.
- Align **Payout period** with **Schedule Settings** (e.g. weekly schedule for 7-day payout period).
- Use **Settlement Rules** to override or refine commission or period by conditions (tier is one of the conditions).
