# Tax Configuration Guide: GST Config vs Flexible Tax System

This guide explains how to configure tax rates, how the two Finance tabs (GST Configuration and Flexible Tax System) sync, and which configuration wins at runtime.

---

## Two Tabs, One System

| Tab | Location | Purpose |
|-----|----------|---------|
| **GST Configuration** | Finance → GST Configuration | Define **Tax Categories** (groupings + default rate) and **HSN Codes** (product/service codes + rate). |
| **Flexible Tax System** | Finance → Flexible Tax System | Define **Tax Rules** with conditions (category, service style, vendor role). Fallback when item has no HSN or Tax Category link. |

---

## Resolution Order: Which Rate Wins?

The backend (`TaxCalculationService`) resolves the GST rate in this order:

```
1. HSN Code (GST Configuration)
   └─ If the item has hsn_code_id or hsn_code → use hsn_codes.gst_rate

2. Tax Category (GST Configuration)
   └─ If the item has tax_category_id → use tax_categories.tax_rate

3. Flexible Tax Rule
   └─ If a rule matches (category, service_style, vendor_role) → use gst_rules.gst_rate

4. Default
   └─ 18% hardcoded fallback
```

**Final rule:** HSN Code from GST Configuration is the **highest priority**. Tax Rules are used only when the item is **not** linked to an HSN code or Tax Category.

---

## Why Tax % in Multiple Places?

| Place | Purpose |
|-------|---------|
| **Tax Categories (GST Config)** | Default rate for a *group* (e.g. "Veterinary Services" = 18%). Used when a service/product is linked to that category but has no HSN. |
| **HSN Codes (GST Config)** | Specific rate for a *product/service type* (e.g. HSN 9996 = 18%). Overrides the Tax Category rate when present. |
| **Flexible Tax Rules** | Conditional rules (e.g. "At Home services = 18%", "Tele role = 18%"). Used when the item has **no** HSN or Tax Category link. |

You don’t need to set the same % in all three. Configure based on how specific you want matching to be:

1. **Most specific:** HSN Code (per product/service type)
2. **Group level:** Tax Category (per category)
3. **Fallback:** Flexible Tax Rule (by conditions like service style, vendor role)

---

## How the Two Tabs Sync

- **Tax Categories** are created in **GST Configuration**.
- The **Flexible Tax System** Edit Tax Rule modal uses the same Tax Categories (via `/admin/finance/gst/tax-categories`).
- **Vendor Roles** used in Flexible Tax Rules come from `/config/roles` (platform roles).

So:

- Create Tax Categories in **GST Configuration** first.
- Create HSN Codes and link them to Tax Categories.
- In **Flexible Tax System**, select Tax Category and Vendor Role from the dropdowns for rule conditions.
- Link services/products to Tax Category or HSN Code (via service catalog) so the right rate is applied.

---

## Configuration Checklist

1. **GST Configuration → Tax Categories**  
   Create categories (e.g. "Veterinary Services", "Pet Products") and set default rates.

2. **GST Configuration → HSN Codes**  
   Add HSN codes with rates and optionally link to Tax Categories.

3. **Flexible Tax System**  
   Add rules for cases where items are not linked to HSN or Tax Category (e.g. "At Home 18%", "Tele 18%").

4. **Service Catalog / Products**  
   Ensure services/products have `tax_category_id` or `hsn_code_id` set when possible.

---

## Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ GST Configuration Tab                                                   │
│                                                                         │
│  Tax Categories (group + default rate)                                  │
│       ↑                                                                 │
│       │ category_id                                                     │
│       │                                                                 │
│  HSN Codes (code + rate, optional category link)                        │
└─────────────────────────────────────────────────────────────────────────┘
        │
        │ Same tax_categories table
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Flexible Tax System Tab                                                 │
│                                                                         │
│  Tax Rules (conditions: Tax Category, Service Style, Vendor Role)       │
│  Uses Tax Categories dropdown from GST Config                           │
│  Uses Vendor Roles from /config/roles                                   │
└─────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Payment / Checkout                                                      │
│                                                                         │
│  TaxCalculationService: HSN → Tax Category → Tax Rule → 18% default     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

| Issue | Likely Cause | Fix |
|-------|--------------|-----|
| Tax Category dropdown empty | No categories created in GST Config | Create Tax Categories in GST Configuration first. |
| Vendor Role dropdown empty | Roles API failing or no roles | Check `/config/roles` and `/admin/vendor-roles`; ensure roles exist and are active. |
| Always 18% at checkout | Item not linked to HSN/Tax Category | Set `tax_category_id` or `hsn_code_id` on service/product, or add matching Flexible Tax Rule. |
