-- ============================================================================
-- Migration 1130: Insurance company plans and platform settings
-- ============================================================================
-- Plan catalogue lives in insurance_company_plans so it does not collide with
-- the legacy dev-only insurance_plans table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_company_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES insurance_companies(id),
  name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  premium_from NUMERIC(12, 2) NOT NULL,
  premium_unit TEXT NOT NULL,
  cover_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  sum_insured_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  copay_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INT NOT NULL DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_company_plans_highlights_chk CHECK (jsonb_array_length(highlights) <= 3),
  CONSTRAINT insurance_company_plans_premium_chk CHECK (premium_from >= 0),
  CONSTRAINT insurance_company_plans_unit_chk CHECK (premium_unit IN ('month', 'year')),
  CONSTRAINT insurance_company_plans_status_chk CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_insurance_company_plans_company
  ON insurance_company_plans (company_id, status, sort_order);

INSERT INTO admin_settings (setting_category, setting_key, setting_value, description, is_active)
VALUES
  (
    'insurance',
    'insurance_auto_confirm_days',
    '7'::jsonb,
    'Days after policy upload before the customer confirmation is applied automatically.',
    true
  ),
  (
    'insurance',
    'insurance_chat_open_while_active',
    'true'::jsonb,
    'Keep the consultation chat open while the insurance application is not terminal.',
    true
  ),
  (
    'insurance',
    'insurance_payment_link_expiry_hours_default',
    '72'::jsonb,
    'Default hours until an insurer payment link expires.',
    true
  )
ON CONFLICT (setting_category, setting_key) DO NOTHING;
