-- ============================================================================
-- Migration 1134: Short public description for insurance companies
-- Shown under the company name on the admin Catalogue and customer plan cards.
-- ============================================================================

ALTER TABLE insurance_companies ADD COLUMN IF NOT EXISTS description TEXT;
