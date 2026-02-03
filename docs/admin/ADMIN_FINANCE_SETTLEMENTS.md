# Settlements – Admin Guide

## What are Settlements?

Settlements are **vendor payables** – the amount due to vendors after deducting platform commission and other charges. The Settlements dashboard shows **total revenue**, **platform commission**, **vendor payout**, **pending settlements**, and a list of settlements by status (Due, Pending, Paid).

---

## How to Use the Settlements Dashboard

1. Go to **Finance & Logistics** → **Settlements**.
2. View the **stats cards**: Total Revenue, Platform Commission, Vendor Payout, Pending Settlements.
3. Use the **settlements list** (and filters, if available) to see Due, Pending, and Paid settlements.
4. Click **Process** on a settlement to mark it as processed or trigger payout (depending on your flow).
5. Use **Settlement Schedule** (Schedule Settings) to control how often settlements are generated; use **Payout Management** to actually disburse money to vendors.

---

## Where Settlements Are Used

| Where | How |
|-------|-----|
| **Settlement run** | A scheduled job or manual run aggregates completed bookings/orders per vendor, deducts commission, and creates settlement records (Due → Pending). |
| **Payout Management** | You process payouts from the Payout Management screen; each payout typically corresponds to one or more settlements. |
| **Vendor statements** | Vendors see their settlement history and pending payouts. |
| **Reports** | Finance reports use settlement data for revenue, commission, and vendor payables. |

---

## Option Impact Summary

| Concept | Impacts |
|--------|---------|
| **Settlement status (Due / Pending / Paid)** | Due = calculated but not yet approved for payout; Pending = approved/queued; Paid = payout completed. |
| **Process action** | Moves a settlement to the next stage (e.g. Due → Pending) or triggers payout integration. |
| **Settlement Schedule** | Controls how often new settlements are generated (daily, weekly, etc.) – see Schedule Settings. |
| **Settlement Rules** | Conditions (vendor tier, category, amount) that determine period, commission rate, and auto-process – see Settlement Rules. |

---

## Tips

- Align **Settlement Schedule** (Schedule Settings) with your business cycle (e.g. weekly on Monday).
- Use **Settlement Rules** to set different commission rates or hold periods by vendor tier or category.
- Process settlements in batches from Payout Management after verifying bank details and reconciliation.
