-- ============================================================================
-- MIGRATION 1086: one vendor_earnings row per booking_id
-- ============================================================================
-- Duplicate ledger rows (concurrent complete paths) inflated package earnings.
-- Keep the oldest row per booking, reverse extras from vendor totals, then unique index.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'vendor_earnings'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'pending_payout'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vendors'
      AND column_name = 'total_earnings'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        vendor_id,
        amount,
        status,
        ROW_NUMBER() OVER (
          PARTITION BY booking_id
          ORDER BY created_at ASC NULLS LAST, id ASC
        ) AS rn
      FROM vendor_earnings
    ),
    dupes AS (
      SELECT * FROM ranked WHERE rn > 1
    ),
    vendor_delta AS (
      SELECT
        vendor_id,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_delta,
        COALESCE(SUM(amount), 0) AS total_delta
      FROM dupes
      GROUP BY vendor_id
    )
    UPDATE vendors v
    SET
      pending_payout = GREATEST(COALESCE(v.pending_payout, 0) - d.pending_delta, 0),
      total_earnings = GREATEST(COALESCE(v.total_earnings, 0) - d.total_delta, 0),
      updated_at = NOW()
    FROM vendor_delta d
    WHERE v.id = d.vendor_id;
  END IF;

  DELETE FROM vendor_earnings ve
  WHERE ve.id IN (
    SELECT id FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY booking_id
          ORDER BY created_at ASC NULLS LAST, id ASC
        ) AS rn
      FROM vendor_earnings
    ) x
    WHERE rn > 1
  );
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendor_earnings_booking_id_unique
  ON vendor_earnings (booking_id);
