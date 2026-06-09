-- ============================================================================
-- MIGRATION 1029: SEARCH TAXONOMY KEYWORDS (Phase 1)
-- ============================================================================
-- Single-table keyword → category discovery. Data loaded via
-- scripts/import-search-taxonomy-spreadsheet.js (not seeded here).
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_taxonomy_keywords (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug           TEXT NOT NULL,
  category_display_name   TEXT NOT NULL,
  subcategory             TEXT,
  keyword                 TEXT NOT NULL,
  keyword_normalized      TEXT NOT NULL,
  hub_slug                TEXT NOT NULL,
  weight                  INTEGER NOT NULL DEFAULT 100,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_search_taxonomy_keywords_hub_phrase
  ON search_taxonomy_keywords (hub_slug, keyword_normalized);

CREATE INDEX IF NOT EXISTS idx_search_taxonomy_keywords_active_hub
  ON search_taxonomy_keywords (hub_slug)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_search_taxonomy_keywords_category_slug
  ON search_taxonomy_keywords (category_slug)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_search_taxonomy_keywords_keyword_normalized
  ON search_taxonomy_keywords (keyword_normalized)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_search_taxonomy_keywords_updated_at
  ON search_taxonomy_keywords (updated_at DESC);

COMMENT ON TABLE search_taxonomy_keywords IS
  'Customer search taxonomy: spreadsheet keywords mapped to hub_slug at import time.';
COMMENT ON COLUMN search_taxonomy_keywords.category_slug IS
  'Stable slug derived from Category column; used for logic and dedupe.';
COMMENT ON COLUMN search_taxonomy_keywords.category_display_name IS
  'Human-readable category label from spreadsheet; safe to rename in UI copy imports.';
COMMENT ON COLUMN search_taxonomy_keywords.hub_slug IS
  'Discovery hub slug (vet, grooming, shop, …); set by import script, not spreadsheet.';
