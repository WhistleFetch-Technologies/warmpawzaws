# Delivery Rules – Admin Guide

## What are Delivery Rules?

Delivery rules define **which logistics partner** is used for an order based on **conditions** such as order type, product category, region, weight, value, payment method, urgency, and distance. Each rule has a **priority**; the first matching rule’s **primary partner** (and optional **fallback partners**) is assigned to the order.

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
| **Partner assignment** | The selected rule’s **Primary Partner** is assigned to the order. If that partner is unavailable or fails, **Fallback Partners** can be tried. |
| **Customer experience** | Delivery fee and ETA may be derived from the assigned partner’s pricing and type (configured in **Logistics Partners**). |
| **Fulfillment** | The assigned partner’s API (if configured) is used to create the shipment and track it. |

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
4. That rule’s **Primary Partner** is assigned. If you have fallbacks, they are used on failure/unavailability.

---

## Tips

- Give **specific rules** (e.g. pharmacy, heavy items) a **lower priority number** (e.g. 10, 20) and a **default rule** a higher number (e.g. 100) so the default is used only when nothing else matches.
- Ensure **Primary Partner** IDs match exactly the IDs configured in **Logistics Partners**.
- Use **Fallback Partners** for resilience (e.g. secondary courier when primary is overloaded).
- Use **Regions** and **Categories** so each rule only applies where the selected partner actually operates.
