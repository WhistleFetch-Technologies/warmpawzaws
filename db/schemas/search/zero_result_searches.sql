-- ============================================================================
-- ZERO_RESULT_SEARCHES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS zero_result_searches (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    last_searched_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX zero_result_searches_pkey ON public.zero_result_searches USING btree (id);
CREATE INDEX idx_zero_result_searches_query ON public.zero_result_searches USING btree (query);
CREATE INDEX idx_zero_result_searches_count ON public.zero_result_searches USING btree (search_count DESC);
CREATE INDEX idx_zero_result_searches_last_searched ON public.zero_result_searches USING btree (last_searched_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE zero_result_searches IS 'Zero result searches - maps from search_zero_results KV key';
COMMENT ON COLUMN zero_result_searches.query IS 'Search query that returned zero results';
COMMENT ON COLUMN zero_result_searches.search_count IS 'Number of times this query returned zero results';
COMMENT ON COLUMN zero_result_searches.last_searched_at IS 'When this query was last searched';
