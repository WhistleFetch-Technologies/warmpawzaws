# Payment Policies – Admin Guide

## What are Payment Policies?

Payment policies (payment rules) define **how much customers pay at booking**, **when money is held**, and **when it is released** to vendors. Each rule applies to specific **vendor types** and **service locations** (Home, Center, Tele/Video, or All).

---

## How to Create a Payment Policy

1. Go to **Finance & Logistics** → **Payment Policies**.
2. Click **Create Rule**.
3. Fill in:
   - **Rule Name** – e.g. "Standard Payment Rule", "Grooming Advance".
   - **Vendor Types** – Select one or more vendor types (e.g. Grooming, Veterinarian). The rule applies only to bookings for these vendor types.
   - **Service Location** – Home, Center, Tele/Video Consultation, or **All** (all locations).
   - **Reservation Type** – **Flat Amount**, **Percentage**, or **Full Payment** (100% at booking).
   - **Flat Amount (₹)** – Used when reservation type is Flat; this is the advance amount in INR.
   - **Reservation Percentage (%)** – Used when reservation type is Percentage; share of total booking amount taken at booking.
   - **Minimum Advance Payment (₹)** – Minimum amount the customer must pay at booking.
   - **Escrow Hold Period (hours)** – How long payment is held before release to vendor (e.g. 24h after service).
   - **Cancellation Grace Period (hours)** – Window after booking within which cancellation is free (often used with cancellation policy).
   - **Partial Payment Allowed** – If enabled, customers can pay the rest later (subject to your flows).
   - **Auto Capture Payment** – If enabled, payment is captured automatically when conditions are met; otherwise manual capture.
   - **Premium Booking Value (₹)** – Threshold above which different logic can apply (e.g. higher advance).
   - **Travel Distance Limit (km)** / **Travel Surcharge per km** – For at-home services; used to compute travel surcharges.
   - **Equipment Fee** – Optional fixed fee for equipment.
   - **Active** – Only active rules are applied.
4. Click **Save Rule**.

---

## Where Payment Policies Are Used

| Where | How |
|-------|-----|
| **Customer booking flow** | At checkout, the platform picks the payment rule that matches the **vendor type** and **service location** of the selected service. It shows the required advance (flat/percentage/full) and minimum amount. |
| **Payment capture** | After the booking, payment is held (escrow). **Escrow Hold Period** and **Auto Capture** determine when money moves to the vendor. |
| **Cancellations** | **Cancellation Grace Period** is used with your **Cancellation Policy** to decide if a cancellation is free or incurs a fee. |
| **Vendor payouts** | Settlements and payouts use the same rule (advance vs balance) so vendor earnings match what was collected. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Vendor Types** | Which service categories (e.g. Grooming, Vet) this rule applies to. |
| **Service Location** | Whether the rule applies to At Home, At Center, Tele/Video, or all. |
| **Reservation Type + Flat/Percentage** | How much the customer pays at booking (fixed ₹, % of total, or 100%). |
| **Minimum Advance Payment** | Floor on the advance amount regardless of percentage/flat. |
| **Escrow Hold Period** | When funds can be released to the vendor (e.g. after 24h post service). |
| **Cancellation Grace Period** | Used with cancellation policy to allow free cancellation within X hours. |
| **Partial Payment Allowed** | Whether the customer can pay the remainder after booking (affects checkout and payouts). |
| **Auto Capture Payment** | Whether capture happens automatically when conditions are met or manually. |
| **Travel Distance / Surcharge** | How at-home travel fees are calculated for the customer. |

---

## Tips

- Create one rule per **vendor type + location** combination if you need different advance amounts (e.g. higher advance for Tele, lower for Home).
- Use **Priority** (if exposed in future) or **order of rules** so the most specific rule (e.g. Grooming + Home) is applied before a generic "All" rule.
- Keep **Escrow Hold Period** aligned with your cancellation policy (e.g. 24–48h) so refunds can be processed before release.
