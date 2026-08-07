-- Migration 1097: Cancel WAPPT appointment-fee vendor_earnings (platform-retained fees)
-- WAPPT appointment fees stay with platform; vendor payout is Pay Bill settlement only.
-- SAFETY: only pending/processing/in_progress rows on warmpawz_appointments bookings.

-- Dry-run (dev sign-off before apply on shared RDS):
-- SELECT ve.id, ve.vendor_id, ve.booking_id, ve.amount, ve.status, b.commerce_mode
-- FROM vendor_earnings ve
-- JOIN bookings b ON b.id = ve.booking_id
-- WHERE LOWER(COALESCE(b.commerce_mode, '')) = 'warmpawz_appointments'
--   AND ve.status IN ('pending', 'processing', 'in_progress')
--   AND COALESCE(ve.amount, 0) > 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_earnings'
  ) THEN
    RAISE NOTICE 'vendor_earnings table missing — skipping 1097';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookings'
  ) THEN
    RAISE NOTICE 'bookings table missing — skipping 1097';
    RETURN;
  END IF;
END $$;

WITH cancelled AS (
  UPDATE vendor_earnings ve
  SET status = 'cancelled',
      updated_at = NOW()
  FROM bookings b
  WHERE b.id = ve.booking_id
    AND LOWER(COALESCE(b.commerce_mode, '')) = 'warmpawz_appointments'
    AND ve.status IN ('pending', 'processing', 'in_progress')
    AND COALESCE(ve.amount, 0) > 0
  RETURNING ve.vendor_id, ve.amount
),
totals AS (
  SELECT vendor_id, COALESCE(SUM(amount), 0) AS total
  FROM cancelled
  GROUP BY vendor_id
)
UPDATE vendors v
SET pending_payout = GREATEST(0, COALESCE(v.pending_payout, 0) - t.total),
    total_earnings = GREATEST(0, COALESCE(v.total_earnings, 0) - t.total),
    updated_at = NOW()
FROM totals t
WHERE v.id = t.vendor_id;

COMMENT ON TABLE vendor_earnings IS 'Per-booking vendor accruals; WAPPT (warmpawz_appointments) appointment fees are platform-retained and must not accrue here.';
