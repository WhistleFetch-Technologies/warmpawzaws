-- One-time codes for admin "Open vendor portal" bootstrap (exchange at POST /auth/vendor-portal-session).
CREATE TABLE IF NOT EXISTS vendor_admin_portal_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_admin_portal_codes_vendor_id
  ON vendor_admin_portal_codes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_admin_portal_codes_expires
  ON vendor_admin_portal_codes(expires_at);

COMMENT ON TABLE vendor_admin_portal_codes IS 'Short-lived single-use codes for admin-open-vendor-portal; consumed by /auth/vendor-portal-session';
