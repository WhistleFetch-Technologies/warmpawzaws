# Logistics Partners – Admin Guide

## What are Logistics Partners?

Logistics partners are **delivery providers** (e.g. Dunzo, local couriers) that the platform uses to fulfill orders. Each partner is configured with **type** (last mile, hyperlocal, intercity, pan India), **API details**, **regions**, **product categories**, and **pricing** (base fee, per km, minimum order value, surge).

---

## How to Create a Logistics Partner

1. Go to **Platform Settings** → **Integrations** → **Logistics** (or **Logistics & Shipping** → **Partners & Configuration**), or **Finance & Logistics** if logistics is under Finance.
2. Click **Add Partner** (or **New Logistics Partner**).
3. Fill in:

   **Basic**
   - **Partner Name** – e.g. "Dunzo", "Local Courier".
   - **Partner ID** – Unique identifier (e.g. `partner_dunzo`). Used in **Delivery Rules** as primary/fallback partner.

   **Type & connectivity**
   - **Type** – **Last Mile** (bike/scooter), **Hyperlocal** (within ~5 km), **Intercity** (trucking), or **Pan India** (courier).
   - **Enabled** – Only enabled partners are available for assignment.
   - **API Endpoint** – Base URL for the partner’s API (if integrated).
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
| **Order fulfillment** | When an order is created, the system applies Delivery Rules to choose a partner. The order is then sent to that partner’s API (if configured). |
| **Customer checkout** | Delivery fee and ETA can be computed using the partner’s **pricing** (base + per km) and **type** (e.g. hyperlocal vs pan India). |
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

- Use a clear **Partner ID** (e.g. `dunzo`, `delhivery`) so Delivery Rules are easy to configure.
- Set **Regions** and **Categories** to match where and what you actually use this partner for.
- **Min Cart Value** can be used to avoid using premium partners for very small orders.
- Add **Fallback Partners** in Delivery Rules so another partner is used if the primary fails or is unavailable.
