-- ============================================================================
-- Migration 1131: Insurance vendor form templates
-- ============================================================================

CREATE TABLE IF NOT EXISTS insurance_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  company_id UUID NOT NULL REFERENCES insurance_companies(id),
  plan_id UUID,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  draft_schema JSONB NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  current_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT insurance_form_templates_status_chk CHECK (status IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_insurance_form_templates_vendor
  ON insurance_form_templates (vendor_id, company_id, status);

CREATE TABLE IF NOT EXISTS insurance_form_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES insurance_form_templates(id),
  version INT NOT NULL,
  schema JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by TEXT,
  CONSTRAINT insurance_form_template_versions_version_chk CHECK (version >= 1),
  CONSTRAINT insurance_form_template_versions_unique UNIQUE (template_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_insurance_applications_open_pet_plan
  ON insurance_applications (pet_id, plan_id)
  WHERE pet_id IS NOT NULL
    AND plan_id IS NOT NULL
    AND status NOT IN ('free_look_cancelled', 'dropped', 'cancelled');
