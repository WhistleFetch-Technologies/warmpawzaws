# Settlement Reporting — Reuse Plan

**Phase:** Analysis Only  
**Date:** 2026-07-06  
**Principle:** Extend existing reports and services. No duplicate settlement math. Prefer ledger reads over recomputation.

---

## Reuse Inventory

### Backend — Finance S2 (settlement truth)

| Asset | Path | Reuse for reporting |
|-------|------|---------------------|
| `SettlementSnapshot` type | `finance/settlement/types.ts` | Response DTO for booking breakdown API |
| `extractSettlementSnapshotFromBooking()` | `finance/settlement/persist-settlement-snapshot.ts` | Parse from booking notes / financial_meta |
| `settlementSnapshotToVendorEarningsMetadata()` | same | Already maps snapshot → ledger metadata; invert for read path |
| `parseBookingFinancialMeta()` | `discount-engine/settlement/settlement-hook-bridge.ts` | Read wp_financial_meta from booking |
| `SETTLEMENT_SNAPSHOT_META_KEY` | `persist-settlement-snapshot.ts` | Consistent JSON key |

**Do not reuse for reports:** `compute-funding-aware-settlement.ts`, `build-settlement-snapshot.ts` — these **recompute**; reports must read **persisted** snapshot only.

### Backend — Report engines (extend, don't fork)

| Asset | Path | Extension point |
|-------|------|-----------------|
| `vendor-booking-earnings-report.ts` | `utils/vendor-booking-earnings-report.ts` | Add `ve.metadata`, `ve.settlement_id`, `ve.payout_id` to SQL; map to breakdown fields |
| `buildVendorBookingEarningsLine()` | same | Attach `settlementBreakdown` from metadata parse (no recompute) |
| `admin-vendor-booking-earnings.ts` | `endpoints/admin/endpoints/admin-vendor-booking-earnings.ts` | Extend CSV headers + cells |
| `vendor-accrual-fee-breakdown.ts` | `utils/vendor-accrual-fee-breakdown.ts` | Keep for customer-paid side; do not merge with settlement snapshot |
| `admin-vendor-daily-accrual.ts` | `endpoints/admin/endpoints/admin-vendor-daily-accrual.ts` | Optional aggregate query on metadata for KPI cards |

### Backend — Settlement batch (linkage only)

| Asset | Path | Reuse |
|-------|------|-------|
| `GET /settlements/:id` | `settlements.ts` | Booking list for batch; link target |
| `aggregate-vendor-earnings-batch.ts` | `finance/settlement/` | Batch job only — not for report reads |
| Settlement list fields | `admin-advanced.ts` | Batch ID, status for cross-link |

### Frontend — Components (extend)

| Asset | Path | Extension |
|-------|------|-------------|
| `VendorBookingEarningsReport.tsx` | `apps/admin-web/components/admin/finance/` | Enhanced expanded panel; optional drawer component |
| `VendorDailyAccrualReport.tsx` | same | Deep link button; optional KPI cards |
| `VendorMonthlyAccrualReport.tsx` | same | Same KPI pattern as daily |
| `SettlementDashboard.tsx` | `settlements/` | “View bookings” link |
| `PayoutManagement.tsx` | `payoutManagement/` | Show linked settlement IDs in modal |
| Shared `moneyCell`, period pickers | Booking Earnings | Extract breakdown sub-component if needed |

**New shared component (future):** `SettlementBreakdownPanel.tsx` — read-only display of `SettlementSnapshot` fields; used in expanded row + drawer + optional export preview. Single source for labels/formatting.

### Database — Read paths

| Table / column | Use |
|----------------|-----|
| `vendor_earnings.metadata` | Primary breakdown source post-S2 |
| `vendor_earnings.settlement_id` | Link to batch |
| `vendor_earnings.payout_id` | Link to payout |
| `bookings.notes` / `financial_meta` | Fallback when metadata empty (pre-S2 bookings) |
| `settlements` | Batch status, period |
| `payouts` | Payout status |
| `vendor_daily_accrual` | Unchanged for accrual; optional metadata aggregate via JOIN |

**Do not add columns to `vendor_daily_accrual`** for breakdown — keep materialized table lean; aggregate at query time from `vendor_earnings.metadata` if KPIs needed.

### CSV generators (extend)

| Generator | Location | Action |
|-----------|----------|--------|
| `BOOKING_CSV_HEADERS` | `admin-vendor-booking-earnings.ts` | Append optional settlement columns |
| `bookingLineCsvCells()` | same | Map from metadata |
| Accrual CSV | `admin-vendor-daily-accrual.ts` | No booking columns; optional 2 aggregate columns at most |
| Client CSV | Settlement/Payout components | Add settlement_id column only |

---

## Proposed API Changes (Future — Not Implemented)

### Option A — Extend existing booking earnings API (Recommended)

**Route:** `GET /admin/finance/vendor-booking-earnings` (unchanged path)

Add to each booking line in response:

```typescript
settlementBreakdown?: {
  vendorBasePrice: number;
  commissionBase: number;
  commissionRate: number;
  commissionAmount: number;
  vendorSettlement: number;
  platformDiscount: number;
  vendorDiscount: number;
  winningOfferType: string | null;
  winningOfferName: string | null;
  fundingType: 'PLATFORM' | 'VENDOR' | 'SHARED' | null;
  fundingSummary: FundingSummarySnapshot;
  tierName: string | null;
  tierSource: string;
  subscriptionActive: boolean;
  policyFingerprint: string | null;
  snapshotVersion: string | null;
  settlementId: string | null;
  payoutId: string | null;
  settlementStatus: string | null;  // from settlements join
  dataSource: 'ledger_metadata' | 'booking_meta' | 'unavailable';
};
```

**SQL change:** Add to `fetchRawEarningsRowsForIstRange`:

```sql
ve.metadata,
ve.settlement_id::text,
ve.payout_id::text,
b.notes,
b.financial_meta
```

Optional LEFT JOIN `settlements s ON s.id = ve.settlement_id` for status.

**Parse in:** `buildVendorBookingEarningsLine()` — call existing `extractSettlementSnapshotFromBooking()` or read flat keys from `ve.metadata`.

**Why reuse:** Same pagination/filter model; UI already calls this endpoint; export shares same loader.

### Option B — Dedicated breakdown endpoint (Defer)

**Route:** `GET /admin/finance/bookings/:bookingId/settlement-breakdown`

Use only if:

- Booking earnings list becomes too heavy with metadata parse
- Other consumers (vendor portal, support) need breakdown without full report

**Not recommended initially** — adds second API and N+1 if UI fetches per booking on expand.

### Option C — Accrual funding KPI endpoint (Optional)

**Route:** `GET /admin/finance/vendor-daily-accrual/funding-summary?reportDate=`

Single aggregate query:

```sql
SELECT
  SUM((metadata->'fundingSummary'->>'platformPaid')::numeric) AS platform_discount_total,
  SUM((metadata->'fundingSummary'->>'vendorPaid')::numeric) AS vendor_discount_total
FROM vendor_earnings
WHERE realized_at >= ... AND realized_at < ...
  AND status != 'cancelled';
```

Reuse IST bounds from `vendor-accrual-ist.ts`.

---

## Data Resolution Priority (Read Path)

When building breakdown for a booking line:

```
1. vendor_earnings.metadata.settlementSnapshot     ← authoritative (S2 ledger)
2. vendor_earnings.metadata flat keys              ← partial fallback
3. wp_financial_meta from booking (notes/financial_meta)  ← checkout-time snapshot
4. discount-engine settlement_preview in meta      ← legacy authoritative mode
5. unavailable — show "Legacy booking (no snapshot)" + existing waterfall only
```

**Never recompute** commission base in report layer.

---

## Performance Strategy

| Concern | Mitigation |
|---------|------------|
| JSON parse per row | Parse in single pass after SQL fetch; lazy-parse only expanded bookings if list > 500 rows |
| N+1 fee breakdown (existing) | Keep; separate from metadata read |
| N+1 breakdown fetch | Avoid Option B on initial load; include metadata in main SQL |
| Large CSV export | Stream CSV; same columns as today + optional settlement columns |
| Accrual KPI aggregate | One extra SUM query on `vendor_earnings` — not per-vendor |

### Lazy-load pattern (if needed at scale)

Initial booking list: ledger + waterfall only (current behavior).

On expand: if `settlementBreakdown` absent from list payload, fetch single booking — **only if** list payload omits metadata for performance. Prefer including metadata in main query first.

---

## Frontend Reuse Flow

```
VendorBookingEarningsReport
  └── loadVendorSummaries()          [unchanged API]
  └── loadBookings(vendorId)         [extended response]
        └── expanded row
              └── <SettlementBreakdownPanel snapshot={b.settlementBreakdown} />
        └── optional drawer
              └── same panel + settlement/payout links

VendorDailyAccrualReport
  └── optional loadFundingKpis()     [new lightweight API or totals extension]
  └── row action → navigateToBookingEarnings(vendorId, date)

export CSV
  └── same endpoint with ?includeSettlementDetail=1  [optional query flag]
```

---

## What NOT to Duplicate

| Avoid | Use instead |
|-------|-------------|
| New settlement preview page | Booking Earnings expanded row |
| Recompute funding in report utils | Read `vendor_earnings.metadata` |
| Second booking earnings SQL file | Extend `fetchRawEarningsRowsForIstRange` |
| Excel export from scratch | Extend CSV first; Excel later via same row mapper |
| Legacy `vendor_settlements` in reports | Live `settlements` + `vendor_earnings` |
| Discount engine preview at report time | Persisted snapshot only |

---

## Implementation Phases (Reference — Out of Scope Here)

| Phase | Scope | Reuse |
|-------|-------|-------|
| P1 | Booking earnings API + expanded UI | `vendor-booking-earnings-report.ts`, `SettlementBreakdownPanel` |
| P2 | Booking CSV export columns | `BOOKING_CSV_HEADERS` |
| P3 | Accrual funding KPI cards | Optional aggregate on `vendor_earnings.metadata` |
| P4 | Deep links + settlement/payout cross-refs | Existing nav + query params |
| P5 | Excel (if requested) | Same row mapper as CSV |

---

## Related Documentation

- `docs/FINANCE_REPORTING_CURRENT_STATE.md`
- `docs/FINANCE_REPORTING_UX_ANALYSIS.md`
- `docs/FINANCE_EXPORT_ANALYSIS.md`
- `docs/FINANCE_SETTLEMENT_INTEGRATION_IMPLEMENTATION.md`
