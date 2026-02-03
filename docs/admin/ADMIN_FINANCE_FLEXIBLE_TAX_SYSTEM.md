# Flexible Tax System – Admin Guide

## What is the Flexible Tax System?

The Flexible Tax System lets you define **tax rules** with conditions, exemptions, and multiple tax types (GST, CGST, SGST, IGST, cesses, custom). Rules are matched by **priority** (lower number = higher priority); the first matching rule is applied.

---

## How to Create a Tax Rule

1. Go to **Finance & Logistics** → **Flexible Tax System**.
2. Click **Create Tax Rule**.
3. Fill in:
   - **Name** – e.g. "GST 18% Services", "IGST Export".
   - **Description** – Optional note for admins.
   - **Tax Type** – GST, CGST, SGST, IGST, Service Tax, Education Cess, Swachh Bharat Cess, Krishi Kalyan Cess, Infrastructure Cess, or Custom.
   - **Rate** – Percentage or fixed amount (depending on calculation method).
   - **Calculation Method** – Percentage or fixed amount.
   - **Priority** – Lower number = higher priority; first matching rule wins.
   - **Conditions** – e.g. transaction type (booking, order, both), service category, amount range (if supported).
   - **Exemptions** – Categories or conditions where this tax is not applied (if supported).
   - **Active** – Only active rules are applied.
4. Click **Save**.

---

## Where the Flexible Tax System Is Used

| Where | How |
|-------|-----|
| **Checkout / booking** | When calculating order or booking total, the system evaluates tax rules by priority and applies the first matching rule. |
| **Invoicing** | Invoices show the tax breakdown (e.g. CGST, SGST, or IGST) based on the applied rule. |
| **Refunds** | Tax component of refunds is calculated using the same rules. |

---

## Option Impact Summary

| Option | Impacts |
|--------|---------|
| **Tax Type** | Which tax is applied (GST, CGST, SGST, IGST, cess, custom). |
| **Rate** | The percentage or fixed amount used for calculation. |
| **Calculation Method** | Whether the rate is applied as a percentage of the amount or as a fixed value. |
| **Priority** | Order of evaluation; lower number = higher priority. First match wins. |
| **Conditions** | Restricts when this rule applies (e.g. booking vs order, category, amount). |
| **Exemptions** | When this tax is not applied (e.g. certain categories or regions). |
| **Active** | Inactive rules are skipped. |

---

## Tips

- Put **specific rules** (e.g. export 0%) at **lower priority numbers** and **default GST** at a higher number.
- Use **conditions** to apply different rates by transaction type, category, or amount.
- Compound taxes (e.g. cess on top of GST) can be modelled with separate rules or compound logic if supported by your implementation.
