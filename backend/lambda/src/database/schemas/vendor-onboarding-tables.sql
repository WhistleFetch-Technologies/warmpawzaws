-- ============================================================================
-- VENDOR ONBOARDING TABLES & FUNCTIONS
-- ============================================================================
-- Essential tables for the vendor onboarding flow
-- Run this migration to ensure all onboarding tables exist
-- ============================================================================

-- ============================================
-- VENDOR IDENTITY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  selected_role_id UUID REFERENCES roles(id),
  vendor_type VARCHAR(50), -- 'solo' or 'center'
  onboarding_status VARCHAR(50) DEFAULT 'ROLE_PENDING',
  application_id UUID,
  vendor_id UUID REFERENCES vendors(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_identity_phone ON vendor_identity(phone);
CREATE INDEX IF NOT EXISTS idx_vendor_identity_status ON vendor_identity(onboarding_status);

-- ============================================
-- VENDOR ONBOARDING APPLICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS vendor_onboarding_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_identity_id UUID REFERENCES vendor_identity(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id),
  vendor_type VARCHAR(50),
  application_payload JSONB DEFAULT '{}',
  uploaded_documents JSONB DEFAULT '[]',
  form_version INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CLARIFICATION_REQUIRED
  submitted_at TIMESTAMP,
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  admin_comments TEXT,
  rejection_reason TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voa_vendor_identity ON vendor_onboarding_applications(vendor_identity_id);
CREATE INDEX IF NOT EXISTS idx_voa_status ON vendor_onboarding_applications(status);
CREATE INDEX IF NOT EXISTS idx_voa_submitted_at ON vendor_onboarding_applications(submitted_at);

-- ============================================
-- ONBOARDING FORMS TABLE (Dynamic forms per role)
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id VARCHAR(100) NOT NULL,
  vendor_type VARCHAR(50) DEFAULT 'center',
  fields JSONB DEFAULT '[]',
  sections JSONB DEFAULT '[]',
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'published', -- draft, published
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(role_id, vendor_type)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_forms_role ON onboarding_forms(role_id);

-- ============================================
-- TRANSITION FUNCTION (Optional - for state machine)
-- ============================================
CREATE OR REPLACE FUNCTION transition_onboarding_status(
  p_identity_id UUID,
  p_new_status VARCHAR,
  p_admin_id UUID DEFAULT NULL,
  p_actor_type VARCHAR DEFAULT 'vendor',
  p_action VARCHAR DEFAULT 'update',
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status VARCHAR;
BEGIN
  -- Get current status
  SELECT onboarding_status INTO v_current_status
  FROM vendor_identity
  WHERE id = p_identity_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vendor identity not found';
  END IF;
  
  -- Update the status
  UPDATE vendor_identity
  SET onboarding_status = p_new_status,
      updated_at = NOW()
  WHERE id = p_identity_id;
  
  -- Log the transition (optional)
  -- INSERT INTO onboarding_status_log (vendor_identity_id, old_status, new_status, actor_type, actor_id, action, metadata)
  -- VALUES (p_identity_id, v_current_status, p_new_status, p_actor_type, p_admin_id, p_action, p_metadata);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE CONSTRAINTS (add if not exists)
-- ============================================
DO $$
BEGIN
  -- Add foreign key from vendor_identity.application_id to vendor_onboarding_applications if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_vendor_identity_application'
  ) THEN
    ALTER TABLE vendor_identity
    ADD CONSTRAINT fk_vendor_identity_application
    FOREIGN KEY (application_id) REFERENCES vendor_onboarding_applications(id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore errors (constraint might already exist with different name)
  NULL;
END $$;

-- ============================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================
-- GRANT SELECT, INSERT, UPDATE ON vendor_identity TO lambda_user;
-- GRANT SELECT, INSERT, UPDATE ON vendor_onboarding_applications TO lambda_user;
-- GRANT SELECT, INSERT, UPDATE ON onboarding_forms TO lambda_user;

COMMENT ON TABLE vendor_identity IS 'Tracks vendor phone numbers and their onboarding status';
COMMENT ON TABLE vendor_onboarding_applications IS 'Stores vendor application data for admin review';
COMMENT ON TABLE onboarding_forms IS 'Dynamic form configurations per role';
