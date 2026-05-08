-- Ensure customer administration tables needed by admin "Open customer portal" and related UI.
-- Idempotent duplicate of DDL in 722_customer_admin_portal_and_rbac.sql (without the DO $$ RBAC block)
-- so databases that never applied 722 still get these relations on migrate:up.
--
-- Leading DO block: run-migration-all.js skips its PL/pgSQL wrapper when the file already contains
-- DO $$ — plain DDL must not be wrapped (CREATE inside that wrapper is unreliable).

DO $$
BEGIN
END $$;

CREATE TABLE IF NOT EXISTS customer_admin_portal_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_admin_portal_codes_customer_id
  ON customer_admin_portal_codes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_admin_portal_codes_expires
  ON customer_admin_portal_codes(expires_at);

COMMENT ON TABLE customer_admin_portal_codes IS 'Short-lived single-use codes for admin-open-customer-portal; consumed by /auth/customer-portal-session';

CREATE TABLE IF NOT EXISTS customer_deactivation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_deactivation_requests_status ON customer_deactivation_requests(status);

CREATE TABLE IF NOT EXISTS customer_compliance_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL DEFAULT 'other',
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  investigated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_compliance_issues_customer_id ON customer_compliance_issues(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_compliance_issues_status ON customer_compliance_issues(status);
