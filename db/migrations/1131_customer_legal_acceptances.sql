-- ============================================================================
-- MIGRATION 1131: Customer legal acceptances (T&Cs + Privacy)
-- ============================================================================
-- Once-per-customer (per policy_version) record so the team has acceptance history.
-- First used by Warmpawz Pay Bill before Razorpay; reusable for other gates.
-- Additive / idempotent only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  policy_version TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'warmpawz_pay',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  CONSTRAINT uq_customer_legal_acceptances_customer_version UNIQUE (customer_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_customer_legal_acceptances_customer_id
  ON customer_legal_acceptances (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_legal_acceptances_accepted_at
  ON customer_legal_acceptances (accepted_at DESC);

COMMENT ON TABLE customer_legal_acceptances IS
  'Platform Customer Terms + Privacy Policy acceptance; one row per customer per policy_version';
COMMENT ON COLUMN customer_legal_acceptances.policy_version IS
  'Version key for the legal bundle (e.g. platform_tos_privacy_v1)';
COMMENT ON COLUMN customer_legal_acceptances.source IS
  'UI/surface where acceptance was captured (e.g. warmpawz_pay)';
