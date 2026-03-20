-- ============================================================================
-- POPULAR_SEARCHES TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS popular_searches (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    search_count INTEGER DEFAULT 1,
    last_searched_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id)
);

-- ============================================================================
-- UNIQUE CONSTRAINTS
-- ============================================================================

ALTER TABLE popular_searches ADD CONSTRAINT popular_searches_query_key UNIQUE (query);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX popular_searches_pkey ON public.popular_searches USING btree (id);
CREATE UNIQUE INDEX popular_searches_query_key ON public.popular_searches USING btree (query);
CREATE INDEX idx_popular_searches_count ON public.popular_searches USING btree (search_count DESC);
CREATE INDEX idx_popular_searches_last_searched ON public.popular_searches USING btree (last_searched_at DESC);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE popular_searches IS 'Popular searches - maps from search_popular KV key';
COMMENT ON COLUMN popular_searches.query IS 'Search query (unique)';
COMMENT ON COLUMN popular_searches.search_count IS 'Number of times this query was searched';
COMMENT ON COLUMN popular_searches.last_searched_at IS 'When this query was last searched';
