# Refund Policies – Admin Guide

## What are Refund Policies?

Refund policies (refund tiers) define **how much money is returned to the customer** when they cancel a booking, based on **how many hours before the service** they cancel. Each tier applies to specific **vendor types** and **service locations** (Home, Center, Tele/Video, or All).

---

## How to Create a Refund Policy

1. Go to **Finance & Logistics** → **Refund Policies**.
2. Click **Create Refund Tier**.
3. Fill in:
   - **Tier Name** – e.g. "Standard Refund", "Grooming 24h".
   - **Vendor Types** – Select one or more vendor types. The tier applies only to cancellations for these vendor types.
   - **Service Location** – At Home, At Center, Tele/Video Consultation, or **All**.
   - **Hours Before Service** – Cancellations made **at least this many hours** before the service get this tier’s refund.
   - **Refund Percentage (%)** – Percentage of the paid amount refunded (0–100).
   - **Cancellation Fee (₹)** – Fixed fee deducted from the refund (optional).
   - **Active** – Only active tiers are used.
4. Click **Save Tier**.

You can create multiple tiers for the same vendor type + location with different **Hours Before Service** (e.g. 48h → 100% refund, 24h → 75%, 12h → 50%). The system uses the tier that matches the cancellation time.

---

## Where Refund Policies Are Used

| Where | How |
|-------|-----|
| **Customer cancellation** | When a customer cancels, the platform finds the matching refund tier (vendor type + service location + hours before service). It calculates refund = (refund % × paid amount) − cancellation fee. |
| **Refund processing** | Support or automated flows use the same tier to process the actual refund (e.g. to wallet or card). |
| **Vendor settlement** | The amount not refunded may be settled to the vendor (subject to your cancellation policy and settlement rules). |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Vendor Types** | Which service categories (e.g. Grooming, Vet) this tier applies to. |
| **Service Location** | Whether the tier applies to At Home, At Center, Tele/Video, or all. |
| **Hours Before Service** | Only cancellations made **≥ this many hours** before the service get this refund %. |
| **Refund Percentage** | Share of the paid amount returned to the customer (0–100). |
| **Cancellation Fee** | Fixed amount deducted from the refund (reduces what the customer gets back). |
| **Active** | Inactive tiers are ignored when computing refunds. |

---

## How Multiple Tiers Work Together

- For a given **vendor type + service location**, you can have several tiers with different **Hours Before Service** (e.g. 48, 24, 12, 0).
- When a customer cancels, the system picks the tier with the **largest** "Hours Before Service" that is **≤** the actual hours before the service (e.g. cancel 30h before → use 24h tier).
- Example: 48h → 100%, 24h → 75%, 12h → 50%, 0h → 0%. A cancellation 10h before uses the 12h tier (50% refund).

---

## Tips

- Align **Hours Before Service** with your **Cancellation Policy** windows so customers see consistent messaging (e.g. "Cancel 24h before for 75% refund").
- Use **Cancellation Fee** to cover processing or to discourage last-minute cancellations.
- Keep **Refund Percentage** and **Cancellation Fee** consistent across vendor types unless you intentionally want different rules (e.g. stricter for high-demand services).
