-- 1105: Pause customer loyalty earn triggers and zero loyalty point counters.
-- Idempotent. Additive (UPDATE only). Does not drop tables or delete history rows.
-- Customer INR wallets are NOT changed here — use scripts/zero-customer-wallets.js.

-- 1) Disable all action_sources (Admin can re-enable later; code gate still blocks customer earn).
UPDATE action_sources
SET enabled = false,
    updated_at = NOW()
WHERE enabled = true;

-- 2) Cancel leftover shop pending awards so Rewards GET cannot grant them.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ecommerce_loyalty_pending_awards'
  ) THEN
    UPDATE ecommerce_loyalty_pending_awards
    SET status = 'cancelled',
        cancelled_at = NOW(),
        cancel_reason = COALESCE(cancel_reason, '1105_loyalty_pause')
    WHERE status = 'pending';
  END IF;
END $$;

-- 3) Zero customer loyalty counters (available + lifetime earned/redeemed).
UPDATE customer_loyalty_points
SET total_points = 0,
    lifetime_points_earned = 0,
    lifetime_points_redeemed = 0,
    updated_at = NOW()
WHERE COALESCE(total_points, 0) <> 0
   OR COALESCE(lifetime_points_earned, 0) <> 0
   OR COALESCE(lifetime_points_redeemed, 0) <> 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'customer_loyalty_points'
      AND column_name = 'qualifying_purchase_count'
  ) THEN
    UPDATE customer_loyalty_points
    SET qualifying_purchase_count = 0,
        updated_at = NOW()
    WHERE COALESCE(qualifying_purchase_count, 0) <> 0;
  END IF;
END $$;
