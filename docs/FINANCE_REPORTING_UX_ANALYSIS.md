# Finance Reporting — UX Analysis (Settlement Breakdown)

**Phase:** Analysis Only  
**Date:** 2026-07-06  
**Audience:** Finance product, Accounts team workflows  
**Constraint:** Extend existing reports; avoid a separate Settlement Preview page unless proven necessary.

---

## Problem Statement

Accounts receives CSV exports from Finance reports and must reconcile:

- What the customer paid
- What discount was applied and **who funded it**
- What commission base was used (especially when platform promos do not reduce vendor commission base)
- What the vendor should receive
- Which settlement batch / payout paid them

Today, **Booking Earnings** shows a customer-paid waterfall and ledger amounts but **cannot explain commission base or funding**. **Daily/Monthly Accrual** show vendor aggregates without booking-level context. **Settlement/Payout** screens show batch totals without line-item funding detail.

Finance S2 now persists `SettlementSnapshot` at booking completion — the data exists but is invisible in reporting UX.

---

## User Personas & Jobs

| Persona | Primary job | Reports used | Pain today |
|---------|-------------|--------------|------------|
| **Finance Analyst** | Daily accrual check, gap detection | Daily Accrual | Cannot see if commission base matches promo policy |
| **Accounts (AP)** | Monthly vendor payment file | Monthly Accrual CSV + bank columns | Single “discount” number; no platform vs vendor split |
| **Finance Ops** | Dispute / audit single booking | Booking Earnings | Expanded panel lacks funding type, commission base, winning offer |
| **Payout Executor** | Process bank transfers | Payout Management | Modal shows gross/commission/net only |
| **Investor / Leadership** | Fee and GST totals | Daily Accrual KPI cards | Adequate for fees; promo funding invisible |

---

## Per-Report UX Assessment

### Daily Accrual

**Purpose:** IST-day vendor rollup for operational monitoring and investor fee reporting.  
**Primary user:** Finance Analyst  
**Frequency:** Daily  
**Current workflow:** Compute yesterday → scan Missing VE/DS columns → export CSV with bank details for downstream use.

**Settlement Breakdown fit:** **Poor at row level** — report is vendor-aggregated by design. Adding 10+ settlement columns per vendor row would duplicate Booking Earnings logic and confuse the accrual-vs-audit boundary.

**Recommendation:**

| UX option | Verdict | Reason |
|-----------|---------|--------|
| New columns (commission base, funding, winning offer) | **No** | Not meaningful at vendor-day aggregate without weighted semantics |
| Expandable vendor rows | **No** | Would become a second Booking Earnings embedded in accrual |
| Drawer | **No** | Same problem |
| Separate export | **No** | Wrong granularity |
| Link to Booking Earnings | **Optional** | “View bookings for this vendor/day” deep link — low cost, high clarity |

**KPI cards — keep and extend lightly:**

| KPI | Keep? | Notes |
|-----|-------|-------|
| Gross, Commission, Net | Yes | Core accrual |
| Platform / Convenience / Delivery / GST | Yes | Investor reporting |
| Vendor count | Yes | |
| **Platform-funded discount total** | **Add (aggregate)** | Single card from ledger metadata SUM — explains promo cost without row noise |
| **Vendor-funded discount total** | **Add (aggregate)** | Same |
| Pending/Paid settlement | **No** | Wrong report — belongs on Settlement/Payout tabs |

**Verdict:** **Keep as-is** for table structure; **extend** KPI strip with 2 optional funding summary cards (month-level aggregates only if cheap to compute).

---

### Monthly Accrual

**Purpose:** Month-end vendor reconciliation before payout batch.  
**Primary user:** Accounts (AP)  
**Frequency:** Monthly  
**Current workflow:** Compute full month → export CSV with bank fields → Accounts processes payments in external system.

**Settlement Breakdown fit:** **Summary-level only.** Accounts needs to trust that monthly commission and net match policy, but they reconcile at **vendor × month**, not booking.

**Recommendation:**

| UX option | Verdict | Reason |
|-----------|---------|--------|
| New columns per vendor | **Partial** — 2–3 optional aggregate columns only | e.g. `platform_discount_total`, `vendor_discount_total`, `avg_commission_rate` |
| Expandable rows | **No** | Too heavy |
| Drawer with booking list | **No** | Use Booking Earnings instead |
| Separate “settlement detail export” | **Yes** — booking-level CSV variant | Accounts often wants one file; offer **“Export with settlement detail”** checkbox on Booking Earnings monthly export, not on accrual |

**Monthly reconciliation workflow (target state):**

```
Monthly Accrual CSV (vendor totals + bank)
        ↓
Accounts matches net_amount to bank transfer
        ↓
If mismatch → Booking Earnings (month, vendor) → expand booking → Settlement Breakdown drawer
```

**Verdict:** **Extend** monthly accrual KPIs only; **do not** embed booking breakdown. Point users to Booking Earnings for disputes.

---

### Booking Earnings

**Purpose:** Per-booking financial audit trail.  
**Primary user:** Finance Ops / Accounts (disputes)  
**Frequency:** Ad hoc  
**Current workflow:** Select period → load vendors → drill vendor → drill booking → read expanded fee grid.

**This is the natural home for Settlement Breakdown.**

**Can it become the financial audit report?** **Yes**, with settlement metadata surfaced at booking drill-down. It already has:

- Two-level drill-down (vendor → booking → expanded detail)
- Ledger SoT columns (gross, commission, net)
- Customer-paid waterfall
- Server CSV export at booking level

**Missing for audit completeness:**

| Field | In metadata? | In UI today? |
|-------|--------------|--------------|
| Commission base | Yes | No |
| Vendor base price | Yes | Partial (service base ≈ but not always identical) |
| Platform discount | Yes | No (single discount column) |
| Vendor discount | Yes | No |
| Funding type | Yes | No |
| Winning offer type/name | Yes | No |
| Tier / subscription source | Yes | No |
| Settlement batch ID | On `vendor_earnings.settlement_id` | No |
| Payout ID | On `vendor_earnings.payout_id` | No |
| Policy fingerprint | Yes | No |

**Recommended UX — combination approach:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Booking Earnings Report                          [Daily|Monthly]│
├─────────────────────────────────────────────────────────────────┤
│ KPI cards (existing + optional Platform/Vendor discount totals) │
├─────────────────────────────────────────────────────────────────┤
│ Vendor table (unchanged columns)                                │
│   ▼ Vendor row → booking sub-table                              │
│       ▼ Booking row → ENHANCED expanded panel OR drawer         │
│           ┌─ Settlement Breakdown ─────────────────────────┐  │
│           │ Vendor base    ₹X    Commission base    ₹Y       │  │
│           │ Winning offer  PLATFORM_COUPON (-₹Z)             │  │
│           │ Funding        Platform pays ₹A / Vendor ₹B    │  │
│           │ Commission     12% of ₹Y = ₹C                    │  │
│           │ Vendor settlement              ₹D                │  │
│           │ Batch: SET-xxx  Payout: PAY-yyy  Status: paid    │  │
│           └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Drawer vs expandable row vs modal:**

| Pattern | Fit | Reason |
|---------|-----|--------|
| **Expandable row (inline accordion)** | **Primary** | Already implemented; extend content in-place — lowest friction for scanning multiple bookings |
| **Drawer (right panel)** | **Secondary** | Use when breakdown exceeds ~12 fields or needs copy/export single booking |
| **Modal** | Avoid | Blocks table context |
| **Separate page** | Avoid | Breaks drill-down flow |

**Verdict:** **Extend** — rename subtitle to “Booking financial audit” in help text; enhance expanded booking panel into **Settlement Breakdown** section; optional drawer for “full detail + copy JSON” power users.

---

### Settlement Dashboard

**Purpose:** Batch-level settlement operations.  
**Settlement Breakdown fit:** Batch summary only — `GET /settlements/:id` already lists bookings with amounts.

**Recommendation:** **Extend** row action “View detail” → slide-over listing bookings with **link** “Open in Booking Earnings” rather than duplicating full breakdown here.

**Verdict:** **Keep as-is** for table; light **extend** on detail view.

---

### Payout Management

**Purpose:** Execute bank transfers.  
**Settlement Breakdown fit:** Low — Accounts already trusts net amount from accrual; modal is bank-focused.

**Recommendation:** Add read-only **“Source settlements”** list in detail modal with batch IDs — no per-booking breakdown.

**Verdict:** **Keep as-is** with minor batch linkage.

---

## Drill-Down UX — Finance User Preferences

Finance users work in **spreadsheet mental models**:

1. Scan aggregates (accrual)
2. Drop to line items when totals disagree (booking earnings)
3. Read explanatory fields once (settlement breakdown)
4. Export the line-item file for Accounts

**Best pattern hierarchy:**

1. **Inline accordion** — default for booking-level breakdown (fast, scannable)
2. **Drawer** — overflow / print-friendly single-booking view
3. **Deep link** — accrual → booking earnings pre-filtered
4. **Never** a standalone Settlement Preview page — Booking Earnings already is the preview surface

---

## KPI Analysis — Daily & Monthly

### Recommended KPI additions (both reports)

| KPI | Useful? | Noise? | Implementation note |
|-----|---------|--------|---------------------|
| Gross revenue | Already have | — | |
| Vendor discounts (ledger sum) | **Yes** | Low | Aggregate from metadata or booking discount split |
| Platform discounts (ledger sum) | **Yes** | Low | Shows promo cost to platform |
| Commission | Already have | — | |
| Vendor settlement (net) | Already have | — | |
| Pending settlement ₹ | **No on accrual** | High | Accrual ≠ settlement status |
| Paid settlement ₹ | **No on accrual** | High | Belongs on Settlement tab |
| Outstanding | **No** | High | Duplicate of Payout pending stats |

### Booking Earnings KPI additions

| KPI | Verdict |
|-----|---------|
| Platform discount total | Add to secondary row |
| Vendor discount total | Add to secondary row |
| Bookings missing settlement snapshot | Add badge/count — data quality signal for S2 rollout |

---

## Wireframe-Level Recommendations

### A. Booking Earnings — Enhanced Expanded Row

```
[Booking abc123…]  Grooming  Raj  ₹1,200  …  [▼ expanded]
────────────────────────────────────────────────────────────
 CUSTOMER WATERFALL          │  SETTLEMENT BREAKDOWN
 Customer paid      ₹1,180   │  Vendor base price    ₹1,000
 Service base       ₹1,000   │  Commission base      ₹1,000  ← platform promo
 Discount           ₹50      │  Winning offer        PLATFORM_COUPON
 Coupon             SAVE50    │  Funding              Platform ₹50
 GST                ₹180      │  Commission           15% → ₹150
 Platform fee       ₹0        │  Vendor settlement    ₹850
 Vendor gross       ₹1,000    │  Ledger net           ₹850 ✓
 Commission         ₹150      │  Tier                 Gold (subscription)
 Vendor net         ₹850      │  Settlement           SET-7f3… (paid)
 Fee source: payment │  Payout                 PAY-2a1…
────────────────────────────────────────────────────────────
 [Copy breakdown]  [Open drawer]  [Export this booking]
```

### B. Monthly Accrual — Optional Summary Strip

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Gross    │ │ Commission│ │ Net      │ │ Vendors  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
┌─────────────────────┐ ┌─────────────────────┐
│ Platform discounts  │ │ Vendor discounts    │  ← new, optional
│ ₹12,400             │ │ ₹8,200              │
└─────────────────────┘ └─────────────────────┘
```

### C. Daily Accrual — Deep Link (no new columns)

Vendor row hover action: **“View bookings”** → `/finance?tab=vendor-booking-earnings&date=…&vendorId=…`

---

## Final UX Recommendation Summary

| Report | Action | Settlement Breakdown placement |
|--------|--------|-------------------------------|
| Daily Accrual | **Keep as-is** (+ optional funding KPI cards) | Not in table; deep link only |
| Monthly Accrual | **Extend** KPI strip | Not in table; detailed export via Booking Earnings |
| Booking Earnings | **Extend** → primary audit report | **Expandable row + optional drawer** |
| Settlement Dashboard | **Keep as-is** | Link out to Booking Earnings |
| Payout Management | **Keep as-is** | Batch IDs in modal only |

**Settlement Breakdown should be:** **Combination of (3) expandable row + (4) additional export columns + (2) drawer for overflow** — **not** a separate page.
