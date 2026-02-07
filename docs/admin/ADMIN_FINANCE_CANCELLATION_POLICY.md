# Cancellation Policy – Admin Guide

## What is the Cancellation Policy?

Cancellation policies define **refund windows**, **fees**, **vendor penalties**, and **no-show handling** when a booking is cancelled. They can be **standard** (all vendors/services), **vendor-specific** (by vendor type), or **service-specific** (by service type, e.g. At Home, Video Consultation).

---

## How to Create a Cancellation Policy

1. Go to **Finance & Logistics** → **Cancellation Policy**.
2. Click **Create Policy**.
3. Fill in:

   **Basic**
   - **Name** – e.g. "Standard 24h", "Grooming Cancellation".
   - **Description** – Short note for admins.
   - **Policy Type** – **Standard** (all), **Vendor Specific** (selected vendor types), or **Service Specific** (selected service types).
   - **Vendor Types** – Required if type is Vendor Specific; optional otherwise.
   - **Service Types** – Required if type is Service Specific (e.g. At Home, At Center, Video Consultation, Delivery, Pickup).

   **Grace & Windows**
   - **Grace Period (hours)** – Time after booking during which cancellation is free (e.g. 2h).
   - **Cancellation Windows** – List of windows (hours before service, refund %, fee, penalty %). Example:
     - 48h+ → 100% refund, ₹0 fee
     - 24h+ → 75% refund, ₹0 fee
     - 12h+ → 50% refund
     - &lt;12h → 0% refund, possible fee

   **Vendor cancellation penalty**
   - **Enabled** – Whether the vendor is penalized if they cancel.
   - **Penalty %** – Percentage of booking value deducted from vendor (e.g. 10%).
   - **Compensation %** – Percentage of booking value given to the customer as compensation.

   **No-show**
   - **Enabled** – Whether no-show is handled by this policy.
   - **Refund %** – What the customer gets back if they no-show (often 0).
   - **Penalty Amount** – Optional fee charged to the customer for no-show.

   **Other**
   - **Active** – Only active policies are used.
   - **Priority** – Higher priority policies are preferred when multiple match (e.g. vendor-specific over standard).

4. Click **Save**.

---

## Where Cancellation Policies Are Used

| Where | How |
|-------|-----|
| **Customer cancellation** | When a customer cancels, the platform selects the matching policy (by type + vendor type/service type). It uses **cancellation windows** to compute refund and any fee, and **grace period** to allow free cancellation. |
| **Vendor cancellation** | If the vendor cancels, **Vendor Cancellation Penalty** is applied (penalty % from vendor, compensation % to customer). |
| **No-show** | If **No-show** is enabled, **Refund %** and **Penalty Amount** determine what the customer gets back and what they pay. |
| **Refund policies** | Refund tiers (Refund Policies) work with these windows; align "hours before service" in both for consistent behaviour. |
| **Settlements** | Amounts not refunded and vendor penalties feed into settlement and payouts. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Policy Type** | **Standard** = applies to all; **Vendor Specific** = only selected vendor types; **Service Specific** = only selected service types (e.g. At Home, Video). |
| **Vendor Types** | Which vendor categories this policy applies to (when type is Vendor Specific). |
| **Service Types** | Which delivery/service types this policy applies to (when type is Service Specific). |
| **Grace Period** | Free cancellation within X hours of booking. |
| **Cancellation Windows** | Refund %, fee, and penalty for each "hours before service" band. |
| **Vendor Cancellation Penalty** | Applied when the **vendor** cancels (penalty from vendor, compensation to customer). |
| **No-show** | Applied when the customer does not show up (refund to customer, optional penalty). |
| **Priority** | When several policies match, the one with higher priority is used. |

---

## How Policy Type Affects Matching

- **Standard** – Used as default when no vendor-specific or service-specific policy matches.
- **Vendor Specific** – Used when the booking’s vendor type is in the policy’s **Vendor Types** list. Typically higher priority than standard.
- **Service Specific** – Used when the booking’s service type (e.g. At Home, Video) is in the policy’s **Service Types** list.

The system picks the **highest-priority** policy that matches the booking’s vendor type and service type.

---

## Tips

- Set **Grace Period** (e.g. 2h) so customers can fix mistakes soon after booking without penalty.
- Keep **cancellation windows** in sync with **Refund Policies** (hours before service and percentages).
- Use **Vendor Cancellation Penalty** to discourage vendor no-shows and compensate customers.
- Use **Priority** to give vendor-specific or service-specific policies precedence over the standard policy.
