-- Migration 513: Add service_style to diagnostic_tests (at_center / at_home)
-- Enables explicit "conduct test at center" vs "home collection" per test (e.g. X-ray at center only).

ALTER TABLE diagnostic_tests
ADD COLUMN IF NOT EXISTS service_style VARCHAR(20) DEFAULT 'at_center';

COMMENT ON COLUMN diagnostic_tests.service_style IS 'Where test is conducted: at_center (e.g. X-ray, imaging) or at_home (sample collection)';

CREATE INDEX IF NOT EXISTS idx_diagnostic_tests_service_style ON diagnostic_tests(service_style);
