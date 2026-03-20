-- ============================================================================
-- SEARCH_ANALYTICS TABLE - SCHEMA
-- ============================================================================
-- Extracted from production RDS database
-- ============================================================================

-- ============================================================================
-- TABLE DEFINITION
-- ============================================================================

CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    search_date DATE NOT NULL,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    zero_results BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT unique_search_analytics_date_query UNIQUE (search_date, query)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE UNIQUE INDEX search_analytics_pkey ON public.search_analytics USING btree (id);
CREATE UNIQUE INDEX unique_search_analytics_date_query ON public.search_analytics USING btree (search_date, query);
CREATE INDEX idx_search_analytics_date ON public.search_analytics USING btree (search_date);
CREATE INDEX idx_search_analytics_zero_results ON public.search_analytics USING btree (zero_results) WHERE zero_results = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE search_analytics IS 'Search analytics - maps from search-analytics KV key';
COMMENT ON COLUMN search_analytics.search_date IS 'Date of search';
COMMENT ON COLUMN search_analytics.query IS 'Search query';
COMMENT ON COLUMN search_analytics.results_count IS 'Number of results returned';
COMMENT ON COLUMN search_analytics.zero_results IS 'Whether search returned zero results';
