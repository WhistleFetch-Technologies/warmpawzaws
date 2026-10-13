-- ============================================================================
-- Migration 1132: Chat cards and insurance form submissions
-- ============================================================================

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS metadata JSONB;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_message_type_check
  CHECK (message_type IS NULL OR message_type IN ('text', 'image', 'file', 'location', 'card'));

ALTER TABLE insurance_applications ADD COLUMN IF NOT EXISTS template_version_id UUID;

CREATE TABLE IF NOT EXISTS insurance_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES insurance_applications(id),
  template_version_id UUID NOT NULL REFERENCES insurance_form_template_versions(id),
  revision INT NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  prefilled_slugs TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  consent_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  change_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT insurance_form_submissions_revision_chk CHECK (revision >= 1),
  CONSTRAINT insurance_form_submissions_status_chk
    CHECK (status IN ('submitted', 'changes_requested', 'confirmed', 'superseded')),
  CONSTRAINT insurance_form_submissions_unique UNIQUE (application_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_insurance_form_submissions_application
  ON insurance_form_submissions (application_id, revision DESC);
