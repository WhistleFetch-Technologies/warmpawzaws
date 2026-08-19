# GST FINANCIAL-LINEAGE CODE IS PROTECTED

This code controls **customer money**, **GST**, **payment totals**, **finalPaid**, **vendor economics**, **package GST**, **invoices**, and **financial reports**.

It is not ordinary UI. Casual edits, silent rate changes, and “helpful” reconstructions have already produced wrong Admin Booking Earnings Customer Paid and invented historical GST.

**Admin / product GST configuration in the live Admin UI is not blocked.** Creating a GST card, changing a rate, or mapping a catalogue category is runtime configuration. This guard protects **repository code**, not Admin GST cards.

---

## Before changing anything in the protected surface

1. Read this document.
2. Explain why the change is required.
3. Identify which invariants below are affected.
4. Trace the existing financial lineage (do not invent a second formula).
5. Add or update regression tests.
6. Run `cd backend/lambda && npm run test:gst-financial`.
7. Report failures. Do **not** weaken or delete GST tests to go green.
8. Never modify production data or Admin GST configuration as part of a code experiment.
9. Never silently change GST rates or category mappings in code.

Declare an intentional protected change in the **PR body** and/or **commit message**:

```text
GST-PROTECTED-CHANGE: <why this code change is required>
GST-PROTECTED-INVARIANT: <which invariant>
GST-PROTECTED-TESTS: <which suites cover it>
```

`GST-PROTECTED-CHANGE:` plus a real reason is required. CI fails if a protected **source** file changes without that declaration.

---

## Protected modules (code, not Admin UI)

Inspected in-repo. Display-only Admin/customer columns are **not** listed.

| Concern | File |
|---|---|
| GST category / alias / UUID→slug / diagnostics resolve | `backend/lambda/src/lib/services/gst-catalog-role-resolution.ts` |
| Configured GST rate pick (no silent 18%) | `backend/lambda/src/utils/tax-category-display-rate.ts` |
| GST calculation | `backend/lambda/src/lib/services/tax-calculation-service.ts` |
| Authoritative service GST | `backend/lambda/src/utils/calculate-authoritative-service-gst.ts` |
| Checkout tax item resolve | `backend/lambda/src/utils/resolve-service-booking-tax-item.ts` |
| CGST / SGST / IGST | `backend/lambda/src/utils/gst-split.ts` |
| Place of supply | `backend/lambda/src/lib/gst-place-of-supply.ts` |
| Canonical snapshot / 0% lock | `backend/lambda/src/utils/canonical-gst-snapshot.ts` |
| Customer list price (`custom_price ?? price`) | `backend/lambda/src/utils/resolve-booking-list-price.ts` |
| Booking financial gross | `backend/lambda/src/utils/booking-financial-gross.ts` |
| Customer Paid + Booking Earnings GST | `backend/lambda/src/utils/vendor-booking-earnings-report.ts` |
| Accrual / stored-payment GST | `backend/lambda/src/utils/vendor-accrual-fee-breakdown.ts` |
| Package session allocation | `backend/lambda/src/utils/package-session-earnings-allocation.ts` |
| Commission vs customer paid (funding overlay) | `backend/lambda/src/utils/funding-aware-ledger-correction.ts` |
| Invoice historical GST + paid reconciliation | `backend/lambda/src/utils/booking-invoice-amounts.ts` |
| Invoice row GST | `backend/lambda/src/utils/invoice-row-gst.ts` |
| Guard + canonical suite | `backend/lambda/scripts/gst-financial-lineage-guard.js` |

Checkout `finalPaid` lock is also applied in `backend/lambda/src/endpoints/booking/endpoints/bookings-enhanced.booking.ts` (`gstFinalPaid` → `booking.total_amount` / `wp_financial_meta.finalPaid`). That file is a large booking monolith and is **not** path-guarded as a whole so ordinary booking-flow edits do not trip this guard. The contract is enforced by `authoritative-final-paid.test.ts`. Do not change that lock without the declaration and suite.

Required regression files are listed in `gst-financial-lineage-guard.js` (`REQUIRED_TEST_FILES`). Deleting or emptying the suite pattern fails the guard even if Jest is configured to skip them.

---

## Non-negotiable invariants

### Customer price

```text
custom_price ?? price
```

Vendor commission must never reduce the customer selling price.

Example: vendor selling price ₹1,650, commission 10%, vendor net ₹1,485 → customer base stays **₹1,650**.

### Customer Paid

When an authoritative payment exists:

```text
captured payment.amount
  + wallet actually used
  − applicable refund
```

Fallback only if amount is unavailable: `payment.total_amount`, then stored `booking.total_amount`.

Never reconstruct as `service base + inferred GST + fees` when a capture exists.  
Never use vendor net, commission, GST, or **today’s Admin GST rate** to inflate Customer Paid.  
Do not create a second Customer Paid calculator.

### GST

Resolve from authoritative catalogue / category mapping (`gst-catalog-role-resolution`).  
Do **not** reintroduce vendor-role-only GST resolution.  
Missing GST configuration **fail closed** (no silent 18%).

### 0% GST

A backend-authoritative 0% snapshot stays 0%.  
Do **not** use `gstAmount > 0` as the test for whether backend GST authority exists.

### finalPaid

When backend authority exists, these must agree:

- `booking.total_amount`
- `wp_financial_meta.finalPaid`
- authoritative GST `gstFinalPaid`

### GST split

- Intra-state → CGST + SGST  
- Inter-state → IGST  
- Bangalore / Karnataka is intra-state  
- Never CGST + SGST + IGST on one taxable line  

### Package GST

GST is attributed **once** to the package purchase.  
Sessions must not duplicate GST or treat allocation as another customer payment.

### Commission

```text
Vendor Net = Vendor Gross − Platform Commission
```

Commission stays separate from Customer Paid. GST is never calculated on vendor net.

### Historical

Current Admin GST rates must never rewrite historical GST, invoices, or Booking Earnings.

---

## Prohibited

- Weakening or deleting GST / Customer Paid regressions to force green  
- Bypassing category-authoritative resolution  
- Adding a vendor-role GST fallback  
- Calculating GST from vendor net  
- Using commission-adjusted price as customer price  
- Reconstructing historical GST from current rates  
- Removing 0% GST authority  
- Changing finalPaid lineage without this review  
- Duplicating package GST  
- A second Customer Paid calculation  

---

## Canonical command

```bash
cd backend/lambda
npm run validate:gst-financial
npm run test:gst-financial
```

CI workflow: `.github/workflows/gst-financial-lineage-ci.yml`.
