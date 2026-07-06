# Finance Export Analysis — CSV / Accounts Workflow

**Phase:** Analysis Only  
**Date:** 2026-07-06  
**Scope:** How Finance exports work today, how Accounts likely processes them, and recommended settlement columns for exports.

---

## Current Export Landscape

| Report | Export type | Generator | Auth | Respects filters |
|--------|-------------|-----------|------|------------------|
| Daily Accrual | Server CSV | `admin-vendor-daily-accrual.ts` | Bearer + UAT headers | Date only |
| Monthly Accrual | Server CSV | same | same | Month only |
| Booking Earnings (vendor) | Server CSV | `admin-vendor-booking-earnings.ts` | same | Period |
| Booking Earnings (bookings) | Server CSV | same | same | Period + vendorId |
| Settlement Dashboard | Client CSV | `SettlementDashboard.tsx` | N/A | Client filters |
| Payout Management | Client CSV | `PayoutManagement.tsx` | N/A | Client filters |

**Excel (.xlsx):** Not available for Finance reports.

---

## Daily Accrual — Current Export Columns

```
report_date, vendor_id, business_name, owner_name, vendor_phone,
gross_amount, commission_amount, net_amount,
platform_fee, convenience_fee, delivery_fee, gst_total,
currency, earnings_line_count, delivery_settlement_line_count,
missing_earnings_booking_count, missing_delivery_settlement_count,
bank_name, account_holder_name, account_number, ifsc_code,
bank_verified, bank_verification_status, razorpay_fund_account_id,
bank_source, computed_at
```

**UI-only columns (not in CSV):** CGST/SGST/IGST split (CSV has `gst_total` only)

**Accounts usage pattern (inferred):**

1. Filter/sort by `net_amount` for payment amounts
2. Match `vendor_id` / bank fields to Razorpay or bank file
3. Use `missing_*` columns to chase ops before paying
4. Gross/commission for reconciliation to internal ledger

**Settlement breakdown in daily export:** **Not recommended** at row level.

---

## Monthly Accrual — Current Export Columns

Same as daily plus: `year`, `month`, `month_start`, `month_end_exclusive`, `snapshot_day_count` (in monthly variant).

**Accounts usage:** Primary **payment file** for monthly vendor transfers — bank columns are mandatory for AP.

---

## Booking Earnings — Current Export Columns

### Vendor summary export

```
vendor_id, business_name, owner_name, booking_count,
customer_paid_total, service_base_total, discount_total, gst_total,
platform_fee_total, convenience_fee_total, delivery_fee_total,
vendor_gross, commission_total, vendor_net
```

### Booking-level export

```
booking_id, vendor_id, booking_date, booking_status, service_name, customer_name,
coupon_code, customer_paid_total, service_base, discount_amount, gst_total,
platform_fee, convenience_fee, delivery_fee, vendor_gross,
commission_rate, commission_amount, vendor_net, fee_source, realized_at
```

**Gap:** `discount_amount` is undifferentiated; no commission base; no funding; no batch/payout.

---

## Settlement Dashboard — Client CSV

```
Vendor, Role/Business Type, Amount, Commission, Status, Date
```

Minimal — operational snapshot, not used for Accounts payment processing.

---

## Payout Management — Client CSV

```
Payout ID, Vendor, Amount (net), Status, Period
```

Missing gross, commission, bank — Accounts likely uses accrual export instead.

---

## How Accounts Team Likely Processes Files

Based on column design (bank fields on accrual, booking detail separate):

```
┌─────────────────────────────────────────────────────────────┐
│ MONTH END                                                    │
├─────────────────────────────────────────────────────────────┤
│ 1. Finance runs Monthly Accrual Compute                      │
│ 2. Export vendor-monthly-accrual-YYYY-MM.csv                 │
│ 3. Accounts imports to spreadsheet / ERP                     │
│    - Group by vendor_id                                      │
│    - Verify net_amount vs prior month delta                  │
│    - Match bank_name, ifsc_code, account_number              │
│ 4. Initiate bank transfers (Razorpay / manual)               │
│ 5. Cross-check Payout Management for status                  │
├─────────────────────────────────────────────────────────────┤
│ DISPUTE / AUDIT (ad hoc)                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. Export booking-level CSV for vendor + month                 │
│ 2. Find booking_id in dispute                                │
│ 3. Manually compare discount vs commission (pain point)      │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** Accounts needs **two files**:

- **Vendor payment file** — monthly accrual (keep lean)
- **Audit file** — booking earnings with settlement detail (extend this)

Do **not** merge into one mega-CSV — different audiences and row counts.

---

## Recommended Column Additions

### Booking-level export (mandatory for self-explanatory audit file)

| Column | Mandatory | Optional | Hidden | Source |
|--------|-----------|----------|--------|--------|
| `vendor_id` | ✓ | | | existing |
| `booking_id` | ✓ | | | existing |
| `business_name` | ✓ | | | join vendors |
| `booking_date` | ✓ | | | existing |
| `service_name` | ✓ | | | existing |
| `customer_name` | | ✓ | | existing |
| `customer_paid_total` | ✓ | | | existing |
| `vendor_base_price` | ✓ | | | metadata |
| `vendor_discount` | ✓ | | | metadata |
| `platform_discount` | ✓ | | | metadata |
| `discount_amount` (total) | | ✓ | | existing — keep for backward compat |
| `gst_total` | ✓ | | | existing |
| `platform_fee` | | ✓ | | existing |
| `convenience_fee` | | | ✓ | rarely needed in audit |
| `delivery_fee` | | ✓ | | existing |
| `commission_base` | ✓ | | | metadata |
| `commission_rate` | ✓ | | | existing |
| `commission_amount` | ✓ | | | existing |
| `vendor_settlement` | ✓ | | | metadata (should match vendor_net) |
| `vendor_net` (ledger) | ✓ | | | existing — reconciliation column |
| `winning_offer_type` | ✓ | | | metadata |
| `winning_offer_name` | | ✓ | | metadata |
| `funding_type` | ✓ | | | metadata |
| `platform_funded_amount` | ✓ | | | fundingSummary.platformPaid |
| `vendor_funded_amount` | ✓ | | | fundingSummary.vendorPaid |
| `coupon_code` | | ✓ | | existing |
| `settlement_id` | ✓ | | | vendor_earnings |
| `settlement_status` | ✓ | | | settlements join |
| `payout_id` | | ✓ | | vendor_earnings |
| `payout_status` | | ✓ | | payouts join |
| `tier_name` | | ✓ | | metadata.commissionPolicy |
| `tier_source` | | | ✓ | internal debug |
| `policy_fingerprint` | | | ✓ | internal audit only |
| `snapshot_version` | | | ✓ | integration tracking |
| `settlement_data_source` | | ✓ | | ledger_metadata / unavailable |
| `realized_at` | ✓ | | | existing |
| `fee_source` | | | ✓ | internal |

### Vendor summary export (optional extensions)

| Column | Verdict |
|--------|---------|
| `platform_discount_total` | Optional — useful for month review |
| `vendor_discount_total` | Optional |
| `bookings_missing_snapshot_count` | Optional — data quality |

### Daily / Monthly accrual export (minimal change)

| Column | Verdict |
|--------|---------|
| All settlement breakdown columns | **Do not add** |
| `platform_discount_total` | Optional single column at vendor level (monthly only) |
| `vendor_discount_total` | Optional (monthly only) |

### Settlement / Payout client CSV

| Column | Verdict |
|--------|---------|
| `settlement_id` | Add to payout export |
| `gross_amount`, `commission` | Add to payout export (already in UI) |
| Booking breakdown | **No** — link to booking export |

---

## Export Modes Recommendation

### Mode 1: Standard (default)

Current booking CSV headers — backward compatible.

### Mode 2: Settlement detail

Query flag: `?includeSettlementDetail=1` on booking export

- Appends mandatory audit columns above
- Filename: `vendor-booking-earnings-{period}-settlement-detail.csv`

### Mode 3: Accounts reconciliation pack (future)

Zip or two-file download:

1. `vendor-monthly-accrual-{YYYY-MM}.csv` (payment)
2. `vendor-booking-earnings-{YYYY-MM}-settlement-detail.csv` (audit)

No new page — button on Monthly Accrual: **“Download reconciliation pack”**.

---

## Excel Consideration

Accounts often prefers Excel for filters and pivot tables.

**Recommendation:**

- **Phase 1:** CSV with settlement columns (zero new dependencies)
- **Phase 2:** Optional `.xlsx` using existing ExcelJS pattern from `bulk-product-xlsx.ts`
- Same row mapper function for CSV and Excel — **reuse plan**

Excel benefits: column widths, number formats (₹), multiple sheets (Summary + Bookings).

**Not mandatory** if CSV columns are self-explanatory.

---

## Column Ordering (Accounts-friendly)

Recommended booking detail export column order:

```
1. Identity:     report_period, vendor_id, business_name, booking_id, booking_date
2. Customer:     customer_name, service_name, coupon_code
3. Customer $:   customer_paid_total, vendor_base_price
4. Discounts:    vendor_discount, platform_discount, winning_offer_type, funding_type
5. Tax & fees:   gst_total, platform_fee, delivery_fee
6. Commission:   commission_base, commission_rate, commission_amount
7. Vendor $:     vendor_settlement, vendor_net, vendor_gross
8. Status:       settlement_id, settlement_status, payout_id, realized_at
```

Group related fields — Accounts scans vertically in blocks.

---

## Validation Columns (Self-Explanatory Reports)

Add computed check columns for Accounts trust:

| Column | Formula | Purpose |
|--------|---------|---------|
| `ledger_match` | `vendor_settlement ≈ vendor_net` | Y/N flag |
| `commission_check` | `commission_base * rate ≈ commission_amount` | Y/N flag |
| `snapshot_present` | metadata has snapshot | Y/N |

These reduce back-and-forth with Finance ops.

---

## Hidden / Internal Only

Keep out of default export (available in debug or admin-only flag):

- `policy_fingerprint`
- `snapshot_version` / `integration_version`
- `tier_source`, `subscription_source`
- Raw JSON `settlement_snapshot`
- `fee_source`

---

## Related Documentation

- `docs/FINANCE_REPORTING_CURRENT_STATE.md`
- `docs/FINANCE_REPORTING_UX_ANALYSIS.md`
- `docs/SETTLEMENT_REPORTING_REUSE_PLAN.md`
