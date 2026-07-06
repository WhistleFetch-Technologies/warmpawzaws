# Finance Reporting S3 — Implementation

**Phase:** S3 (Finance Reporting & Settlement Audit)  
**Date:** 2026-07-06  
**Status:** Implemented locally — not committed  
**Scope:** Expose persisted `SettlementSnapshot` / funding metadata in Finance reporting UI and exports. No settlement engine changes.

---

## Summary

Booking Earnings is the **Financial Audit Report**. Settlement breakdown opens in a **right-side drawer** (`SettlementBreakdownDrawer`) populated from **persisted metadata only** — no recomputation.

Daily / Monthly Accrual keep existing tables; optional **funding KPI cards** and deep links into Booking Earnings.

Monthly Accrual adds **Download reconciliation pack** (two separate CSV downloads).

---

## Files Changed

### Backend — new

| File | Purpose |
|------|---------|
| `backend/lambda/src/utils/resolve-settlement-breakdown-for-report.ts` | Read-only metadata resolver + IST funding aggregate query |
| `backend/lambda/src/utils/settlement-audit-csv.ts` | Settlement audit CSV headers and row builder |

### Backend — modified

| File | Changes |
|------|---------|
| `backend/lambda/src/utils/vendor-booking-earnings-report.ts` | SQL: `ve.metadata`, settlement/payout joins; `settlementBreakdown` on each line; `fetchAllVendorBookingEarningsLinesForIstRange()` |
| `backend/lambda/src/endpoints/admin/endpoints/admin-vendor-booking-earnings.ts` | New route `GET .../export-settlement-audit.csv` |
| `backend/lambda/src/endpoints/admin/endpoints/admin-vendor-daily-accrual.ts` | Funding KPI totals on daily + monthly JSON responses |

### Frontend — new

| File | Purpose |
|------|---------|
| `apps/admin-web/lib/finance/settlement-audit-types.ts` | Shared DTOs + `normalizeBookingLine()` |
| `apps/admin-web/lib/finance/settlementAuditExport.ts` | CSV download helpers, deep-link URL builders |
| `apps/admin-web/lib/finance/settlementExplanation.ts` | Human-readable explanation steps from persisted fields |
| `apps/admin-web/components/admin/finance/settlementAudit/SettlementBreakdownDrawer.tsx` | 560px right drawer |
| `apps/admin-web/components/admin/finance/settlementAudit/SettlementExplanation.tsx` | Explanation UI block |

### Frontend — modified

| File | Changes |
|------|---------|
| `VendorBookingEarningsReport.tsx` | View Settlement action, drawer, settlement audit CSV, deep-link hydration |
| `VendorDailyAccrualReport.tsx` | Funding KPI cards, View bookings deep link per vendor row |
| `VendorMonthlyAccrualReport.tsx` | Funding KPI cards, reconciliation pack download |
| `SettlementDashboard.tsx` | Open in Booking Earnings action |
| `PayoutManagement.tsx` | Linked settlement IDs in detail modal, Open Booking Earnings |

---

## Backend Extensions

### Extended API: `GET /admin/finance/vendor-booking-earnings`

Each booking line now includes `settlementBreakdown`:

```typescript
{
  available: boolean;
  dataSource: 'ledger_metadata' | 'booking_meta' | 'settlement_preview' | 'unavailable';
  vendorBasePrice, commissionBase, commissionRate, commissionAmount, vendorSettlement;
  vendorPromotion, platformPromotion, vendorCoupon, platformCoupon;
  winningOfferType, winningOfferName, fundingType;
  fundingSummary fields (vendorPaid, platformPaid, shared*, campaignPaid);
  policy fields (tierName, policyFingerprint, policyVersion, …);
  settlementId, settlementStatus, payoutId, payoutStatus;
}
```

### New API: `GET /admin/finance/vendor-booking-earnings/export-settlement-audit.csv`

Query: `reportDate=YYYY-MM-DD` **or** `year` + `month`  
Returns all bookings in period with audit columns (see Export section).

### Extended API: daily / monthly accrual JSON

`totals` now includes (when metadata present):

- `platformFundedDiscount`
- `vendorFundedDiscount`

Single aggregate SQL on `vendor_earnings.metadata` — no per-vendor loop.

---

## SQL Changes

In `fetchRawEarningsRowsForIstRange`:

```sql
ve.metadata AS earnings_metadata,
ve.settlement_id, ve.payout_id,
COALESCE(s.settlement_status, s.status) AS settlement_status,
po.status AS payout_status,
b.notes AS booking_notes
LEFT JOIN settlements s ON s.id = ve.settlement_id
LEFT JOIN payouts po ON po.id = ve.payout_id
```

Funding KPI aggregate reads JSONB paths:

- `metadata->'fundingSummary'->>'platformPaid'`
- `metadata->'settlementSnapshot'->'fundingSummary'->>'vendorPaid'` (fallback chain)

No new tables or migrations.

---

## Export Changes

| Export | Route | Status |
|--------|-------|--------|
| Vendor summary CSV | `.../export.csv` (no vendorId) | **Unchanged** |
| Booking CSV | `.../export.csv?vendorId=` | **Unchanged** |
| **Settlement audit CSV** | `.../export-settlement-audit.csv` | **New** |
| Monthly accrual CSV | `.../monthly/export.csv` | **Unchanged** |
| Reconciliation pack | Client: accrual CSV + audit CSV sequential download | **New** |

### Settlement audit CSV columns

`booking_id`, `vendor_id`, `business_name`, `customer_name`, `service_name`, `vendor_base_price`, `vendor_promotion`, `platform_promotion`, `vendor_coupon`, `platform_coupon`, `winning_offer`, `funding_type`, `vendor_funded_amount`, `platform_funded_amount`, `commission_base`, `commission_rate`, `commission_amount`, `vendor_settlement`, `settlement_id`, `settlement_status`, `payout_id`, `payout_status`, `realized_at`, `data_source`

---

## Frontend Extensions

### Booking Earnings

- **View Settlement** button on each booking row → opens drawer
- Existing expandable row waterfall **retained**
- **Settlement audit CSV** button (all vendors, full period)
- URL deep links: `/finance?tab=vendor-booking-earnings&period=day|month&reportDate=…&vendorId=…&bookingId=…`

### Daily Accrual

- Optional KPI: Platform-funded discount, Vendor-funded discount
- **View bookings** link per vendor → Booking Earnings pre-filtered

### Monthly Accrual

- Same funding KPI cards
- **Download reconciliation pack** → two files (not merged)

### Settlement Dashboard

- **Open in Booking Earnings** — loads settlement bookings via `GET /settlements/:id`, navigates with vendor + first booking

### Payout Management

- **Linked settlements** list in detail modal
- **Open Booking Earnings** button (vendor + payout month)

---

## New Reusable Components

| Component | Location |
|-----------|----------|
| `SettlementBreakdownDrawer` | `settlementAudit/SettlementBreakdownDrawer.tsx` |
| `SettlementExplanation` | `settlementAudit/SettlementExplanation.tsx` |
| `settlementAuditExport` (module) | `lib/finance/settlementAuditExport.ts` |

---

## Data Resolution Priority (Read Path)

1. `vendor_earnings.metadata.settlementSnapshot`
2. Flat keys in `vendor_earnings.metadata`
3. `wp_financial_meta` from `bookings.notes`
4. Legacy `settlement_preview` in metadata
5. `unavailable` → legacy banner + waterfall only

**Never** calls `compute-funding-aware-settlement` or discount engine at report time.

---

## Performance Considerations

| Change | Impact |
|--------|--------|
| Extra columns in existing earnings SQL | One query, no N+1 HTTP |
| JSON parse per booking line | In-process after fetch; same loop as fee breakdown |
| Funding KPI aggregate | +1 SUM query per accrual load |
| Settlement audit export | Full-period line build (same as report engine); no per-booking API |
| Drawer | Client-only; no extra fetch |

Pre-existing N+1 in fee breakdown enrichment **unchanged** (out of S3 scope).

Pagination behaviour **unchanged** (none on accrual/booking reports).

---

## Backward Compatibility

| Scenario | Behaviour |
|----------|-----------|
| Booking with S2 metadata | Full drawer + audit CSV columns |
| Legacy booking (no snapshot) | Amber banner: *Legacy booking. Settlement snapshot unavailable.* Waterfall + ledger columns still shown |
| Existing CSV exports | Unchanged headers and filenames |
| Accrual tables | Unchanged columns |
| Funding KPIs | Show ₹0 when no metadata in period |

No crashes on missing `metadata` column values (NULL-safe SQL + empty breakdown object).

---

## Testing Checklist

### Booking Earnings

- [ ] Load daily report — vendor summary unchanged
- [ ] Expand vendor — booking list loads
- [ ] Click **View Settlement** — drawer opens (~560px from right)
- [ ] S2 booking — all sections populated (Customer journey, Settlement, Funding, Policy, Status, Explanation)
- [ ] Legacy booking — legacy banner; waterfall values visible
- [ ] Export vendor summary CSV — same columns as before
- [ ] Export booking CSV — same columns as before
- [ ] Export **Settlement audit CSV** — new columns present
- [ ] Deep link from Daily Accrual — vendor + date pre-selected; drawer opens when `bookingId` set

### Daily Accrual

- [ ] Load report — existing columns unchanged
- [ ] Funding KPI cards show totals (or ₹0)
- [ ] **View bookings** navigates to Booking Earnings

### Monthly Accrual

- [ ] Funding KPI cards
- [ ] **Download reconciliation pack** downloads two CSV files

### Settlement Dashboard

- [ ] **Open in Booking Earnings** navigates correctly

### Payout Management

- [ ] Detail modal shows settlement IDs
- [ ] **Open Booking Earnings** works

### Backend

- [ ] `npm run build` in `backend/lambda` succeeds
- [ ] `npm run build` in `apps/admin-web` succeeds

---

## Known Limitations

1. **Policy stack/priority rules** — not fully persisted on snapshot; drawer shows derived labels from `winningOffer` / `policyVersion` where available; stack rule often `—`.
2. **Pre-S2 bookings** — no commission base / funding split in drawer (waterfall only).
3. **Reconciliation pack** — two sequential browser downloads (not a single ZIP) to avoid new dependencies.
4. **Settlement Dashboard** — uses first booking on settlement batch for deep link when multiple bookings exist.
5. **Funding KPIs** — sum only rows with JSON metadata; legacy earnings contribute ₹0 to funding cards.
6. **`bookings.financial_meta` column** — not selected (may not exist on all envs); fallback uses `notes` only.

---

## Future Enhancements

- Single ZIP reconciliation pack (optional `jszip` or server-side archive)
- Pagination on booking earnings for high-volume days
- Policy stack/priority display when persisted on snapshot
- Excel export sharing same row mapper as settlement audit CSV
- Vendor portal read-only settlement breakdown (reuse `SettlementBreakdownDrawer`)
- Data quality KPI: *bookings missing snapshot* count on Booking Earnings summary

---

## Related Documentation

- `docs/FINANCE_REPORTING_CURRENT_STATE.md` (S3 analysis baseline)
- `docs/FINANCE_REPORTING_UX_ANALYSIS.md`
- `docs/SETTLEMENT_REPORTING_REUSE_PLAN.md`
- `docs/FINANCE_EXPORT_ANALYSIS.md`
- `docs/FINANCE_REPORT_GAP_ANALYSIS.md`
- `docs/FINANCE_SETTLEMENT_INTEGRATION_IMPLEMENTATION.md` (S2 snapshot schema)
