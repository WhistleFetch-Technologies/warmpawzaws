# P7 — Payout windows, completion reports and reconciliation

- **Owner:** Abhi (Bindu reviews)
- **Estimate:** 4 days
- **Depends on:** P6a (commission snapshots)
- **Gate:** G7
- **Reference:** footer "Completion Report" in [mockups/07-vendor-kanban.jpg](../mockups/07-vendor-kanban.jpg)

## Goal

For each payout window (per the link's frequency), the vendor generates and submits a completion report from confirmed policies; admin reconciles it against the system-expected amount on the Dashboard, sends reminders and records receipts.

## Current state (branch)

`domain/payout-periods.ts`, `domain/payout-ledger.ts`, `services/insurance-payouts.service.ts` compute windows and expected amounts live from issued policies and in-force terms; reminders insert a vendor `notifications` row; receipts upsert `insurance_payout_periods`.

## Tasks

### Backend

- [ ] Ledger source switches from live pricing to `insurance_commission_snapshots` (confirmed policies) + clawback rows (free-look cancellations land in the window of the cancellation date as negative lines).
- [ ] Migration: `insurance_completion_reports`; `insurance_payout_receipts` (partial payments, TDS, UTR); link periods to reports.
- [ ] Vendor: `GET /vendor/insurance/payout-windows` (closed windows with expected lines), `POST /payout-windows/report` (generate draft, then submit; lock lines on submit).
- [ ] Admin: `GET /completion-reports`, `POST /completion-reports/:id/accept|dispute` (note required on dispute); expected vs reported variance.
- [ ] Reminders: keep manual; enable the scheduled trigger (`trigger='scheduled'`) on reminder days for due / grace / overdue windows with no receipt.
- [ ] Receipts: amount, TDS, UTR, date; window paid when received + TDS ≥ expected.
- [ ] Export (xlsx): applications and payout windows (pattern: WPay export, row cap).
- [ ] Frequency change on a link: close the current window at the change date so recorded receipts are not orphaned.

### Vendor-web

- [ ] Reports tab + `CompletionReportBar` on the Kanban: window picker, lines, totals, Review & Submit; CSV download (EarningsAnalytics pattern).

### Admin-web (Dashboard tab)

- [ ] `PayoutWindowsTable` with report status and variance; `CompletionReportDetail`; `RecordReceiptDialog` with TDS + UTR; export buttons.

## Tests

- Extend `payout-ledger.test.ts`: snapshots, clawbacks, partial receipts with TDS, frequency change mid-window.
- Report lock: submitted report lines cannot change; re-generate only while draft.
- Variance: matching, under-reported, over-reported; dispute flow.
- Scheduled reminder idempotent per window per day (IST).

## Exit (G7)

FF-16, FF-17 pass on dev.
