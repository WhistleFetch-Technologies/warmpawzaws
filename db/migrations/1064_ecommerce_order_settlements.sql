-- ============================================================================
-- MIGRATION 1064: E-commerce batch settlement ledger
-- ============================================================================
-- Replaces instant per-order Razorpay Route transfers for e-commerce orders.
-- One ledger row is written per paid order (at payment-verify time). A periodic
-- batch job (backend/lambda/src/jobs/ecommerce-settlement-processor.ts) groups
-- pending rows by vendor + period into a settlement batch and triggers a single
-- RazorpayX payout per vendor per batch — this is what allows WarmPawz to fund
-- admin-promo subsidies (a single order can have negative platform net; the
-- vendor is still paid as if full price) out of the pooled commission across
-- many orders, which a single-order transfer cannot do.
--
-- Additive only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ecommerce_settlement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    order_count INTEGER NOT NULL DEFAULT 0,
    gross_merchandise_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_vendor_payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_platform_net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'paid', 'failed')),
    razorpay_payout_id TEXT,
    failure_reason TEXT,

    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecommerce_order_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

    -- Inputs (snapshot at settlement time — never recomputed after the fact)
    merchandise_value NUMERIC(12, 2) NOT NULL,      -- P: original GST-inclusive catalog price x qty
    taxable_value NUMERIC(12, 2) NOT NULL,          -- T = P / (1 + gst%/100)
    gst_amount NUMERIC(12, 2) NOT NULL,             -- G = P - T (informational)
    commission_rate NUMERIC(5, 2) NOT NULL,
    commission_amount NUMERIC(12, 2) NOT NULL,      -- Comm = T * rate/100, always on original T

    promotion_source TEXT,                          -- 'vendor' | 'admin' | NULL
    promotion_id UUID,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- D

    shipping_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- S (never enters vendor/platform goods math)

    -- Outputs
    vendor_payout_amount NUMERIC(12, 2) NOT NULL,   -- see ecommerce-settlement-calculator.ts
    platform_net_amount NUMERIC(12, 2) NOT NULL,    -- can be negative (admin-promo subsidy)

    status TEXT NOT NULL DEFAULT 'pending_batch' CHECK (status IN ('pending_batch', 'batched', 'paid', 'failed')),
    settlement_batch_id UUID REFERENCES ecommerce_settlement_batches(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ecommerce_order_settlements_order ON ecommerce_order_settlements(order_id);
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_settlements_vendor_status ON ecommerce_order_settlements(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_ecommerce_order_settlements_batch ON ecommerce_order_settlements(settlement_batch_id);

CREATE INDEX IF NOT EXISTS idx_ecommerce_settlement_batches_vendor ON ecommerce_settlement_batches(vendor_id, status);

COMMENT ON TABLE ecommerce_order_settlements IS
  'Per-order settlement ledger row, written once at payment-verify time. Reconciliation invariant: merchandise_value - discount_amount = vendor_payout_amount + platform_net_amount (shipping excluded, see ecommerce-settlement-calculator.ts).';
COMMENT ON TABLE ecommerce_settlement_batches IS
  'One row per vendor per settlement run. total_vendor_payout_amount is what actually gets paid out via a single RazorpayX payout, funded by pooling platform_net_amount (which can be negative per-order) across all orders in the batch.';
