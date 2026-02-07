# Settlement Rules – Admin Guide

## What are Settlement Rules?

Settlement Rules define **conditions** (vendor tier, service category, booking amount, payment method, region, day/time) and **settlement behaviour** (period in days, commission rate, minimum payout amount, auto-process, hold period). Rules are evaluated by **priority** (lower number = higher priority); the first matching rule determines how a vendor’s settlements are calculated and when they can be paid.

---

## How to Create a Settlement Rule

1. Go to **Finance & Logistics** → **Settlement Rules**.
2. Click **Create Rule**.
3. Fill in:

   **Basic**
   - **Name** – e.g. "Weekly Standard", "Premium Tier Monthly".
   - **Priority** – Lower number = higher priority. First matching rule wins.
   - **Enabled** – Only enabled rules are considered.

   **Conditions** (optional; when this rule applies)
   - **Vendor Tier** – Which subscription tiers (e.g. Basic, Pro).
   - **Service Category** – Which service types or categories.
   - **Min / Max Booking Amount** – Booking value range (₹).
   - **Payment Method** – e.g. card, UPI, COD.
   - **Region** – Cities or regions.
   - **Day of Week** – Which days (e.g. weekday only).
   - **Time of Day** – Start and end time window.

   **Settlement**
   - **Period (days)** – Settlement cycle length (e.g. 7 = weekly).
   - **Commission Rate (%)** – Override platform commission for this rule (if supported).
   - **Min Payout Amount (₹)** – Minimum balance to include in a payout.
   - **Auto Process** – Whether to auto-advance or auto-process settlements for this rule.
   - **Hold Period (days)** – Optional delay before settlement is payable (e.g. for dispute window).

4. Click **Save**.

---

## Where Settlement Rules Are Used

| Where | How |
|-------|-----|
| **Settlement run** | When generating settlements, the system matches each vendor/booking to the first rule (by priority) whose conditions apply; that rule’s period, commission, and hold are used. |
| **Commission** | Rule’s **commission rate** (if set) overrides tier default for matching transactions. |
| **Payout period** | Rule’s **period days** can override tier payout period for matching vendors/transactions. |
| **Payout Management** | **Min payout amount** and **hold period** affect when a vendor’s balance becomes payable. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Priority** | Lower number = higher priority. First matching rule is used. |
| **Enabled** | Disabled rules are skipped. |
| **Conditions** | Restrict which vendors/transactions this rule applies to (tier, category, amount, region, time). |
| **Period (days)** | Length of settlement cycle for this rule (e.g. 7 = weekly). |
| **Commission Rate** | Platform commission override for matching transactions (if supported). |
| **Min Payout Amount** | Minimum balance to generate a payout for this rule. |
| **Auto Process** | Whether settlements matching this rule are auto-processed. |
| **Hold Period** | Days before settlement amount becomes payable (e.g. dispute window). |

---

## Tips

- Put **specific rules** (e.g. premium tier, high-value bookings) at **lower priority** and a **default rule** at higher priority.
- Use **Hold period** for categories with higher dispute risk (e.g. 3–7 days).
- Align **Period** with **Schedule Settings** (e.g. weekly schedule with 7-day period rules).
