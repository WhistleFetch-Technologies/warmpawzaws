-- ============================================================================
-- MIGRATION 1132: Vendor legal acceptances (T&Cs + Privacy + Onboarding agreement)
-- ============================================================================
-- Once-per-vendor-identity (per policy_version) audit record for internal history.
-- Captured at vendor onboarding submit when the vendor checks the agreement box.
-- Additive / idempotent only.
-- ============================================================================

CREATE TABLE IF NOT EXISTS vendor_legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_identity_id UUID NOT NULL REFERENCES vendor_identity(id) ON DELETE CASCADE,
  application_id UUID NULL REFERENCES vendor_onboarding_applications(id) ON DELETE SET NULL,
  policy_version TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'vendor_onboarding',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  CONSTRAINT uq_vendor_legal_acceptances_identity_version UNIQUE (vendor_identity_id, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_vendor_legal_acceptances_vendor_identity_id
  ON vendor_legal_acceptances (vendor_identity_id);

CREATE INDEX IF NOT EXISTS idx_vendor_legal_acceptances_application_id
  ON vendor_legal_acceptances (application_id)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_legal_acceptances_accepted_at
  ON vendor_legal_acceptances (accepted_at DESC);

COMMENT ON TABLE vendor_legal_acceptances IS
  'Vendor platform legal acceptance audit; one row per vendor_identity per policy_version';
COMMENT ON COLUMN vendor_legal_acceptances.policy_version IS
  'Version key for the vendor legal bundle (e.g. vendor_tos_privacy_onboarding_v1)';
COMMENT ON COLUMN vendor_legal_acceptances.source IS
  'UI/surface where acceptance was captured (e.g. vendor_onboarding)';
COMMENT ON COLUMN vendor_legal_acceptances.application_id IS
  'Optional link to the onboarding application that recorded this acceptance';
