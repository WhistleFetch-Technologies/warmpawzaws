-- ============================================================================
-- ADMINS TABLE
-- ============================================================================
-- Table for storing admin user accounts
-- Used for admin authentication and authorization
-- ============================================================================

CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255), -- For email/password auth (optional)
  role VARCHAR(50) DEFAULT 'admin', -- admin, super-admin, support
  permissions JSONB DEFAULT '{}', -- Custom permissions per admin
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_phone ON admins(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role);
CREATE INDEX IF NOT EXISTS idx_admins_active ON admins(is_active);

-- Comments
COMMENT ON TABLE admins IS 'Admin user accounts for platform administration';
COMMENT ON COLUMN admins.phone IS 'Phone number for OTP-based admin login (optional)';
COMMENT ON COLUMN admins.email IS 'Email address for admin login (required)';
COMMENT ON COLUMN admins.role IS 'Admin role: admin, super-admin, support';
COMMENT ON COLUMN admins.permissions IS 'JSONB object with custom permissions';

-- ============================================================================
-- DEFAULT ADMIN USER (for UAT/Development)
-- ============================================================================
-- Insert default admin if not exists
INSERT INTO admins (phone, email, name, role, is_active)
VALUES ('9999999999', 'admin@warmpawz.app', 'System Admin', 'super-admin', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE ON admins TO lambda_user;
-- GRANT USAGE, SELECT ON SEQUENCE admins_id_seq TO lambda_user;
