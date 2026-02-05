# Tax, HSN & Service Catalog: 360-Degree Mapping Analysis

## Executive Summary

The Finance & Logistics module has **two disconnected subsystems**:
1. **GST Configuration** (HSN Codes + Tax Categories) – defines tax rates
2. **Flexible Tax System** (Tax Rules) – defines when/how rules apply

**Neither is linked to the single source of truth for services**: `service_catalog`, `service_categories`, `vendor_services`, and `products`. The payment flow often falls back to defaults (e.g. 18% GST) because the correct mapping cannot be resolved.

---

## Enforcement Order: Which Configuration Wins?

The **TaxCalculationService** applies this precedence when determining the GST rate for an item:

```
gstRate = hsnDetails?.gst_rate || taxRule.gst_rate || 18
```

| Priority | Source | Condition | Enforced From |
|----------|--------|-----------|---------------|
| **1st** | HSN Code rate | Item has `hsnCode` and it exists in `hsn_codes` | **GST Configuration (HSN Codes)** |
| **2nd** | Tax Rule rate | `gst_rules` match by category, service_style, role, etc. | **Flexible Tax System (Tax Rules)** |
| **3rd** | Default | No match above | 18% hardcoded fallback |

**Answer:** **GST Configuration (HSN Codes) is the final enforced configuration** when the transaction item is linked to an HSN code. Tax Rules apply only when there is no HSN linkage. Tax Categories are used for grouping HSN codes and (when wired) as a fallback rate when a service has a tax category but no HSN code.

---

## How GST Configuration Links to Tax Categories

| Component | Links To | Purpose |
|-----------|----------|---------|
| **HSN Codes** | `tax_categories` via `category_id` (FK) | Each HSN code is grouped under a tax category (e.g. "Veterinary Services", "Pet Products") |
| **Tax Categories** | — | Defines groupings and a **default `tax_rate`** for that category |

**Relationship:**
- **HSN Code** → has its own `gst_rate` (the one enforced at transaction time)
- **Tax Category** → has `tax_rate` (default for the group)
- When a service/product links to **Tax Category only** (no HSN): use `tax_categories.tax_rate`
- When a service/product links to **HSN Code**: use `hsn_codes.gst_rate` (overrides category default)

The current backend does **not** resolve `tax_category_id` for services. It only uses HSN (if present) or Tax Rules. To make Tax Categories enforceable, the payment flow must resolve `service → tax_category_id` and call a rate resolver that checks: HSN first, then Tax Category rate, then Tax Rules.

### Recommended Full Enforcement Chain

```
Transaction (booking/order)
    │
    ├─ Item linked to HSN Code? ────YES──→ Use hsn_codes.gst_rate  [GST Configuration - FINAL]
    │
    └─ NO
         │
         ├─ Item linked to Tax Category? ────YES──→ Use tax_categories.tax_rate  [GST Configuration]
         │
         └─ NO
              │
              └─ Tax Rule matches (category, style, role)? ────YES──→ Use gst_rules.gst_rate  [Flexible Tax System]
                   │
                   └─ NO ──→ 18% default
```

**Summary:** GST Configuration (HSN Codes + Tax Categories) should be the primary/final source. Tax Rules provide conditional overrides when items are not explicitly linked to HSN or Tax Category.

---

## Current Architecture

### 1. HSN Codes Tab

| Column       | Type     | Purpose                              |
|--------------|----------|--------------------------------------|
| HSN Code     | TEXT     | GST code (e.g. 9996, 2309)           |
| Description  | TEXT     | Human-readable label                 |
| Category     | TEXT/ID? | Links to Tax Category (schema varies)|
| GST Rate     | NUMERIC  | Tax rate (12%, 18%, etc.)            |
| Status       | BOOLEAN  | Active/Inactive                      |

**Schema (migration 213):** `hsn_codes` has `category_id UUID REFERENCES tax_categories(id)` – HSN codes can be linked to tax categories.

### 2. Tax Categories Tab

| Column       | Type   | Purpose                          |
|--------------|--------|----------------------------------|
| Category Name| TEXT   | e.g. "Veterinary Services"       |
| Tax Rate     | NUMERIC| Default GST for this category    |
| Description  | TEXT   | Optional notes                   |
| Status       | BOOLEAN| Active/Inactive                  |

**Role:** Groups HSN codes and provides default tax rates for a category.

### 3. Flexible Tax Rules Tab

| Column        | Type   | Purpose                                      |
|---------------|--------|----------------------------------------------|
| Rule Name     | TEXT   | e.g. "Standard 18%", "Pet Medicines 12%"     |
| Tax Type      | TEXT   | GST                                          |
| Rate          | NUMERIC| GST percentage                               |
| Priority      | INT    | Lower = higher priority                      |
| Conditions    | TEXT   | **"Type: both"** – free text, not FK-linked  |
| Status        | BOOLEAN| Active/Inactive                              |

**Conditions today:** `role_id`, `service_style`, `category` (TEXT) – all free-text or optional FKs. The `category` field is a **string**, not a foreign key to `tax_categories` or `service_catalog.category_id`. Rules match by string comparison.

### 4. Service Sources (Not Linked to Tax)

| Table             | Tax-Related Fields                    | Used By                          |
|-------------------|--------------------------------------|----------------------------------|
| `service_catalog` | **None** – no hsn_code, no tax_category_id | Master catalog, discovery        |
| `vendor_services` | **None**                             | Bookings, vendor offerings       |
| `services` (legacy)| `hsn_code`, `gst_rate`, `tax_category_id` | Some bookings, payments-enhanced |
| `products`        | `hsn_code`, `gst_rate`               | E-commerce orders                |
| `service_categories` | **None**                           | service_catalog.category_id refs |

**Critical gap:** `service_catalog` is the main source for services but has no tax linkage. Most bookings use `vendor_services` (which references `service_catalog`), but payments-enhanced tries to read from the legacy `services` table, which often doesn’t contain the booking’s service.

---

## How the Two Tabs Connect (Intended vs Actual)

### Intended Flow

```
Tax Categories (defines groups)
       ↑
       │ category_id
       │
HSN Codes (product/service → HSN → rate)
       │
       │ (should be selected by services/products)
       ↓
Tax Rules (conditions: category, service_style, role)
       │
       │ (applied when transaction matches)
       ↓
Payment / Checkout (applies correct tax)
```

### Actual Flow

1. **Tax Categories** and **HSN Codes** are linked via `hsn_codes.category_id`.
2. **Tax Rules** use `category` as free text – no FK to tax_categories or service_catalog.
3. **Service catalog** has no link to HSN codes or tax categories.
4. **Payment flow:**
   - UniversalPaymentPage: passes `category` (often `'pet_services'`) and `serviceStyle` to `/tax/calculate`.
   - payments-enhanced: reads `services` by `booking.service_id` for `hsn_code` and `category` – often empty for catalog-based bookings.
   - TaxCalculationService: uses `item.hsnCode` if present, else matches `gst_rules` by `category`/`service_style` – strings must match exactly.
5. Result: frequent fallback to 18% default.

---

## Why "Selection Not Enter" Fails Today

| Location              | Current Behavior                         | Desired Behavior                        |
|-----------------------|------------------------------------------|-----------------------------------------|
| Tax Rules – Conditions| Free text "Type: both" or category name  | Dropdown: Tax Categories, Service Styles|
| HSN Codes – Category  | May be text or optional FK               | Dropdown: Tax Categories                |
| Service Catalog       | No tax fields                            | Dropdown: Tax Category or HSN Code      |
| Products              | Optional hsn_code text                   | Dropdown: HSN Codes                     |

The system allows manual text entry instead of selecting from master data. That causes:
- Typos and mismatches
- No automatic propagation when tax rates change
- No audit trail linking services → HSN → tax rules

---

## Proposed 360-Degree Mapping

### Single Source of Truth

**Tax Categories** = canonical tax groupings.

```
tax_categories (id, category_name, tax_rate, description)
       │
       ├── hsn_codes (category_id FK)
       │
       ├── service_catalog (tax_category_id FK) ← NEW
       │
       └── gst_rules (tax_category_id FK) ← REPLACE category TEXT
```

### Schema Changes

1. **service_catalog**
   - Add: `tax_category_id UUID REFERENCES tax_categories(id)`
   - Add: `hsn_code_id UUID REFERENCES hsn_codes(id)` (optional, for services needing a specific HSN)

2. **gst_rules**
   - Add: `tax_category_id UUID REFERENCES tax_categories(id)`
   - Keep: `service_style`, `role_id` for extra conditions
   - Deprecate: `category` TEXT (or use only when `tax_category_id` is null for backward compatibility)

3. **vendor_services**
   - Inherit tax from `service_catalog` via `service_id` → no new columns if catalog has tax linkage

4. **products**
   - Add: `hsn_code_id UUID REFERENCES hsn_codes(id)` (or keep `hsn_code` TEXT but validate against `hsn_codes`)

### Admin UI: Selection Not Enter

| Screen            | Field           | Type            | Source                          |
|-------------------|-----------------|-----------------|---------------------------------|
| Tax Rules         | Tax Category    | Dropdown        | `GET /admin/finance/gst/tax-categories` |
| Tax Rules         | Service Style   | Dropdown        | `at_center`, `at_home`, `tele`  |
| Tax Rules         | Role            | Dropdown        | `GET /roles`                    |
| HSN Codes         | Category        | Dropdown        | Tax Categories                  |
| Service Catalog   | Tax Category    | Dropdown        | Tax Categories                  |
| Service Catalog   | HSN Code (opt)  | Dropdown        | HSN Codes                       |
| Products          | HSN Code        | Dropdown        | HSN Codes                       |

### Payment Flow: Resolve Tax at Transaction Time

```
Booking (service_id) 
  → vendor_services (service_id) 
  → service_catalog (id) 
  → tax_category_id, hsn_code_id
  → tax_categories.tax_rate OR hsn_codes.gst_rate
  → Apply gst_rules if conditions (role, style, amount) match (override default)
  → TaxCalculationService receives: hsnCode, taxCategoryId, serviceStyle, roleId
```

When creating a payment:
1. Resolve booking → vendor_services → service_catalog.
2. Read `service_catalog.tax_category_id` and `service_catalog.hsn_code_id`.
3. If `hsn_code_id` set: use `hsn_codes.gst_rate`.
4. Else if `tax_category_id` set: use `tax_categories.tax_rate`.
5. Optionally apply `gst_rules` (by `tax_category_id`, `service_style`, `role_id`) for overrides.

---

## Implementation Phases

### Phase 1: Schema & APIs

1. Migration: add `tax_category_id`, `hsn_code_id` to `service_catalog`.
2. Migration: add `tax_category_id` to `gst_rules`.
3. Admin APIs: ensure tax categories and HSN codes are returned for dropdowns.

### Phase 2: Admin UI – Selection Not Enter

1. Tax Rules: replace category text with tax category dropdown.
2. HSN Codes: ensure category is tax category dropdown.
3. Service Catalog: add tax category and optional HSN code dropdowns.
4. Products: HSN code dropdown (if not already).

### Phase 3: Payment & Checkout Wiring

1. payments-enhanced: resolve booking → vendor_services → service_catalog; pass `tax_category_id`, `hsn_code_id`, `service_style`, `role_id` to tax calculation.
2. UniversalPaymentPage: pass `category` and `serviceStyle` from booking/service data (no hardcoded `'pet_services'`).
3. TaxCalculationService: prefer `hsn_code_id` / `tax_category_id` over string matching; use `gst_rules` for overrides.

### Phase 4: Data Migration

1. Map existing `service_catalog.category_id` values (e.g. `veterinary`, `grooming`) to `tax_categories`.
2. Create or align tax categories for each service category.
3. Backfill `service_catalog.tax_category_id`.
4. Migrate `gst_rules.category` text to `tax_category_id` where possible.

---

## Summary: How Both Tabs Deliver Flexibility and Power

| Tab            | Role                          | Power                                  | Flexibility                        |
|----------------|-------------------------------|----------------------------------------|------------------------------------|
| **HSN Codes**  | Product/service → HSN → rate  | Exact GST per HSN code                 | Add HSN codes without code changes |
| **Tax Categories** | Grouping and default rate| One rate per category                  | Change category rate in one place   |
| **Tax Rules**  | Override by conditions        | Priority, role, style, amount ranges   | Complex scenarios (e.g. Tele 18%)   |

Together they give:

1. **Granularity:** HSN codes for precise product/service classification.
2. **Grouping:** Tax categories for defaults and simpler admin.
3. **Overrides:** Tax rules for exceptions (e.g. different rate for tele vs at-home).
4. **Single source:** Services and products select from these, not free text.
5. **Dynamic operation:** New services/categories get tax via dropdown selection; no code changes needed.

---

## References

- `backend/lambda/src/lib/services/tax-calculation-service.ts`
- `backend/lambda/src/endpoints/payments-enhanced.ts`
- `backend/lambda/src/endpoints/tax-management.ts`
- `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx`
- `db/migrations/040_add_services_tax_fields.sql`
- `db/migrations/213_ecommerce_missing_tables.sql`
- `db/migrations/512_gst_rules_table_only.sql`
