# GST Configuration – Admin Guide

## What is GST Configuration?

GST Configuration lets you manage **GST rates** and **HSN codes** used for invoicing and tax calculation. You can define **HSN codes** (with CGST, SGST, IGST rates) and **tax categories** that map services or products to default GST rates.

---

## How to Use GST Configuration

1. Go to **Finance & Logistics** → **GST Configuration**.
2. Use the tabs:
   - **Overview** – Summary of HSN codes and tax categories.
   - **HSN Codes** – Add or edit HSN codes (code, description, category, GST rate, CGST/SGST/IGST).
   - **Tax Categories** – Define categories (name, description, default GST rate, applicable services).
   - **Settings** – Any global GST settings (if available).
3. Click **Refresh** to reload data from the server.

---

## Where GST Configuration Is Used

| Where | How |
|-------|-----|
| **Invoicing** | Invoices use the HSN code and GST rate from the matching tax category or HSN code for the service/product. |
| **Tax calculation** | At checkout or booking, tax is computed using the applicable GST rate (CGST+SGST for same-state, IGST for inter-state). |
| **Reports** | GST reports and filings use the same HSN codes and rates configured here. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **HSN Code** | The code (e.g. 9983) used on invoices and for tax classification. |
| **Description** | Human-readable description of the HSN code. |
| **Category** | Grouping for the HSN code (e.g. services, goods). |
| **GST Rate** | Overall GST rate (e.g. 18%). |
| **CGST / SGST / IGST** | Split rates for same-state (CGST+SGST) or inter-state (IGST). |
| **Tax Category – Default GST Rate** | Default rate applied when a service/product is in this category. |
| **Applicable Services** | Which services or products use this tax category. |
| **Active** | Only active HSN codes and categories are used for tax calculation. |

---

## Tips

- Keep HSN codes aligned with your GST registration and annual return (e.g. 9983 for services).
- Use tax categories to map vendor service types to the correct GST rate.
- Ensure CGST+SGST equals the total GST rate for same-state supplies; use IGST for inter-state.
