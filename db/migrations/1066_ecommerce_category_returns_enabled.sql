-- ============================================================================
-- MIGRATION 1066: Ecommerce category returns_enabled flag
-- ============================================================================
-- Purpose: Allow returns only for categories explicitly marked returns_enabled.
-- Seed: Pet Clothing only (configurable via admin category management).
-- ============================================================================

ALTER TABLE ecommerce_categories
  ADD COLUMN IF NOT EXISTS returns_enabled BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN ecommerce_categories.returns_enabled IS
  'When true, delivered products in this category may be returned within the return window';

UPDATE ecommerce_categories
SET returns_enabled = true
WHERE name ILIKE 'Pet Clothing%';
