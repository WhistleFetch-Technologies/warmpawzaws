-- ============================================================================
-- MIGRATION 1080: Warmpawz Pay Phase 1 schema foundation
-- ============================================================================
-- Purpose: Bounded-context database foundation for Warmpawz Pay (M1)
-- References: WARMPAWZ_PAY_PHASE1_SCHEMA_ANALYSIS.md,
--             WARMPAWZ_PAY_PHASE1_IMPLEMENTATION_PLAN.md,
--             WARMPAWZ_PAY_PHASE1_IMPACT_ANALYSIS.md,
--             WARMPAWZ_PAY_PHASE1_SCHEMA_VERIFICATION.md
-- Idempotent: safe to re-run
-- Additive only: no DROP TABLE/COLUMN, no TRUNCATE, no data mutation
-- ============================================================================

-- ============================================================================
-- PHASE 1 — SCHEMA CHANGES (columns, table, constraints)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 1: vendors — eligibility flags
-- ----------------------------------------------------------------------------

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS pay_bill_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS bank_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- Step 2: payments — bounded-context hub columns
-- ----------------------------------------------------------------------------

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_source TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(12, 2);

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- Step 3: warmpawz_pay_vendor_catalog — visibility-only publishing catalogue
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS warmpawz_pay_vendor_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL,
    publish_status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'warmpawz_pay_vendor_catalog'::regclass
      AND conname = 'warmpawz_pay_vendor_catalog_publish_status_check'
  ) THEN
    ALTER TABLE warmpawz_pay_vendor_catalog
      ADD CONSTRAINT warmpawz_pay_vendor_catalog_publish_status_check
      CHECK (publish_status IN ('draft', 'published'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warmpawz_pay_vendor_catalog_vendor_id_fkey'
  ) THEN
    ALTER TABLE warmpawz_pay_vendor_catalog
      ADD CONSTRAINT warmpawz_pay_vendor_catalog_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Step 4: catalogue indexes
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_wpay_catalog_vendor_id
  ON warmpawz_pay_vendor_catalog (vendor_id);

CREATE INDEX IF NOT EXISTS idx_wpay_catalog_published
  ON warmpawz_pay_vendor_catalog (vendor_id)
  WHERE publish_status = 'published';

-- ----------------------------------------------------------------------------
-- Step 5: promotion_usages — payment linkage
-- ----------------------------------------------------------------------------

ALTER TABLE promotion_usages
  ADD COLUMN IF NOT EXISTS payment_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promotion_usages_payment_id_fkey'
  ) THEN
    ALTER TABLE promotion_usages
      ADD CONSTRAINT promotion_usages_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Step 6: coupon_usages — payment linkage + discount parity
-- ----------------------------------------------------------------------------

ALTER TABLE coupon_usages
  ADD COLUMN IF NOT EXISTS payment_id UUID;

ALTER TABLE coupon_usages
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coupon_usages_payment_id_fkey'
  ) THEN
    ALTER TABLE coupon_usages
      ADD CONSTRAINT coupon_usages_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Step 7: transactions — extend transaction_category CHECK (append warmpawz_pay)
-- Preserves: booking, order, subscription, wallet, payout, other
-- Does NOT modify: payments.payment_status, settlements.settlement_status, vendors.status
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  constraint_rec RECORD;
  already_extended BOOLEAN := FALSE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transactions'
  ) THEN
    RAISE NOTICE '1080: transactions table absent — skipping transaction_category CHECK extension';
    RETURN;
  END IF;

  FOR constraint_rec IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%transaction_category%'
  LOOP
    IF constraint_rec.def LIKE '%warmpawz_pay%' THEN
      already_extended := TRUE;
    ELSE
      EXECUTE format(
        'ALTER TABLE public.transactions DROP CONSTRAINT %I',
        constraint_rec.conname
      );
      RAISE NOTICE '1080: dropped transaction_category CHECK % for extension',
        constraint_rec.conname;
    END IF;
  END LOOP;

  IF already_extended THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.transactions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%transaction_category%'
      AND pg_get_constraintdef(oid) LIKE '%warmpawz_pay%'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_transaction_category_check
      CHECK (transaction_category IN (
        'booking',
        'order',
        'subscription',
        'wallet',
        'payout',
        'other',
        'warmpawz_pay'
      ));
    RAISE NOTICE '1080: added transactions_transaction_category_check with warmpawz_pay';
  END IF;
END $$;

-- ============================================================================
-- PHASE 2 — INDEXES (Warmpawz Pay partial / unique indexes only)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 8: payments — Warmpawz Pay partial indexes
-- Retains existing idx_payment_idempotency (global) — not modified
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_payments_wpay_customer_date
  ON payments (customer_id, created_at DESC)
  WHERE payment_source = 'warmpawz_pay';

CREATE INDEX IF NOT EXISTS idx_payments_wpay_vendor_date
  ON payments (vendor_id, created_at DESC)
  WHERE payment_source = 'warmpawz_pay';

CREATE INDEX IF NOT EXISTS idx_payments_wpay_pending
  ON payments (created_at)
  WHERE payment_source = 'warmpawz_pay' AND payment_status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_wpay_idempotency
  ON payments (customer_id, idempotency_key)
  WHERE payment_source = 'warmpawz_pay' AND idempotency_key IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Step 9: settlements — idempotent accrual per Warmpawz Pay payment
-- Requires settlements.order_type (migration 213) and settlements.payment_id (020)
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_wpay_payment_unique
  ON settlements (payment_id)
  WHERE order_type = 'warmpawz_pay' AND payment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Step 10: promotion_usages — payment lookup + idempotency
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_promotion_usages_payment_id
  ON promotion_usages (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_promotion_usages_wpay_unique
  ON promotion_usages (payment_id, promotion_type)
  WHERE payment_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- Step 11: coupon_usages — payment lookup + idempotency
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_coupon_usages_payment_id
  ON coupon_usages (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usages_wpay_unique
  ON coupon_usages (payment_id)
  WHERE payment_id IS NOT NULL;

-- ============================================================================
-- PHASE 3 — COMMENTS & VALIDATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Step 12: comments (new objects only — does not overwrite existing table comments)
-- ----------------------------------------------------------------------------

COMMENT ON TABLE warmpawz_pay_vendor_catalog IS
  'Warmpawz Pay vendor publishing catalogue — visibility only. Admin controls which vendors appear in the customer Pay Bill list. No pricing, discount, or promotion columns.';

COMMENT ON COLUMN warmpawz_pay_vendor_catalog.vendor_id IS
  'One catalogue row per vendor. Customer visibility also requires vendors.pay_bill_enabled, vendors.bank_verified, and vendors.status = active.';

COMMENT ON COLUMN warmpawz_pay_vendor_catalog.publish_status IS
  'Publishing state: draft (hidden) or published (eligible for customer list when vendor flags satisfied).';

COMMENT ON COLUMN warmpawz_pay_vendor_catalog.published_at IS
  'Timestamp when publish_status was set to published.';

COMMENT ON COLUMN warmpawz_pay_vendor_catalog.created_by IS
  'Admin user UUID who added the vendor to the catalogue (no FK in Phase 1).';

COMMENT ON COLUMN payments.payment_source IS
  'Bounded-context discriminator. Warmpawz Pay inserts must set warmpawz_pay explicitly. Nullable in M1 for legacy rows.';

COMMENT ON COLUMN payments.original_amount IS
  'Pre-discount bill amount for Warmpawz Pay and other contexts that track gross before discount.';

COMMENT ON COLUMN payments.metadata IS
  'JSONB context payload (e.g. promo snapshot, quote reference). Not a substitute for promotion_usages.';

COMMENT ON COLUMN vendors.pay_bill_enabled IS
  'When true, vendor is eligible for Warmpawz Pay Bill product (requires bank_verified and status active).';

COMMENT ON COLUMN vendors.bank_verified IS
  'When true, vendor bank account is verified for payouts and Warmpawz Pay eligibility.';

COMMENT ON COLUMN promotion_usages.payment_id IS
  'Warmpawz Pay payment linkage for Promotion Engine V2 async usage commit. NULL for booking/order flows.';

COMMENT ON COLUMN coupon_usages.payment_id IS
  'Warmpawz Pay payment linkage for coupon usage commit. NULL for booking/order flows.';

COMMENT ON COLUMN coupon_usages.discount_amount IS
  'Discount amount applied for this coupon usage (environment parity column).';

-- ----------------------------------------------------------------------------
-- Post-apply validation (NOTICE only — idempotent re-runs stay green)
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  missing_count INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'payment_source'
  ) THEN
    missing_count := missing_count + 1;
    RAISE WARNING '1080 validation: payments.payment_source missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'metadata'
  ) THEN
    missing_count := missing_count + 1;
    RAISE WARNING '1080 validation: payments.metadata missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'warmpawz_pay_vendor_catalog'
  ) THEN
    missing_count := missing_count + 1;
    RAISE WARNING '1080 validation: warmpawz_pay_vendor_catalog table missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_payments_wpay_idempotency'
  ) THEN
    missing_count := missing_count + 1;
    RAISE WARNING '1080 validation: idx_payments_wpay_idempotency missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_settlements_wpay_payment_unique'
  ) THEN
    missing_count := missing_count + 1;
    RAISE WARNING '1080 validation: idx_settlements_wpay_payment_unique missing';
  END IF;

  IF missing_count = 0 THEN
    RAISE NOTICE '1080 validation: Warmpawz Pay Phase 1 schema objects present';
  ELSE
    RAISE WARNING '1080 validation: % check(s) failed — review migration output', missing_count;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION 1080 COMPLETE
-- ============================================================================
