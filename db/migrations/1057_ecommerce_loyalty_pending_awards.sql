-- Migration: 1057_ecommerce_loyalty_pending_awards.sql
-- Idempotent. Safe to run multiple times.
--
-- 1. New table: tracks deferred ecommerce loyalty awards
--    Points are inserted here when an order is delivered, then awarded lazily
--    after the return window passes with no return initiated.
-- 2. Upserts the buy_product loyalty_action_rule so all ecommerce products earn.
-- 3. Disables the incorrect action_sources rows that fired points at order creation.
-- 4. Adds wallet_amount_applied column to orders for wallet-at-checkout.

-- ── 1. Pending awards table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ecommerce_loyalty_pending_awards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL,
  customer_id   UUID        NOT NULL,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  action_name   TEXT        NOT NULL DEFAULT 'buy_product',
  award_after   TIMESTAMPTZ NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'awarded', 'cancelled')),
  awarded_at    TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ecommerce_loyalty_order UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_elpa_status_award_after
  ON ecommerce_loyalty_pending_awards (status, award_after)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_elpa_customer
  ON ecommerce_loyalty_pending_awards (customer_id);

-- ── 2. buy_product loyalty rule (all ecommerce products) ────────────────────
INSERT INTO loyalty_action_rules (
  action_name, action_category, user_type, points_type, points_value, base_amount,
  frequency_type, description, notes, is_active, priority
) VALUES (
  'buy_product', 'loyalty', 'customer', 'per_amount', 10, 1000,
  'unlimited',
  'Ecommerce purchase',
  '10 points per ₹1000 — all ecommerce products [1057]',
  true, 100
) ON CONFLICT (action_name) DO UPDATE SET
  is_active      = EXCLUDED.is_active,
  notes          = EXCLUDED.notes,
  updated_at     = NOW();

-- ── 3. Disable wrong action_sources (fired at order creation, pet-food only) ─
UPDATE action_sources
SET    enabled = false, updated_at = NOW()
WHERE  method = 'POST'
  AND  route_pattern IN ('/ecommerce/orders', '/orders')
  AND  action_name = 'purchase_pet_food';

-- ── 4. wallet_amount_applied column on orders ────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS wallet_amount_applied NUMERIC(12,2) NOT NULL DEFAULT 0;
