-- ============================================================================
-- MIGRATION 749: Canonical meal subscription architecture (P0)
-- ============================================================================
-- Adds:
--   - meal_subscription_deliveries (operational sessions)
--   - meal_subscription_payments
--   - Canonical columns on meal_subscriptions (nullable for legacy rows)
--   - delivery_tracking.subscription_delivery_id + updated XOR constraint
-- Does NOT remove legacy behavior or break ONE_TIME meal_orders.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) meal_subscriptions: relax / extend constraints; add canonical columns
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'meal_subscriptions'
  ) THEN
    -- Widen frequency for monthly canonical plans
    ALTER TABLE meal_subscriptions DROP CONSTRAINT IF EXISTS meal_subscriptions_frequency_check;
    ALTER TABLE meal_subscriptions ADD CONSTRAINT meal_subscriptions_frequency_check
      CHECK (
        frequency IS NULL OR frequency::text IN (
          'once_daily', 'twice_daily', 'alternate_days', 'weekly', 'monthly'
        )
      );

    -- Widen status for lifecycle (canonical + legacy)
    ALTER TABLE meal_subscriptions DROP CONSTRAINT IF EXISTS meal_subscriptions_status_check;
    ALTER TABLE meal_subscriptions ADD CONSTRAINT meal_subscriptions_status_check
      CHECK (
        status::text IN (
          'active', 'paused', 'cancelled', 'expired',
          'pending_payment', 'draft', 'completed'
        )
      );

    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS purchase_type TEXT;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS billing_cycle TEXT;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS total_sessions INTEGER;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS completed_sessions INTEGER DEFAULT 0;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS skipped_sessions INTEGER DEFAULT 0;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS remaining_sessions INTEGER;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS next_delivery_date DATE;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS pause_start DATE;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS pause_end DATE;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT false;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS delivery_schedule_json JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS dietary_snapshot JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS client_request_key VARCHAR(192);
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS session_horizon_generated_through DATE;
    ALTER TABLE meal_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    ALTER TABLE meal_subscriptions DROP CONSTRAINT IF EXISTS meal_subscriptions_client_request_key_key;
    ALTER TABLE meal_subscriptions ADD CONSTRAINT meal_subscriptions_client_request_key_key UNIQUE (client_request_key);

    ALTER TABLE meal_subscriptions DROP CONSTRAINT IF EXISTS meal_subscriptions_lifecycle_status_check;
    ALTER TABLE meal_subscriptions ADD CONSTRAINT meal_subscriptions_lifecycle_status_check
      CHECK (
        lifecycle_status IS NULL OR lifecycle_status IN (
          'draft', 'pending_payment', 'active', 'paused', 'cancelled', 'expired', 'completed'
        )
      );

    ALTER TABLE meal_subscriptions DROP CONSTRAINT IF EXISTS meal_subscriptions_purchase_type_check;
    ALTER TABLE meal_subscriptions ADD CONSTRAINT meal_subscriptions_purchase_type_check
      CHECK (
        purchase_type IS NULL OR purchase_type IN ('WEEKLY_PLAN', 'MONTHLY_PLAN')
      );

    COMMENT ON COLUMN meal_subscriptions.lifecycle_status IS 'Canonical lifecycle; NULL = row created before migration 749';
    COMMENT ON COLUMN meal_subscriptions.client_request_key IS 'Idempotency key for POST /meal/subscriptions';
    COMMENT ON COLUMN meal_subscriptions.session_horizon_generated_through IS 'Last delivery_date included when rolling session generator ran';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meal_subscriptions_customer_lifecycle
  ON meal_subscriptions (customer_id, lifecycle_status)
  WHERE lifecycle_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meal_subscriptions_vendor_next_delivery
  ON meal_subscriptions (vendor_id, next_delivery_date)
  WHERE lifecycle_status = 'active';

CREATE INDEX IF NOT EXISTS idx_meal_subscriptions_client_request_key
  ON meal_subscriptions (client_request_key)
  WHERE client_request_key IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) meal_subscription_deliveries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_subscription_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES meal_subscriptions(id) ON DELETE RESTRICT,
  session_number INTEGER NOT NULL,
  delivery_date DATE NOT NULL,
  delivery_time_slot JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  assigned_driver_id UUID,
  tracking_id UUID,
  proof_of_delivery JSONB,
  customer_notes TEXT,
  vendor_notes TEXT,
  skipped_reason TEXT,
  rescheduled_from UUID REFERENCES meal_subscription_deliveries(id) ON DELETE SET NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meal_subscription_deliveries_session_uniq UNIQUE (subscription_id, session_number),
  CONSTRAINT meal_subscription_deliveries_status_check CHECK (
    status IN (
      'scheduled',
      'preparing',
      'ready',
      'assigned',
      'out_for_delivery',
      'delivered',
      'skipped',
      'rescheduled',
      'cancelled',
      'failed'
    )
  )
);

-- Legacy gap-analysis tables used scheduled_date / delivery_status and omitted session_number.
-- CREATE TABLE IF NOT EXISTS leaves that shape in place; normalize before canonical indexes/constraints.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'meal_subscription_deliveries'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'meal_subscription_deliveries'
        AND column_name = 'scheduled_date'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'meal_subscription_deliveries'
        AND column_name = 'delivery_date'
    ) THEN
      ALTER TABLE meal_subscription_deliveries RENAME COLUMN scheduled_date TO delivery_date;
    END IF;

    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS session_number INTEGER;
    UPDATE meal_subscription_deliveries AS m
    SET session_number = sub.rn
    FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY subscription_id ORDER BY delivery_date NULLS LAST, created_at
        ) AS rn
      FROM meal_subscription_deliveries
    ) AS sub
    WHERE m.id = sub.id AND m.session_number IS NULL;

    UPDATE meal_subscription_deliveries SET session_number = 1 WHERE session_number IS NULL;
    ALTER TABLE meal_subscription_deliveries ALTER COLUMN session_number SET NOT NULL;

    ALTER TABLE meal_subscription_deliveries
      ADD COLUMN IF NOT EXISTS delivery_time_slot JSONB NOT NULL DEFAULT '{}'::jsonb;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'meal_subscription_deliveries'
        AND column_name = 'status'
    ) THEN
      ALTER TABLE meal_subscription_deliveries
        ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'scheduled';
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'meal_subscription_deliveries'
          AND column_name = 'delivery_status'
      ) THEN
        UPDATE meal_subscription_deliveries SET status = COALESCE(delivery_status, 'scheduled');
      END IF;
    END IF;

    UPDATE meal_subscription_deliveries SET status = CASE status
      WHEN 'pending' THEN 'scheduled'
      WHEN 'completed' THEN 'delivered'
      ELSE status
    END;

    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS assigned_driver_id UUID;
    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS tracking_id UUID;
    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS proof_of_delivery JSONB;
    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS customer_notes TEXT;
    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS vendor_notes TEXT;
    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS skipped_reason TEXT;
    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS rescheduled_from UUID;
    ALTER TABLE meal_subscription_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'meal_subscription_deliveries_session_uniq'
    ) THEN
      ALTER TABLE meal_subscription_deliveries
        ADD CONSTRAINT meal_subscription_deliveries_session_uniq UNIQUE (subscription_id, session_number);
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'meal_subscription_deliveries_status_check'
    ) THEN
      BEGIN
        ALTER TABLE meal_subscription_deliveries ADD CONSTRAINT meal_subscription_deliveries_status_check CHECK (
          status IN (
            'scheduled',
            'preparing',
            'ready',
            'assigned',
            'out_for_delivery',
            'delivered',
            'skipped',
            'rescheduled',
            'cancelled',
            'failed'
          )
        );
      EXCEPTION
        WHEN check_violation THEN
          RAISE NOTICE 'meal_subscription_deliveries_status_check skipped: %', SQLERRM;
      END;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_meal_sub_deliveries_subscription_date
  ON meal_subscription_deliveries (subscription_id, delivery_date);

CREATE INDEX IF NOT EXISTS idx_meal_sub_deliveries_status_date
  ON meal_subscription_deliveries (status, delivery_date);

COMMENT ON TABLE meal_subscription_deliveries IS 'Canonical per-delivery operational sessions for meal subscriptions';

-- Link sessions → delivery_tracking rows (tracking_id filled when logistics starts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meal_subscription_deliveries_tracking_fk'
  ) THEN
    ALTER TABLE meal_subscription_deliveries
      ADD CONSTRAINT meal_subscription_deliveries_tracking_fk
      FOREIGN KEY (tracking_id) REFERENCES delivery_tracking(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'meal_subscription_deliveries_tracking_fk: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- 3) meal_subscription_payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meal_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES meal_subscriptions(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  provider VARCHAR(32) NOT NULL DEFAULT 'razorpay',
  provider_payment_id VARCHAR(255),
  provider_order_id VARCHAR(255),
  purpose VARCHAR(32) NOT NULL DEFAULT 'initial',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meal_subscription_payments_status_check CHECK (
    status IN ('pending', 'paid', 'failed', 'refunded')
  ),
  CONSTRAINT meal_subscription_payments_purpose_check CHECK (
    purpose IN ('initial', 'renewal', 'adjustment')
  )
);

CREATE INDEX IF NOT EXISTS idx_meal_sub_payments_subscription
  ON meal_subscription_payments (subscription_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) delivery_tracking: subscription_delivery_id + constraint
-- ---------------------------------------------------------------------------
ALTER TABLE delivery_tracking ADD COLUMN IF NOT EXISTS subscription_delivery_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_tracking_subscription_delivery_fk'
  ) THEN
    ALTER TABLE delivery_tracking
      ADD CONSTRAINT delivery_tracking_subscription_delivery_fk
      FOREIGN KEY (subscription_delivery_id) REFERENCES meal_subscription_deliveries(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'delivery_tracking_subscription_delivery_fk: %', SQLERRM;
END $$;

ALTER TABLE delivery_tracking DROP CONSTRAINT IF EXISTS delivery_tracking_order_check;
ALTER TABLE delivery_tracking ADD CONSTRAINT delivery_tracking_order_check CHECK (
  (
    pharmacy_order_id IS NOT NULL
    AND meal_order_id IS NULL
    AND subscription_delivery_id IS NULL
  )
  OR (
    pharmacy_order_id IS NULL
    AND meal_order_id IS NOT NULL
    AND subscription_delivery_id IS NULL
  )
  OR (
    pharmacy_order_id IS NULL
    AND meal_order_id IS NULL
    AND subscription_delivery_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_delivery_tracking_subscription_delivery
  ON delivery_tracking (subscription_delivery_id)
  WHERE subscription_delivery_id IS NOT NULL;
