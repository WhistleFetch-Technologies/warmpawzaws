-- ============================================================================
-- MIGRATION 732: vendor_daily_accrual — IST calendar-day snapshot from vendor_earnings
-- ============================================================================
-- Materialized per (report_date, vendor_id) for Admin finance reports.
-- report_date is the calendar date in Asia/Kolkata (not UTC date).
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_daily_accrual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  gross_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  earnings_line_count INTEGER NOT NULL DEFAULT 0,
  missing_earnings_booking_count INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (report_date, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_daily_accrual_report_date ON vendor_daily_accrual (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_daily_accrual_vendor_id ON vendor_daily_accrual (vendor_id);

COMMENT ON TABLE vendor_daily_accrual IS 'Per-vendor accrual for calendar day in Asia/Kolkata; sums vendor_earnings by realized_at in [day 00:00, next day 00:00) IST.';
COMMENT ON COLUMN vendor_daily_accrual.missing_earnings_booking_count IS 'Completed bookings that day (IST via completed_at) with no vendor_earnings row.';
