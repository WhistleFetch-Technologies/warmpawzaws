-- ============================================================================
-- MIGRATION 700: Ensure products.status defaults to 'pending' and protect visibility
-- ============================================================================
-- - Adds products.status column if missing
-- - Backfills NULL statuses to 'pending'
-- - Sets default to 'pending' for new rows
-- - Optionally ensures non-active products are not visible (is_active = false)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'status'
  ) THEN
    ALTER TABLE products ADD COLUMN status TEXT;
  END IF;
END $$;

-- Backfill to 'pending' where missing
UPDATE products SET status = 'pending' WHERE status IS NULL;

-- Default new rows to pending
ALTER TABLE products ALTER COLUMN status SET DEFAULT 'pending';

-- Ensure non-active items are not visible until approval
UPDATE products SET is_active = false WHERE COALESCE(status, 'pending') <> 'active';

