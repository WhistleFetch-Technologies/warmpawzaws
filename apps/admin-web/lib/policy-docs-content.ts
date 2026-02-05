/**
 * Policy documentation content for Finance and Logistics help.
 * Full markdown docs live in docs/admin/ADMIN_*.md; this module provides
 * the same content for in-app Help dialogs.
 */

export type PolicyDocKey =
  | 'finance-payment-policies'
  | 'finance-refund-policies'
  | 'finance-cancellation-policy'
  | 'finance-ecommerce-policies'
  | 'logistics-partners'
  | 'logistics-delivery-rules'
  | 'finance-gst-configuration'
  | 'finance-flexible-tax-system'
  | 'finance-settlements'
  | 'finance-payout-management'
  | 'finance-tier-system'
  | 'finance-schedule-settings'
  | 'finance-settlement-rules'
  | 'finance-payment-gateway';

export interface PolicyDocEntry {
  title: string;
  markdown: string;
}

const DOCS: Record<PolicyDocKey, PolicyDocEntry> = {
  'finance-payment-policies': {
    title: 'Payment Policies – Admin Guide',
    markdown: `# Payment Policies – Admin Guide

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
- Keep **Escrow Hold Period** aligned with your cancellation policy (e.g. 24–48h) so refunds can be processed before release.`,
  },
  'finance-refund-policies': {
    title: 'Refund Policies – Admin Guide',
    markdown: `# Refund Policies – Admin Guide

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
   - **Hours Before Service** – Cancellations made **at least this many hours** before the service get this tier's refund.
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
- Keep **Refund Percentage** and **Cancellation Fee** consistent across vendor types unless you intentionally want different rules (e.g. stricter for high-demand services).`,
  },
  'finance-cancellation-policy': {
    title: 'Cancellation Policy – Admin Guide',
    markdown: `# Cancellation Policy – Admin Guide

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
     - <12h → 0% refund, possible fee

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
- **Vendor Specific** – Used when the booking's vendor type is in the policy's **Vendor Types** list. Typically higher priority than standard.
- **Service Specific** – Used when the booking's service type (e.g. At Home, Video) is in the policy's **Service Types** list.

The system picks the **highest-priority** policy that matches the booking's vendor type and service type.

---

## Tips

- Set **Grace Period** (e.g. 2h) so customers can fix mistakes soon after booking without penalty.
- Keep **cancellation windows** in sync with **Refund Policies** (hours before service and percentages).
- Use **Vendor Cancellation Penalty** to discourage vendor no-shows and compensate customers.
- Use **Priority** to give vendor-specific or service-specific policies precedence over the standard policy.`,
  },
  'logistics-partners': {
    title: 'Logistics Partners – Admin Guide',
    markdown: `# Logistics Partners – Admin Guide

## What are Logistics Partners?

Logistics partners are **delivery providers** (e.g. Dunzo, local couriers) that the platform uses to fulfill orders. Each partner is configured with **type** (last mile, hyperlocal, intercity, pan India), **API details**, **regions**, **product categories**, and **pricing** (base fee, per km, minimum order value, surge).

---

## How to Create a Logistics Partner

1. Go to **Platform Settings** → **Integrations** → **Logistics** (or **Logistics & Shipping** → **Partners & Configuration**), or **Finance & Logistics** if logistics is under Finance.
2. Click **Add Partner** (or **New Logistics Partner**).
3. Fill in:

   **Basic**
   - **Partner Name** – e.g. "Dunzo", "Local Courier".
   - **Partner ID** – Unique identifier (e.g. partner_dunzo). Used in **Delivery Rules** as primary/fallback partner.

   **Type & connectivity**
   - **Type** – **Last Mile** (bike/scooter), **Hyperlocal** (within ~5 km), **Intercity** (trucking), or **Pan India** (courier).
   - **Enabled** – Only enabled partners are available for assignment.
   - **API Endpoint** – Base URL for the partner's API (if integrated).
   - **API Key** – Credential for the API (stored securely; not shown in UI after save).

   **Coverage**
   - **Regions** – Cities/regions where this partner operates (used by Delivery Rules to match orders).
   - **Categories** – Product categories this partner can deliver (e.g. Pet Food, Medicines, Grooming Supplies).

   **Pricing**
   - **Base Fee (₹)** – Fixed delivery fee per order.
   - **Per Km (₹)** – Additional amount per kilometre.
   - **Min Cart Value (₹)** – Minimum order value for this partner (e.g. 500).
   - **Surge Multiplier** – Multiplier in peak demand (e.g. 1.2 = 20% extra).

4. Click **Save**.

---

## Where Logistics Partners Are Used

| Where | How |
|-------|-----|
| **Delivery Rules** | In **Delivery Rules**, you select a **Primary Partner** (and optional **Fallback Partners**) by partner ID. Rules match orders by order type, category, region, weight, value, etc., and assign the primary partner. |
| **Order fulfillment** | When an order is created, the system applies Delivery Rules to choose a partner. The order is then sent to that partner's API (if configured). |
| **Customer checkout** | Delivery fee and ETA can be computed using the partner's **pricing** (base + per km) and **type** (e.g. hyperlocal vs pan India). |
| **Settlements** | Delivery fees may be reconciled with partners using the same pricing and order data. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Partner ID** | Used in **Delivery Rules** as primary/fallback partner. Must be unique. |
| **Type** | **Last Mile** / **Hyperlocal** – short distance; **Intercity** / **Pan India** – longer. Affects which rules and orders the partner is suitable for. |
| **Enabled** | Disabled partners are excluded from rule assignment and checkout. |
| **API Endpoint / API Key** | Used to call the partner for create shipment, track, cancel. If blank, only manual or other integrations can be used. |
| **Regions** | Limits where this partner can be assigned; Delivery Rules often filter by region. |
| **Categories** | Limits which product types this partner delivers; rules match by category. |
| **Base Fee / Per Km / Min Cart / Surge** | Used to calculate delivery fee shown at checkout and for settlement. |

---

## Tips

- Use a clear **Partner ID** (e.g. dunzo, delhivery) so Delivery Rules are easy to configure.
- Set **Regions** and **Categories** to match where and what you actually use this partner for.
- **Min Cart Value** can be used to avoid using premium partners for very small orders.
- Add **Fallback Partners** in Delivery Rules so another partner is used if the primary fails or is unavailable.`,
  },
  'logistics-delivery-rules': {
    title: 'Delivery Rules – Admin Guide',
    markdown: `# Delivery Rules – Admin Guide

## What are Delivery Rules?

Delivery rules define **which logistics partner** is used for an order based on **conditions** such as order type, product category, region, weight, value, payment method, urgency, and distance. Each rule has a **priority**; the first matching rule's **primary partner** (and optional **fallback partners**) is assigned to the order.

---

## How to Create a Delivery Rule

1. Go to **Platform Settings** → **Integrations** → **Logistics** → **Delivery Rules** (or **Logistics & Shipping** → **Delivery Rules**).
2. Click **Create Rule**.
3. Fill in:

   **Basic**
   - **Rule Name** – e.g. "Hyperlocal Pet Food", "Pan India Pharmacy".
   - **Priority** – Numeric priority (e.g. 100). **Lower number = higher priority.** The system evaluates rules in priority order and uses the first matching rule.
   - **Enabled** – Only enabled rules are considered.

   **Conditions** (optional; narrow when this rule applies)
   - **Order Type** – e.g. food, subscription, ecommerce, pharmacy, fresh.
   - **Product Categories** – e.g. Pet Food, Medicines, Grooming Supplies.
   - **Delivery Type** – hyperlocal, intracity, intercity, pan_india.
   - **Regions** – Cities/regions where this rule applies.
   - **Weight Range** – Min/max weight (kg).
   - **Value Range** – Min/max order value (₹).
   - **Payment Method** – e.g. cod, prepaid.
   - **Urgency** – instant, same_day, standard, economy.
   - **Distance Range** – Min/max distance (km).

   **Logistics**
   - **Primary Partner** – Partner ID of the logistics partner to assign (must match a **Logistics Partner** ID).
   - **Fallback Partners** – Optional list of partner IDs if primary fails or is unavailable.

4. Click **Save Rule**.

---

## Where Delivery Rules Are Used

| Where | How |
|-------|-----|
| **Order placement** | When an order is created (or at checkout), the system evaluates **Delivery Rules** in **priority order**. The first rule whose **conditions** match the order (type, category, region, weight, value, etc.) is selected. |
| **Partner assignment** | The selected rule's **Primary Partner** is assigned to the order. If that partner is unavailable or fails, **Fallback Partners** can be tried. |
| **Customer experience** | Delivery fee and ETA may be derived from the assigned partner's pricing and type (configured in **Logistics Partners**). |
| **Fulfillment** | The assigned partner's API (if configured) is used to create the shipment and track it. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Priority** | **Lower value = higher priority.** Rules are evaluated in ascending priority; the first match wins. Put specific rules (e.g. "Pharmacy Pan India") before generic ones (e.g. "Default Hyperlocal"). |
| **Enabled** | Disabled rules are skipped during evaluation. |
| **Order Type** | Restricts the rule to certain order flows (food, ecommerce, pharmacy, etc.). |
| **Product Categories** | Restricts to orders containing these categories (from **Logistics Partners** categories). |
| **Delivery Type** | Matches intended delivery scope (hyperlocal vs intercity vs pan India). |
| **Regions** | Restricts the rule to orders in these regions (align with partner **Regions**). |
| **Weight / Value / Distance** | Fine-tune which orders use this rule (e.g. heavy orders → trucking partner). |
| **Payment Method / Urgency** | Can route COD vs prepaid or express vs economy to different partners. |
| **Primary Partner** | **Partner ID** from **Logistics Partners**; must exist and be enabled. |
| **Fallback Partners** | Used if primary is unavailable or fails; order is tried with next partner in list. |

---

## How Matching Works

1. Rules are sorted by **priority** (ascending).
2. For each order, conditions (order type, categories, regions, weight, value, etc.) are evaluated.
3. The **first rule** that is **enabled** and whose **conditions** all match the order is selected.
4. That rule's **Primary Partner** is assigned. If you have fallbacks, they are used on failure/unavailability.

---

## Tips

- Give **specific rules** (e.g. pharmacy, heavy items) a **lower priority number** (e.g. 10, 20) and a **default rule** a higher number (e.g. 100) so the default is used only when nothing else matches.
- Ensure **Primary Partner** IDs match exactly the IDs configured in **Logistics Partners**.
- Use **Fallback Partners** for resilience (e.g. secondary courier when primary is overloaded).
- Use **Regions** and **Categories** so each rule only applies where the selected partner actually operates.`,
  },
  'finance-ecommerce-policies': {
    title: 'Ecommerce Cancellation & Returns – Admin Guide',
    markdown: `# Ecommerce Cancellation & Returns – Admin Guide

## What is Ecommerce Policy?

Ecommerce policies define **order cancellation** (before/after dispatch), **return window**, **refund processing**, and **non-returnable categories** for products sold on the Warmpawz platform.

---

## Key Options

| Option | Description |
|--------|-------------|
| **Return window (hours)** | Return or replacement requests must be raised within this many hours of delivery (e.g. 48). |
| **Cancel before dispatch** | If enabled, orders cancelled before they are shipped receive a full refund. |
| **Refund processing (days)** | Refunds are processed to the original payment method within this many business days (e.g. 5–7). |
| **Non-returnable categories** | Categories that are generally non-returnable unless the product is damaged, defective, or wrong item (e.g. opened pet food, hygiene once opened, customized). |

---

## Where Ecommerce Policy Is Used

- **Order cancellation** – Before dispatch: full refund. After dispatch: no cancel; customer may request return/replacement per eligibility.
- **Returns & replacements** – Eligibility: damaged, defective, wrong item, expired. Return window applies.
- **Refunds** – Processed within configured business days to original payment method.`,
  },
  'finance-gst-configuration': {
    title: 'GST Configuration – Admin Guide',
    markdown: `# GST Configuration – Admin Guide

## What is GST Configuration?

GST Configuration lets you manage **GST rates** and **HSN codes** used for invoicing and tax calculation. You can define **HSN codes** (with CGST, SGST, IGST rates) and **tax categories** that map services or products to default GST rates.

---

## How to Use GST Configuration

1. Go to **Finance & Logistics** → **GST Configuration**.
2. Use the tabs: **Overview**, **HSN Codes**, **Tax Categories**, **Settings**.
3. Click **Refresh** to reload data from the server.

---

## Where GST Configuration Is Used

| Where | How |
|-------|-----|
| **Invoicing** | Invoices use the HSN code and GST rate from the matching tax category or HSN code. |
| **Tax calculation** | At checkout or booking, tax is computed using the applicable GST rate (CGST+SGST same-state, IGST inter-state). |
| **Reports** | GST reports and filings use the same HSN codes and rates configured here. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **HSN Code** | Code (e.g. 9983) used on invoices and for tax classification. |
| **GST Rate / CGST / SGST / IGST** | Rates for same-state (CGST+SGST) or inter-state (IGST). |
| **Tax Category – Default GST Rate** | Default rate when a service/product is in this category. |
| **Applicable Services** | Which services or products use this tax category. |
| **Active** | Only active HSN codes and categories are used. |

---

## Tips

- Keep HSN codes aligned with your GST registration (e.g. 9983 for services).
- Ensure CGST+SGST equals total GST for same-state; use IGST for inter-state.`,
  },
  'finance-flexible-tax-system': {
    title: 'Flexible Tax System – Admin Guide',
    markdown: `# Flexible Tax System – Admin Guide

## What is the Flexible Tax System?

The Flexible Tax System lets you define **tax rules** with conditions, exemptions, and multiple tax types (GST, CGST, SGST, IGST, cesses, custom). Rules are matched by **priority** (lower number = higher priority); the first matching rule is applied.

---

## How to Create a Tax Rule

1. Go to **Finance & Logistics** → **Flexible Tax System**.
2. Click **Create Tax Rule**.
3. Fill in: **Name**, **Tax Type**, **Rate**, **Calculation Method**, **Priority**, **Conditions**, **Exemptions**, **Active**.
4. Click **Save**.

---

## Where the Flexible Tax System Is Used

| Where | How |
|-------|-----|
| **Checkout / booking** | System evaluates tax rules by priority and applies the first matching rule. |
| **Invoicing** | Invoices show tax breakdown (CGST, SGST, IGST) from the applied rule. |
| **Refunds** | Tax component of refunds uses the same rules. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Tax Type** | Which tax is applied (GST, CGST, SGST, IGST, cess, custom). |
| **Rate / Calculation Method** | Percentage or fixed amount. |
| **Priority** | Lower number = higher priority; first match wins. |
| **Conditions / Exemptions** | When this rule applies or is excluded. |
| **Active** | Inactive rules are skipped. |

---

## Tips

- Put specific rules (e.g. export 0%) at lower priority; default GST at higher priority.
- Use conditions to apply different rates by transaction type, category, or amount.`,
  },
  'finance-settlements': {
    title: 'Settlements – Admin Guide',
    markdown: `# Settlements – Admin Guide

## What are Settlements?

Settlements are **vendor payables** – the amount due to vendors after deducting platform commission. The dashboard shows total revenue, platform commission, vendor payout, pending settlements, and a list by status (Due, Pending, Paid).

---

## How to Use the Settlements Dashboard

1. Go to **Finance & Logistics** → **Settlements**.
2. View stats cards and settlements list.
3. Click **Process** on a settlement to mark it processed or trigger payout.
4. Use **Schedule Settings** to control how often settlements are generated; use **Payout Management** to disburse.

---

## Where Settlements Are Used

| Where | How |
|-------|-----|
| **Settlement run** | Scheduled or manual run aggregates bookings/orders per vendor, deducts commission, creates records (Due → Pending). |
| **Payout Management** | You process payouts; each payout typically corresponds to one or more settlements. |
| **Vendor statements / Reports** | Vendors see history; finance reports use settlement data. |

---

## Option Impact Summary

| Concept | Impacts |
|--------|---------|
| **Status (Due / Pending / Paid)** | Due = calculated; Pending = approved/queued; Paid = payout completed. |
| **Process** | Moves settlement to next stage or triggers payout. |
| **Schedule Settings / Settlement Rules** | When runs happen; commission and period by conditions. |

---

## Tips

- Align Schedule Settings with your business cycle (e.g. weekly Monday).
- Use Settlement Rules for different commission or hold by tier/category.
- Process in batches from Payout Management after verifying bank details.`,
  },
  'finance-payout-management': {
    title: 'Payout Management – Admin Guide',
    markdown: `# Payout Management – Admin Guide

## What is Payout Management?

Payout Management is where you **review and process vendor payouts**. **Scheduled** payouts run automatically as per each vendor's **tier** (settlement period and frequency are defined in Finance → Tier Management). **Manual** processing here is for: (1) **Retry** after a payout failed (e.g. bank not verified or wrong details — fix the bank info, then Process again), and (2) **Adhoc/urgent** payouts on request. It shows pending, processing, completed, and failed payouts; lets you **Process** or **Reject**; Export to CSV.

---

## How to Use Payout Management

1. Go to **Finance & Logistics** → **Payout Management**.
2. View stats; use search and status filter (e.g. **Failed** to find payouts to retry after fixing bank).
3. Click a payout for details (amount, commission, TDS, net, bank, period).
4. Click **Process** to send to vendor bank (use for pending, scheduled, or **failed** retry); **Reject** with reason if needed.
5. Use **Export** for CSV reconciliation.

---

## Scheduled vs manual

| Mode | How |
|------|-----|
| **Scheduled** | Settlements are created and paid as per tier (Tier Management: payout period and frequency). Run "Process Now" in Schedule Settings to create new settlements; scheduled job can send to bank per config. |
| **Manual** | Use **Process** here to send a payout to bank (e.g. retry after fixing bank verification or wrong account, or adhoc/urgent on request). |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Process** | Triggers transfer to vendor bank (pending, scheduled, or **failed** retry). |
| **Reject** | Cancels payout; use for wrong details or disputes. |
| **Status** | pending / processing / completed / failed / rejected. |
| **Export** | CSV for reconciliation or accounting. |

---

## Tips

- Verify vendor bank (account, IFSC, holder) before processing; after a **failed** payout, fix details then use **Process** again.
- Use Reject with clear reason so support can fix details.
- Run Export regularly for audit and bank reconciliation.`,
  },
  'finance-tier-system': {
    title: 'Tier System – Admin Guide',
    markdown: `# Tier System – Admin Guide

## What is the Tier System?

The Tier System defines **vendor subscription tiers** (e.g. Basic, Pro). Each tier has **commission rate**, **payout period**, **subscription cost** (monthly/yearly), **features**, and **roles**. Tiers drive platform commission and how often vendors get paid.

---

## How to Create or Edit a Tier

1. Go to **Finance & Logistics** → **Tier System**.
2. Click **Create Tier** or **Edit**.
3. Fill in: **Name**, **Display Name**, **Commission Rate**, **Payout Period (days)**, **Monthly/Yearly Cost**, **Features**, **Roles**, **Default**, **Active**.
4. Click **Save**.

---

## Where the Tier System Is Used

| Where | How |
|-------|-----|
| **Vendor onboarding** | New vendors get default tier (or choose). |
| **Commission** | Booking/order uses vendor tier commission rate. |
| **Settlement / Payout** | Payout period and Settlement Rules (if tier-based) use tier. |
| **Subscription** | Monthly/yearly cost and split payment drive billing if tiers are paid. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Commission Rate** | % of booking/order taken as platform commission. |
| **Payout Period (days)** | How often payouts run (e.g. 7 = weekly). |
| **Roles** | Which vendor types can be on this tier. |
| **Default** | New vendors get this tier if no other selection. |
| **Active** | Inactive tiers not assignable. |

---

## Tips

- Use Default tier for most; create higher tiers with lower commission or more features.
- Align Payout period with Schedule Settings (e.g. weekly).
- Settlement Rules can override commission or period by conditions.`,
  },
  'finance-schedule-settings': {
    title: 'Schedule Settings – Admin Guide',
    markdown: `# Schedule Settings – Admin Guide

## What are Schedule Settings?

Schedule Settings control **when and how often settlements run** and **when payouts can be processed**. You set **schedule type** (daily, weekly, biweekly, monthly), **day and time**, **timezone**, **minimum payout amount**, and **auto-process**. **Process Now** runs a cycle manually.

---

## How to Configure

1. Go to **Finance & Logistics** → **Schedule Settings** (or Payment Gateway → Schedule tab).
2. Set **Enable**, **Schedule Type**, **Schedule Day**, **Schedule Time**, **Settlement Period (days)**, **Auto Process**, **Min Payout Amount**, **Timezone**.
3. Click **Save**. Use **Process Now** to run immediately.

---

## Where Schedule Settings Are Used

| Where | How |
|-------|-----|
| **Settlement run** | Cron/scheduler uses these settings to trigger the settlement job at configured day/time. |
| **Settlements dashboard** | Shows last processed and next run (if displayed). |
| **Payout Management** | After settlements are generated, payouts are processed from Payout Management. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Enabled** | When off, no automatic runs; Process Now still available. |
| **Schedule Type / Day / Time** | How often and when the job runs. |
| **Settlement Period (days)** | Days of transactions per run (e.g. 7 = last week). |
| **Auto Process** | Auto-advance or auto-process settlements after run. |
| **Process Now** | Runs one cycle immediately. |

---

## Tips

- Set Schedule Time outside peak hours.
- Use Settlement Period to match business (e.g. 7 weekly, 30 monthly).
- Process Now useful for ad-hoc runs or testing.`,
  },
  'finance-settlement-rules': {
    title: 'Settlement Rules – Admin Guide',
    markdown: `# Settlement Rules – Admin Guide

## What are Settlement Rules?

Settlement Rules define **conditions** (vendor tier, service category, booking amount, payment method, region, day/time) and **settlement behaviour** (period days, commission rate, min payout, auto-process, hold period). First matching rule (by **priority**) determines how settlements are calculated and when payable.

---

## How to Create a Rule

1. Go to **Finance & Logistics** → **Settlement Rules**.
2. Click **Create Rule**.
3. Fill in **Name**, **Priority**, **Enabled**; **Conditions** (tier, category, amount, region, time); **Settlement** (period, commission rate, min payout, auto process, hold period).
4. Click **Save**.

---

## Where Settlement Rules Are Used

| Where | How |
|-------|-----|
| **Settlement run** | When generating settlements, first matching rule (by priority) applies; its period, commission, hold are used. |
| **Commission** | Rule commission rate (if set) overrides tier default. |
| **Payout period** | Rule period days can override tier for matching vendors/transactions. |
| **Payout Management** | Min payout and hold period affect when balance becomes payable. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Priority** | Lower number = higher priority; first match wins. |
| **Conditions** | Restrict which vendors/transactions this rule applies to. |
| **Period (days)** | Settlement cycle length (e.g. 7 = weekly). |
| **Commission Rate** | Override for matching transactions (if supported). |
| **Min Payout / Hold Period** | Minimum to payout; days before payable. |

---

## Tips

- Put specific rules at lower priority; default at higher.
- Use Hold period for higher-dispute categories (e.g. 3–7 days).
- Align Period with Schedule Settings.`,
  },
  'finance-payment-gateway': {
    title: 'Payment Gateway & Payment Rules – Admin Guide',
    markdown: `# Payment Gateway & Payment Rules – Admin Guide

## What is the Payment Gateway Screen?

The Payment Gateway screen (Finance → Payment Gateway) configures **payment gateways** (e.g. Razorpay), **general refund settings**, **payment rules** (advance, escrow, vendor-type rules), **refund policies** (tiers by hours before service), and **settlement schedule**. Central place for how customers pay and how refunds and settlements are configured.

---

## Tabs Overview

| Tab | Purpose |
|-----|---------|
| **General** | Enable refunds, auto-reconcile, reconcile period. |
| **Gateway** | Add/edit gateways (name, type, Key ID, Key Secret, Webhook Secret, enabled). |
| **Payment Rules** | Same as Payment Policies: advance, escrow, grace period, vendor types, service location. |
| **Refund Policies** | Same as Refund Policies: refund tiers by hours, vendor types, service location. |
| **Schedule** | Same as Schedule Settings: when settlements run, period, Process Now. |

---

## Where Payment Gateway Settings Are Used

| Where | How |
|-------|-----|
| **Customer checkout** | Gateway keys and Payment Rules determine advance and gateway used. |
| **Refunds** | Refund Policies and General control eligibility and reconciliation. |
| **Settlement run** | Schedule tab controls when settlement jobs run. |
| **Payouts** | Gateway used to send payouts to vendors (e.g. Razorpay). |

---

## Option Impact Summary

| Area | Key options | Impacts |
|------|-------------|---------|
| **General** | Enable Refunds, Auto Reconcile, Reconcile Period | Whether refunds allowed; how reconciliation is done. |
| **Gateway** | Key ID, Key Secret, Webhook Secret, Enabled | Which gateway for payments/payouts; webhook for async events. |
| **Payment Rules / Refund Policies / Schedule** | See respective help docs | Same as Finance → Payment Policies, Refund Policies, Schedule Settings. |

---

## Tips

- Keep Key Secret and Webhook Secret secure.
- Payment Rules and Refund Policies here = Finance tabs; changing in one updates the other.
- Use Schedule to align settlement runs with your finance calendar.`,
  },
};

export function getPolicyDoc(key: PolicyDocKey): PolicyDocEntry | null {
  return DOCS[key] ?? null;
}

export function getAllPolicyDocKeys(): PolicyDocKey[] {
  return Object.keys(DOCS) as PolicyDocKey[];
}
